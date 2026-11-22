import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nService, TranslatePipe, translate } from '../../core/i18n/i18n';
import { FeeRow, FeeTable } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { ToastService } from '../../shared/toast.service';

/**
 * Monthly building-cleaning fee: one row per apartment, one column per month.
 * Everyone sees who paid; the entrance admin taps cells to mark paid / unpaid.
 */
@Component({
  selector: 'app-fees',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './fees.html',
  styleUrl: './fees.css',
})
export class FeesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly i18n = inject(I18nService);
  protected readonly isAdmin = inject(AuthService).isAdmin;

  private readonly now = new Date();
  protected readonly year = signal(this.now.getFullYear());
  protected readonly table = signal<FeeTable | null>(null);
  protected readonly loading = signal(true);
  protected readonly busyCell = signal<string | null>(null);

  // admin forms
  protected amount: number | null = null;
  protected currency = 'RSD';
  protected newFloor = '';
  protected newApartment = '';

  protected readonly months = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.i18n.locale(), { month: 'short' });
    const long = new Intl.DateTimeFormat(this.i18n.locale(), { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => ({
      index: i,
      short: fmt.format(new Date(2000, i, 1)).replace('.', ''),
      long: long.format(new Date(2000, i, 1)),
    }));
  });

  /** Column of the current month (highlighted), only when viewing this year. */
  protected readonly currentMonth = computed(() =>
    this.year() === this.now.getFullYear() ? this.now.getMonth() : -1,
  );

  protected readonly paidPerMonth = computed(() => {
    const rows = this.table()?.rows ?? [];
    return Array.from({ length: 12 }, (_, m) => rows.filter((r) => r.paid[m]).length);
  });

  protected readonly summary = computed(() => {
    const t = this.table();
    const m = this.currentMonth();
    if (!t || m < 0) return null;
    const paid = this.paidPerMonth()[m];
    return {
      month: this.months()[m].long,
      paid,
      total: t.rows.length,
      sum: t.amount != null ? this.money(paid * t.amount, t.currency) : null,
    };
  });

  ngOnInit(): void {
    this.load();
    this.realtime
      .entrance<{ year: number }>('fees')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(false));
  }

  protected changeYear(delta: number): void {
    this.year.update((y) => y + delta);
    this.load();
  }

  protected toggle(row: FeeRow, month: number): void {
    if (!this.isAdmin()) return;
    const t = this.table();
    if (!t) return;
    const wasPaid = !!row.paid[month];
    const cell = `${row.unitId}:${month}`;
    this.busyCell.set(cell);
    this.patchCell(row.unitId, month, wasPaid ? null : new Date().toISOString()); // optimistic
    this.api.setFeePaid(row.unitId, t.year, month + 1, !wasPaid).subscribe({
      next: () => this.busyCell.set(null),
      error: (e) => {
        this.busyCell.set(null);
        this.patchCell(row.unitId, month, row.paid[month]);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected saveSettings(): void {
    if (this.amount == null || this.amount < 0) return;
    const currency = this.currency.trim().toUpperCase();
    this.api.updateFeeSettings(this.amount, currency).subscribe({
      next: () => {
        this.toast.success(translate('fees.settingsSaved'));
        this.load(false);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected addUnit(): void {
    const floor = this.newFloor.trim();
    const apartment = this.newApartment.trim();
    if (!floor || !apartment) return;
    this.api.addFeeUnit(floor, apartment).subscribe({
      next: () => {
        this.newFloor = '';
        this.newApartment = '';
        this.load(false);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected removeUnit(row: FeeRow): void {
    if (!confirm(translate('fees.confirmRemove', { label: this.label(row) }))) return;
    this.api.removeFeeUnit(row.unitId).subscribe({
      next: () => this.load(false),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected label(row: FeeRow): string {
    return `${row.floor}/${row.apartment}`;
  }

  protected money(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency, maximumFractionDigits: 2 })
        .format(value);
    } catch {
      return `${value} ${currency}`;
    }
  }

  private load(showSpinner = true): void {
    if (showSpinner) this.loading.set(true);
    this.api.fees(this.year()).subscribe({
      next: (t) => {
        this.table.set(t);
        this.loading.set(false);
        if (this.amount == null && t.amount != null) this.amount = t.amount;
        this.currency = t.currency;
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  private patchCell(unitId: string, month: number, value: string | null): void {
    this.table.update((t) =>
      t
        ? {
            ...t,
            rows: t.rows.map((r) =>
              r.unitId === unitId ? { ...r, paid: r.paid.map((p, i) => (i === month ? value : p)) } : r,
            ),
          }
        : t,
    );
  }
}
