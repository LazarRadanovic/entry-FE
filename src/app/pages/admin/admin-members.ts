import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { Entrance, Member } from '../../core/models';
import { Avatar } from '../../shared/avatar';
import { TimeAgoPipe } from '../../shared/time-ago.pipe';
import { ToastService } from '../../shared/toast.service';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

/** Template #17. */
@Component({
  selector: 'app-admin-members',
  imports: [Avatar, RouterLink, TimeAgoPipe, TranslatePipe],
  template: `
    <h1 class="page-title" style="margin-bottom:20px">{{ 'admin.title' | t }}</h1>

    <section class="admin-section">
      <h2>{{ 'admin.inviteCode' | t }}</h2>
      <div class="card invite-box">
        <div class="invite-code">{{ entrance()?.inviteCode ?? '········' }}</div>
        <button class="btn-sm" style="background:var(--primary);color:white" (click)="copy()">{{ 'admin.copy' | t }}</button>
        <button class="btn-sm btn-secondary" (click)="regenerate()" [title]="'admin.regenerateTitle' | t">↻</button>
      </div>
      <p class="muted hint">{{ 'admin.inviteHint' | t }}</p>
    </section>

    <section class="admin-section">
      <h2>{{ 'admin.pending' | t: { n: pending().length } }}</h2>
      @for (m of pending(); track m.id) {
        <div class="card pending-card">
          <app-avatar [person]="m" [size]="44" />
          <div class="info">
            <div style="font-weight:600">{{ m.firstName }} {{ m.lastName }}</div>
            <div class="sub">{{ 'common.floorApt' | t: { floor: m.floor, apt: m.apartment } }} · {{ 'admin.requested' | t: { ago: (m.createdAt | timeAgo) } }}</div>
            <div class="sub">{{ m.email }}</div>
          </div>
          <div class="actions">
            <button class="btn-sm btn-approve" (click)="approve(m)" [disabled]="busy() === m.id">{{ 'admin.approve' | t }}</button>
            <button class="btn-sm btn-reject" (click)="reject(m)" [disabled]="busy() === m.id">{{ 'admin.reject' | t }}</button>
          </div>
        </div>
      } @empty {
        <p class="muted">{{ 'admin.noneWaiting' | t }}</p>
      }
    </section>

    <section class="admin-section">
      <h2>{{ 'admin.members' | t: { n: members().length } }}</h2>
      @for (m of members(); track m.id) {
        <div class="list-card">
          <a [routerLink]="['/residents', m.id]"><app-avatar [person]="m" [size]="44" /></a>
          <div class="info">
            <div class="name">{{ m.firstName }} {{ m.lastName }} @if (m.id === me()?.id) { <span class="muted">{{ 'admin.youMark' | t }}</span> }</div>
            <div class="detail">{{ 'common.floorApt' | t: { floor: m.floor, apt: m.apartment } }} · {{ m.email }}</div>
          </div>
          @if (m.role === 'ENTRANCE_ADMIN') { <span class="role-badge">{{ 'common.admin' | t }}</span> }
          @if (m.id !== me()?.id) {
            <div class="actions">
              <button class="btn-sm btn-secondary" (click)="toggleRole(m)" [disabled]="busy() === m.id">
                {{ (m.role === 'ENTRANCE_ADMIN' ? 'admin.makeResident' : 'admin.makeAdmin') | t }}
              </button>
              <button class="btn-sm btn-reject" (click)="remove(m)" [disabled]="busy() === m.id">{{ 'admin.remove' | t }}</button>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .admin-section { margin-bottom: 28px; }
    .admin-section h2 { font-size: 1.1rem; margin-bottom: 12px; }
    .invite-box { padding: 18px; display: flex; gap: 10px; align-items: center; }
    .invite-code { flex: 1; font-family: monospace; font-size: 1.2rem; font-weight: 700; letter-spacing: 0.08em; background: #f1f5f9; padding: 10px 14px; border-radius: 8px; }
    .hint { font-size: 0.8rem; margin-top: 8px; }
    .pending-card { display: flex; align-items: center; gap: 12px; padding: 14px; margin-bottom: 10px; flex-wrap: wrap; }
    .info { flex: 1; min-width: 160px; }
    .sub { font-size: 0.8rem; color: var(--muted); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .list-card { flex-wrap: wrap; }
  `,
})
export class AdminMembersPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly me = inject(AuthService).user;

  protected readonly entrance = signal<Entrance | null>(null);
  protected readonly pending = signal<Member[]>([]);
  protected readonly members = signal<Member[]>([]);
  protected readonly busy = signal<string | null>(null);

  ngOnInit(): void {
    this.api.entrance().subscribe((e) => this.entrance.set(e));
    this.loadMembers();
  }

  protected copy(): void {
    const code = this.entrance()?.inviteCode;
    if (!code) return;
    navigator.clipboard?.writeText(code).then(
      () => this.toast.success(translate('admin.copied')),
      () => this.toast.info(code),
    );
  }

  protected regenerate(): void {
    if (!confirm(translate('admin.confirmRegenerate'))) return;
    this.api.regenerateInviteCode().subscribe({
      next: (r) => {
        this.entrance.update((e) => (e ? { ...e, inviteCode: r.inviteCode } : e));
        this.toast.success(translate('admin.newCode'));
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected approve(m: Member): void {
    this.act(m, this.api.approve(m.id), translate('admin.approved', { name: m.firstName }));
  }

  protected reject(m: Member): void {
    if (!confirm(translate('admin.confirmReject', { name: m.firstName }))) return;
    this.act(m, this.api.reject(m.id), translate('admin.rejected'));
  }

  protected toggleRole(m: Member): void {
    const role = m.role === 'ENTRANCE_ADMIN' ? 'RESIDENT' : 'ENTRANCE_ADMIN';
    this.act(m, this.api.changeRole(m.id, role),
      role === 'ENTRANCE_ADMIN' ? translate('admin.nowAdmin', { name: m.firstName }) : translate('admin.roleUpdated'));
  }

  protected remove(m: Member): void {
    if (!confirm(translate('admin.confirmRemove', { name: `${m.firstName} ${m.lastName}` }))) return;
    this.act(m, this.api.removeMember(m.id), translate('admin.removed', { name: m.firstName }));
  }

  private act(m: Member, call: Observable<unknown>, done: string): void {
    this.busy.set(m.id);
    call.subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(done);
        this.loadMembers();
      },
      error: (e) => {
        this.busy.set(null);
        this.toast.error(errorMessage(e));
      },
    });
  }

  private loadMembers(): void {
    this.api.members('PENDING').subscribe((l) => this.pending.set(l));
    this.api.members('ACTIVE').subscribe((l) => this.members.set(l));
  }
}
