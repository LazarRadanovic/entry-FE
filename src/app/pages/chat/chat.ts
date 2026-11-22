import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { switchMap, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { ChatMessage } from '../../core/models';
import { PresenceService } from '../../core/presence.service';
import { RealtimeService } from '../../core/realtime.service';
import { Avatar } from '../../shared/avatar';
import { LightboxService } from '../../shared/lightbox';
import { ToastService } from '../../shared/toast.service';
import { TranslatePipe, currentLocale, translate } from '../../core/i18n/i18n';

interface Row {
  msg: ChatMessage;
  mine: boolean;
  /** Show a date separator above this message. */
  day: string | null;
  /** Show the sender name (first message of a run from someone else). */
  showSender: boolean;
}

/** Template #10: entrance chat with images and the online-users panel. */
@Component({
  selector: 'app-chat',
  imports: [Avatar, DatePipe, FormsModule, TranslatePipe],
  template: `
    <div class="chat-layout">
      <div class="chat-main">
        <div class="chat-messages" #scroller>
          @if (nextCursor()) {
            <button class="btn btn-secondary btn-small older" (click)="loadOlder()" [disabled]="loadingOlder()">
              {{ (loadingOlder() ? 'common.loading' : 'chat.earlier') | t }}
            </button>
          }
          @if (loading()) {
            <div class="spinner"></div>
          }
          @for (row of rows(); track row.msg.id) {
            @if (row.day) { <div class="day">{{ row.day }}</div> }
            <div class="message" [class.mine]="row.mine" [class.theirs]="!row.mine">
              @if (row.showSender) { <div class="sender">{{ row.msg.sender.firstName }}</div> }
              @if (row.msg.image; as img) {
                <img class="photo" [src]="img.thumbnailUrl" alt="" (click)="lightbox.open(img.url)" />
              }
              @if (row.msg.text) { <div class="text">{{ row.msg.text }}</div> }
              <div class="time">{{ row.msg.createdAt | date: 'HH:mm' }}</div>
            </div>
          } @empty {
            @if (!loading()) {
              <div class="empty-state"><div class="emoji">💬</div>{{ 'chat.empty' | t }}</div>
            }
          }
        </div>

        <form class="chat-input" (ngSubmit)="send()">
          <label class="attach" [title]="'chat.sendPhoto' | t" [class.disabled]="sending()">
            📷
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden (change)="sendImage($event)" />
          </label>
          <input name="text" [(ngModel)]="text" [placeholder]="'chat.placeholder' | t" maxlength="2000" autocomplete="off" />
          <button class="round-send" type="submit" [disabled]="!text.trim() || sending()" [attr.aria-label]="'common.send' | t">➤</button>
        </form>
      </div>

      <aside class="online-panel">
        <h3>{{ 'chat.online' | t: { n: presence.online().length } }}</h3>
        <div class="online-list">
          @for (r of presence.online(); track r.id) {
            <div class="online-user">
              <span class="online-dot"></span>
              <app-avatar [person]="r" [size]="28" />
              <span class="who">{{ r.id === me()?.id ? ('common.you' | t) : r.firstName + ' ' + r.lastName.charAt(0) + '.' }}</span>
            </div>
          }
        </div>
      </aside>
    </div>
  `,
  styleUrl: './chat.css',
})
export class ChatPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly presence = inject(PresenceService);
  protected readonly lightbox = inject(LightboxService);
  protected readonly me = inject(AuthService).user;

  /** Oldest first. */
  private readonly messages = signal<ChatMessage[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingOlder = signal(false);
  protected readonly sending = signal(false);
  protected text = '';
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly rows = computed<Row[]>(() => {
    const myId = this.me()?.id;
    let prevDay = '';
    let prevSender = '';
    return this.messages().map((msg) => {
      const d = new Date(msg.createdAt);
      const dayKey = d.toDateString();
      const day = dayKey !== prevDay ? dayLabel(d) : null;
      const mine = msg.sender.id === myId;
      const showSender = !mine && (msg.sender.id !== prevSender || day !== null);
      prevDay = dayKey;
      prevSender = msg.sender.id;
      return { msg, mine, day, showSender };
    });
  });

  ngOnInit(): void {
    this.api.messages().subscribe({
      next: (page) => {
        this.messages.set([...page.items].reverse());
        this.nextCursor.set(page.nextCursor);
        this.loading.set(false);
        this.scrollToBottom();
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(errorMessage(e));
      },
    });

    this.realtime
      .entrance<ChatMessage>('chat')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        if (e.type === 'MESSAGE_CREATED') this.append(e.payload);
      });
  }

  protected loadOlder(): void {
    const el = this.scroller()?.nativeElement;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    this.loadingOlder.set(true);
    this.api.messages(this.nextCursor()).subscribe({
      next: (page) => {
        const known = new Set(this.messages().map((m) => m.id));
        const older = [...page.items].reverse().filter((m) => !known.has(m.id));
        this.messages.update((l) => [...older, ...l]);
        this.nextCursor.set(page.nextCursor);
        this.loadingOlder.set(false);
        // keep the viewport where it was
        setTimeout(() => el && (el.scrollTop = el.scrollHeight - before));
      },
      error: () => this.loadingOlder.set(false),
    });
  }

  protected send(): void {
    const text = this.text.trim();
    if (!text) return;
    this.sending.set(true);
    this.api.sendMessage(text, null).subscribe({
      next: (m) => {
        this.text = '';
        this.sending.set(false);
        this.append(m);
      },
      error: (e) => {
        this.sending.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected sendImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.toast.error(translate('chat.photoTooLarge'));
      return;
    }
    this.sending.set(true);
    const caption = this.text.trim() || null;
    this.api
      .uploadImage(file)
      .pipe(switchMap((img) => (img ? this.api.sendMessage(caption, img.id) : of(null))))
      .subscribe({
        next: (m) => {
          this.sending.set(false);
          if (caption) this.text = '';
          if (m) this.append(m);
        },
        error: (e) => {
          this.sending.set(false);
          this.toast.error(errorMessage(e, 'chat.photoFailed'));
        },
      });
  }

  /** Messages arrive both from the REST response and over STOMP: de-duplicate by id. */
  private append(m: ChatMessage): void {
    if (this.messages().some((x) => x.id === m.id)) return;
    const el = this.scroller()?.nativeElement;
    const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    this.messages.update((l) => [...l, m]);
    if (nearBottom || m.sender.id === this.me()?.id) this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}

function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return translate('chat.today');
  if (d.toDateString() === yesterday.toDateString()) return translate('chat.yesterday');
  return d.toLocaleDateString(currentLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
}
