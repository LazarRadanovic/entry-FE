import { Injectable, inject, signal } from '@angular/core';
import { RxStomp, RxStompState } from '@stomp/rx-stomp';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { RealtimeEvent } from './models';

/**
 * One STOMP-over-WebSocket connection for the whole app. Authenticates on CONNECT with a fresh access
 * token (also on every automatic reconnect). Subscriptions survive reconnects.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly stomp = new RxStomp();

  readonly connected = signal(false);
  /** Emits every time the connection is (re-)established. */
  readonly connected$ = this.stomp.connected$;

  constructor() {
    this.stomp.connectionState$.subscribe((s) => this.connected.set(s === RxStompState.OPEN));
  }

  start(): void {
    if (this.stomp.active) return;
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    this.stomp.configure({
      brokerURL: `${scheme}://${location.host}/ws`,
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      beforeConnect: async (client: RxStomp) => {
        const token = await this.auth.freshToken();
        client.configure({ connectHeaders: token ? { Authorization: `Bearer ${token}` } : {} });
      },
    });
    this.stomp.activate();
  }

  async stop(): Promise<void> {
    await this.stomp.deactivate();
  }

  watch<T>(destination: string): Observable<RealtimeEvent<T>> {
    return this.stomp.watch(destination).pipe(map((m) => JSON.parse(m.body) as RealtimeEvent<T>));
  }

  /** {@code name}: feed | chat | polls | presence */
  entrance<T>(name: string): Observable<RealtimeEvent<T>> {
    const entranceId = this.auth.user()?.entrance.id;
    return this.watch<T>(`/topic/entrance/${entranceId}/${name}`);
  }
}
