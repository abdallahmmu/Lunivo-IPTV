import { XtreamCategory } from './common.models';

export type LiveCategory = XtreamCategory;

/** Item from `action=get_live_streams`, verified against a real Xtream-Masters panel. */
export interface LiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon?: string | null;
  epg_channel_id?: string | null;
  added?: string;
  custom_sid?: string;
  tv_archive: number;
  direct_source?: string;
  tv_archive_duration?: number;
  category_id: string;
}
