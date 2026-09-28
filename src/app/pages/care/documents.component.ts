import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
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
import { HealthShellComponent } from '../../shared/health-shell.component';
import { HealthEmptyComponent } from '../../shared/health-empty.component';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, VosSelectComponent, HealthShellComponent, HealthEmptyComponent],
  selector: 'app-documents',
  template: `
    <vos-health-shell
      [petId]="petId"
      section="documents"
      sectionTitle="Documents"
      lede="Upload IDs, photos, past reports, and care files — organised by category."
    >

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
            @if (d.kind === 'link' || isDerivedDoc(d)) {
              <a class="vos-card item link-card" [routerLink]="d.link">
                <strong>{{ d.fileName }}</strong>
                <span class="vos-muted">{{ prettyCat(d.category) }} · {{ (d.createdAt || '').slice(0, 10) || '—' }}</span>
              </a>
            } @else {
              <div class="vos-card item item--managed">
                <button type="button" class="item__main" (click)="open(d)">
                  <strong>{{ d.fileName || prettyCat(d.category) }}</strong>
                  <span class="vos-muted">{{ prettyCat(d.category) }} · {{ (d.createdAt || '').slice(0, 10) || '—' }}</span>
                </button>
                <div class="item__acts">
                  <button type="button" class="act" (click)="open(d)">Open</button>
                  <button type="button" class="act" (click)="startEdit(d)" [disabled]="busyId() === d.id">Edit</button>
                  <button type="button" class="act" (click)="pickReplace(d)" [disabled]="busyId() === d.id">Change</button>
                  <button type="button" class="act act--danger" (click)="confirmRemove(d)" [disabled]="busyId() === d.id">
                    {{ busyId() === d.id && removing() ? 'Removing…' : 'Remove' }}
                  </button>
                </div>
              </div>
            }
          }
        }
      } @else {
        <vos-health-empty
          title="No documents yet"
          message="Upload ID papers, past reports, vaccination cards, or extra photos. Visit summaries also appear here after completed appointments."
        >
          @if (petId) {
            <a class="vos-btn vos-btn-secondary" [routerLink]="['/pets', petId, 'timeline']">View timeline</a>
            <a class="vos-btn" routerLink="/book/new">Book a visit</a>
          } @else {
            <a class="vos-btn" routerLink="/health">Back to Health</a>
          }
        </vos-health-empty>
      }
    }

    <input
      #replaceInput
      type="file"
      class="sr-file"
      [accept]="acceptFor(editCategory)"
      (change)="onReplaceFile($event)"
    />

    @if (editDoc(); as ed) {
      <div class="modal-layer" role="presentation" (click)="closeEdit()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-doc-title" (click)="$event.stopPropagation()">
          <h2 id="edit-doc-title">Edit document</h2>
          <p class="modal__file">{{ ed.fileName || 'Document' }}</p>
          <label class="field">
            Category
            <vos-select
              name="editDocCategory"
              ariaLabel="Document category"
              [options]="categoryOptions"
              [(ngModel)]="editCategory"
            />
          </label>
          @if (editError()) {
            <p class="modal__err" role="alert">{{ editError() }}</p>
          }
          <div class="modal__acts">
            <button type="button" class="ghost" (click)="closeEdit()" [disabled]="savingEdit()">Cancel</button>
            <button type="button" class="vos-btn" (click)="saveEdit()" [disabled]="savingEdit()">
              {{ savingEdit() ? 'Saving…' : 'Save category' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (removeDoc(); as rd) {
      <div class="modal-layer" role="presentation" (click)="closeRemove()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="remove-doc-title" (click)="$event.stopPropagation()">
          <h2 id="remove-doc-title">Remove document?</h2>
          <p>This removes <strong>{{ rd.fileName || 'this file' }}</strong> from {{ titleCase(petName()) || 'your pet' }}’s records.</p>
          @if (editError()) {
            <p class="modal__err" role="alert">{{ editError() }}</p>
          }
          <div class="modal__acts">
            <button type="button" class="ghost" (click)="closeRemove()" [disabled]="removing()">Keep</button>
            <button type="button" class="vos-btn danger" (click)="doRemove()" [disabled]="removing()">
              {{ removing() ? 'Removing…' : 'Remove' }}
            </button>
          </div>
        </div>
      </div>
    }
    </vos-health-shell>
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
      text-align: left; margin-bottom: 10px; border: 0;
    }
    .item--managed {
      gap: 10px;
      padding: 14px 16px;
    }
    .item__main {
      display: flex; flex-direction: column; gap: 4px; width: 100%;
      text-align: left; border: 0; background: transparent; padding: 0;
      cursor: pointer; font: inherit; color: inherit;
    }
    .item__acts {
      display: flex; flex-wrap: wrap; gap: 8px;
    }
    .act {
      min-height: 34px; padding: 0 12px; border-radius: 999px;
      border: 1px solid var(--vos-border); background: #fff;
      font: inherit; font-size: 0.85rem; font-weight: 700;
      color: var(--vos-ink); cursor: pointer;
    }
    .act:disabled { opacity: 0.55; cursor: not-allowed; }
    .act--danger {
      color: #B42318; border-color: rgba(180, 35, 24, 0.35);
    }
    .link-card { text-decoration: none; color: inherit; cursor: pointer; }
    .sr-file {
      position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;
    }
    .modal-layer {
      position: fixed; inset: 0; z-index: 80;
      display: flex; align-items: center; justify-content: center;
      padding: 20px; background: rgba(10, 10, 10, 0.45);
    }
    .modal {
      width: min(420px, 100%);
      padding: 22px 20px;
      border-radius: 18px;
      background: #fff;
      border: 1px solid var(--vos-border);
      box-shadow: 0 20px 50px rgba(10, 10, 10, 0.2);
    }
    .modal h2 {
      margin: 0 0 8px; font-family: var(--vos-display); font-size: 1.25rem;
    }
    .modal p { margin: 0 0 14px; color: var(--vos-ink-muted); line-height: 1.45; }
    .modal__file {
      margin: 0 0 14px !important;
      color: var(--vos-ink) !important;
      font-weight: 700;
    }
    .modal__err {
      margin: 0 0 12px !important;
      padding: 10px 12px;
      border-radius: 12px;
      background: #fff5f3;
      border: 1px solid rgba(180, 35, 24, 0.22);
      color: #B42318 !important;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .modal__acts {
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; margin-top: 8px;
    }
    .modal__acts .ghost {
      min-height: 44px; padding: 0 16px; border-radius: 999px;
      border: 1px solid var(--vos-border); background: #fff;
      font: inherit; font-weight: 700; cursor: pointer;
    }
    .modal__acts .vos-btn { min-width: 120px; }
    .modal__acts .danger {
      background: #B42318 !important;
    }
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
  readonly removing = signal(false);
  readonly savingEdit = signal(false);
  readonly busyId = signal('');
  readonly error = signal('');
  readonly ok = signal('');
  readonly editError = signal('');
  readonly editDoc = signal<any | null>(null);
  readonly removeDoc = signal<any | null>(null);
  readonly categories = PET_DOC_CATEGORIES.filter((c) => c.id !== 'clinical');
  readonly categoryOptions: VosSelectOption[] = this.categories.map((c) => ({
    value: c.id,
    label: c.label,
  }));
  readonly maxMb = Math.round(MAX_PET_DOC_BYTES / (1024 * 1024));
  uploadCategory: PetDocCategoryId = 'id';
  editCategory: PetDocCategoryId = 'id';
  petId = '';
  private replaceTarget: any | null = null;
  private sub?: Subscription;

  @ViewChild('replaceInput') replaceInput?: ElementRef<HTMLInputElement>;

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
    document.body.style.overflow = '';
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

  isDerivedDoc(d: any): boolean {
    const id = String(d?.id || '');
    return (
      d?.kind === 'link' ||
      d?.source === 'visit' ||
      id.startsWith('visit-doc-') ||
      id.startsWith('rx-doc-') ||
      !id
    );
  }

  isManagedDoc(d: any): boolean {
    return !this.isDerivedDoc(d);
  }

  startEdit(d: any) {
    if (!this.isManagedDoc(d)) return;
    this.editError.set('');
    this.ok.set('');
    this.error.set('');
    this.editCategory = normalizeDocCategory(d?.category);
    this.editDoc.set(d);
    document.body.style.overflow = 'hidden';
  }

  closeEdit() {
    if (this.savingEdit()) return;
    this.editDoc.set(null);
    this.editError.set('');
    document.body.style.overflow = '';
  }

  async saveEdit() {
    const d = this.editDoc();
    if (!d?.id || this.savingEdit()) return;
    this.savingEdit.set(true);
    this.editError.set('');
    this.busyId.set(String(d.id));
    try {
      await this.api.updatePetDocument(String(d.id), {
        category: this.editCategory,
        petId: this.petId,
      });
      this.ok.set(`Updated category to ${categoryLabel(this.editCategory)}.`);
      this.editDoc.set(null);
      document.body.style.overflow = '';
      await this.load();
    } catch (e: any) {
      const msg = String(e?.error?.message || e?.message || 'Could not update document');
      this.editError.set(
        /route not found|missing/i.test(msg)
          ? 'Document edit API is missing on the server. See API_README.md.'
          : msg,
      );
    } finally {
      this.savingEdit.set(false);
      this.busyId.set('');
    }
  }

  pickReplace(d: any) {
    if (!this.isManagedDoc(d) || this.busyId()) return;
    this.replaceTarget = d;
    this.editCategory = normalizeDocCategory(d?.category);
    this.error.set('');
    this.ok.set('');
    this.replaceInput?.nativeElement?.click();
  }

  async onReplaceFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    const d = this.replaceTarget;
    this.replaceTarget = null;
    if (!file || !d?.id) return;
    if (!isAllowedPetDocument(file)) {
      this.error.set(
        file.size > MAX_PET_DOC_BYTES
          ? `File must be ${this.maxMb} MB or smaller.`
          : 'Please choose a PDF, image, or Word document.',
      );
      return;
    }
    this.busyId.set(String(d.id));
    this.uploading.set(true);
    this.error.set('');
    try {
      await this.api.replacePetDocument(String(d.id), file, {
        category: normalizeDocCategory(d.category),
        petId: this.petId,
      });
      this.ok.set(`Replaced “${d.fileName || 'document'}” with “${file.name}”.`);
      await this.load();
    } catch (e: any) {
      const msg = String(e?.error?.message || e?.message || 'Replace failed');
      this.error.set(
        /route not found|missing/i.test(msg)
          ? 'Document change API is missing on the server. See API_README.md.'
          : msg,
      );
    } finally {
      this.uploading.set(false);
      this.busyId.set('');
    }
  }

  confirmRemove(d: any) {
    if (!this.isManagedDoc(d)) return;
    this.editError.set('');
    this.error.set('');
    this.ok.set('');
    this.removeDoc.set(d);
    document.body.style.overflow = 'hidden';
  }

  closeRemove() {
    if (this.removing()) return;
    this.removeDoc.set(null);
    this.editError.set('');
    document.body.style.overflow = '';
  }

  async doRemove() {
    const d = this.removeDoc();
    if (!d?.id || this.removing()) return;
    this.removing.set(true);
    this.busyId.set(String(d.id));
    this.editError.set('');
    try {
      await this.api.deletePetDocument(String(d.id), this.petId);
      this.ok.set(`Removed “${d.fileName || 'document'}”.`);
      this.removeDoc.set(null);
      document.body.style.overflow = '';
      await this.load();
    } catch (e: any) {
      const msg = String(e?.error?.message || e?.message || 'Could not remove document');
      this.editError.set(
        /route not found|missing/i.test(msg)
          ? 'Document remove API is missing on the server. See API_README.md.'
          : msg,
      );
    } finally {
      this.removing.set(false);
      this.busyId.set('');
    }
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
