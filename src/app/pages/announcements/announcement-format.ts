import { I18nKey, currentLocale, translate } from '../../core/i18n/i18n';
import { Announcement, AnnouncementKind, RealtimeEvent } from '../../core/models';

export const KINDS: { kind: AnnouncementKind; icon: string; label: I18nKey }[] = [
  { kind: 'RENOVATION', icon: '🔨', label: 'ann.kind.RENOVATION' },
  { kind: 'CELEBRATION', icon: '🎉', label: 'ann.kind.CELEBRATION' },
  { kind: 'MOVING', icon: '📦', label: 'ann.kind.MOVING' },
  { kind: 'OTHER', icon: '🔊', label: 'ann.kind.OTHER' },
];

export function kindIcon(kind: AnnouncementKind): string {
  return KINDS.find((k) => k.kind === kind)?.icon ?? '🔊';
}

/** "YYYY-MM-DD" of today in local time. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function day(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(currentLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Mon, Dec 1 – Fri, Dec 5" or "Today" / "Sat, Dec 6". */
export function datesText(a: Announcement): string {
  const today = todayIso();
  const one = (iso: string) => (iso === today ? translate('ann.today') : day(iso));
  return a.startDate === a.endDate ? one(a.startDate) : `${one(a.startDate)} – ${one(a.endDate)}`;
}

/** "08:00–16:00" or "All day". */
export function hoursText(a: Announcement): string {
  return a.fromTime && a.toTime ? `${a.fromTime.slice(0, 5)}–${a.toTime.slice(0, 5)}` : translate('ann.allDay');
}

/** Applies a live event to an ACTIVE list (ongoing/upcoming, soonest first). */
export function applyAnnouncementEvent(list: Announcement[], e: RealtimeEvent<any>, today: string): Announcement[] {
  if (e.type === 'ANNOUNCEMENT_DELETED') return list.filter((a) => a.id !== e.payload.announcementId);
  if (e.type !== 'ANNOUNCEMENT_CREATED' && e.type !== 'ANNOUNCEMENT_UPDATED') return list;
  const a = e.payload as Announcement;
  const rest = list.filter((x) => x.id !== a.id);
  if (a.endDate < today) return rest;
  return [...rest, a].sort((x, y) => x.startDate.localeCompare(y.startDate) || x.createdAt.localeCompare(y.createdAt));
}
