import { Pipe, PipeTransform } from '@angular/core';
import { currentLocale, translate, translatePlural } from '../core/i18n/i18n';

/** "just now", "5 min ago", "2 hours ago", "Yesterday", "3 days ago", then a date (translated). */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return translate('time.justNow');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return translatePlural('time.minAgo', minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return translatePlural('time.hoursAgo', hours);
  const days = Math.round(hours / 24);
  if (days === 1) return translate('time.yesterday');
  if (days < 7) return translatePlural('time.daysAgo', days);
  return date.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Ends in 2 days", "Ends in 5 hours", "Ended 3 days ago" (translated). */
export function untilText(iso: string | null): string {
  if (!iso) return translate('polls.noEnd');
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return translate('polls.endedAgo', { ago: timeAgo(iso).toLowerCase() });
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return translate('polls.endsSoon');
  if (hours < 48) return translatePlural('polls.endsInHours', hours);
  return translatePlural('polls.endsInDays', Math.round(hours / 24));
}

/** Impure so it follows language switches. */
@Pipe({ name: 'timeAgo', pure: false })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return timeAgo(value);
  }
}
