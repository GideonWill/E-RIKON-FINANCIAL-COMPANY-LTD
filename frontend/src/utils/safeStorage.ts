const memoryStore = new Map<string, string>();

/**
 * Safe LocalStorage wrapper for cross-device & mobile browser resilience.
 * Prevents QuotaExceededError and SecurityError in iOS Safari Private Mode,
 * Android WebViews, and restricted privacy environments.
 */
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      // Fall through to memoryStore
    }
    return memoryStore.get(key) ?? null;
  },

  setItem: (key: string, value: string): void => {
    memoryStore.set(key, value);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      // Handled by memoryStore
    }
  },

  removeItem: (key: string): void => {
    memoryStore.delete(key);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {}
  },

  clear: (): void => {
    memoryStore.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (e) {}
  },
};

