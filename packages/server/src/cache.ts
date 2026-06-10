/** Dead-simple per-key TTL cache for adapter results. Single-process, in-memory. */
export class TtlCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  get(key: string, now: number): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, ttlMs: number, now: number): void {
    this.store.set(key, { value, expiresAt: now + ttlMs });
  }
}
