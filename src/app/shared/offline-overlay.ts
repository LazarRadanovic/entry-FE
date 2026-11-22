import { Component, signal } from '@angular/core';
import { TranslatePipe } from '../core/i18n/i18n';

/** Offline fallback (template #4): shown while the browser reports no connection. */
@Component({
  selector: 'app-offline-overlay',
  imports: [TranslatePipe],
  host: {
    '(window:online)': 'online.set(true)',
    '(window:offline)': 'online.set(false)',
  },
  template: `
    @if (!online() && !dismissed()) {
      <div class="offline">
        <div class="center-card text-center">
          <div class="big-icon" style="background:#e0e7ff;color:var(--primary)">📡</div>
          <h1>{{ 'offline.title' | t }}</h1>
          <p class="lead">{{ 'offline.body' | t }}</p>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:28px">
            <button class="btn btn-primary" (click)="retry()">{{ 'common.tryAgain' | t }}</button>
            <button class="btn btn-secondary" (click)="dismissed.set(true)">{{ 'offline.browse' | t }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .offline {
      position: fixed; inset: 0; z-index: 700; background: var(--bg-soft);
      display: flex; align-items: center; justify-content: center; padding: 24px;
    }
  `,
})
export class OfflineOverlay {
  protected readonly online = signal(navigator.onLine);
  protected readonly dismissed = signal(false);

  protected retry(): void {
    location.reload();
  }
}
