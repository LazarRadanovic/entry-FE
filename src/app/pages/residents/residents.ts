import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { Resident } from '../../core/models';
import { PresenceService } from '../../core/presence.service';
import { Avatar } from '../../shared/avatar';
import { TranslatePipe, TranslatePluralPipe } from '../../core/i18n/i18n';

/** Template #13. */
@Component({
  selector: 'app-residents',
  imports: [Avatar, FormsModule, RouterLink, TranslatePipe, TranslatePluralPipe],
  template: `
    <div class="page-header">
      <h1 class="page-title">{{ 'residents.title' | t }}</h1>
      <span class="muted" style="font-size:0.9rem">{{ 'residents.members' | tp: residents().length }}</span>
    </div>

    <input class="input search" type="search" [placeholder]="'residents.search' | t"
           [ngModel]="query()" (ngModelChange)="query.set($event)" />

    @if (loading()) {
      <div class="spinner"></div>
    } @else if (error()) {
      <div class="empty-state">{{ error() }}</div>
    } @else {
      @for (r of filtered(); track r.id) {
        <a class="list-card" [routerLink]="['/residents', r.id]">
          <div class="av">
            <app-avatar [person]="r" [size]="48" />
            @if (presence.isOnline(r.id)) { <span class="online-dot on" [title]="'residents.online' | t"></span> }
          </div>
          <div class="info">
            <div class="name">{{ r.firstName }} {{ r.lastName }}</div>
            <div class="detail">{{ 'common.floorApt' | t: { floor: r.floor, apt: r.apartment } }}</div>
          </div>
          @if (r.role === 'ENTRANCE_ADMIN') { <span class="role-badge">{{ 'common.admin' | t }}</span> }
        </a>
      } @empty {
        <div class="empty-state">{{ 'residents.noMatch' | t: { q: query() } }}</div>
      }
    }
  `,
  styles: `
    .search { margin-bottom: 16px; border-radius: 10px; background: var(--card); }
    .av { position: relative; display: flex; }
    .on { position: absolute; right: 1px; bottom: 1px; width: 12px; height: 12px; border: 2px solid white; }
  `,
})
export class ResidentsPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly presence = inject(PresenceService);

  protected readonly residents = signal<Resident[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.residents();
    return this.residents().filter((r) =>
      `${r.firstName} ${r.lastName} ${r.floor} ${r.apartment} floor sprat ${r.floor} apt stan ${r.apartment}`.toLowerCase().includes(q),
    );
  });

  ngOnInit(): void {
    this.api.residents().subscribe({
      next: (list) => {
        this.residents.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
