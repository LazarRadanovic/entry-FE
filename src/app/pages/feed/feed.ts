import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { Post } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { PostCard } from '../../shared/post-card';
import { AnnouncementStrip } from '../announcements/announcement-strip';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Template #7. Live: new posts appear on top, like/comment counts update. */
@Component({
  selector: 'app-feed',
  imports: [PostCard, AnnouncementStrip, RouterLink, RouterOutlet, TranslatePipe],
  template: `
    <div class="page-header">
      <h1 class="page-title">{{ 'feed.title' | t }}</h1>
      <a routerLink="/new-post" class="btn btn-primary btn-small">{{ 'feed.newPost' | t }}</a>
    </div>

    <nav class="quick-links">
      <a routerLink="/announcements">📢 {{ 'nav.announcements' | t }}</a>
      <a routerLink="/lost-found">🔑 {{ 'nav.lostFound' | t }}</a>
    </nav>

    <app-announcement-strip />

    @if (loading()) {
      @for (i of [1, 2, 3]; track i) {
        <div class="card sk">
          <div class="sk-head"><div class="skeleton circle"></div><div class="skeleton line"></div></div>
          <div class="skeleton text"></div>
        </div>
      }
    } @else if (error()) {
      <div class="empty-state">
        <div class="emoji">⚠️</div>
        {{ error() }}
        <div style="margin-top:16px"><button class="btn btn-secondary" (click)="load()">{{ 'common.tryAgain' | t }}</button></div>
      </div>
    } @else {
      @for (post of posts(); track post.id) {
        <app-post-card [post]="post" (changed)="replace($event)" (deleted)="remove($event)" />
      } @empty {
        <div class="empty-state">
          <div class="emoji">🏠</div>
          {{ 'feed.empty' | t }}
        </div>
      }
      @if (nextCursor()) {
        <button class="btn btn-secondary btn-block" (click)="loadMore()" [disabled]="loadingMore()">
          {{ (loadingMore() ? 'common.loading' : 'common.loadMore') | t }}
        </button>
      }
    }

    <router-outlet />
  `,
  styles: `
    .quick-links { display: flex; gap: 8px; margin-bottom: 12px; overflow-x: auto; }
    .quick-links a { flex-shrink: 0; background: var(--card); box-shadow: var(--shadow); border-radius: 16px; padding: 6px 14px; font-size: 0.85rem; color: inherit; text-decoration: none; }
    @media (min-width: 900px) { .quick-links { display: none; } }
    .sk { padding: 16px; margin-bottom: 16px; }
    .sk-head { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; }
    .circle { width: 40px; height: 40px; border-radius: 50%; }
    .line { height: 14px; width: 40%; }
    .text { height: 48px; }
  `,
})
export class FeedPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly posts = signal<Post[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
    this.realtime
      .entrance<any>('feed')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        switch (e.type) {
          case 'POST_CREATED': {
            const post = e.payload as Post;
            if (!this.posts().some((p) => p.id === post.id)) this.posts.update((l) => [post, ...l]);
            break;
          }
          case 'POST_DELETED':
            this.remove(e.payload.postId);
            break;
          case 'POST_STATS':
            this.posts.update((l) =>
              l.map((p) =>
                p.id === e.payload.postId
                  ? { ...p, likeCount: e.payload.likeCount, commentCount: e.payload.commentCount }
                  : p,
              ),
            );
            break;
        }
      });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.posts().subscribe({
      next: (page) => {
        this.posts.set(page.items);
        this.nextCursor.set(page.nextCursor);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected loadMore(): void {
    this.loadingMore.set(true);
    this.api.posts(this.nextCursor()).subscribe({
      next: (page) => {
        const known = new Set(this.posts().map((p) => p.id));
        this.posts.update((l) => [...l, ...page.items.filter((p) => !known.has(p.id))]);
        this.nextCursor.set(page.nextCursor);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  protected replace(post: Post): void {
    this.posts.update((l) => l.map((p) => (p.id === post.id ? post : p)));
  }

  protected remove(id: string): void {
    this.posts.update((l) => l.filter((p) => p.id !== id));
  }
}
