import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BillingService } from '../../core/billing.service';
import { ToastService } from '../../shared/toast.service';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { LangSwitch } from '../../shared/lang-switch';

/** Residents of an entrance whose free trial ended without a subscription. */
@Component({
  selector: 'app-locked',
  imports: [TranslatePipe, LangSwitch],
  template: `
    <div class="center-page">
      <app-lang-switch class="corner-lang" />
      <div class="center-card text-center">
        <div class="big-icon" style="background:#fee2e2;color:var(--error)">🔒</div>
        <h1 style="font-size:1.4rem;margin-bottom:12px">{{ 'locked.title' | t }}</h1>
        <p class="lead">{{ 'locked.endedBefore' | t }}<strong>{{ auth.user()?.entrance?.name }}</strong>{{ 'locked.endedAfter' | t }}</p>
        <p class="lead">{{ 'locked.body' | t }}</p>
        <div style="margin-top:28px">
          <button class="btn btn-primary" (click)="check()" [disabled]="checking()">
            {{ (checking() ? 'pending.checking' : 'locked.check') | t }}
          </button>
          <br />
          <button class="btn btn-ghost" style="margin-top:12px" (click)="auth.logout()">{{ 'common.signOut' | t }}</button>
        </div>
      </div>
    </div>
  `,
})
export class LockedPage {
  protected readonly auth = inject(AuthService);
  private readonly billing = inject(BillingService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly checking = signal(false);

  protected check(): void {
    this.checking.set(true);
    this.billing.load().subscribe((b) => {
      this.checking.set(false);
      if (b?.accessAllowed) this.router.navigateByUrl('/feed');
      else this.toast.info(translate('locked.still'));
    });
  }
}
