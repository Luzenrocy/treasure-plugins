import { randomUUID } from 'node:crypto';
import * as mysql from 'mysql2/promise';
import type { Pool, RowDataPacket } from 'mysql2/promise';

type Operation = 'select' | 'insert' | 'update' | 'delete' | 'upsert';
type Filter = { kind: 'eq' | 'is' | 'gt' | 'lt' | 'in' | 'or'; column: string; value: unknown };

const jsonColumns = ['categories', 'permissions', 'manifest_json', 'metadata'];
const idTables = ['users', 'plugins', 'plugin_releases', 'developer_tokens', 'audit_logs'];
const quote = (identifier: string) => `\`${identifier.replace(/`/g, '``')}\``;
const has = (values: string[], value: string) => values.indexOf(value) !== -1;
const unique = <T>(values: T[]) => values.filter((value, index) => values.indexOf(value) === index);

function toDatabaseValue(column: string, value: unknown) {
  // MySQL DATETIME/TIMESTAMP does not consistently accept the JavaScript ISO `T...Z`
  // form. Repositories use ISO strings, so convert them at the driver boundary.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    return value.replace('T', ' ').replace('Z', '');
  }
  return has(jsonColumns, column) && value !== null && value !== undefined && typeof value !== 'string'
    ? JSON.stringify(value)
    : value;
}

function normalize(row: Record<string, any>) {
  for (const key of Object.keys(row)) {
    if (has(jsonColumns, key) && typeof row[key] === 'string') {
      try { row[key] = JSON.parse(row[key]); } catch { /* keep invalid legacy JSON visible */ }
    }
    if (row[key] instanceof Date) row[key] = row[key].toISOString();
  }
  // 仅为 MySQL 复现部分唯一索引而存在，不属于应用数据模型。
  delete row.active_plugin_code;
  delete row.active_version;
  return row;
}

function splitFields(fields: string) {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < fields.length; index++) {
    if (fields[index] === '(') depth++;
    if (fields[index] === ')') depth--;
    if (fields[index] === ',' && depth === 0) { result.push(fields.slice(start, index).trim()); start = index + 1; }
  }
  result.push(fields.slice(start).trim());
  return result.filter(Boolean);
}

function project(row: Record<string, any> | null, fields: string): Record<string, any> | null {
  if (!row || fields.trim() === '*') return row;
  const output: Record<string, any> = {};
  for (const field of splitFields(fields)) {
    if (field === '*') {
      Object.assign(output, row);
      continue;
    }
    const nested = field.match(/^([\w]+)(?:![\w]+)?\(([\s\S]*)\)$/);
    if (nested) {
      const [, relation, nestedFields] = nested;
      if (Array.isArray(row[relation])) output[relation] = row[relation].map((item) => project(item, nestedFields));
      else output[relation] = project(row[relation], nestedFields);
    } else if (field in row) output[field] = row[field];
  }
  return output;
}

/** A small PostgREST-shaped adapter so the existing repository code runs unchanged on MySQL. */
class MysqlQuery implements PromiseLike<any> {
  private operation: Operation = 'select';
  private fields = '*';
  private payload: Record<string, unknown> | Record<string, unknown>[] | undefined;
  private filters: Filter[] = [];
  private orderBy?: { column: string; ascending: boolean };
  private rowLimit?: number;
  private one = false;
  private countOnly = false;

  constructor(private readonly pool: Pool, private readonly table: string) {}

  select(fields = '*', options?: { count?: string; head?: boolean }) {
    this.fields = fields;
    this.operation = this.operation === 'select' ? 'select' : this.operation;
    this.countOnly = options?.count === 'exact' && options?.head === true;
    return this;
  }
  insert(payload: Record<string, unknown> | Record<string, unknown>[]) { this.operation = 'insert'; this.payload = payload; return this; }
  update(payload: Record<string, unknown>) { this.operation = 'update'; this.payload = payload; return this; }
  delete() { this.operation = 'delete'; return this; }
  upsert(payload: Record<string, unknown>, _options?: { onConflict?: string }) { this.operation = 'upsert'; this.payload = payload; return this; }
  eq(column: string, value: unknown) { this.filters.push({ kind: 'eq', column, value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ kind: 'is', column, value }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ kind: 'gt', column, value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ kind: 'lt', column, value }); return this; }
  in(column: string, values: unknown[]) { this.filters.push({ kind: 'in', column, value: values }); return this; }
  or(expression: string) { this.filters.push({ kind: 'or', column: '', value: expression }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orderBy = { column, ascending: options?.ascending !== false }; return this; }
  limit(value: number) { this.rowLimit = value; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }

  then<TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private where(alias = '') {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const prefix = alias ? `${quote(alias)}.` : '';
    for (const filter of this.filters) {
      if (filter.kind === 'or') {
        const entries = String(filter.value).split(',').map((part) => part.trim().match(/^([\w]+)\.eq\.(.*)$/)).filter(Boolean) as RegExpMatchArray[];
        if (entries.length) {
          clauses.push(`(${entries.map(([_, column]) => `${prefix}${quote(column)} = ?`).join(' OR ')})`);
          values.push(...entries.map(([, , value]) => value));
        }
        continue;
      }
      const [relation, column] = filter.column.split('.', 2);
      if (column) {
        // Relationship predicates only occur for plugin_releases -> plugins in current repositories.
        if (relation === 'plugins') {
          const operator = filter.kind === 'eq' ? '=' : filter.kind === 'is' ? (filter.value === null ? 'IS' : '=') : filter.kind === 'gt' ? '>' : '<';
          clauses.push(`${quote('p')}.${quote(column)} ${operator} ${filter.value === null ? 'NULL' : '?'}`);
          if (filter.value !== null) values.push(toDatabaseValue(column, filter.value));
        }
        continue;
      }
      const qualified = `${prefix}${quote(relation)}`;
      if (filter.kind === 'is') {
        clauses.push(`${qualified} ${filter.value === null ? 'IS NULL' : 'IS NOT NULL'}`);
      } else if (filter.kind === 'in') {
        const list = Array.isArray(filter.value) ? filter.value : [];
        clauses.push(list.length ? `${qualified} IN (${list.map(() => '?').join(', ')})` : 'FALSE');
        values.push(...list.map((value) => toDatabaseValue(relation, value)));
      } else {
        clauses.push(`${qualified} ${filter.kind === 'eq' ? '=' : filter.kind === 'gt' ? '>' : '<'} ?`);
        values.push(toDatabaseValue(relation, filter.value));
      }
    }
    return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values };
  }

  private async attachRelations(rows: Record<string, any>[]) {
    if (!rows.length) return rows;
    if (this.table === 'plugins' && this.fields.includes('plugin_releases(')) {
      const ids = rows.map((row) => row.id).filter(Boolean);
      if (!ids.length) return rows;
      const [releases] = await this.pool.query<RowDataPacket[]>(`SELECT * FROM plugin_releases WHERE plugin_id IN (${ids.map(() => '?').join(', ')})`, ids);
      const byPlugin = new Map<string, Record<string, any>[]>();
      for (const release of releases.map(normalize)) {
        const list = byPlugin.get(release.plugin_id) ?? [];
        list.push(release); byPlugin.set(release.plugin_id, list);
      }
      for (const row of rows) row.plugin_releases = byPlugin.get(row.id) ?? [];
    }
    if (this.table === 'plugin_releases' && this.fields.includes('plugins')) {
      const ids = unique(rows.map((row) => row.plugin_id).filter(Boolean));
      if (ids.length) {
        const [plugins] = await this.pool.query<RowDataPacket[]>(`SELECT * FROM plugins WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
        const byId = new Map(plugins.map(normalize).map((plugin) => [plugin.id, plugin]));
        for (const row of rows) row.plugins = byId.get(row.plugin_id) ?? null;
      }
    }
    if (this.table === 'users' && this.fields.includes('user_settings(')) {
      const ids = rows.map((row) => row.id);
      const [settings] = await this.pool.query<RowDataPacket[]>(`SELECT * FROM user_settings WHERE user_id IN (${ids.map(() => '?').join(', ')})`, ids);
      const byUser = new Map(settings.map(normalize).map((setting) => [setting.user_id, setting]));
      for (const row of rows) row.user_settings = byUser.get(row.id) ?? null;
    }
    return rows;
  }

  private async selectRows() {
    const joinsPlugins = this.table === 'plugin_releases' && this.filters.some((filter) => filter.column.startsWith('plugins.'));
    const { sql, values } = this.where();
    const join = joinsPlugins ? ' INNER JOIN plugins p ON p.id = plugin_releases.plugin_id' : '';
    if (this.countOnly) {
      const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM ${quote(this.table)}${join}${sql}`, values);
      return { data: null, error: null, count: Number(rows[0]?.count ?? 0) };
    }
    const order = this.orderBy ? ` ORDER BY ${quote(this.orderBy.column)} ${this.orderBy.ascending ? 'ASC' : 'DESC'}` : '';
    const limit = this.rowLimit === undefined ? '' : ` LIMIT ${Math.max(0, this.rowLimit)}`;
    const [result] = await this.pool.query<RowDataPacket[]>(`SELECT ${quote(this.table)}.* FROM ${quote(this.table)}${join}${sql}${order}${limit}`, values);
    const rows = await this.attachRelations(result.map((row) => normalize({ ...row })));
    const data = rows.map((row) => project(row, this.fields)!);
    return { data: this.one ? data[0] ?? null : data, error: null, count: null };
  }

  private async execute() {
    try {
      if (this.operation === 'select') return await this.selectRows();
      if (this.operation === 'insert') {
        const inputs = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((input) => {
          const row = { ...input } as Record<string, unknown>;
          if (has(idTables, this.table) && !row.id) row.id = randomUUID();
          return row;
        });
        const keys = unique(inputs.reduce<string[]>((all, row) => all.concat(Object.keys(row)), []));
        const values = inputs.flatMap((row) => keys.map((key) => toDatabaseValue(key, row[key] ?? null)));
        await this.pool.query(`INSERT INTO ${quote(this.table)} (${keys.map(quote).join(', ')}) VALUES ${inputs.map(() => `(${keys.map(() => '?').join(', ')})`).join(', ')}`, values);
        const rows = inputs.map((row) => project(normalize({ ...row }), this.fields)!);
        return { data: this.one ? rows[0] ?? null : rows, error: null, count: null };
      }
      if (this.operation === 'upsert') {
        const row = { ...this.payload! } as Record<string, unknown>;
        const keys = Object.keys(row);
        const values = keys.map((key) => toDatabaseValue(key, row[key]));
        const updates = keys.filter((key) => key !== 'user_id').map((key) => `${quote(key)} = VALUES(${quote(key)})`).join(', ');
        await this.pool.query(`INSERT INTO ${quote(this.table)} (${keys.map(quote).join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${updates}`, values);
        const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT * FROM ${quote(this.table)} WHERE user_id = ?`, [row.user_id]);
        return { data: normalize({ ...rows[0] }), error: null, count: null };
      }
      const { sql, values } = this.where();
      if (this.operation === 'update') {
        const entries = Object.entries(this.payload ?? {});
        const set = entries.map(([key]) => `${quote(key)} = ?`).join(', ');
        await this.pool.query(`UPDATE ${quote(this.table)} SET ${set}${sql}`, [...entries.map(([key, value]) => toDatabaseValue(key, value)), ...values]);
      } else {
        await this.pool.query(`DELETE FROM ${quote(this.table)}${sql}`, values);
      }
      // PostgREST returns affected rows when a trailing select() is present. Re-querying also preserves callers' expectations.
      const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT * FROM ${quote(this.table)}${sql}`, values);
      const data = rows.map((row) => normalize({ ...row }));
      return { data: this.one ? data[0] ?? null : data, error: null, count: null };
    } catch (error) {
      return { data: null, error, count: null };
    }
  }
}

export function createMysqlClient() {
  const url = process.env.MYSQL_URL;
  if (!url) throw new Error('MYSQL_URL 未配置（例如 mysql://user:password@host:3306/database）');
  const pool = mysql.createPool({ uri: url, waitForConnections: true, connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT ?? 10), timezone: 'Z' });
  return {
    from(table: string) { return new MysqlQuery(pool, table); },
    async health() { await pool.query('SELECT 1'); },
  };
}
