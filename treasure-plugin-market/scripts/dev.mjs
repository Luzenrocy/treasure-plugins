/**
 * 本地调试一键启动：同时运行后端 Node API（7860）与 Vite 前端（5174）。
 * 任一端退出都会终止整个会话；Ctrl+C 一并回收两个子进程。
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const children = [];
let shuttingDown = false;

function run(name, command, args) {
  const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  children.push(child);
  child.on('exit', (code) => {
    console.log(`[dev] ${name} 已退出（code=${code}）`);
    shutdown(code ?? 1);
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

console.log('[dev] 启动 treasure-plugin-market 本地调试…');
console.log('[dev]   API: http://127.0.0.1:7860   Web: http://127.0.0.1:5174（/api 代理到 7860）');
run('api', 'npm', ['run', 'dev:api']);
run('web', 'npm', ['run', 'dev:web']);