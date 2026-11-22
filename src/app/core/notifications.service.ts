import { Injectable, inject, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { ApiService } from './api.service';
import { AppNotification } from './models';
import { RealtimeService } from './realtime.service';
import { ToastService } from '../shared/toast.service';
import { notificationText } from '../shared/notification-text';

/** Unread badge + live notifications from /user/queue/notifications. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private sub?: Subscription;

  readonly unread = signal(0);
  /** Emits each notification that arrives live (the notifications page prepends them). */
  readonly incoming$ = new Subject<AppNotification>();

  start(): void {
    this.refreshCount();
    this.sub = this.realtime.watch<AppNotification>('/user/queue/notifications').subscribe((e) => {
      const n = e.payload;
      this.refreshCount();
      this.incoming$.next(n);
      this.toast.info(notificationText(n).plain);
    });
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.unread.set(0);
  }

  refreshCount(): void {
    this.api.unreadCount().subscribe({ next: (r) => this.unread.set(r.count), error: () => undefined });
  }
}
