import { Injectable, computed, inject, signal } from '@angular/core';
import { ContentKind } from '../models/common.models';
import { ContentRef, FavoriteEntry } from '../models/library.models';
import { StorageService } from './storage.service';

const KEY = 'favorites';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly storage = inject(StorageService);
  private readonly entries = signal<FavoriteEntry[]>(this.storage.get<FavoriteEntry[]>(KEY) ?? []);

  readonly all = this.entries.asReadonly();
  readonly live = computed(() => this.entries().filter((e) => e.kind === 'live'));
  readonly movies = computed(() => this.entries().filter((e) => e.kind === 'movie'));
  readonly series = computed(() => this.entries().filter((e) => e.kind === 'series'));

  isFavorite(kind: ContentKind, id: number): boolean {
    return this.entries().some((e) => e.kind === kind && e.id === id);
  }

  toggle(ref: ContentRef): void {
    if (this.isFavorite(ref.kind, ref.id)) {
      this.remove(ref.kind, ref.id);
    } else {
      this.add(ref);
    }
  }

  add(ref: ContentRef): void {
    if (this.isFavorite(ref.kind, ref.id)) return;
    const next = [{ ...ref, addedAt: Date.now() }, ...this.entries()];
    this.entries.set(next);
    this.persist(next);
  }

  remove(kind: ContentKind, id: number): void {
    const next = this.entries().filter((e) => !(e.kind === kind && e.id === id));
    this.entries.set(next);
    this.persist(next);
  }

  private persist(entries: FavoriteEntry[]): void {
    this.storage.set(KEY, entries);
  }
}
