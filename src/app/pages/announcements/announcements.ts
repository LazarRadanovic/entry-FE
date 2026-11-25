import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { Announcement, AnnouncementKind, AnnouncementRequest } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { Avatar } from '../../shared/avatar';
import { ToastService } from '../../shared/toast.service';
import { KINDS, applyAnnouncementEvent, datesText, hoursText, kindIcon, todayIso } from './announcement-format';

type Tab = 'ACTIVE' | 'PAST';

/** "I'm renovating / having a celebration": tell the neighbours before the noise starts. */
@Component({
  selector: 'app-announcements',
  imports: [FormsModule, TranslatePipe, Avatar],
  template: `
    <div class="page-header">
      <h1 class="page-title">{{ 'ann.title' | t }}</h1>
      <button class="btn btn-primary btn-small" (click)="openCreate()">{{ 'ann.new' | t }}</button>
    </div>
    <p class="muted intro">{{ 'ann.intro' | t }}</p>

    <div class="tabs">
      <button class="tab" [class.active]="tab() === 'ACTIVE'" (click)="switchTab('ACTIVE')">{{ 'ann.active' | t }}</button>
      <button class="tab" [class.active]="tab() === 'PAST'" (click)="switchTab('PAST')">{{ 'ann.past' | t }}</button>
    </div>

    @if (loading()) {
      <div class="spinner"></div>
    } @else {
      @for (a of items(); track a.id) {
        <div class="ann-card" [class.now]="a.ongoing">
          <div class="ann-top">
            <span class="kind-icon">{{ icon(a) }}</span>
            <div class="ann-main">
              <div class="ann-title">
                {{ kindLabel(a.kind) }} · {{ 'common.apartment' | t }} {{ a.author.apartment }}
                @if (a.ongoing) { <span class="badge-now">{{ 'ann.now' | t }}</span> }
              </div>
              <div class="ann-when">📅 {{ dates(a) }} &nbsp; 🕒 {{ hours(a) }}</div>
            </div>
            @if (canEdit(a) && tab() === 'ACTIVE') {
              <button class="icon-btn small" [title]="'ann.edit' | t" (click)="openEdit(a)">✏️</button>
              <button class="icon-btn small" [title]="'ann.delete' | t" (click)="remove(a)">🗑️</button>
            }
          </div>
          @if (a.note) { <div class="ann-note">{{ a.note }}</div> }
          <div class="ann-author">
            <app-avatar [person]="a.author" [size]="22" />
            {{ a.author.firstName }} {{ a.author.lastName }} · {{ 'common.floorApt' | t: { floor: a.author.floor, apt: a.author.apartment } }}
          </div>
        </div>
      } @empty {
        <div class="empty-state">
          <div class="emoji">🤫</div>
          {{ (tab() === 'ACTIVE' ? 'ann.emptyActive' : 'ann.emptyPast') | t }}
        </div>
      }
    }

    @if (editing(); as mode) {
      <div class="modal-overlay" (click)="editing.set(null)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <h2>{{ (mode === 'new' ? 'ann.createTitle' : 'ann.editTitle') | t }}</h2>

          <div class="kinds">
            @for (k of kinds; track k.kind) {
              <button type="button" class="kind" [class.active]="form.kind === k.kind" (click)="form.kind = k.kind">
                <span>{{ k.icon }}</span> {{ k.label | t }}
              </button>
            }
          </div>

          <div class="row">
            <div class="form-group">
              <label for="sd">{{ 'ann.from' | t }}</label>
              <input id="sd" type="date" name="startDate" [(ngModel)]="form.startDate" [min]="minStart" (ngModelChange)="startChanged()" required />
            </div>
            <div class="form-group">
              <label for="ed">{{ 'ann.to' | t }}</label>
              <input id="ed" type="date" name="endDate" [(ngModel)]="form.endDate" [min]="form.startDate" required />
            </div>
          </div>

          <label class="check">
            <input type="checkbox" name="allDay" [(ngModel)]="allDay" /> {{ 'ann.allDay' | t }}
          </label>
          @if (!allDay) {
            <div class="row">
              <div class="form-group">
                <label for="ft">{{ 'ann.hoursFrom' | t }}</label>
                <input id="ft" type="time" name="fromTime" [(ngModel)]="fromTime" required />
              </div>
              <div class="form-group">
                <label for="tt">{{ 'ann.hoursTo' | t }}</label>
                <input id="tt" type="time" name="toTime" [(ngModel)]="toTime" required />
              </div>
            </div>
          }

          <div class="form-group">
            <label for="note">{{ 'ann.note' | t }}</label>
            <textarea id="note" name="note" [(ngModel)]="form.note" maxlength="500" [placeholder]="'ann.notePh' | t"></textarea>
          </div>
          @if (mode === 'new') { <p class="muted hint">{{ 'ann.notifyHint' | t }}</p> }

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="editing.set(null)">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn btn-primary" [disabled]="!valid() || saving()">
              {{ (saving() ? 'common.saving' : mode === 'new' ? 'ann.publish' : 'common.save') | t }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .intro { font-size: 0.9rem; margin: -8px 0 16px; }
    .ann-card { background: var(--card); border-radius: var(--radius); padding: 16px; margin-bottom: 14px; box-shadow: var(--shadow); border-left: 4px solid transparent; }
    .ann-card.now { border-left-color: #f59e0b; }
    .ann-top { display: flex; gap: 12px; align-items: flex-start; }
    .kind-icon { font-size: 26px; line-height: 1; }
    .ann-main { flex: 1; min-width: 0; }
    .ann-title { font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .badge-now { background: #fef3c7; color: #b45309; font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
    .ann-when { font-size: 0.88rem; color: var(--muted); margin-top: 4px; }
    .small { width: 32px; height: 32px; font-size: 15px; opacity: 0.7; }
    .ann-note { margin-top: 10px; white-space: pre-wrap; font-size: 0.95rem; }
    .ann-author { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 0.8rem; color: var(--muted); }
    .kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
    .kind { border: 1px solid #e2e8f0; background: var(--card); border-radius: 10px; padding: 10px; cursor: pointer; font-size: 0.9rem; text-align: left; }
    .kind.active { border-color: var(--primary); background: #eff6ff; color: var(--primary); font-weight: 600; }
    .check { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; font-size: 0.9rem; cursor: pointer; }
    .form-group textarea { min-height: 80px; }
    .hint { font-size: 0.85rem; }
  `,
})
export class AnnouncementsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly kinds = KINDS;
  protected readonly tab = signal<Tab>('ACTIVE');
  protected readonly items = signal<Announcement[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  /** null = closed, 'new' = creating, otherwise the id being edited. */
  protected readonly editing = signal<string | null>(null);

  protected form: AnnouncementRequest = this.blank();
  protected allDay = false;
  protected fromTime = '08:00';
  protected toTime = '16:00';
  protected minStart = todayIso();

  protected readonly icon = (a: Announcement) => kindIcon(a.kind);
  protected readonly dates = datesText;
  protected readonly hours = hoursText;

  ngOnInit(): void {
    this.load();
    this.realtime
      .entrance<any>('announcements')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        if (this.tab() === 'ACTIVE') this.items.update((l) => applyAnnouncementEvent(l, e, todayIso()));
      });
  }

  protected kindLabel(kind: AnnouncementKind): string {
    return translate(KINDS.find((k) => k.kind === kind)!.label);
  }

  protected canEdit(a: Announcement): boolean {
    return this.auth.isAdmin() || a.author.id === this.auth.user()?.id;
  }

  protected switchTab(tab: Tab): void {
    if (tab === this.tab()) return;
    this.tab.set(tab);
    this.load();
  }

  protected openCreate(): void {
    this.form = this.blank();
    this.allDay = false;
    this.fromTime = '08:00';
    this.toTime = '16:00';
    this.minStart = todayIso();
    this.editing.set('new');
  }

  protected openEdit(a: Announcement): void {
    this.form = { kind: a.kind, startDate: a.startDate, endDate: a.endDate, fromTime: null, toTime: null, note: a.note };
    this.allDay = !a.fromTime;
    this.fromTime = a.fromTime?.slice(0, 5) ?? '08:00';
    this.toTime = a.toTime?.slice(0, 5) ?? '16:00';
    // an announcement that already started keeps its start date
    this.minStart = a.startDate < todayIso() ? a.startDate : todayIso();
    this.editing.set(a.id);
  }

  protected startChanged(): void {
    if (this.form.endDate < this.form.startDate) this.form.endDate = this.form.startDate;
  }

  protected valid(): boolean {
    const f = this.form;
    if (!f.startDate || !f.endDate || f.endDate < f.startDate) return false;
    return this.allDay || (!!this.fromTime && !!this.toTime && this.fromTime !== this.toTime);
  }

  protected save(): void {
    if (!this.valid()) return;
    const id = this.editing();
    const body: AnnouncementRequest = {
      ...this.form,
      fromTime: this.allDay ? null : this.fromTime,
      toTime: this.allDay ? null : this.toTime,
      note: this.form.note?.trim() || null,
    };
    this.saving.set(true);
    const req = id === 'new' ? this.api.createAnnouncement(body) : this.api.updateAnnouncement(id!, body);
    req.subscribe({
      next: (a) => {
        this.saving.set(false);
        this.editing.set(null);
        if (this.tab() !== 'ACTIVE') this.switchTab('ACTIVE');
        else this.items.update((l) => applyAnnouncementEvent(l, { type: 'ANNOUNCEMENT_UPDATED', payload: a }, todayIso()));
        this.toast.success(translate(id === 'new' ? 'ann.published' : 'ann.saved'));
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected remove(a: Announcement): void {
    if (!confirm(translate('ann.confirmDelete'))) return;
    this.api.deleteAnnouncement(a.id).subscribe({
      next: () => this.items.update((l) => l.filter((x) => x.id !== a.id)),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  private blank(): AnnouncementRequest {
    const today = todayIso();
    return { kind: 'RENOVATION', startDate: today, endDate: today, fromTime: null, toTime: null, note: '' };
  }

  private load(): void {
    this.loading.set(true);
    this.api.announcements(this.tab()).subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
