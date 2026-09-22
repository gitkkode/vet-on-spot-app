import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import {
  documentsFromTimeline,
  isPetPhotoDoc,
  petInitial,
  titleCase,
} from '../../utils/health-records';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-documents',
  template: `
    <a class="vos-back" [routerLink]="petId ? ['/pets', petId, 'health'] : '/health'">← Health</a>

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
        <p class="lede">Visit summaries, prescriptions, and files from care.</p>
      </div>
    </header>

    @if (error()) {
      <div class="vos-err">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else {
      @if (clinical().length) {
        <h2 class="sec">Clinical</h2>
        @for (d of clinical(); track d.id) {
          @if (d.kind === 'link') {
            <a class="vos-card item link-card" [routerLink]="d.link">
              <strong>{{ d.fileName }}</strong>
              <span class="vos-muted">{{ prettyCat(d.category) }} · {{ (d.createdAt || '').slice(0, 10) || '—' }}</span>
            </a>
          } @else {
            <button type="button" class="vos-card item" (click)="open(d.id)">
              <strong>{{ d.fileName || prettyCat(d.category) }}</strong>
              <span class="vos-muted">{{ prettyCat(d.category) }} · {{ (d.createdAt || '').slice(0, 10) }} · {{ titleCase(d.petName) }}</span>
            </button>
          }
        }
      }

      @if (photos().length) {
        <h2 class="sec">Photos</h2>
        @for (d of photos(); track d.id) {
          <button type="button" class="vos-card item" (click)="open(d.id)">
            <strong>{{ d.fileName || 'Photo' }}</strong>
            <span class="vos-muted">Profile photo · {{ (d.createdAt || '').slice(0, 10) }}</span>
          </button>
        }
      }

      @if (!clinical().length && !photos().length) {
        <div class="empty">
          <div class="empty__mark" aria-hidden="true"></div>
          <h2>No clinical documents yet</h2>
          <p>Visit summaries and prescriptions appear here after appointments. Your vet can also attach files during care.</p>
          <div class="empty__actions">
            @if (petId) {
              <a class="vos-btn" [routerLink]="['/pets', petId, 'timeline']">View timeline</a>
              <a class="vos-btn vos-btn-secondary" routerLink="/book/new">Book a visit</a>
            } @else {
              <a class="vos-btn" routerLink="/health">Back to Health</a>
            }
          </div>
        </div>
      } @else if (!clinical().length) {
        <p class="hint">No visit files yet — profile photos are listed below. Summaries appear after completed appointments.</p>
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
    .item {
      display: flex; flex-direction: column; gap: 4px; width: 100%;
      text-align: left; cursor: pointer; margin-bottom: 10px; border: 0;
    }
    .link-card { text-decoration: none; color: inherit; }
    .hint {
      margin: 0 0 12px; padding: 10px 12px; border-radius: 12px;
      background: #fff7e8; color: #8a5a12; font-size: 0.9rem;
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
    .empty p { margin: 0 auto 18px; max-width: 38ch; color: var(--vos-ink-muted); }
    .empty__actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  `],
})
export class DocumentsComponent implements OnInit, OnDestroy {
  readonly clinical = signal<any[]>([]);
  readonly photos = signal<any[]>([]);
  readonly petName = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
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
    return String(cat || 'document')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
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

      const uploaded = files || [];
      const photos = uploaded.filter((d) => isPetPhotoDoc(d));
      const clinicalFiles = uploaded.filter((d) => !isPetPhotoDoc(d));
      const derived = id ? documentsFromTimeline(timeline, this.petName()) : [];

      // Prefer real files; add visit links that aren't already covered
      const merged = [...clinicalFiles];
      for (const d of derived) {
        const key = String(d.link?.[1] || '');
        const already = clinicalFiles.some(
          (f) =>
            String(f.visitId || f.bookingId || '') === key ||
            /visit.?summary|prescription/i.test(String(f.category || f.fileName || '')),
        );
        if (!already) merged.push(d);
      }

      this.clinical.set(merged);
      this.photos.set(photos);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async open(id: string) {
    if (String(id).startsWith('visit-doc-') || String(id).startsWith('rx-doc-')) return;
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
