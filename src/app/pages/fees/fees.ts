import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nService, TranslatePipe, TranslatePluralPipe, translate } from '../../core/i18n/i18n';
import { Cost, CostRequest, CostRow, CostTable, MyCost, MyCosts, Unit } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { ToastService } from '../../shared/toast.service';

/**
 * Entrance costs (building cleaning, garage cleaning, repairs...). Each cost applies to all apartments or a
 * subset and is either a fixed amount per apartment or a total split by area. Everyone sees who paid;
 * the entrance admin defines costs, assigns apartments and taps cells to mark paid / unpaid.
 */
@Component({
  selector: 'app-fees',
  imports: [DatePipe, FormsModule, TranslatePipe, TranslatePluralPipe],
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
  protected readonly costs = signal<Cost[] | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly table = signal<CostTable | null>(null);
  protected readonly mine = signal<MyCosts | null>(null);
  protected readonly units = signal<Unit[]>([]);
  protected readonly loadingTable = signal(false);
  protected readonly busyCell = signal<string | null>(null);

  // add-apartment form
  protected newFloor = '';
  protected newApartment = '';
  protected newArea: number | null = null;

  // cost dialog (null = closed)
  protected readonly editing = signal<{ id: string | null; form: CostRequest } | null>(null);
  protected readonly saving = signal(false);

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

  protected readonly selected = computed(() => this.table()?.cost ?? null);
  protected readonly oneTime = computed(() => this.selected()?.recurrence === 'ONE_TIME');
  protected readonly byArea = computed(() => this.selected()?.type === 'BY_AREA');

  /** One slot per month, or a single slot for one-time costs. */
  protected readonly slots = computed(() =>
    this.oneTime()
      ? [{ index: 0, short: this.i18n.t('fees.paidCol'), long: this.i18n.t('fees.paidCol') }]
      : this.months(),
  );

  protected readonly paidPerSlot = computed(() => {
    const rows = this.table()?.rows ?? [];
    return this.slots().map((s) => rows.filter((r) => r.paid[s.index]).length);
  });

  protected readonly summary = computed(() => {
    const t = this.table();
    if (!t) return null;
    const slot = this.oneTime() ? 0 : this.currentMonth();
    if (slot < 0) return null;
    const paidRows = t.rows.filter((r) => r.paid[slot]);
    const sum = t.cost.missingArea ? null : paidRows.reduce((acc, r) => acc + (r.share ?? 0), 0);
    return {
      month: this.oneTime() ? null : this.months()[slot].long,
      paid: paidRows.length,
      total: t.rows.length,
      sum: sum != null ? this.money(sum, t.cost.currency) : null,
    };
  });

  ngOnInit(): void {
    this.loadAll();
    this.realtime
      .entrance<unknown>('fees')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadAll(false));
  }

  protected changeYear(delta: number): void {
    this.year.update((y) => y + delta);
    this.loadAll();
  }

  protected select(cost: Cost): void {
    if (this.selectedId() === cost.id) return;
    this.selectedId.set(cost.id);
    this.loadTable();
  }

  // ---------- payments ----------

  protected toggle(row: CostRow, slot: number): void {
    const t = this.table();
    if (!this.isAdmin() || !t) return;
    const wasPaid = !!row.paid[slot];
    const period = this.oneTime() ? 'ONCE' : `${t.year}-${String(slot + 1).padStart(2, '0')}`;
    this.busyCell.set(`${row.unitId}:${slot}`);
    this.patchCell(row.unitId, slot, wasPaid ? null : new Date().toISOString()); // optimistic
    this.api.setCostPaid(t.cost.id, row.unitId, period, !wasPaid).subscribe({
      next: () => {
        this.busyCell.set(null);
        this.loadMine();
      },
      error: (e) => {
        this.busyCell.set(null);
        this.patchCell(row.unitId, slot, row.paid[slot]);
        this.toast.error(errorMessage(e));
      },
    });
  }

  // ---------- cost dialog ----------

  protected newCost(): void {
    this.editing.set({
      id: null,
      form: {
        name: '',
        description: null,
        type: 'PER_APARTMENT',
        amount: 0,
        currency: this.costs()?.[0]?.currency ?? 'RSD',
        recurrence: 'MONTHLY',
        dueDate: null,
        appliesToAll: true,
        unitIds: [],
      },
    });
  }

  protected editCost(c: Cost): void {
    this.editing.set({
      id: c.id,
      form: {
        name: c.name,
        description: c.description,
        type: c.type,
        amount: c.amount,
        currency: c.currency,
        recurrence: c.recurrence,
        dueDate: c.dueDate,
        appliesToAll: c.appliesToAll,
        unitIds: [...c.unitIds],
      },
    });
  }

  protected toggleUnit(form: CostRequest, unitId: string, checked: boolean): void {
    form.unitIds = checked ? [...form.unitIds, unitId] : form.unitIds.filter((id) => id !== unitId);
  }

  protected canSave(form: CostRequest): boolean {
    return (
      !!form.name.trim() &&
      form.amount != null &&
      form.amount >= 0 &&
      /^[A-Za-z]{3}$/.test(form.currency.trim()) &&
      (form.appliesToAll || form.unitIds.length > 0)
    );
  }

  protected saveCost(): void {
    const e = this.editing();
    if (!e || !this.canSave(e.form)) return;
    const body: CostRequest = {
      ...e.form,
      name: e.form.name.trim(),
      description: e.form.description?.trim() || null,
      currency: e.form.currency.trim().toUpperCase(),
      dueDate: e.form.recurrence === 'ONE_TIME' ? e.form.dueDate || null : null,
      unitIds: e.form.appliesToAll ? [] : e.form.unitIds,
    };
    this.saving.set(true);
    (e.id ? this.api.updateCost(e.id, body) : this.api.createCost(body)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.editing.set(null);
        this.selectedId.set(saved.id);
        this.toast.success(translate('fees.costSaved'));
        this.loadAll(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected deleteCost(c: Cost): void {
    if (!confirm(translate('fees.confirmDelete', { name: c.name }))) return;
    this.api.deleteCost(c.id).subscribe({
      next: () => {
        this.toast.success(translate('fees.costDeleted'));
        this.selectedId.set(null);
        this.loadAll(false);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  // ---------- apartments ----------

  protected saveArea(unit: Unit, raw: string): void {
    const parsed = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
    const area = parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    if (area === unit.areaM2) return;
    this.api.updateUnit(unit.id, area).subscribe({
      next: () => {
        this.toast.success(translate('fees.areaSaved'));
        this.loadAll(false);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected addUnit(): void {
    const floor = this.newFloor.trim();
    const apartment = this.newApartment.trim();
    if (!floor || !apartment) return;
    const area = this.newArea != null && this.newArea > 0 ? this.newArea : null;
    this.api.addUnit(floor, apartment, area).subscribe({
      next: () => {
        this.newFloor = '';
        this.newApartment = '';
        this.newArea = null;
        this.loadAll(false);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected removeUnit(unit: Unit): void {
    if (!confirm(translate('fees.confirmRemove', { label: this.label(unit) }))) return;
    this.api.removeUnit(unit.id).subscribe({
      next: () => this.loadAll(false),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  // ---------- display helpers ----------

  protected label(u: { floor: string; apartment: string }): string {
    return `${u.floor}/${u.apartment}`;
  }

  protected amountText(c: Cost): string {
    const amount = this.money(c.amount, c.currency);
    const key =
      c.type === 'BY_AREA'
        ? c.recurrence === 'ONE_TIME' ? 'fees.byAreaOnce' : 'fees.byAreaMonthly'
        : c.recurrence === 'ONE_TIME' ? 'fees.perApartmentOnce' : 'fees.perApartmentMonthly';
    return this.i18n.t(key, { amount });
  }

  /** "Paid this month" / "Paid 3/12 months" / "Paid" for one item of "My costs". */
  protected myStatus(item: MyCost): { paid: boolean; text: string } {
    if (item.cost.recurrence === 'ONE_TIME') {
      const paid = !!item.paid[0];
      return { paid, text: this.i18n.t(paid ? 'fees.paidCol' : 'fees.notPaid') };
    }
    const m = this.currentMonth();
    if (m >= 0) {
      const paid = !!item.paid[m];
      return { paid, text: this.i18n.t(paid ? 'fees.thisMonthPaid' : 'fees.thisMonthUnpaid') };
    }
    const count = item.paid.filter((p) => p).length;
    return { paid: count === 12, text: this.i18n.t('fees.monthsPaid', { paid: count }) };
  }

  protected money(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency, maximumFractionDigits: 2 })
        .format(value);
    } catch {
      return `${value} ${currency}`;
    }
  }

  // ---------- loading ----------

  private loadAll(showSpinner = true): void {
    forkJoin({ costs: this.api.costs(), units: this.api.units() }).subscribe({
      next: ({ costs, units }) => {
        this.costs.set(costs);
        this.units.set(units);
        const current = this.selectedId();
        if (!current || !costs.some((c) => c.id === current)) {
          this.selectedId.set(costs[0]?.id ?? null);
        }
        this.loadTable(showSpinner);
        this.loadMine();
      },
      error: (e) => {
        this.costs.set(this.costs() ?? []);
        this.toast.error(errorMessage(e));
      },
    });
  }

  private loadTable(showSpinner = true): void {
    const id = this.selectedId();
    if (!id) {
      this.table.set(null);
      return;
    }
    if (showSpinner) this.loadingTable.set(true);
    this.api.costTable(id, this.year()).subscribe({
      next: (t) => {
        if (t.cost.id === this.selectedId()) this.table.set(t);
        this.loadingTable.set(false);
      },
      error: (e) => {
        this.loadingTable.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  private loadMine(): void {
    this.api.myCosts(this.year()).subscribe({
      next: (m) => this.mine.set(m),
      error: () => this.mine.set(null),
    });
  }

  private patchCell(unitId: string, slot: number, value: string | null): void {
    this.table.update((t) =>
      t
        ? {
            ...t,
            rows: t.rows.map((r) =>
              r.unitId === unitId ? { ...r, paid: r.paid.map((p, i) => (i === slot ? value : p)) } : r,
            ),
          }
        : t,
    );
  }
}
