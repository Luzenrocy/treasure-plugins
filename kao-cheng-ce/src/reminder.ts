/**
 * 到期任务提醒检查器
 *
 * 在指定时间（默认 09:30 和 17:30）查询即将到期的任务，
 * 通过系统通知提醒用户。
 *
 * 运行机制：
 *   - 启动后每 60 秒检查一次当前时间是否匹配提醒时间
 *   - 匹配时查询数据库，获取未来 N 天内到期的未完成任务
 *   - 有到期任务则发送系统通知
 *   - 每个提醒时间槽每天只触发一次
 *
 * @packageDocumentation
 */

import { getTreasure } from '@treasure/sdk';

/** 提醒配置 */
interface ReminderSettings {
  /** 提醒总开关 */
  enabled: boolean;
  /** 提醒时间列表，如 ["09:30", "17:30"] */
  times: string[];
  /** 提前提醒天数 */
  daysBefore: number;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  times: ['09:30', '17:30'],
  daysBefore: 3,
};

/**
 * 提醒检查器
 *
 * @example
 * ```typescript
 * const checker = new ReminderChecker();
 * checker.start();
 * ```
 */
export class ReminderChecker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private settings: ReminderSettings = { ...DEFAULT_SETTINGS };
  /**
   * 已触发的提醒时间槽集合
   * 格式："YYYY-MM-DD HH:MM"，用于防止同一时间槽重复提醒
   */
  private triggeredSlots = new Set<string>();

  /**
   * 启动提醒检查器
   *
   * 在 app.mount() 之后调用。启动后立即执行一次检查，
   * 然后每 60 秒轮询。
   */
  async start(): Promise<void> {
    await this.loadSettings();
    this.startTimer();
    // 启动时立即检查一次，避免等到下一个间隔
    this.check();
  }

  /**
   * 停止提醒检查器，清理计时器
   *
   * 在插件卸载时调用，防止内存泄漏。
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ── 私有方法 ──────────────────────────────────────────

  /** 从宿主设置中读取用户配置 */
  private async loadSettings(): Promise<void> {
    try {
      const bridge = getTreasure();
      const all = await bridge.getSettings();
      if (all.code !== 1 || !all.data) return;

      const map = new Map(
        (all.data as any[]).map((s: any) => [s.param_key, s.param_value])
      );

      this.settings.enabled = map.get('reminder_enabled') !== '0';

      const timesRaw = map.get('reminder_times') || '09:30,17:30';
      if (Array.isArray(timesRaw)) {
        this.settings.times = timesRaw.map((t: any) => String(t)).filter(Boolean);
      } else if (typeof timesRaw === 'string' && timesRaw.startsWith('[')) {
        try {
          this.settings.times = JSON.parse(timesRaw).map((t: any) => String(t)).filter(Boolean);
        } catch {
          this.settings.times = timesRaw
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean);
        }
      } else {
        this.settings.times = timesRaw
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
      }

      this.settings.daysBefore = Math.max(0, Number(map.get('reminder_days_before')) || 3);
    } catch {
      // 读取失败时使用默认值
    }
  }

  /** 启动定时器，每 60 秒检查一次 */
  private startTimer(): void {
    this.timer = setInterval(() => this.check(), 60_000);
  }

  /** 检查当前时间是否匹配提醒时间 */
  private check(): void {
    if (!this.settings.enabled) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 找出当前时间匹配的提醒时间槽
    const matchedTime = this.settings.times.find((time) => {
      const [h, m] = time.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return false;
      const targetMinutes = h * 60 + m;
      return Math.abs(currentMinutes - targetMinutes) <= 1;
    });

    // 没有匹配的时间槽，跳过
    if (!matchedTime) return;

    // 构建时间槽标识：YYYY-MM-DD HH:MM
    const slotKey = this.formatSlotKey(now, matchedTime);

    // 该时间槽今天已触发过，跳过
    if (this.triggeredSlots.has(slotKey)) return;

    this.doRemind(slotKey);
  }

  /** 执行提醒：查询到期任务 → 发送通知 */
  private async doRemind(slotKey: string): Promise<void> {
    try {
      const bridge = getTreasure();
      const tasks = await this.queryExpiringTasks();

      // 标记该时间槽已触发（无论有无到期任务，避免空轮询）
      this.triggeredSlots.add(slotKey);

      if (tasks.length === 0) return;

      // 发送系统通知
      const title = '考成策 - 任务到期提醒';
      const body = this.formatReminderBody(tasks);

      await bridge.sendNotification?.(title, body);
    } catch {
      // 静默失败，不影响主流程
    }
  }

  /** 查询即将到期的任务 */
  private async queryExpiringTasks(): Promise<Array<{ title: string; due_date: string }>> {
    const bridge = getTreasure();
    const days = this.settings.daysBefore;

    const sql = `
      SELECT id, title, due_date
      FROM tasks
      WHERE due_date IS NOT NULL
        AND is_deleted = 0
        AND status NOT IN ('done', 'cancelled')
        AND DATE(due_date) BETWEEN DATE('now', 'localtime')
                               AND DATE('now', 'localtime', '+${days} days')
      ORDER BY due_date ASC
    `;

    const res = await bridge.query(sql, ['tasks']);
    if (res.code !== 1 || !res.data) return [];
    return res.data.map((r: any) => ({ title: r.title, due_date: r.due_date }));
  }

  /** 格式化通知体 */
  private formatReminderBody(tasks: Array<{ title: string; due_date: string }>): string {
    if (tasks.length === 1) {
      return `1 个任务即将到期：${tasks[0].title}`;
    }
    return `${tasks.length} 个任务即将到期，请及时处理`;
  }

  /** 构建时间槽标识：YYYY-MM-DD HH:MM */
  private formatSlotKey(date: Date, time: string): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d} ${time}`;
  }
}