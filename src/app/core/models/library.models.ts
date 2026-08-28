import { ContentKind } from './common.models';

/** Minimal, display-ready reference to a piece of content, used by favorites/history/search. */
export interface ContentRef {
  kind: ContentKind;
  id: number;
  /** For a series episode, the episode id; absent for live/movie. */
  episodeId?: string;
  name: string;
  image: string | null;
  categoryId: string;
  /** Denormalized fields used only for episode "continue watching" rows. */
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface FavoriteEntry extends ContentRef {
  addedAt: number;
}

export interface HistoryEntry extends ContentRef {
  lastWatchedAt: number;
  /** Playback position in seconds, when known. */
  positionSecs?: number;
  durationSecs?: number;
}
