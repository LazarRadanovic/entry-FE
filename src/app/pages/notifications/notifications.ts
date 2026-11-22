import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AppNotification } from '../../core/models';
import { NotificationsService } from '../../core/notifications.service';
import { notificationText } from '../../shared/notification-text';
import { TimeAgoPipe } from '../../shared/time-ago.pipe';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Template #16. */
@Component({
  selector: 'app-notifications',
  imports: [TimeAgoPipe, TranslatePipe],
  template: `
    <div class="page-header">
      <h1 class="page-title">{{ 'notif.title' | t }}</h1>
      @if (notifications.unread() > 0) {
        <button class="btn btn-secondary btn-small" (click)="markAll()">{{ 'notif.markAll' | t }}</button>
      }
    </div>

    @if (loading()) {
      <div class="spinner"></div>
    } @else {
      @for (n of items(); track n.id) {
        @let t = text(n);
        <button class="notif-item" [class.unread]="!n.read" (click)="open(n)">
          <div class="notif-icon">{{ t.icon }}</div>
          <div class="notif-content">
            <div class="notif-text">{{ t.before }}<strong>{{ t.bold }}</strong>{{ t.after }}</div>
            <div class="notif-time">{{ n.createdAt | timeAgo }}</div>
          </div>
        </button>
      } @empty {
        <div class="empty-state"><div class="emoji">🔔</div>{{ 'notif.empty' | t }}</div>
      }
      @if (nextCursor()) {
        <button class="btn btn-secondary btn-block" (click)="more()">{{ 'common.loadMore' | t }}</button>
      }
    }
  `,
  styles: `
    .notif-item {
      display: flex; gap: 14px; width: 100%; text-align: left; border: none; cursor: pointer;
      background: var(--card); padding: 14px 16px; border-radius: var(--radius); margin-bottom: 10px; box-shadow: var(--shadow);
    }
    .notif-item:hover { background: #f8fafc; }
    .notif-item.unread { background: #eff6ff; }
    .notif-icon { width: 40px; height: 40px; border-radius: 50%; background: #e0e7ff; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .notif-content { flex: 1; min-width: 0; }
    .notif-text { font-size: 0.9rem; line-height: 1.4; overflow-wrap: anywhere; }
    .notif-time { font-size: 0.75rem; color: var(--muted); margin-top: 4px; }
  `,
})
export class NotificationsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly notifications = inject(NotificationsService);

  protected readonly items = signal<AppNotification[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly text = notificationText;

  ngOnInit(): void {
    this.api.notifications().subscribe({
      next: (page) => {
        this.items.set(page.items);
        this.nextCursor.set(page.nextCursor);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.notifications.incoming$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((n) => {
      // aggregated likes update an existing row
      this.items.update((l) => [n, ...l.filter((x) => x.id !== n.id)]);
    });
  }

  protected open(n: AppNotification): void {
    if (!n.read) {
      this.api.markRead(n.id).subscribe(() => this.notifications.refreshCount());
      this.items.update((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    this.router.navigateByUrl(notificationText(n).link);
  }

  protected markAll(): void {
    this.api.markAllRead().subscribe(() => {
      this.items.update((l) => l.map((x) => ({ ...x, read: true })));
      this.notifications.unread.set(0);
    });
  }

  protected more(): void {
    this.api.notifications(this.nextCursor()).subscribe((page) => {
      this.items.update((l) => [...l, ...page.items]);
      this.nextCursor.set(page.nextCursor);
    });
  }
}
