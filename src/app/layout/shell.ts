import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { BillingService } from '../core/billing.service';
import { AuthService } from '../core/auth.service';
import { NotificationsService } from '../core/notifications.service';
import { PresenceService } from '../core/presence.service';
import { RealtimeService } from '../core/realtime.service';
import { Avatar } from '../shared/avatar';
import { LangSwitch } from '../shared/lang-switch';
import { I18nKey, I18nService, TranslatePipe } from '../core/i18n/i18n';

/** App shell (template #6): top bar, desktop sidebar, mobile bottom nav. Owns the realtime connection. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, LangSwitch, TranslatePipe],
  template: `
    <header class="topbar">
      <div class="topbar-left">
        <a routerLink="/feed" class="logo-small">E</a>
        <div class="entrance-name">
          {{ auth.user()?.entrance?.name }}<span class="address"> · {{ auth.user()?.entrance?.address }}</span>
        </div>
      </div>
      <div class="topbar-right">
        @if (!realtime.connected() && !billing.locked()) {
          <span class="conn" [title]="'shell.reconnecting' | t">●</span>
        }
        <app-lang-switch class="lang" />
        <a class="icon-btn" routerLink="/notifications" [title]="'nav.notifications' | t">
          🔔
          @if (notifications.unread() > 0) {
            <span class="badge">{{ notifications.unread() > 9 ? '9+' : notifications.unread() }}</span>
          }
        </a>
        <a routerLink="/profile" class="me" [title]="'nav.myProfile' | t"><app-avatar [person]="auth.user()" [size]="32" /></a>
      </div>
    </header>

    <aside class="sidebar">
      @for (item of nav; track item.path) {
        <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
          <span class="icon">{{ item.icon }}</span> {{ item.label | t }}
        </a>
      }
      @if (auth.isAdmin()) {
        <a routerLink="/admin" routerLinkActive="active" class="nav-item"><span class="icon">⚙️</span> {{ 'nav.admin' | t }}</a>
        @if (billing.billing()?.enabled) {
          <a routerLink="/billing" routerLinkActive="active" class="nav-item"><span class="icon">💳</span> {{ 'nav.subscription' | t }}</a>
        }
      }
    </aside>

    <main class="main">
      @if (banner(); as text) {
        <a routerLink="/billing" class="billing-banner" [class.urgent]="billing.billing()?.state !== 'TRIAL'">
          {{ text }} <strong>{{ (billing.billing()?.state === 'PAST_DUE' ? 'shell.fixPayment' : 'shell.subscribe') | t }}</strong>
        </a>
      }
      <router-outlet />
    </main>

    <nav class="bottom-nav">
      @for (item of nav; track item.path) {
        <a [routerLink]="item.path" routerLinkActive="active">
          <span class="icon">{{ item.icon }}</span>
          {{ item.short | t }}
        </a>
      }
    </nav>
  `,
  styleUrl: './shell.css',
})
export class Shell implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly realtime = inject(RealtimeService);
  protected readonly notifications = inject(NotificationsService);
  private readonly presence = inject(PresenceService);

  protected readonly nav: { path: string; icon: string; label: I18nKey; short: I18nKey }[] = [
    { path: '/feed', icon: '🏠', label: 'nav.feed', short: 'nav.feed' },
    { path: '/chat', icon: '💬', label: 'nav.chat', short: 'nav.chat' },
    { path: '/polls', icon: '📊', label: 'nav.polls', short: 'nav.polls' },
    { path: '/fees', icon: '🧹', label: 'nav.fees', short: 'nav.feesShort' },
    { path: '/residents', icon: '👥', label: 'nav.residents', short: 'nav.residents' },
    { path: '/profile', icon: '👤', label: 'nav.myProfile', short: 'nav.profile' },
  ];

  protected readonly billing = inject(BillingService);
  private readonly i18n = inject(I18nService);
  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: '' },
  );

  /** Admin reminder in the last week of the trial, or when payment needs attention. */
  protected readonly banner = computed(() => {
    const b = this.billing.billing();
    if (!b || !this.auth.isAdmin() || this.url().startsWith('/billing')) return null;
    if (b.state === 'TRIAL' && (b.trialDaysLeft ?? 99) <= 7) {
      return this.i18n.plural('shell.trialBanner', b.trialDaysLeft ?? 0);
    }
    if (b.state === 'PAST_DUE') return this.i18n.t('shell.paymentFailed');
    return null;
  });

  ngOnInit(): void {
    // A locked entrance (trial over) can't open live connections; the admin only sees /billing.
    if (this.billing.locked()) return;
    this.realtime.start();
    this.presence.start();
    this.notifications.start();
  }

  ngOnDestroy(): void {
    this.notifications.stop();
    this.presence.stop();
    this.realtime.stop();
  }
}
