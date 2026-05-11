import '@testing-library/jest-dom/vitest';

// Bun's runtime injects a degraded `localStorage` (`{}` with null prototype, no
// Storage methods) that shadows jsdom's. Detect that and install a real
// in-memory Storage so tests can interact with `localStorage` like in a browser.
// `sessionStorage` is unaffected — jsdom's implementation wins there.
if (
  typeof localStorage === 'undefined' ||
  typeof (localStorage as Storage).getItem !== 'function'
) {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length(): number {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.has(key) ? (this.store.get(key) as string) : null;
    }
    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      this.store.set(key, String(value));
    }
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}
