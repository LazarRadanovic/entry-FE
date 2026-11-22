import { Component, computed, input } from '@angular/core';

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#4f46e5', '#ca8a04'];

/** Profile picture, or coloured initials when there is none. */
@Component({
  selector: 'app-avatar',
  template: `
    @if (person()?.avatarUrl; as url) {
      <img [src]="url" [style.width.px]="size()" [style.height.px]="size()" alt="" loading="lazy" />
    } @else {
      <span
        class="initials"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.4"
        [style.background]="color()"
        >{{ initials() }}</span
      >
    }
  `,
  styles: `
    :host { display: inline-flex; flex-shrink: 0; }
    img, .initials { border-radius: 50%; object-fit: cover; background: #cbd5e1; }
    .initials { display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 600; }
  `,
})
export class Avatar {
  readonly person = input<{ firstName: string; lastName: string; avatarUrl: string | null } | null>(null);
  readonly size = input(40);

  protected readonly initials = computed(() => {
    const p = this.person();
    return p ? `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase() : '?';
  });

  protected readonly color = computed(() => {
    const p = this.person();
    const key = p ? p.firstName + p.lastName : '';
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return COLORS[Math.abs(hash) % COLORS.length];
  });
}
