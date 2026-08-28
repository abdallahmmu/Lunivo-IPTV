import { Injectable, inject } from '@angular/core';
import { joinUrl } from '../utils/url.util';
import { AuthService } from './auth.service';

export type PlaybackKind = 'hls' | 'native';

export interface PlaybackSource {
  url: string;
  kind: PlaybackKind;
  /** Container/extension actually used, for diagnostics and the "open externally" fallback. */
  extension: string;
}

/**
 * Builds playback URLs. Patterns verified live against a real Xtream-Masters
 * panel: `/live/{user}/{pass}/{id}.m3u8`, `/movie/{user}/{pass}/{id}.{ext}`,
 * `/series/{user}/{pass}/{episodeId}.{ext}` — each redirects (302, CORS-enabled)
 * to a tokenized CDN URL. Centralized here per the "no scattered URL building" requirement.
 */
@Injectable({ providedIn: 'root' })
export class StreamService {
  private readonly auth = inject(AuthService);

  liveStreamUrl(streamId: number): PlaybackSource {
    return { url: this.build('live', streamId, 'm3u8'), kind: 'hls', extension: 'm3u8' };
  }

  vodStreamUrl(streamId: number, containerExtension: string): PlaybackSource {
    return { url: this.build('movie', streamId, containerExtension), kind: this.kindFor(containerExtension), extension: containerExtension };
  }

  seriesEpisodeUrl(episodeId: string, containerExtension: string): PlaybackSource {
    return { url: this.build('series', episodeId, containerExtension), kind: this.kindFor(containerExtension), extension: containerExtension };
  }

  private kindFor(extension: string): PlaybackKind {
    return extension.toLowerCase() === 'm3u8' ? 'hls' : 'native';
  }

  private build(segment: 'live' | 'movie' | 'series', id: number | string, extension: string): string {
    const creds = this.auth.credentials();
    if (!creds) {
      throw new Error('Not connected to an IPTV server.');
    }
    return `${joinUrl(creds.serverUrl, segment, creds.username, creds.password, id)}.${extension}`;
  }
}
