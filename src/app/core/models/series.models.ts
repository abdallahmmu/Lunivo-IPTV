import { XtreamCategory } from './common.models';
import { MediaProbeStream } from './vod.models';

export type SeriesCategory = XtreamCategory;

/** Item from `action=get_series`. */
export interface SeriesListItem {
  num: number;
  name: string;
  series_id: number;
  cover?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  last_modified?: string;
  rating?: string;
  rating_5based?: number;
  backdrop_path?: string[];
  youtube_trailer?: string;
  episode_run_time?: string;
  category_id: string;
}

export interface SeriesSeason {
  id: number;
  season_number: number;
  name: string;
  overview?: string;
  air_date?: string;
  episode_count?: number;
  vote_average?: number;
  cover?: string;
  cover_big?: string;
}

export interface EpisodeInfo {
  tmdb_id?: number | string;
  releasedate?: string;
  plot?: string;
  duration_secs?: number;
  duration?: string;
  movie_image?: string;
  bitrate?: number;
  rating?: number | string;
  season?: string | number;
  video?: MediaProbeStream;
  audio?: MediaProbeStream;
}

export interface SeriesEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info?: EpisodeInfo;
  custom_sid?: string;
  added?: string;
  season: number;
  direct_source?: string;
}

/** `get_series_info` response — episodes keyed by season number as a string. */
export interface SeriesInfo {
  info: SeriesListItem | Record<string, never>;
  seasons: SeriesSeason[];
  episodes: Record<string, SeriesEpisode[]>;
}
