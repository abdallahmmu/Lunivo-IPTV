import { Injectable, inject } from '@angular/core';
import { CacheEntry } from '../models/common.models';
import { StorageService } from './storage.service';

const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * In-memory TTL cache for API responses (categories/streams/EPG/etc).
 * Backed by a Map so it survives navigation within the SPA session but
 * resets on full page reload — appropriate for catalogs that can be
 * tens of MB (see §17/§18: never persist those to localStorage).
 * Callers that want small, safe payloads (categories) to survive a reload
 * can opt in with `persist: true`.
 */
@Injectable({ providedIn: 'root' })
export class CacheService {
  private readonly storage = inject(StorageService);
  private readonly memory = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string, persist = false): T | null {
    const inMemory = this.memory.get(key) as CacheEntry<T> | undefined;
    if (inMemory && inMemory.expiresAt > Date.now()) {
      return inMemory.value;
    }
    if (persist) {
      const stored = this.storage.get<CacheEntry<T>>(`cache:${key}`);
      if (stored && stored.expiresAt > Date.now()) {
        this.memory.set(key, stored);
        return stored.value;
      }
    }
    return null;
  }

  set<T>(key: string, value: T, options?: { ttlMs?: number; persist?: boolean }): void {
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + (options?.ttlMs ?? DEFAULT_TTL_MS) };
    this.memory.set(key, entry);
    if (options?.persist) {
      this.storage.set(`cache:${key}`, entry);
    }
  }

  invalidate(prefix: string): void {
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }
  }

  clear(): void {
    this.memory.clear();
  }
}
