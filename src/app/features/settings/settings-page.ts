import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { HistoryService } from '../../core/services/history.service';
import { IptvApiService } from '../../core/services/iptv-api.service';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(IptvApiService);
  private readonly history = inject(HistoryService);

  protected readonly refreshed = signal(false);
  protected readonly clearedHistory = signal(false);

  protected refreshData(): void {
    this.api.invalidateAll();
    this.refreshed.set(true);
    setTimeout(() => this.refreshed.set(false), 2500);
  }

  protected clearWatchHistory(): void {
    this.history.clear();
    this.clearedHistory.set(true);
    setTimeout(() => this.clearedHistory.set(false), 2500);
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
