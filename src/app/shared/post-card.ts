import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/errors';
import { Post } from '../core/models';
import { Avatar } from './avatar';
import { LightboxService } from './lightbox';
import { TimeAgoPipe } from './time-ago.pipe';
import { TranslatePipe, translate } from '../core/i18n/i18n';
import { ToastService } from './toast.service';

/** Feed post card (template #7). Handles like/unlike and delete itself and reports changes. */
@Component({
  selector: 'app-post-card',
  imports: [Avatar, RouterLink, TimeAgoPipe, TranslatePipe],
  template: `
    <article class="post-card">
      <div class="post-header">
        <a [routerLink]="['/residents', post().author.id]"><app-avatar [person]="post().author" /></a>
        <div class="post-meta">
          <a class="post-author" [routerLink]="['/residents', post().author.id]">
            {{ post().author.firstName }} {{ post().author.lastName }}
          </a>
          <div class="post-time">{{ post().createdAt | timeAgo }} · {{ 'common.floor' | t }} {{ post().author.floor }}</div>
        </div>
        @if (canDelete()) {
          <button class="icon-btn menu" [title]="'post.deleteTitle' | t" (click)="remove()" [disabled]="busy()">🗑️</button>
        }
      </div>

      @if (post().text) {
        <div class="post-body">{{ post().text }}</div>
      }

      @if (post().images.length) {
        <div class="post-images" [class.single]="post().images.length === 1">
          @for (img of post().images; track img.id) {
            <img [src]="img.thumbnailUrl" alt="" loading="lazy" (click)="lightbox.open(img.url)" />
          }
        </div>
      }

      <div class="post-actions">
        <button (click)="toggleLike()" [class.liked]="post().likedByMe" [attr.aria-pressed]="post().likedByMe">
          {{ post().likedByMe ? '❤️' : '🤍' }} {{ post().likeCount }}
        </button>
        <a [routerLink]="['/feed', post().id]">💬 {{ post().commentCount }}</a>
      </div>
    </article>
  `,
  styles: `
    .post-card { background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 16px; overflow: hidden; }
    .post-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px 10px; }
    .post-meta { flex: 1; min-width: 0; }
    .post-author { font-weight: 600; font-size: 0.95rem; color: var(--text); text-decoration: none; }
    .post-time { font-size: 0.8rem; color: var(--muted); }
    .menu { font-size: 16px; width: 34px; height: 34px; opacity: 0.6; }
    .menu:hover { opacity: 1; }
    .post-body { padding: 0 16px 12px; font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
    .post-images { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
    .post-images img { width: 100%; aspect-ratio: 1; object-fit: cover; cursor: zoom-in; background: #e2e8f0; }
    .post-images.single { grid-template-columns: 1fr; }
    .post-images.single img { aspect-ratio: 16/10; }
    .post-actions { display: flex; gap: 16px; padding: 12px 16px; border-top: 1px solid var(--border); font-size: 0.9rem; }
    .post-actions button, .post-actions a {
      background: none; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer;
      color: var(--muted); font-size: 0.9rem; text-decoration: none;
    }
    .post-actions button:hover, .post-actions a:hover { color: var(--primary); }
    .post-actions .liked { color: #e11d48; }
  `,
})
export class PostCard {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly lightbox = inject(LightboxService);

  readonly post = input.required<Post>();
  readonly changed = output<Post>();
  readonly deleted = output<string>();

  protected readonly busy = signal(false);
  protected readonly canDelete = computed(
    () => this.auth.isAdmin() || this.post().author.id === this.auth.user()?.id,
  );

  protected toggleLike(): void {
    const p = this.post();
    const like = !p.likedByMe;
    // optimistic update
    this.changed.emit({ ...p, likedByMe: like, likeCount: p.likeCount + (like ? 1 : -1) });
    this.api.like(p.id, like).subscribe({
      next: (r) => this.changed.emit({ ...this.post(), likedByMe: r.likedByMe, likeCount: r.likeCount }),
      error: (e) => {
        this.changed.emit(p);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected remove(): void {
    if (!confirm(translate('post.confirmDelete'))) return;
    this.busy.set(true);
    this.api.deletePost(this.post().id).subscribe({
      next: () => this.deleted.emit(this.post().id),
      error: (e) => {
        this.busy.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
