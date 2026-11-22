import { Component, DestroyRef, ElementRef, OnInit, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { Comment, Post } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { Avatar } from '../../shared/avatar';
import { LightboxService } from '../../shared/lightbox';
import { TimeAgoPipe } from '../../shared/time-ago.pipe';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { ToastService } from '../../shared/toast.service';

/** Template #8: post + comments in a bottom sheet over the feed (route /feed/:postId). */
@Component({
  selector: 'app-post-sheet',
  imports: [Avatar, FormsModule, RouterLink, TimeAgoPipe, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="overlay" (click)="close()">
      <div class="bottom-sheet" (click)="$event.stopPropagation()" role="dialog" [attr.aria-label]="'sheet.comments' | t">
        <div class="sheet-header">
          <h2>{{ 'sheet.comments' | t }}</h2>
          <button class="close-btn" (click)="close()" [attr.aria-label]="'common.close' | t">✕</button>
        </div>

        <div class="sheet-body" #body>
          @if (post(); as p) {
            <div class="original">
              <div class="who">
                <app-avatar [person]="p.author" [size]="36" />
                <div>
                  <a class="name" [routerLink]="['/residents', p.author.id]">{{ p.author.firstName }} {{ p.author.lastName }}</a>
                  <div class="time">{{ p.createdAt | timeAgo }}</div>
                </div>
              </div>
              @if (p.text) { <p class="text">{{ p.text }}</p> }
              @if (p.images.length) {
                <div class="thumbs">
                  @for (img of p.images; track img.id) {
                    <img [src]="img.thumbnailUrl" alt="" (click)="lightbox.open(img.url)" />
                  }
                </div>
              }
            </div>

            @for (c of comments(); track c.id) {
              <div class="comment">
                <app-avatar [person]="c.author" [size]="36" />
                <div class="comment-content">
                  <div class="comment-author">{{ c.author.firstName }} {{ c.author.lastName }}</div>
                  <div class="comment-text">{{ c.text }}</div>
                  <div class="comment-time">
                    {{ c.createdAt | timeAgo }}
                    @if (c.author.id === me()?.id || auth.isAdmin()) {
                      · <button class="link" (click)="deleteComment(c)">{{ 'common.delete' | t }}</button>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <p class="muted" style="text-align:center;padding:16px 0">{{ 'sheet.noComments' | t }}</p>
            }
          } @else if (notFound()) {
            <p class="muted" style="text-align:center;padding:24px 0">{{ 'sheet.gone' | t }}</p>
          } @else {
            <div class="spinner"></div>
          }
        </div>

        @if (post()) {
          <form class="comment-input-bar" (ngSubmit)="send()">
            <input name="text" [(ngModel)]="text" [placeholder]="'sheet.placeholder' | t" maxlength="1000" autocomplete="off" />
            <button class="round-send" type="submit" [disabled]="!text.trim() || sending()" [attr.aria-label]="'common.send' | t">➤</button>
          </form>
        }
      </div>
    </div>
  `,
  styles: `
    .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
    @media (min-width: 900px) { .overlay { align-items: center; } .bottom-sheet { border-radius: 20px !important; } }
    .bottom-sheet { background: var(--card); width: 100%; max-width: 520px; max-height: 90vh; border-radius: 20px 20px 0 0; overflow: hidden; display: flex; flex-direction: column; animation: up 0.2s ease; }
    @keyframes up { from { transform: translateY(24px); opacity: 0.6; } }
    .sheet-header { padding: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .sheet-header h2 { font-size: 1.1rem; }
    .close-btn { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: var(--muted); }
    .sheet-body { overflow-y: auto; flex: 1; padding: 16px; }
    .original { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .who { display: flex; gap: 10px; margin-bottom: 8px; }
    .name { font-weight: 600; font-size: 0.9rem; color: var(--text); text-decoration: none; }
    .time { font-size: 0.8rem; color: var(--muted); }
    .text { font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
    .thumbs { display: flex; gap: 6px; margin-top: 10px; overflow-x: auto; }
    .thumbs img { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; cursor: zoom-in; }
    .comment { display: flex; gap: 12px; margin-bottom: 16px; }
    .comment-content { flex: 1; min-width: 0; }
    .comment-author { font-weight: 600; font-size: 0.9rem; }
    .comment-text { font-size: 0.9rem; margin-top: 2px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
    .comment-time { font-size: 0.75rem; color: var(--muted); margin-top: 4px; }
    .link { background: none; border: none; color: var(--muted); font-size: 0.75rem; cursor: pointer; text-decoration: underline; }
    .comment-input-bar { display: flex; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); background: var(--card); padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
    .comment-input-bar input { flex: 1; border: 1px solid var(--border); border-radius: 20px; padding: 10px 16px; font-size: 0.95rem; }
    .comment-input-bar input:focus { outline: none; border-color: var(--primary); }
  `,
})
export class PostSheet implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  protected readonly lightbox = inject(LightboxService);

  /** Bound from the :postId route parameter. */
  readonly postId = input.required<string>();

  protected readonly me = this.auth.user;
  protected readonly post = signal<Post | null>(null);
  protected readonly comments = signal<Comment[]>([]);
  protected readonly notFound = signal(false);
  protected readonly sending = signal(false);
  protected text = '';
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  constructor() {
    effect(() => {
      const id = this.postId();
      untracked(() => this.load(id));
    });
  }

  ngOnInit(): void {
    this.realtime
      .entrance<Comment>('feed')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        if (e.type === 'COMMENT_CREATED' && e.payload.postId === this.postId()) this.append(e.payload);
      });
  }

  protected close(): void {
    this.router.navigate(['/feed']);
  }

  protected send(): void {
    const text = this.text.trim();
    if (!text) return;
    this.sending.set(true);
    this.api.addComment(this.postId(), text).subscribe({
      next: (c) => {
        this.text = '';
        this.sending.set(false);
        this.append(c);
      },
      error: (e) => {
        this.sending.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected deleteComment(c: Comment): void {
    if (!confirm(translate('sheet.confirmDelete'))) return;
    this.api.deleteComment(this.postId(), c.id).subscribe({
      next: () => this.comments.update((l) => l.filter((x) => x.id !== c.id)),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  private load(id: string): void {
    this.post.set(null);
    this.notFound.set(false);
    this.api.post(id).subscribe({
      next: (p) => this.post.set(p),
      error: () => this.notFound.set(true),
    });
    this.api.comments(id).subscribe({ next: (c) => this.comments.set(c), error: () => undefined });
  }

  private append(c: Comment): void {
    if (this.comments().some((x) => x.id === c.id)) return;
    this.comments.update((l) => [...l, c]);
    setTimeout(() => {
      const el = this.body()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
