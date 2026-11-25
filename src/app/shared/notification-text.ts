import { translate, translatePlural } from '../core/i18n/i18n';
import { AppNotification } from '../core/models';

const fullName = (n: AppNotification) =>
  n.actor ? `${n.actor.firstName} ${n.actor.lastName}` : translate('notif.someone');

/** Icon, sentence parts (bold name / bold preview), plain text and the route a notification opens. */
export function notificationText(n: AppNotification): {
  icon: string;
  before: string;
  bold: string;
  after: string;
  plain: string;
  link: string;
} {
  const t = (icon: string, before: string, bold: string, after: string, link: string) => ({
    icon,
    before,
    bold,
    after,
    plain: `${before}${bold}${after}`,
    link,
  });
  switch (n.type) {
    case 'NEW_POST':
      return t('📝', '', fullName(n), translate('notif.newPost', { text: n.preview ?? '' }), `/feed/${n.targetId}`);
    case 'NEW_POLL':
      return t('📊', translate('notif.newPoll'), n.preview ?? '', '', '/polls');
    case 'NEW_COMMENT':
      return t('💬', '', fullName(n), translate('notif.newComment'), `/feed/${n.targetId}`);
    case 'POST_LIKED': {
      const others = n.count - 1;
      const tail = others > 0 ? translatePlural('notif.likedOthers', others) : translate('notif.liked');
      return t('❤️', '', n.actor?.firstName ?? translate('notif.someone'), tail, `/feed/${n.targetId}`);
    }
    case 'JOIN_REQUEST':
      return t('🙋', '', fullName(n), translate('notif.joinRequest'), '/admin');
    case 'TRIAL_ENDING': {
      // the backend stores e.g. "5 days" as preview: take the number and translate it
      const days = parseInt(n.preview ?? '', 10);
      const bold = Number.isFinite(days) ? translatePlural('notif.trialDays', days) : (n.preview ?? '');
      return t('⏳', translate('notif.trialBefore'), bold, translate('notif.trialAfter'), '/billing');
    }
    case 'NEW_ANNOUNCEMENT': {
      // preview from the backend: "1.12.–5.12. · 08:00–16:00" or "6.12. · all day"
      const when = (n.preview ?? '').replace('all day', translate('ann.allDay'));
      const apt = n.actor?.apartment ?? '?';
      return t('📢', '', fullName(n), translate('notif.announcement', { apt, when }), '/announcements');
    }
    case 'NEW_LOST_FOUND': {
      // preview from the backend: "FOUND: title" / "LOST: title"
      const [kind, ...rest] = (n.preview ?? '').split(': ');
      const title = rest.join(': ');
      return t('🔑', '', fullName(n), translate(kind === 'LOST' ? 'notif.lostItem' : 'notif.foundItem', { title }), '/lost-found');
    }
    case 'LOST_FOUND_RESPONSE':
      return t('🙋', '', fullName(n), translate('notif.lostFoundResponse', { title: n.preview ?? '' }), '/lost-found');
    case 'MEMBERSHIP_APPROVED':
      return t(
        '✅',
        translate('notif.approvedBefore'),
        n.preview ?? translate('notif.theEntrance'),
        translate('notif.approvedAfter'),
        '/feed',
      );
  }
}
