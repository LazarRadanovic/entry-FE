import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { Poll, PollResults } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { untilText } from '../../shared/time-ago.pipe';
import { ToastService } from '../../shared/toast.service';
import { I18nKey, TranslatePipe, TranslatePluralPipe, translate } from '../../core/i18n/i18n';

type Tab = 'ACTIVE' | 'EXPIRED';

/** Templates #11 (list) and #12 (create modal). Results update live for everyone. */
@Component({
  selector: 'app-polls',
  imports: [FormsModule, TranslatePipe, TranslatePluralPipe],
  template: `
    <div class="page-header">
      <h1 class="page-title">{{ 'polls.title' | t }}</h1>
      <button class="btn btn-primary btn-small" (click)="openCreate()">{{ 'polls.newPoll' | t }}</button>
    </div>

    <div class="tabs">
      <button class="tab" [class.active]="tab() === 'ACTIVE'" (click)="switchTab('ACTIVE')">{{ 'polls.active' | t }}</button>
      <button class="tab" [class.active]="tab() === 'EXPIRED'" (click)="switchTab('EXPIRED')">{{ 'polls.expired' | t }}</button>
    </div>

    @if (loading()) {
      <div class="spinner"></div>
    } @else {
      @for (poll of polls(); track poll.id) {
        <div class="poll-card">
          <div class="poll-top">
            <div class="poll-question">{{ poll.question }}</div>
            @if (canDelete(poll)) {
              <button class="icon-btn del" [title]="'polls.deleteTitle' | t" (click)="remove(poll)">🗑️</button>
            }
          </div>
          <div class="poll-meta">
            {{ 'polls.createdBy' | t: { name: poll.author.firstName } }} · {{ until(poll) }} ·
            {{ 'polls.votes' | tp: poll.results.totalVotes }}
          </div>

          @for (opt of options; track opt.value) {
            <button
              class="poll-option"
              [class.voted]="poll.myVote === opt.value"
              [disabled]="poll.expired || voting() === poll.id"
              (click)="vote(poll, opt.value)"
            >
              <div class="poll-option-header">
                <span>{{ opt.label | t }} @if (poll.myVote === opt.value) { ✓ }</span>
                <span>{{ percent(poll.results, opt.value) }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="percent(poll.results, opt.value)"></div>
              </div>
            </button>
          }

          <div class="poll-footer">
            <span>
              @if (poll.myVote === null) {
                {{ (poll.expired ? 'polls.ended' : 'polls.tapToVote') | t }}
              } @else {
                {{ 'polls.youVoted' | t: { choice: ((poll.myVote ? 'common.yes' : 'common.no') | t) } }}{{ poll.expired ? '' : ('polls.tapToChange' | t) }}
              }
            </span>
            <span>{{ 'polls.yesNo' | t: { yes: poll.results.yesCount, no: poll.results.noCount } }}</span>
          </div>
        </div>
      } @empty {
        <div class="empty-state">
          <div class="emoji">📊</div>
          {{ (tab() === 'ACTIVE' ? 'polls.emptyActive' : 'polls.emptyExpired') | t }}
        </div>
      }
    }

    @if (creating()) {
      <div class="modal-overlay" (click)="creating.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="create()">
          <h2>{{ 'polls.createTitle' | t }}</h2>
          <div class="form-group">
            <label for="q">{{ 'polls.question' | t }}</label>
            <input id="q" name="question" [(ngModel)]="question" [placeholder]="'polls.questionPh' | t" maxlength="300" />
          </div>
          <div class="form-group">
            <label for="d">{{ 'polls.duration' | t }}</label>
            <select id="d" name="duration" [(ngModel)]="durationDays">
              @for (d of [1, 3, 7, 14]; track d) {
                <option [ngValue]="d">{{ 'polls.days' | tp: d }}</option>
              }
              <option [ngValue]="0">{{ 'polls.noEnd' | t }}</option>
            </select>
          </div>
          <p class="muted" style="font-size:0.85rem">{{ 'polls.fixed' | t }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="creating.set(false)">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn btn-primary" [disabled]="!question.trim() || saving()">
              {{ (saving() ? 'polls.creating' : 'polls.create') | t }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .poll-card { background: var(--card); border-radius: var(--radius); padding: 18px; margin-bottom: 14px; box-shadow: var(--shadow); }
    .poll-top { display: flex; gap: 8px; align-items: flex-start; }
    .poll-question { font-weight: 600; font-size: 1.05rem; margin-bottom: 6px; flex: 1; }
    .del { width: 32px; height: 32px; font-size: 15px; opacity: 0.6; }
    .poll-meta { font-size: 0.8rem; color: var(--muted); margin-bottom: 16px; }
    .poll-option { display: block; width: 100%; text-align: left; background: none; border: none; padding: 4px 0; margin-bottom: 8px; cursor: pointer; }
    .poll-option:disabled { cursor: default; }
    .poll-option:not(:disabled):hover .progress-bar { background: #cbd5e1; }
    .poll-option-header { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 4px; }
    .progress-bar { height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden; transition: background 0.15s; }
    .progress-fill { height: 100%; background: var(--primary); border-radius: 6px; transition: width 0.4s ease; }
    .poll-option.voted .progress-fill { background: var(--success); }
    .poll-option.voted .poll-option-header { font-weight: 600; }
    .poll-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 8px; font-size: 0.85rem; color: var(--muted); }
  `,
})
export class PollsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly options: { value: boolean; label: I18nKey }[] = [
    { value: true, label: 'common.yes' },
    { value: false, label: 'common.no' },
  ];
  protected readonly tab = signal<Tab>('ACTIVE');
  protected readonly polls = signal<Poll[]>([]);
  protected readonly loading = signal(true);
  protected readonly voting = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected question = '';
  protected durationDays = 3;

  ngOnInit(): void {
    this.load();
    this.realtime
      .entrance<any>('polls')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        if (e.type === 'POLL_CREATED' && this.tab() === 'ACTIVE') {
          const poll = e.payload as Poll;
          if (!this.polls().some((p) => p.id === poll.id)) this.polls.update((l) => [poll, ...l]);
        } else if (e.type === 'POLL_RESULTS') {
          const r = e.payload as PollResults;
          this.polls.update((l) => l.map((p) => (p.id === r.pollId ? { ...p, results: r } : p)));
        } else if (e.type === 'POLL_DELETED') {
          this.polls.update((l) => l.filter((p) => p.id !== e.payload.pollId));
        }
      });
  }

  protected switchTab(tab: Tab): void {
    if (tab === this.tab()) return;
    this.tab.set(tab);
    this.load();
  }

  protected until(p: Poll): string {
    return untilText(p.expiresAt);
  }

  protected percent(r: PollResults, yes: boolean): number {
    return yes ? r.yesPercent : r.noPercent;
  }

  protected canDelete(p: Poll): boolean {
    return this.auth.isAdmin() || p.author.id === this.auth.user()?.id;
  }

  protected vote(poll: Poll, value: boolean): void {
    if (poll.expired || poll.myVote === value) return;
    this.voting.set(poll.id);
    this.api.vote(poll.id, value).subscribe({
      next: (updated) => {
        this.voting.set(null);
        this.polls.update((l) => l.map((p) => (p.id === updated.id ? updated : p)));
      },
      error: (e) => {
        this.voting.set(null);
        this.toast.error(errorMessage(e));
        this.load();
      },
    });
  }

  protected remove(poll: Poll): void {
    if (!confirm(translate('polls.confirmDelete'))) return;
    this.api.deletePoll(poll.id).subscribe({
      next: () => this.polls.update((l) => l.filter((p) => p.id !== poll.id)),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected openCreate(): void {
    this.question = '';
    this.durationDays = 3;
    this.creating.set(true);
  }

  protected create(): void {
    const q = this.question.trim();
    if (!q) return;
    const expiresAt = this.durationDays
      ? new Date(Date.now() + this.durationDays * 86_400_000).toISOString()
      : null;
    this.saving.set(true);
    this.api.createPoll(q, expiresAt).subscribe({
      next: (poll) => {
        this.saving.set(false);
        this.creating.set(false);
        if (this.tab() !== 'ACTIVE') this.switchTab('ACTIVE');
        else if (!this.polls().some((p) => p.id === poll.id)) this.polls.update((l) => [poll, ...l]);
        this.toast.success(translate('polls.created'));
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.polls(this.tab()).subscribe({
      next: (list) => {
        this.polls.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
