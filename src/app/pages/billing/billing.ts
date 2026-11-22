import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { BillingService } from '../../core/billing.service';
import { errorMessage } from '../../core/errors';
import { ToastService } from '../../shared/toast.service';
import { I18nService, TranslatePipe, TranslatePluralPipe, translate } from '../../core/i18n/i18n';

/** Admin: free trial status, Stripe Checkout and the Stripe Billing Portal. */
@Component({
  selector: 'app-billing',
  imports: [DatePipe, TranslatePipe, TranslatePluralPipe],
  template: `
    <h1 class="page-title" style="margin-bottom:20px">{{ 'billing.title' | t }}</h1>

    @if (b(); as b) {
      <div class="card plan">
        <div class="plan-top">
          <div>
            <div class="plan-name">{{ 'billing.plan' | t }}</div>
            @if (b.priceLabel) { <div class="price">{{ b.priceLabel }}</div> }
          </div>
          <span class="state" [class]="b.state.toLowerCase()">{{ stateLabel() }}</span>
        </div>

        @switch (b.state) {
          @case ('FREE') {
            <p class="text">{{ 'billing.free' | t }}</p>
          }
          @case ('TRIAL') {
            <div class="trial">
              <div class="trial-head">
                <strong>{{ 'billing.daysLeft' | tp: (b.trialDaysLeft ?? 0) }}</strong>{{ 'billing.inTrial' | t }}
              </div>
              <div class="progress-bar"><div class="progress-fill" [style.width.%]="trialPercent()"></div></div>
              <div class="muted small">{{ 'billing.trialEnds' | t: { date: (b.trialEndsAt | date: 'longDate' : undefined : i18n.locale()) ?? '' } }}</div>
            </div>
            <p class="text">{{ 'billing.trialText' | t }}</p>
          }
          @case ('ACTIVE') {
            <p class="text">
              {{ 'billing.activeText' | t }}
              @if (b.currentPeriodEnd) {
                {{ (b.cancelAtPeriodEnd ? 'billing.endsOn' : 'billing.renews') | t: { date: (b.currentPeriodEnd | date: 'longDate' : undefined : i18n.locale()) ?? '' } }}
              }
            </p>
            @if (b.cancelAtPeriodEnd) {
              <div class="warn">{{ 'billing.cancelledWarn' | t }}</div>
            }
          }
          @case ('PAST_DUE') {
            <div class="warn">{{ 'billing.pastDue' | t }}</div>
          }
          @case ('EXPIRED') {
            <div class="danger"><strong>{{ 'billing.expiredBold' | t }}</strong>{{ 'billing.expiredText' | t }}</div>
          }
        }

        <div class="actions">
          @if (b.canSubscribe) {
            <button class="btn btn-primary btn-block" (click)="subscribe()" [disabled]="busy()">
              {{ (busy() === 'checkout' ? 'billing.opening' : 'billing.subscribe') | t }}
            </button>
          }
          @if (b.canManage) {
            <button class="btn btn-secondary btn-block" (click)="manage()" [disabled]="busy()">
              {{ (busy() === 'portal' ? 'billing.opening' : 'billing.manage') | t }}
            </button>
          }
        </div>
        @if (b.enabled) {
          <p class="muted small secure">{{ 'billing.secure' | t }}</p>
        }
      </div>
    } @else {
      <div class="spinner"></div>
    }
  `,
  styles: `
    .plan { padding: 24px; }
    .plan-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
    .plan-name { font-weight: 700; font-size: 1.1rem; }
    .price { color: var(--muted); margin-top: 2px; }
    .state { font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; }
    .state.trial { background: #eff6ff; color: var(--primary); }
    .state.active, .state.free { background: #dcfce7; color: var(--success); }
    .state.past_due { background: #fef3c7; color: var(--warning); }
    .state.expired { background: #fee2e2; color: var(--error); }
    .trial { margin-bottom: 16px; }
    .trial-head { margin-bottom: 8px; }
    .progress-bar { height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 6px; }
    .progress-fill { height: 100%; background: var(--primary); border-radius: 6px; }
    .text { line-height: 1.5; margin-bottom: 16px; }
    .small { font-size: 0.8rem; }
    .warn, .danger { border-radius: 8px; padding: 12px 14px; font-size: 0.9rem; line-height: 1.5; margin-bottom: 16px; }
    .warn { background: #fef3c7; color: #92400e; }
    .danger { background: #fef2f2; color: #991b1b; }
    .actions { display: flex; flex-direction: column; gap: 10px; }
    .secure { margin-top: 14px; text-align: center; }
  `,
})
export class BillingPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly billing = inject(BillingService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** ?checkout=success|canceled when Stripe redirects back. */
  readonly checkout = input<string>();

  protected readonly b = this.billing.billing;
  protected readonly busy = signal<'checkout' | 'portal' | null>(null);

  protected readonly i18n = inject(I18nService);

  protected readonly stateLabel = computed(() => {
    const b = this.b();
    if (!b) return '';
    return b.state === 'ACTIVE' && b.cancelAtPeriodEnd
      ? this.i18n.t('billing.state.CANCELLED')
      : this.i18n.t(`billing.state.${b.state}`);
  });

  protected readonly trialPercent = computed(() => {
    const left = this.b()?.trialDaysLeft ?? 0;
    return Math.max(4, Math.min(100, (left / 30) * 100));
  });

  ngOnInit(): void {
    if (this.checkout() === 'success') {
      // Webhooks may not have arrived yet: ask the backend to sync with Stripe now.
      this.api.syncBilling().subscribe({
        next: (b) => {
          this.billing.billing.set(b);
          this.toast.success(translate(b.accessAllowed ? 'billing.thanks' : 'billing.finishing'));
          this.router.navigate([], { queryParams: {}, replaceUrl: true });
        },
        error: (e) => this.toast.error(errorMessage(e)),
      });
    } else {
      if (this.checkout() === 'canceled') this.toast.info(translate('billing.checkoutCanceled'));
      this.billing.load().subscribe();
    }
  }

  protected subscribe(): void {
    this.redirect('checkout', this.api.checkout());
  }

  protected manage(): void {
    this.redirect('portal', this.api.billingPortal());
  }

  private redirect(kind: 'checkout' | 'portal', call: ReturnType<ApiService['checkout']>): void {
    this.busy.set(kind);
    call.subscribe({
      next: (r) => (window.location.href = r.url),
      error: (e) => {
        this.busy.set(null);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
