import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from './api.service';
import { Resident } from './models';
import { RealtimeService } from './realtime.service';

/** Who is online in my entrance (initial REST load, then live PRESENCE events). */
@Injectable({ providedIn: 'root' })
export class PresenceService {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private sub?: Subscription;

  readonly online = signal<Resident[]>([]);
  readonly onlineIds = computed(() => new Set(this.online().map((r) => r.id)));

  start(): void {
    this.sub = this.realtime.entrance('presence').subscribe(() => this.reload());
    // Reload on every (re)connect: by then our own session is registered and we can't have missed events.
    this.sub.add(this.realtime.connected$.subscribe(() => this.reload()));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.online.set([]);
  }

  isOnline(id: string): boolean {
    return this.onlineIds().has(id);
  }

  private reload(): void {
    this.api.online().subscribe({ next: (list) => this.online.set(list), error: () => undefined });
  }
}
