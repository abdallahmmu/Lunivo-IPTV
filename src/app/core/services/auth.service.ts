import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountStatus, IptvConnection, IptvCredentials, XtreamAuthResponse } from '../models/auth.models';
import { AppError } from '../models/common.models';
import { normalizeServerUrl, playerApiUrl } from '../utils/url.util';
import { mapAuthError } from '../utils/xtream-error.util';
import { CacheService } from './cache.service';
import { StorageService } from './storage.service';

const CONNECTION_KEY = 'connection';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly cache = inject(CacheService);
  private readonly router = inject(Router);

  private readonly connectionState = signal<IptvConnection | null>(this.restore());

  readonly connection = this.connectionState.asReadonly();
  readonly isAuthenticated = computed(() => this.connectionState() !== null);
  readonly credentials = computed<IptvCredentials | null>(() => this.connectionState()?.credentials ?? null);
  readonly userInfo = computed(() => this.connectionState()?.auth.user_info ?? null);
  readonly serverInfo = computed(() => this.connectionState()?.auth.server_info ?? null);

  readonly accountStatus = computed<AccountStatus>(() => {
    const info = this.userInfo();
    if (!info) return 'unknown';
    const status = info.status?.toLowerCase() ?? '';
    if (status.includes('expire')) return 'expired';
    if (status.includes('disab') || status.includes('ban')) return 'disabled';
    if (status.includes('active') && String(info.auth) === '1') return 'active';
    return String(info.auth) === '1' ? 'active' : 'unknown';
  });

  readonly expiryDate = computed<Date | null>(() => {
    const raw = this.userInfo()?.exp_date;
    if (!raw) return null;
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : null;
  });

  async connect(rawCredentials: IptvCredentials, rememberMe: boolean): Promise<{ error: AppError | null }> {
    let serverUrl: string;
    try {
      serverUrl = normalizeServerUrl(rawCredentials.serverUrl);
    } catch (e) {
      return { error: { message: (e as Error).message, code: 'invalid_url' } };
    }

    const credentials: IptvCredentials = { serverUrl, username: rawCredentials.username.trim(), password: rawCredentials.password };
    if (!credentials.username || !credentials.password) {
      return { error: { message: 'Username and password are required.', code: 'invalid_credentials' } };
    }

    try {
      const auth = await firstValueFrom(
        this.http.get<XtreamAuthResponse>(playerApiUrl(serverUrl), {
          params: { username: credentials.username, password: credentials.password },
        }),
      );

      if (!auth?.user_info || String(auth.user_info.auth) !== '1') {
        return { error: { message: 'Invalid username or password.', code: 'invalid_credentials' } };
      }

      const status = auth.user_info.status?.toLowerCase() ?? '';
      if (status.includes('expire')) {
        return { error: { message: 'This IPTV account has expired.', code: 'expired' } };
      }
      if (status.includes('disab') || status.includes('ban')) {
        return { error: { message: 'This IPTV account has been disabled.', code: 'disabled' } };
      }

      const connection: IptvConnection = { credentials, auth, connectedAt: Date.now() };
      this.cache.clear();
      this.connectionState.set(connection);
      this.persist(connection, rememberMe);
      return { error: null };
    } catch (e) {
      return { error: mapAuthError(e) };
    }
  }

  async logout(): Promise<void> {
    this.connectionState.set(null);
    this.cache.clear();
    this.storage.remove(CONNECTION_KEY, false);
    this.storage.remove(CONNECTION_KEY, true);
    await this.router.navigateByUrl('/login');
  }

  private persist(connection: IptvConnection, rememberMe: boolean): void {
    // "Remember me" persists the password to localStorage (survives browser restarts).
    // Otherwise we keep it in sessionStorage only, for the current tab session — see README security notes.
    this.storage.remove(CONNECTION_KEY, true);
    this.storage.remove(CONNECTION_KEY, false);
    this.storage.set(CONNECTION_KEY, connection, !rememberMe);
  }

  private restore(): IptvConnection | null {
    return this.storage.get<IptvConnection>(CONNECTION_KEY, false) ?? this.storage.get<IptvConnection>(CONNECTION_KEY, true);
  }
}
