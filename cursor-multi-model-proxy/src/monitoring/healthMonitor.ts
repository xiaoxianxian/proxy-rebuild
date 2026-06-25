import { CircuitBreaker } from './circuitBreaker.js';
import type { ProviderConfig } from '../providers/base.js';

export class HealthMonitor {
  private statuses = new Map<string, { state: string; lastChecked: number; error?: string }>();
  private readonly interval = 30000; // 每 30s 检查一次
  private timer: NodeJS.Timeout | null = null;

  start(configs: ProviderConfig[]): void {
    this.updateStatuses(configs);
    this.timer = setInterval(() => this.updateStatuses(configs), this.interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus(providerId: string): { state: string; lastChecked: number } | undefined {
    return this.statuses.get(providerId);
  }

  getAllStatuses(): Record<string, { state: string; lastChecked: number }> {
    const result: Record<string, { state: string; lastChecked: number }> = {};
    for (const [id, status] of this.statuses) {
      result[id] = { state: status.state, lastChecked: status.lastChecked };
    }
    return result;
  }

  private updateStatuses(configs: ProviderConfig[]): void {
    for (const config of configs) {
      this.statuses.set(config.id, {
        state: 'healthy',
        lastChecked: Date.now(),
      });
    }
  }
}
