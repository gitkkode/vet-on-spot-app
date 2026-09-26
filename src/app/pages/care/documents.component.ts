import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import {
  documentsFromTimeline,
  petInitial,
  titleCase,
} from '../../utils/health-records';
import {
  PET_DOC_CATEGORIES,
  PetDocCategoryId,
  categoryLabel,
  groupDocumentsByCategory,
  isAllowedPetDocument,
  MAX_PET_DOC_BYTES,
  normalizeDocCategory,
} from '../../utils/pet-documents';
import { VosSelectComponent, VosSelectOption } from '../../shared/vos-select.component';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, VosSelectComponent, VosBackButtonComponent],
  selector: 'app-documents',
  template: `
    <vos-back-button [fallback]="petId ? ['/pets', petId, 'health'] : '/health'" fallbackLabel="Health" />

    <header class="head">
      @if (petName()) {
        <span class="avatar" aria-hidden="true">{{ petInitial(petName()) }}</span>
      }
      <div>
        <p class="kicker">Health record</p>
        <h1>
          @if (petName()) {
            {{ titleCase(petName()) }}’s Documents
          } @else {
            Documents
          }
        </h1>
        <p class="lede">Upload IDs, photos, past reports, and care files — organised by category.</p>
      </div>
    </header>

    @if (error()) {
      <div class="vos-err">{{ error() }}</div>
    }
    @if (ok()) {
      <div class="vos-ok">{{ ok() }}</div>
    }

    @if (petId) {
      <section class="upload-panel">
        <h2 class="sec">Upload a document <span class="opt">(optional)</span></h2>
        <p class="upload-lede">Choose a category, then attach a file. Max {{ maxMb }} MB · PDF or image preferred.</p>
        <div class="upload-row">
          <label class="field">
            Category
            <vos-select
              name="docCategory"
              ariaLabel="Document category"
              [options]="categoryOptions"
              [(ngModel)]="uploadCategory"
            />
          </label>
          <label class="upload-btn" [class.is-busy]="uploading()">
            <input
              type="file"
              [accept]="acceptFor(uploadCategory)"
              [disabled]="uploading()"
              (change)="onUpload($event)"
            />
            <strong>{{ uploading() ? 'Uploading…' : 'Choose file' }}</strong>
          </label>
        </div>
        <p class="hint-cat">{{ categoryHint(uploadCategory) }}</p>
      </section>
    } @else {
      <p class="hint">Select a pet from Health to upload and organise their documents.</p>
    }

    @if (loading()) {
      <div class="vos-skel"></div>
    } @else {
      @if (groups().length) {
        @for (g of groups(); track g.category.id) {
          <h2 class="sec">{{ g.category.label }}</h2>
          @for (d of g.items; track trackDoc($index, d)) {
            @if (d.kind === 'link') {
              <a class="vos-card item link-card" [routerLink]="d.link">
                <strong>{{ d.fileName }}</strong>
                <span class="vos-muted">{{ prettyCat(d.category) }} · {{ (d.createdAt || '').slice(0, 10) || '—' }}</span>
              </a>
            } @else {
              <button type="button" class="vos-card item" (click)="open(d)">
                <strong>{{ d.fileName || prettyCat(d.category) }}</strong>
                <span class="vos-muted">{{ prettyCat(d.category) }} · {{ (d.createdAt || '').slice(0, 10) || '—' }}</span>
              </button>
            }
          }
        }
      } @else {
        <div class="empty">
          <div class="empty__mark" aria-hidden="true"></div>
          <h2>No documents yet</h2>
          <p>
            Upload ID papers, past reports, vaccination cards, or extra photos.
            Visit summaries also appear here after completed appointments.
          </p>
          <div class="empty__actions">
            @if (petId) {
              <a class="vos-btn vos-btn-secondary" [routerLink]="['/pets', petId, 'timeline']">View timeline</a>
              <a class="vos-btn" routerLink="/book/new">Book a visit</a>
            } @else {
              <a class="vos-btn" routerLink="/health">Back to Health</a>
            }
          </div>
        </div>
      }
    }
  `,
  styles: [`
    .head { display: flex; gap: 14px; align-items: flex-start; margin: 8px 0 16px; }
    .avatar {
      width: 48px; height: 48px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      color: var(--vos-brand); font-family: var(--vos-display);
      font-size: 1.2rem; font-weight: 700;
      box-shadow: 0 0 0 3px rgba(253, 74, 41, 0.12);
    }
    .kicker {
      margin: 0 0 4px; font-family: var(--vos-mono);
      font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--vos-brand); font-weight: 700;
    }
    h1 { margin: 0; font-family: var(--vos-display); font-size: clamp(1.55rem, 3.5vw, 2rem); letter-spacing: -0.03em; }
    .lede { margin: 6px 0 0; color: var(--vos-ink-muted); }
    .sec {
      margin: 18px 0 8px; font-family: var(--vos-mono);
      font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--vos-ink-muted); font-weight: 700;
    }
    .opt { text-transform: none; letter-spacing: 0; font-weight: 600; color: var(--vos-ink-muted); }
    .upload-panel {
      margin: 8px 0 18px; padding: 16px;
      border-radius: 16px; border: 1px solid var(--vos-border);
      background: #faf8f4;
    }
    .upload-lede { margin: 0 0 12px; color: var(--vos-ink-muted); font-size: 0.92rem; }
    .upload-row {
      display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;
    }
    .field {
      display: flex; flex-direction: column; gap: 6px; flex: 1 1 180px;
      font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--vos-ink-muted);
    }
    .field vos-select {
      text-transform: none; letter-spacing: 0; font-weight: 600;
    }
    .upload-btn {
      position: relative; display: inline-flex; align-items: center; justify-content: center;
      min-height: 44px; padding: 0 18px; border-radius: 999px; cursor: pointer;
      background: linear-gradient(135deg, #FD4A29, #E03E20); color: #fff;
      font-weight: 700; flex: 0 0 auto;
    }
    .upload-btn.is-busy { opacity: 0.65; cursor: wait; }
    .upload-btn input {
      position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
    }
    .hint-cat { margin: 10px 0 0; font-size: 0.88rem; color: var(--vos-ink-muted); }
    .hint {
      margin: 0 0 12px; padding: 10px 12px; border-radius: 12px;
      background: #fff7e8; color: #8a5a12; font-size: 0.9rem;
    }
    .item {
      display: flex; flex-direction: column; gap: 4px; width: 100%;
      text-align: left; cursor: pointer; margin-bottom: 10px; border: 0;
    }
    .link-card { text-decoration: none; color: inherit; }
    .empty {
      text-align: center; padding: 36px 22px;
      border-radius: 24px; background: #fffef9; border: 1px solid var(--vos-border);
    }
    .empty__mark {
      width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 12px;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      box-shadow: inset 0 0 0 2px rgba(253, 74, 41, 0.2);
    }
    .empty h2 { margin: 0 0 8px; font-family: var(--vos-display); }
    .empty p { margin: 0 auto 18px; max-width: 42ch; color: var(--vos-ink-muted); }
    .empty__actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  `],
})
export class DocumentsComponent implements OnInit, OnDestroy {
  readonly groups = signal<{ category: (typeof PET_DOC_CATEGORIES)[number]; items: any[] }[]>([]);
  readonly petName = signal('');
  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly ok = signal('');
  readonly categories = PET_DOC_CATEGORIES.filter((c) => c.id !== 'clinical');
  readonly categoryOptions: VosSelectOption[] = this.categories.map((c) => ({
    value: c.id,
    label: c.label,
  }));
  readonly maxMb = Math.round(MAX_PET_DOC_BYTES / (1024 * 1024));
  uploadCategory: PetDocCategoryId = 'id';
  petId = '';
  private sub?: Subscription;

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private http: HttpClient,
    private activePet: ActivePetService,
  ) {}

  titleCase = titleCase;
  petInitial = petInitial;

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe((pm) => {
      this.petId = pm.get('id') || '';
      if (this.petId) this.activePet.set(this.petId);
      void this.load();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  prettyCat(cat: string) {
    return categoryLabel(cat);
  }

  acceptFor(id: PetDocCategoryId) {
    return PET_DOC_CATEGORIES.find((c) => c.id === id)?.accept || 'image/*,.pdf';
  }

  categoryHint(id: PetDocCategoryId) {
    return PET_DOC_CATEGORIES.find((c) => c.id === id)?.hint || '';
  }

  trackDoc(i: number, d: any) {
    return d?.id || `${d?.fileName}-${i}`;
  }

  async onUpload(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    this.error.set('');
    this.ok.set('');
    if (!file || !this.petId) return;
    if (!isAllowedPetDocument(file)) {
      this.error.set(
        file.size > MAX_PET_DOC_BYTES
          ? `File must be ${this.maxMb} MB or smaller.`
          : 'Please choose a PDF, image, or Word document.',
      );
      return;
    }
    this.uploading.set(true);
    try {
      await this.api.uploadPetDocument(this.petId, file, this.uploadCategory);
      this.ok.set(`Uploaded “${file.name}” to ${categoryLabel(this.uploadCategory)}.`);
      await this.load();
    } catch (e: any) {
      const msg = String(e?.error?.message || e?.message || 'Upload failed');
      this.error.set(
        /route not found/i.test(msg)
          ? 'Document upload API is missing on the server. See API_README.md.'
          : msg,
      );
    } finally {
      this.uploading.set(false);
    }
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const id = this.petId || this.activePet.get();
      let name = '';
      if (id) {
        try {
          const pet = await this.api.pet(id);
          name = pet?.name || '';
          this.petId = id;
        } catch {
          /* ignore */
        }
      }
      this.petName.set(name);

      const [files, timeline] = await Promise.all([
        this.api.documents(id || null),
        id ? this.api.petTimeline(id).catch(() => null) : Promise.resolve(null),
      ]);
      if (!name && timeline?.pet?.name) this.petName.set(timeline.pet.name);

      const uploaded = (files || []).map((d: any) => ({
        ...d,
        category: normalizeDocCategory(d?.category || d?.type),
        fileName: d?.fileName || d?.name || d?.originalName || 'Document',
      }));
      const derived = id ? documentsFromTimeline(timeline, this.petName()) : [];
      const merged = [...uploaded];
      for (const d of derived) {
        const key = String(d.link?.[1] || '');
        const already = uploaded.some(
          (f: any) =>
            String(f.visitId || f.bookingId || '') === key ||
            /visit.?summary|prescription/i.test(String(f.category || f.fileName || '')),
        );
        if (!already) {
          merged.push({
            ...d,
            category: normalizeDocCategory(d.category),
          });
        }
      }

      this.groups.set(groupDocumentsByCategory(merged));
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async open(d: any) {
    const id = String(d?.id || '');
    if (!id || id.startsWith('visit-doc-') || id.startsWith('rx-doc-')) return;
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: { url: string } }>(
          `${environment.apiUrl}/files/${id}/signed-url`,
        ),
      );
      if (res.data?.url) window.open(res.data.url, '_blank', 'noopener');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Unable to open file');
    }
  }
}
