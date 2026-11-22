import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { I18nKey } from './i18n/i18n';

/**
 * Web Push via Angular's service worker. Only available in production builds (the service worker is
 * off in `ng serve`) and when the backend has VAPID keys configured.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(ApiService);

  get supported(): boolean {
    return this.swPush.isEnabled && 'Notification' in window;
  }

  /** Asks for permission (if needed) and registers this device. Returns a reason (translation key) when it can't. */
  async enable(): Promise<I18nKey | null> {
    if (!this.supported) {
      return 'push.devMode';
    }
    const key = await firstValueFrom(this.api.vapidKey());
    if (!key.enabled || !key.publicKey) {
      return 'push.notConfigured';
    }
    try {
      const sub = await this.swPush.requestSubscription({ serverPublicKey: key.publicKey });
      await firstValueFrom(this.api.pushSubscribe(sub.toJSON()));
      return null;
    } catch {
      return 'push.blocked';
    }
  }

  async disable(): Promise<void> {
    if (!this.supported) return;
    const sub = await firstValueFrom(this.swPush.subscription);
    if (sub) {
      await firstValueFrom(this.api.pushUnsubscribe(sub.endpoint)).catch(() => undefined);
      await this.swPush.unsubscribe().catch(() => undefined);
    }
  }
}
