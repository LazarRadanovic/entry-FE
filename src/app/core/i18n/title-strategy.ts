import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nKey, I18nService, hasKey } from './i18n';

/** Route titles are translation keys; re-applied when the language changes. */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private key: I18nKey | null = null;

  constructor() {
    super();
    effect(() => {
      this.i18n.lang();
      this.apply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    this.key = key && hasKey(key) ? key : null;
    this.apply();
  }

  private apply(): void {
    this.title.setTitle(this.key ? `${this.i18n.t(this.key)} · Entry` : 'Entry');
  }
}
