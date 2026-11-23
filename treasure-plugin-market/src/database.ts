import { createMysqlClient } from './mysql.js';
import { supabase, supabaseService } from './supabase.js';

export type DatabaseProvider = 'supabase' | 'mysql';
const configured = (process.env.DATABASE_PROVIDER ?? 'supabase').trim().toLowerCase();
if (configured !== 'supabase' && configured !== 'mysql') throw new Error('DATABASE_PROVIDER 只能是 supabase 或 mysql');
export const databaseProvider = configured as DatabaseProvider;

const mysql = databaseProvider === 'mysql' ? createMysqlClient() : null;
export const database: any = mysql ?? supabase;
// Supabase 的 auth_sessions 必须使用 service-role；MySQL 没有该权限层级，使用同一个连接池。
export const databaseService: any = mysql ?? supabaseService;

export async function checkDatabaseHealth() {
  if (databaseProvider === 'mysql') return mysql!.health();
  const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' }).limit(1);
  if (error) throw error;
}
