/** Credentials entered by the user. Never hard-code these. */
export interface IptvCredentials {
  /** Normalized, e.g. "http://mvo25.in" (no trailing slash, no path) */
  serverUrl: string;
  username: string;
  password: string;
}

/**
 * Raw `user_info` block from `player_api.php`.
 * Numeric-looking fields come back as strings from this API — kept as strings
 * here and converted where needed rather than assumed numeric.
 */
export interface XtreamUserInfo {
  username: string;
  password: string;
  message?: string;
  auth: number | string;
  status: string;
  exp_date: string | null;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats?: string[];
}

/** Raw `server_info` block from `player_api.php`. */
export interface XtreamServerInfo {
  panel?: string;
  version?: string;
  url: string;
  port: string;
  https_port?: string;
  server_protocol: string;
  rtmp_port?: string;
  timezone?: string;
  timestamp_now?: number;
  time_now?: string;
  process?: boolean;
}

export interface XtreamAuthResponse {
  user_info: XtreamUserInfo;
  server_info: XtreamServerInfo;
}

export type AccountStatus = 'active' | 'expired' | 'disabled' | 'unknown';

/** A stored, already-established connection (credentials + account snapshot). */
export interface IptvConnection {
  credentials: IptvCredentials;
  auth: XtreamAuthResponse;
  connectedAt: number;
}
