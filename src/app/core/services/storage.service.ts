import { Injectable } from '@angular/core';

const PREFIX = 'iptv:';

/**
 * Thin, safe wrapper around localStorage/sessionStorage.
 * All app persistence goes through here so storage failures (private mode,
 * quota, disabled storage) never crash a feature.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string, session = false): T | null {
    try {
      const raw = this.backend(session).getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T, session = false): void {
    try {
      this.backend(session).setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage unavailable or full — silently no-op, feature degrades to in-memory only.
    }
  }

  remove(key: string, session = false): void {
    try {
      this.backend(session).removeItem(PREFIX + key);
    } catch {
      // ignore
    }
  }

  private backend(session: boolean): Storage {
    return session ? window.sessionStorage : window.localStorage;
  }
}
