import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Post, Resident } from '../../core/models';
import { PresenceService } from '../../core/presence.service';
import { Avatar } from '../../shared/avatar';
import { PostCard } from '../../shared/post-card';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Template #14, plus the resident's posts. */
@Component({
  selector: 'app-resident-profile',
  imports: [Avatar, PostCard, RouterLink, TranslatePipe],
  template: `
    <a routerLink="/residents" class="back">{{ 'resident.back' | t }}</a>

    @if (resident(); as r) {
      <div class="card profile-header">
        <app-avatar [person]="r" [size]="96" />
        <h1>{{ r.firstName }} {{ r.lastName }}</h1>
        <div class="detail">{{ 'common.floorApt' | t: { floor: r.floor, apt: r.apartment } }}</div>
        @if (presence.isOnline(r.id)) {
          <div class="online"><span class="online-dot"></span> {{ 'resident.onlineNow' | t }}</div>
        }
        @if (r.id === auth.user()?.id) {
          <a routerLink="/profile" class="btn btn-secondary btn-small" style="margin-top:14px">{{ 'resident.editMine' | t }}</a>
        }
      </div>

      <div class="card info-list">
        <div class="info-item"><span>{{ 'resident.role' | t }}</span><span>{{ (r.role === 'ENTRANCE_ADMIN' ? 'resident.roleAdmin' : 'resident.roleResident') | t }}</span></div>
        <div class="info-item"><span>{{ 'common.floor' | t }}</span><span>{{ r.floor }}</span></div>
        <div class="info-item"><span>{{ 'common.apartment' | t }}</span><span>{{ r.apartment }}</span></div>
      </div>

      <h2 class="section-title">{{ 'resident.posts' | t }}</h2>
      @for (p of posts(); track p.id) {
        <app-post-card [post]="p" (changed)="replace($event)" (deleted)="removePost($event)" />
      } @empty {
        <p class="muted" style="text-align:center;padding:16px">{{ 'resident.noPosts' | t }}</p>
      }
      @if (nextCursor()) {
        <button class="btn btn-secondary btn-block" (click)="more()">{{ 'common.loadMore' | t }}</button>
      }
    } @else if (notFound()) {
      <div class="empty-state"><div class="emoji">🤷</div>{{ 'resident.notFound' | t }}</div>
    } @else {
      <div class="spinner"></div>
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 14px; text-decoration: none; font-weight: 500; font-size: 0.9rem; }
    .profile-header { padding: 28px 20px; text-align: center; margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; }
    .profile-header app-avatar { margin-bottom: 14px; }
    .profile-header h1 { font-size: 1.4rem; margin-bottom: 4px; }
    .detail { color: var(--muted); font-size: 0.95rem; }
    .online { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 0.85rem; color: var(--success); }
    .info-list { overflow: hidden; margin-bottom: 24px; }
    .info-item { display: flex; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border); font-size: 0.95rem; }
    .info-item:last-child { border-bottom: none; }
    .info-item span:first-child { color: var(--muted); }
    .section-title { font-size: 1.1rem; margin-bottom: 12px; }
  `,
})
export class ResidentProfilePage {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly presence = inject(PresenceService);

  readonly id = input.required<string>();
  protected readonly resident = signal<Resident | null>(null);
  protected readonly posts = signal<Post[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly notFound = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected more(): void {
    this.api.posts(this.nextCursor(), this.id()).subscribe((page) => {
      this.posts.update((l) => [...l, ...page.items]);
      this.nextCursor.set(page.nextCursor);
    });
  }

  protected replace(p: Post): void {
    this.posts.update((l) => l.map((x) => (x.id === p.id ? p : x)));
  }

  protected removePost(id: string): void {
    this.posts.update((l) => l.filter((x) => x.id !== id));
  }

  private load(id: string): void {
    this.resident.set(null);
    this.notFound.set(false);
    this.api.resident(id).subscribe({ next: (r) => this.resident.set(r), error: () => this.notFound.set(true) });
    this.api.posts(null, id).subscribe({
      next: (page) => {
        this.posts.set(page.items);
        this.nextCursor.set(page.nextCursor);
      },
      error: () => undefined,
    });
  }
}
