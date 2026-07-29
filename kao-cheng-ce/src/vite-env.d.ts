/// <reference types="vite/client" />

declare module '*.svg?component' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, {}, any>;
  export default component;
}

interface Window {
  __TREASURE_HOST__?: boolean;
}

declare module 'sql.js' {
  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }
  interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, any>;
    free(): boolean;
  }
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  interface Database {
    run(sql: string, params?: any[]): Database;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  }
  const initSqlJs: (config?: any) => Promise<SqlJsStatic>;
  export default initSqlJs;
  export { Database, SqlJsStatic, Statement };
}