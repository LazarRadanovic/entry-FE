import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n/i18n';
import { Announcement } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { applyAnnouncementEvent, datesText, hoursText, kindIcon, todayIso } from './announcement-format';

/** On top of the feed: what's noisy today / soon, and a way in to announce (also on mobile, where it's not in the bottom nav). */
@Component({
  selector: 'app-announcement-strip',
  imports: [RouterLink, TranslatePipe],
  template: `
    @if (items().length) {
      <a routerLink="/announcements" class="strip">
        @for (a of items().slice(0, 3); track a.id) {
          <div class="row" [class.now]="a.ongoing">
            <span class="icon">{{ icon(a) }}</span>
            <span class="text">
              <strong>{{ 'common.apartment' | t }} {{ a.author.apartment }}</strong> · {{ dates(a) }} · {{ hours(a) }}
            </span>
          </div>
        }
        @if (items().length > 3) {
          <div class="more">{{ 'ann.seeAll' | t }} ({{ items().length }})</div>
        }
      </a>
    } @else if (loaded()) {
      <a routerLink="/announcements" class="cta">📢 {{ 'ann.cta' | t }}</a>
    }
  `,
  styles: `
    .strip { display: block; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius); padding: 10px 14px; margin-bottom: 16px; color: inherit; text-decoration: none; }
    .row { display: flex; gap: 10px; align-items: center; padding: 4px 0; font-size: 0.9rem; }
    .row.now strong { color: #b45309; }
    .icon { font-size: 18px; }
    .text { flex: 1; min-width: 0; }
    .more { font-size: 0.8rem; color: var(--muted); padding-top: 4px; }
    .cta { display: block; text-align: center; font-size: 0.85rem; color: var(--muted); padding: 8px; margin-bottom: 12px; border: 1px dashed #cbd5e1; border-radius: var(--radius); text-decoration: none; }
    .cta:hover { color: var(--primary); border-color: var(--primary); }
  `,
})
export class AnnouncementStrip implements OnInit {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<Announcement[]>([]);
  protected readonly loaded = signal(false);
  protected readonly icon = (a: Announcement) => kindIcon(a.kind);
  protected readonly dates = datesText;
  protected readonly hours = hoursText;

  ngOnInit(): void {
    this.api.announcements('ACTIVE').subscribe({
      next: (list) => {
        this.items.set(list);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
    this.realtime
      .entrance<any>('announcements')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => this.items.update((l) => applyAnnouncementEvent(l, e, todayIso())));
  }
}
