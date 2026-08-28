import { XtreamCategory } from './common.models';

export type VodCategory = XtreamCategory;

/** Item from `action=get_vod_streams`. */
export interface VodStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon?: string | null;
  rating?: string;
  rating_5based?: number;
  added?: string;
  is_adult?: string;
  /** Drives the playback URL extension — varies per item (mp4 / mkv / avi seen live). */
  container_extension: string;
  custom_sid?: string;
  direct_source?: string;
  category_id: string;
}

/**
 * ffprobe-derived technical stream info embedded in `get_vod_info` / episode info.
 * Loosely typed — fields observed to vary by codec/container, only the
 * fields the UI actually relies on are guaranteed.
 */
export interface MediaProbeStream {
  codec_name?: string;
  codec_long_name?: string;
  codec_type?: string;
  width?: number;
  height?: number;
  channels?: number;
  channel_layout?: string;
  sample_rate?: string;
  bits_per_sample?: number;
  tags?: Record<string, string>;
  disposition?: Record<string, number>;
  [key: string]: unknown;
}

/** The `info` block of `get_vod_info` — TMDB-sourced metadata, fields not always present. */
export interface VodInfoDetails {
  name?: string;
  o_name?: string;
  description?: string;
  plot?: string;
  cast?: string;
  actors?: string;
  director?: string;
  genre?: string;
  releasedate?: string;
  rating?: string;
  mpaa_rating?: string;
  country?: string;
  duration?: string;
  duration_secs?: number;
  bitrate?: number;
  movie_image?: string;
  cover_big?: string;
  backdrop_path?: string[];
  tmdb_id?: string | number;
  tmdb_url?: string;
  youtube_trailer?: string;
  episode_run_time?: string;
  age?: string;
  video?: MediaProbeStream;
  audio?: MediaProbeStream;
}

export interface VodMovieData {
  stream_id: number;
  name: string;
  added?: string;
  category_id: string;
  container_extension: string;
  custom_sid?: string;
  direct_source?: string;
}

export interface VodInfo {
  info: VodInfoDetails;
  movie_data: VodMovieData;
}
