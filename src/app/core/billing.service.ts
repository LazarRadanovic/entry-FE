import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Billing } from './models';

/** Subscription status of my entrance (free trial → Stripe subscription). */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly api = inject(ApiService);

  readonly billing = signal<Billing | null>(null);
  readonly locked = computed(() => this.billing()?.accessAllowed === false);

  load(): Observable<Billing | null> {
    return this.api.billing().pipe(
      tap((b) => this.billing.set(b)),
      catchError(() => of(this.billing())),
    );
  }

  /** Loads once per session (guards call this before every navigation). */
  async ensureLoaded(): Promise<Billing | null> {
    return this.billing() ?? firstValueFrom(this.load());
  }

  clear(): void {
    this.billing.set(null);
  }
}
