import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { I18nKey, I18nService, TranslatePipe, hasSavedLang } from '../../core/i18n/i18n';
import { LangSwitch } from '../../shared/lang-switch';

type Icon = 'board' | 'chat' | 'vote' | 'costs' | 'tools' | 'bell';

/**
 * Public promo page (the printed QR code points here). No login needed.
 * Written for all ages: big type, high contrast, short sentences, large buttons.
 */
@Component({
  selector: 'app-welcome',
  imports: [RouterLink, TranslatePipe, LangSwitch],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
  host: { '(document:keydown.escape)': 'prize.set(false)' },
})
export class WelcomePage {
  protected readonly auth = inject(AuthService);

  /** "You won 30 days free" popup: only for visitors who scanned the gratis flyer (?src=gratis) and aren't logged in. */
  protected readonly prize = signal(
    inject(ActivatedRoute).snapshot.queryParamMap.get('src') === 'gratis' && !this.auth.isLoggedIn(),
  );

  protected readonly features: { icon: Icon; title: I18nKey; text: I18nKey }[] = [
    { icon: 'board', title: 'welcome.f.board', text: 'welcome.f.boardText' },
    { icon: 'chat', title: 'welcome.f.chat', text: 'welcome.f.chatText' },
    { icon: 'vote', title: 'welcome.f.vote', text: 'welcome.f.voteText' },
    { icon: 'costs', title: 'welcome.f.costs', text: 'welcome.f.costsText' },
    { icon: 'tools', title: 'welcome.f.tools', text: 'welcome.f.toolsText' },
    { icon: 'bell', title: 'welcome.f.bell', text: 'welcome.f.bellText' },
  ];

  protected readonly steps: { title: I18nKey; text: I18nKey }[] = [
    { title: 'welcome.s1', text: 'welcome.s1Text' },
    { title: 'welcome.s2', text: 'welcome.s2Text' },
    { title: 'welcome.s3', text: 'welcome.s3Text' },
  ];

  protected readonly perks: I18nKey[] = ['welcome.p1', 'welcome.p2', 'welcome.p3', 'welcome.p4'];

  /**
   * Phone demo timeline. Steps:
   * 0 idle · 1 poll notification · 2 poll card · 3 votes fill · 4 message notification · 5 typing · 6 message · 7 hold.
   */
  private static readonly STEP_MS = [1200, 2200, 1000, 1800, 2200, 1300, 3500, 1500];
  private static readonly LAST = 7;
  protected readonly step = signal(0);

  protected readonly bannerVisible = computed(() => this.step() === 1 || this.step() === 4);
  /** Content stays while the banner slides out, so it doesn't vanish mid-animation. */
  protected readonly banner = computed<{ title: I18nKey; text: I18nKey }>(() =>
    this.step() >= 4 && this.step() <= 6
      ? { title: 'welcome.demo.pushMsgTitle', text: 'welcome.demo.pushMsgText' }
      : { title: 'welcome.demo.pushPollTitle', text: 'welcome.demo.pollTitle' },
  );

  constructor() {
    // People arriving from the printed QR get Serbian unless they already picked a language.
    if (!hasSavedLang()) inject(I18nService).set('sr');

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.step.set(WelcomePage.LAST); // finished screen, no motion
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(() => {
        this.step.update((s) => (s >= WelcomePage.LAST ? 0 : s + 1));
        tick();
      }, WelcomePage.STEP_MS[this.step()]);
    };
    tick();
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
