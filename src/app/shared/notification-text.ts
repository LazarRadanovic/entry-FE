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
