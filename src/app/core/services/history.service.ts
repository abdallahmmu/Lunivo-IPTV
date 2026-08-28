import { Injectable, computed, inject, signal } from '@angular/core';
import { ContentKind } from '../models/common.models';
import { ContentRef, HistoryEntry } from '../models/library.models';
import { StorageService } from './storage.service';

const KEY = 'history';
const MAX_ENTRIES = 100;
/** Below this fraction of the way through, "continue watching" isn't worth showing. */
const MIN_PROGRESS_RATIO = 0.02;
/** Above this fraction, treat it as finished rather than "continue". */
const MAX_PROGRESS_RATIO = 0.96;

function sameItem(a: HistoryEntry, ref: ContentRef): boolean {
  return a.kind === ref.kind && a.id === ref.id && a.episodeId === ref.episodeId;
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly storage = inject(StorageService);
  private readonly entries = signal<HistoryEntry[]>(this.storage.get<HistoryEntry[]>(KEY) ?? []);

  readonly all = this.entries.asReadonly();

  readonly recentlyWatched = computed(() => [...this.entries()].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt));

  readonly continueWatching = computed(() =>
    this.recentlyWatched().filter((e) => {
      if (!e.positionSecs || !e.durationSecs) return false;
      const ratio = e.positionSecs / e.durationSecs;
      return ratio > MIN_PROGRESS_RATIO && ratio < MAX_PROGRESS_RATIO;
    }),
  );

  positionFor(kind: ContentKind, id: number, episodeId?: string): number | null {
    const match = this.entries().find((e) => e.kind === kind && e.id === id && e.episodeId === episodeId);
    return match?.positionSecs ?? null;
  }

  record(ref: ContentRef, playback?: { positionSecs?: number; durationSecs?: number }): void {
    const withoutExisting = this.entries().filter((e) => !sameItem(e, ref));
    const entry: HistoryEntry = {
      ...ref,
      lastWatchedAt: Date.now(),
      positionSecs: playback?.positionSecs,
      durationSecs: playback?.durationSecs,
    };
    const next = [entry, ...withoutExisting].slice(0, MAX_ENTRIES);
    this.entries.set(next);
    this.storage.set(KEY, next);
  }

  remove(kind: ContentKind, id: number, episodeId?: string): void {
    const next = this.entries().filter((e) => !(e.kind === kind && e.id === id && e.episodeId === episodeId));
    this.entries.set(next);
    this.storage.set(KEY, next);
  }

  clear(): void {
    this.entries.set([]);
    this.storage.set(KEY, []);
  }
}
