import { Injectable, Pipe, PipeTransform, computed, inject, signal } from '@angular/core';
import { en } from './en';
import { sr } from './sr';

export type Lang = 'en' | 'sr';
export type I18nKey = keyof typeof en;
export type Params = Record<string, string | number>;

const STORAGE_KEY = 'entry.lang';
const DICTIONARIES: Record<Lang, Record<I18nKey, string>> = { en, sr };

function initialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'sr') return saved;
  const browser = (navigator.languages?.[0] ?? navigator.language ?? 'en').toLowerCase();
  return /^(sr|hr|bs|sh|cnr)/.test(browser) ? 'sr' : 'en';
}

/** Module-level so plain functions (timeAgo, errorMessage) can translate too. */
const currentLang = signal<Lang>(initialLang());

/** Index of the plural form: English one|other, Serbian one|few|many. */
function pluralIndex(lang: Lang, n: number): number {
  if (lang === 'en') return n === 1 ? 0 : 1;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 0;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
  return 2;
}

function interpolate(text: string, params?: Params): string {
  return params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text;
}

/** Translate a key (reads the language signal, so templates re-render when it changes). */
export function translate(key: I18nKey, params?: Params): string {
  return interpolate(DICTIONARIES[currentLang()][key] ?? en[key] ?? key, params);
}

/** Translate a plural key ("one|other" / "one|few|many"); {n} is filled in. */
export function translatePlural(key: I18nKey, n: number, params?: Params): string {
  const lang = currentLang();
  const forms = (DICTIONARIES[lang][key] ?? en[key]).split('|');
  const form = forms[Math.min(pluralIndex(lang, n), forms.length - 1)];
  return interpolate(form, { n, ...params });
}

export function hasKey(key: string): key is I18nKey {
  return key in en;
}

/** Locale id for Angular pipes and Intl (registered in main.ts). */
export function currentLocale(): string {
  return currentLang() === 'sr' ? 'sr-Latn' : 'en-US';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = currentLang.asReadonly();
  readonly locale = computed(() => currentLocale());

  constructor() {
    document.documentElement.lang = currentLang() === 'sr' ? 'sr-Latn' : 'en';
  }

  set(lang: Lang): void {
    currentLang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === 'sr' ? 'sr-Latn' : 'en';
  }

  t(key: I18nKey, params?: Params): string {
    return translate(key, params);
  }

  plural(key: I18nKey, n: number, params?: Params): string {
    return translatePlural(key, n, params);
  }
}

/** {{ 'feed.title' | t }} or {{ 'polls.createdBy' | t: { name } }}. Impure so it follows language changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: I18nKey, params?: Params): string {
    return this.i18n.t(key, params);
  }
}

/** {{ 'polls.votes' | tp: count }} */
@Pipe({ name: 'tp', pure: false })
export class TranslatePluralPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: I18nKey, n: number, params?: Params): string {
    return this.i18n.plural(key, n, params);
  }
}
