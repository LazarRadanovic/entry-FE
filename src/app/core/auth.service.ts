import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, tap } from 'rxjs';
import { BillingService } from './billing.service';
import { AuthResponse, User } from './models';

const SESSION_HINT = 'entry.session';

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  floor: string;
  apartment: string;
  inviteCode?: string;
  newEntrance?: { name: string; address: string };
}

/**
 * Access token lives only in memory; the refresh token is an httpOnly cookie the browser sends to
 * /api/auth/refresh. On startup we try a silent refresh to restore the session.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly billing = inject(BillingService);

  private readonly token = signal<string | null>(null);
  private tokenExpiresAt = 0;
  private refreshInFlight: Observable<string | null> | null = null;

  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isActive = computed(() => this.user()?.status === 'ACTIVE');
  readonly isAdmin = computed(() => this.user()?.role === 'ENTRANCE_ADMIN');

  get accessToken(): string | null {
    return this.token();
  }

  /** Called once at app start. Never throws. Skipped if this browser never had a session. */
  async restoreSession(): Promise<void> {
    if (localStorage.getItem(SESSION_HINT)) {
      await firstValueFrom(this.refresh());
    }
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(map((r) => this.accept(r)));
  }

  register(req: RegisterRequest): Observable<User> {
    return this.http.post<AuthResponse>('/api/auth/register', req).pipe(map((r) => this.accept(r)));
  }

  /** Shared between concurrent callers; resolves to the new token or null (session gone). */
  refresh(): Observable<string | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http.post<AuthResponse>('/api/auth/refresh', {}).pipe(
        map((r) => {
          this.accept(r);
          return r.accessToken;
        }),
        catchError(() => {
          this.clear();
          return of(null);
        }),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay(1),
      );
    }
    return this.refreshInFlight;
  }

  /** A token valid for at least another minute (used before opening the WebSocket). */
  async freshToken(): Promise<string | null> {
    if (this.token() && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.token();
    }
    return firstValueFrom(this.refresh());
  }

  reloadMe(): Observable<User> {
    return this.http.get<User>('/api/users/me').pipe(tap((u) => this.user.set(u)));
  }

  logout(): void {
    this.http.post('/api/auth/logout', {}).pipe(catchError(() => of(null))).subscribe();
    this.clear();
    this.router.navigateByUrl('/login');
  }

  /** Local-only logout (session expired). */
  clear(): void {
    localStorage.removeItem(SESSION_HINT);
    this.billing.clear();
    this.token.set(null);
    this.user.set(null);
    this.tokenExpiresAt = 0;
  }

  /** Where to go after login/registration. */
  homeUrl(): string {
    return this.isActive() ? '/feed' : '/pending';
  }

  private accept(r: AuthResponse): User {
    localStorage.setItem(SESSION_HINT, '1'); // not a secret: only says "try the refresh cookie"
    this.token.set(r.accessToken);
    this.tokenExpiresAt = Date.now() + r.expiresIn * 1000;
    this.user.set(r.user);
    return r.user;
  }
}
