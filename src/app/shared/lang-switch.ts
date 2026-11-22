import { Component, inject } from '@angular/core';
import { I18nService, Lang } from '../core/i18n/i18n';

/** EN | SR segmented switch. */
@Component({
  selector: 'app-lang-switch',
  template: `
    <div class="switch" role="group" aria-label="Language / Jezik">
      @for (l of langs; track l.code) {
        <button type="button" [class.active]="i18n.lang() === l.code" (click)="i18n.set(l.code)"
                [attr.aria-pressed]="i18n.lang() === l.code" [title]="l.title">{{ l.label }}</button>
      }
    </div>
  `,
  styles: `
    .switch { display: inline-flex; background: #e2e8f0; border-radius: 8px; padding: 2px; }
    button {
      border: none; background: transparent; padding: 4px 9px; border-radius: 6px;
      font-size: 0.75rem; font-weight: 700; color: var(--muted); cursor: pointer; letter-spacing: 0.02em;
    }
    button.active { background: white; color: var(--primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
  `,
})
export class LangSwitch {
  protected readonly i18n = inject(I18nService);
  protected readonly langs: { code: Lang; label: string; title: string }[] = [
    { code: 'en', label: 'EN', title: 'English' },
    { code: 'sr', label: 'SR', title: 'Srpski' },
  ];
}
