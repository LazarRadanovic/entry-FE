import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nKey, TranslatePipe, translate } from '../../core/i18n/i18n';
import { LostFoundCategory, LostFoundItem, LostFoundKind, LostFoundRequest } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { Avatar } from '../../shared/avatar';
import { LightboxService } from '../../shared/lightbox';
import { TimeAgoPipe } from '../../shared/time-ago.pipe';
import { ToastService } from '../../shared/toast.service';

const MAX_BYTES = 10 * 1024 * 1024;

export const CATEGORIES: { value: LostFoundCategory; icon: string }[] = [
  { value: 'KEYS', icon: '🔑' },
  { value: 'PACKAGE', icon: '📦' },
  { value: 'PET', icon: '🐾' },
  { value: 'TOY', icon: '🧸' },
  { value: 'DOCUMENTS', icon: '🪪' },
  { value: 'CLOTHING', icon: '🧤' },
  { value: 'OTHER', icon: '❓' },
];

type Tab = 'OPEN' | 'RESOLVED';

interface Editing {
  id: string | null;
  form: LostFoundRequest;
  /** Photo shown in the form: the current one, or a local preview while uploading. */
  preview: string | null;
  uploading: boolean;
}

/** Lost & found in the entrance: keys, packages, toys, pets found in the hallway or in front of the building. */
@Component({
  selector: 'app-lost-found',
  imports: [FormsModule, TranslatePipe, Avatar, TimeAgoPipe],
  templateUrl: './lost-found.html',
  styleUrl: './lost-found.css',
})
export class LostFoundPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly lightbox = inject(LightboxService);

  protected readonly categories = CATEGORIES;
  protected readonly tab = signal<Tab>('OPEN');
  protected readonly kindFilter = signal<LostFoundKind | null>(null);
  protected readonly items = signal<LostFoundItem[] | null>(null);
  protected readonly editing = signal<Editing | null>(null);
  protected readonly saving = signal(false);
  protected readonly busy = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
    this.realtime
      .entrance<any>('lost-found')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        if (e.type === 'LOST_FOUND_DELETED') {
          this.remove(e.payload.itemId);
        } else if (e.type === 'LOST_FOUND_CREATED' || e.type === 'LOST_FOUND_UPDATED') {
          this.upsert(e.payload as LostFoundItem);
        }
      });
  }

  // ---------- display helpers ----------

  protected icon(c: LostFoundCategory): string {
    return CATEGORIES.find((x) => x.value === c)?.icon ?? '❓';
  }

  protected categoryLabel(c: LostFoundCategory): I18nKey {
    return `lf.cat.${c}` as I18nKey;
  }

  protected kindLabel(k: LostFoundKind): I18nKey {
    return `lf.kind.${k}` as I18nKey;
  }

  protected isMine(i: LostFoundItem): boolean {
    return i.author.id === this.auth.user()?.id;
  }

  protected canEdit(i: LostFoundItem): boolean {
    return this.isMine(i) || this.auth.isAdmin();
  }

  protected respondedByMe(i: LostFoundItem): boolean {
    const me = this.auth.user()?.id;
    return i.responders.some((r) => r.id === me);
  }

  protected respondersText(i: LostFoundItem): string {
    const names = i.responders.map((r) => `${r.firstName} (${translate('common.apartment').toLowerCase()} ${r.apartment})`);
    return translate(i.kind === 'FOUND' ? 'lf.claimedBy' : 'lf.foundBy', { names: names.join(', ') });
  }

  // ---------- list ----------

  protected switchTab(tab: Tab): void {
    if (tab === this.tab()) return;
    this.tab.set(tab);
    this.load();
  }

  protected setKind(kind: LostFoundKind | null): void {
    this.kindFilter.set(kind);
    this.load();
  }

  protected respond(i: LostFoundItem): void {
    const next = !this.respondedByMe(i);
    this.busy.set(i.id);
    this.api.respondLostFound(i.id, next).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.upsert(updated);
        if (next) this.toast.success(translate('lf.responded'));
      },
      error: (e) => {
        this.busy.set(null);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected setResolved(i: LostFoundItem, resolved: boolean): void {
    this.busy.set(i.id);
    this.api.resolveLostFound(i.id, resolved).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.upsert(updated);
        if (resolved) this.toast.success(translate('lf.resolvedToast'));
      },
      error: (e) => {
        this.busy.set(null);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected delete(i: LostFoundItem): void {
    if (!confirm(translate('lf.confirmDelete'))) return;
    this.api.deleteLostFound(i.id).subscribe({
      next: () => this.remove(i.id),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  // ---------- add / edit ----------

  protected add(kind: LostFoundKind): void {
    this.editing.set({
      id: null,
      form: { kind, category: 'KEYS', title: '', description: null, location: null, photoFileId: null },
      preview: null,
      uploading: false,
    });
  }

  protected edit(i: LostFoundItem): void {
    this.editing.set({
      id: i.id,
      form: {
        kind: i.kind,
        category: i.category,
        title: i.title,
        description: i.description,
        location: i.location,
        photoFileId: i.photo?.id ?? null,
      },
      preview: i.photo?.thumbnailUrl ?? null,
      uploading: false,
    });
  }

  protected onPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const e = this.editing();
    if (!file || !e) return;
    if (file.size > MAX_BYTES) {
      this.toast.error(translate('create.tooLarge', { name: file.name }));
      return;
    }
    this.editing.set({ ...e, preview: URL.createObjectURL(file), uploading: true });
    this.api.uploadImage(file).subscribe({
      next: (dto) => {
        const cur = this.editing();
        if (cur) this.editing.set({ ...cur, form: { ...cur.form, photoFileId: dto.id }, uploading: false });
      },
      error: (err) => {
        const cur = this.editing();
        if (cur) this.editing.set({ ...cur, preview: null, form: { ...cur.form, photoFileId: null }, uploading: false });
        this.toast.error(errorMessage(err, 'error.uploadFailed'));
      },
    });
  }

  protected removePhoto(): void {
    const e = this.editing();
    if (e) this.editing.set({ ...e, preview: null, form: { ...e.form, photoFileId: null } });
  }

  protected canSave(e: Editing): boolean {
    return !!e.form.title.trim() && !e.uploading && !this.saving();
  }

  protected save(): void {
    const e = this.editing();
    if (!e || !this.canSave(e)) return;
    const body: LostFoundRequest = {
      ...e.form,
      title: e.form.title.trim(),
      description: e.form.description?.trim() || null,
      location: e.form.location?.trim() || null,
    };
    this.saving.set(true);
    (e.id ? this.api.updateLostFound(e.id, body) : this.api.createLostFound(body)).subscribe({
      next: (item) => {
        this.saving.set(false);
        this.editing.set(null);
        if (!e.id && this.tab() !== 'OPEN') this.switchTab('OPEN');
        else this.upsert(item);
        this.toast.success(translate(e.id ? 'lf.saved' : 'lf.published'));
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  // ---------- state ----------

  /** Keeps the list in sync: drops items that no longer match the tab / filter, newest first. */
  private upsert(item: LostFoundItem): void {
    const matches =
      (this.tab() === 'OPEN') === (item.resolvedAt === null) &&
      (this.kindFilter() === null || this.kindFilter() === item.kind);
    this.items.update((l) => {
      if (!l) return l;
      const rest = l.filter((x) => x.id !== item.id);
      if (!matches) return rest;
      const exists = rest.length !== l.length;
      return exists ? l.map((x) => (x.id === item.id ? item : x)) : [item, ...rest];
    });
  }

  private remove(id: string): void {
    this.items.update((l) => l?.filter((x) => x.id !== id) ?? l);
  }

  private load(): void {
    this.items.set(null);
    this.api.lostFound(this.tab(), this.kindFilter()).subscribe({
      next: (list) => this.items.set(list),
      error: (e) => {
        this.items.set([]);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
