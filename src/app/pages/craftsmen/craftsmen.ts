import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { I18nKey, TranslatePipe, TranslatePluralPipe, translate } from '../../core/i18n/i18n';
import { Craftsman, CraftsmanRequest, Trade } from '../../core/models';
import { LightboxService } from '../../shared/lightbox';
import { ToastService } from '../../shared/toast.service';

const MAX_BYTES = 10 * 1024 * 1024;

export const TRADES: Trade[] = [
  'PLUMBER',
  'ELECTRICIAN',
  'LOCKSMITH',
  'PAINTER',
  'CARPENTER',
  'HVAC',
  'CLEANING',
  'ELEVATOR',
  'MOVING',
  'OTHER',
];

const TRADE_ICONS: Record<Trade, string> = {
  PLUMBER: '🚰',
  ELECTRICIAN: '💡',
  LOCKSMITH: '🔑',
  PAINTER: '🎨',
  CARPENTER: '🪚',
  HVAC: '🌡️',
  CLEANING: '🧽',
  ELEVATOR: '🛗',
  MOVING: '📦',
  OTHER: '🛠️',
};

interface Editing {
  id: string | null;
  form: CraftsmanRequest;
  /** Photo shown in the form: the current one, or a local preview while uploading. */
  preview: string | null;
  uploading: boolean;
}

/** Craftsmen / handymen recommended by neighbours: call them, recommend them, add your own. */
@Component({
  selector: 'app-craftsmen',
  imports: [FormsModule, TranslatePipe, TranslatePluralPipe],
  templateUrl: './craftsmen.html',
  styleUrl: './craftsmen.css',
})
export class CraftsmenPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly lightbox = inject(LightboxService);

  protected readonly trades = TRADES;
  protected readonly filter = signal<Trade | null>(null);
  protected readonly list = signal<Craftsman[] | null>(null);
  protected readonly editing = signal<Editing | null>(null);
  protected readonly saving = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected tradeLabel(t: Trade): I18nKey {
    return `craftsmen.trade.${t}` as I18nKey;
  }

  protected icon(t: Trade): string {
    return TRADE_ICONS[t];
  }

  protected setFilter(t: Trade | null): void {
    this.filter.set(t);
    this.load();
  }

  protected recommend(c: Craftsman): void {
    const next = !c.recommendedByMe;
    this.patch(c.id, { recommendedByMe: next, recommendations: c.recommendations + (next ? 1 : -1) });
    this.api.recommendCraftsman(c.id, next).subscribe({
      next: (r) => this.patch(c.id, { recommendedByMe: r.recommendedByMe, recommendations: r.recommendations }),
      error: (e) => {
        this.patch(c.id, { recommendedByMe: c.recommendedByMe, recommendations: c.recommendations });
        this.toast.error(errorMessage(e));
      },
    });
  }

  // ---------- add / edit ----------

  protected add(): void {
    this.editing.set({
      id: null,
      form: {
        name: '',
        trade: this.filter() ?? 'PLUMBER',
        phone: '',
        email: null,
        website: null,
        description: null,
        photoFileId: null,
      },
      preview: null,
      uploading: false,
    });
  }

  protected edit(c: Craftsman): void {
    this.editing.set({
      id: c.id,
      form: {
        name: c.name,
        trade: c.trade,
        phone: c.phone,
        email: c.email,
        website: c.website,
        description: c.description,
        photoFileId: c.photo?.id ?? null,
      },
      preview: c.photo?.thumbnailUrl ?? null,
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
    return !!e.form.name.trim() && /^[+0-9 ()/-]+$/.test(e.form.phone.trim()) && !e.uploading && !this.saving();
  }

  protected save(): void {
    const e = this.editing();
    if (!e || !this.canSave(e)) return;
    let website = e.form.website?.trim() || null;
    if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
    const body: CraftsmanRequest = {
      ...e.form,
      name: e.form.name.trim(),
      phone: e.form.phone.trim(),
      email: e.form.email?.trim() || null,
      website,
      description: e.form.description?.trim() || null,
    };
    this.saving.set(true);
    (e.id ? this.api.updateCraftsman(e.id, body) : this.api.createCraftsman(body)).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.toast.success(translate('craftsmen.saved'));
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected remove(c: Craftsman): void {
    if (!confirm(translate('craftsmen.confirmDelete', { name: c.name }))) return;
    this.api.deleteCraftsman(c.id).subscribe({
      next: () => {
        this.toast.success(translate('craftsmen.deleted'));
        this.list.update((l) => l?.filter((x) => x.id !== c.id) ?? l);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected tel(phone: string): string {
    return 'tel:' + phone.replace(/[^+0-9]/g, '');
  }

  private load(): void {
    this.api.craftsmen(this.filter()).subscribe({
      next: (l) => this.list.set(l),
      error: (e) => {
        this.list.set(this.list() ?? []);
        this.toast.error(errorMessage(e));
      },
    });
  }

  private patch(id: string, changes: Partial<Craftsman>): void {
    this.list.update((l) => l?.map((c) => (c.id === id ? { ...c, ...changes } : c)) ?? l);
  }
}
