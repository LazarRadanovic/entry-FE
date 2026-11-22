import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/toast.service';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { LangSwitch } from '../../shared/lang-switch';

/** Template #3. */
@Component({
  selector: 'app-pending',
  imports: [TranslatePipe, LangSwitch],
  template: `
    <div class="center-page">
      <app-lang-switch class="corner-lang" />
      <div class="center-card text-center">
        <div class="big-icon" style="background:#fef3c7;color:var(--warning)">⏳</div>
        <h1 style="font-size:1.4rem;margin-bottom:12px">{{ 'pending.title' | t }}</h1>
        <p class="lead">{{ 'pending.sentBefore' | t }}<strong>{{ auth.user()?.entrance?.name }}</strong>{{ 'pending.sentAfter' | t }}</p>
        <p class="lead">{{ 'pending.needAdmin' | t }}</p>

        <div class="info-box">
          <strong>{{ 'pending.nextTitle' | t }}</strong>
          {{ 'pending.nextBody' | t }}
        </div>

        <button class="btn btn-primary" (click)="refresh()" [disabled]="checking()">
          {{ (checking() ? 'pending.checking' : 'pending.refresh') | t }}
        </button>
        <br />
        <button class="btn btn-ghost" style="margin-top:12px" (click)="auth.logout()">{{ 'common.signOut' | t }}</button>
      </div>
    </div>
  `,
  styles: `
    .info-box { background: var(--bg-soft); border-radius: 10px; padding: 16px; margin: 28px 0; text-align: left; font-size: 0.9rem; line-height: 1.5; }
    .info-box strong { display: block; margin-bottom: 4px; }
  `,
})
export class PendingPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly checking = signal(false);

  protected refresh(): void {
    this.checking.set(true);
    this.auth.reloadMe().subscribe({
      next: (u) => {
        this.checking.set(false);
        if (u.status === 'ACTIVE') {
          this.toast.success(translate('pending.approved'));
          this.router.navigateByUrl('/feed');
        } else if (u.status === 'REJECTED') {
          this.toast.error(translate('pending.rejected'));
          this.auth.logout();
        } else {
          this.toast.info(translate('pending.still'));
        }
      },
      error: () => {
        this.checking.set(false);
        this.toast.error(translate('pending.failed'));
      },
    });
  }
}
