import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { BookingGateService } from '../../services/booking-gate.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-pet-detail',
  template: `
    <a routerLink="/pets" class="back">← Pets</a>

    @if (loading()) {
      <div class="vos-skel hero-skel"></div>
    } @else if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    } @else if (pet(); as p) {
      <header class="hero">
        <div class="hero__glow" aria-hidden="true"></div>
        <div class="portrait">
          @if (p.photoUrl) {
            <img [src]="p.photoUrl" [alt]="p.name || 'Pet'" />
          } @else {
            <span>{{ (p.name || '?').charAt(0) }}</span>
          }
        </div>
        <h1>{{ p.name || 'Your pet' }}</h1>
        <p class="hero__meta">{{ line(p) }}</p>
        <div class="hero__cta">
          @if (bookingBlocked(p.id)) {
            <button
              type="button"
              class="btn btn--disabled"
              disabled
              title="This pet already has an upcoming or ongoing appointment"
            >Book a visit</button>
          } @else {
            <a class="btn" routerLink="/book/new" [queryParams]="{ petId: p.id }">Book a visit</a>
          }
          <a class="btn btn--ghost" [routerLink]="['/pets', p.id, 'health']">Health hub</a>
        </div>
      </header>

      <section class="manage" aria-label="Care shortcuts">
        <h2>Take care of {{ p.name || 'them' }}</h2>
        <div class="grid">
          <a class="act act--dark" [routerLink]="['/pets', p.id, 'passport']">
            <strong>Pet Passport</strong>
            <span>Official VetOnSpot digital ID</span>
          </a>
          <a class="act" [routerLink]="['/pets', p.id, 'health']">
            <strong>Health hub</strong>
            <span>Meds, vaccines, conditions</span>
          </a>
          <a class="act" [routerLink]="['/pets', p.id, 'timeline']">
            <strong>Timeline</strong>
            <span>Every visit in one story</span>
          </a>
          <a class="act" [routerLink]="['/pets', p.id, 'documents']">
            <strong>Documents</strong>
            <span>Labs, scripts, uploads</span>
          </a>
          <a class="act" [routerLink]="['/pets', p.id, 'reminders']">
            <strong>Reminders</strong>
            <span>What comes next</span>
          </a>
          <a class="act" routerLink="/emergency" [queryParams]="{ petId: p.id }">
            <strong>Emergency</strong>
            <span>Fast path when it matters</span>
          </a>
        </div>
      </section>

      <section class="facts">
        <div class="facts__head">
          <h2>Profile</h2>
          <div class="facts__actions">
            <a [routerLink]="['/pets', p.id, 'edit']">Edit</a>
            <button type="button" class="danger-link" (click)="openRemove()">Remove</button>
          </div>
        </div>
        <div class="facts__grid">
          <div><em>Age / DOB</em><strong>{{ p.ageOrDob || '—' }}</strong></div>
          <div><em>Color</em><strong>{{ p.colorMarks || p.color || '—' }}</strong></div>
          <div><em>Weight</em><strong>{{ p.weight || '—' }}</strong></div>
          <div><em>Microchip</em><strong>{{ p.microchip || '—' }}</strong></div>
          <div class="wide"><em>Allergies</em><strong>{{ p.allergies || '—' }}</strong></div>
          <div class="wide"><em>Medical notes</em><strong>{{ p.medicalNotes || '—' }}</strong></div>
          <div class="wide"><em>Special needs</em><strong>{{ p.specialNeeds || '—' }}</strong></div>
        </div>
      </section>

      @if (removeOpen()) {
        <div class="modal-layer" role="presentation" (click)="closeRemove()">
          <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-pet-title"
            (click)="$event.stopPropagation()"
          >
            <h2 id="remove-pet-title">Remove {{ p.name || 'this pet' }}?</h2>
            <p>
              This requests removal of
              <strong>{{ p.name || 'this pet' }}’s</strong>
              profile from your account. We’ll notify the care team if we can’t complete it instantly.
            </p>
            @if (removeError()) {
              <p class="modal__err" role="alert">{{ removeError() }}</p>
            }
            <div class="modal__actions">
              <button type="button" class="ghost" (click)="closeRemove()" [disabled]="removing()">
                Keep profile
              </button>
              <button
                type="button"
                class="btn btn--danger"
                [disabled]="removing()"
                (click)="confirmRemove()"
              >
                {{ removing() ? 'Removing…' : 'Remove pet' }}
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    .back {
      display: inline-block; margin-bottom: 12px;
      font-weight: 700; color: var(--vos-brand); text-decoration: none;
    }
    .linkish {
      border: 0; background: none; font-weight: 700; cursor: pointer; text-decoration: underline;
    }
    .hero-skel { height: 220px; margin-bottom: 16px; }

    .hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      text-align: center;
      border-radius: 28px;
      padding: 32px 24px 28px;
      margin-bottom: 20px;
      color: #fff;
      background: linear-gradient(145deg, #FD4A29 0%, #E03E20 42%, #1a100e 100%);
      box-shadow: 0 20px 48px rgba(253, 74, 41, 0.28);
    }
    .hero__glow {
      position: absolute; width: 180px; height: 180px; border-radius: 50%;
      right: -50px; top: -60px; background: rgba(255,255,255,0.12); pointer-events: none;
    }
    .portrait {
      width: 104px; height: 104px; border-radius: 50%;
      margin: 0 auto 14px; overflow: hidden;
      background: rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--vos-display); font-size: 2.4rem; font-weight: 700;
      border: 3px solid rgba(255,255,255,0.35);
    }
    .portrait img { width: 100%; height: 100%; object-fit: cover; }
    .hero h1 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: clamp(2rem, 5vw, 2.7rem);
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .hero__meta {
      margin: 0 auto 18px;
      opacity: 0.92;
      font-size: 1.05rem;
      max-width: 36ch;
    }
    .hero__cta {
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;
    }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 46px; padding: 10px 20px; border-radius: 999px;
      border: 0;
      background: #0a0a0a; color: #fff; font-weight: 700; text-decoration: none;
      font-family: inherit;
      cursor: pointer;
    }
    .btn--ghost {
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.35);
    }
    .btn--disabled,
    .btn--disabled:hover {
      background: #c8c4bc;
      color: #fff;
      cursor: not-allowed;
      border: 0;
    }

    .manage { margin-bottom: 20px; }
    .manage h2, .facts h2 {
      margin: 0 0 12px;
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.03em;
    }
    .grid {
      display: grid; gap: 10px;
      grid-template-columns: 1fr;
    }
    @media (min-width: 700px) {
      .grid { grid-template-columns: 1fr 1fr; }
    }
    .act {
      display: flex; flex-direction: column; gap: 4px;
      text-decoration: none; color: inherit;
      padding: 16px 18px;
      border-radius: 18px;
      background: #fff;
      border: 1px solid var(--vos-border);
      box-shadow: 0 6px 18px rgba(20, 16, 12, 0.04);
    }
    .act--dark {
      background: #0a0a0a; color: #fff; border-color: transparent;
    }
    .act--dark span { color: rgba(255,255,255,0.7); }
    .act strong {
      font-family: var(--vos-display);
      font-size: 1.1rem;
      letter-spacing: -0.02em;
    }
    .act span { color: var(--vos-ink-muted); font-size: 0.92rem; }

    .facts {
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 22px;
      padding: 18px 18px 8px;
      margin-bottom: 28px;
      box-shadow: 0 8px 22px rgba(20, 16, 12, 0.04);
    }
    .facts__head {
      display: flex; justify-content: space-between; align-items: baseline;
      margin-bottom: 8px;
    }
    .facts__actions {
      display: flex; align-items: center; gap: 14px;
    }
    .facts__head a {
      font-weight: 700; color: var(--vos-brand); text-decoration: none;
    }
    .danger-link {
      border: 0; background: none; padding: 0;
      font: inherit; font-weight: 700; color: #B42318;
      cursor: pointer;
    }
    .facts__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 14px;
      padding-bottom: 10px;
    }
    .facts__grid .wide { grid-column: 1 / -1; }
    .facts__grid em {
      display: block;
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .facts__grid strong {
      font-family: var(--vos-display);
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.3;
      white-space: pre-wrap;
    }

    .modal-layer {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
      box-sizing: border-box;
      background: rgba(10, 10, 10, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      overflow: auto;
      overscroll-behavior: contain;
    }
    .modal {
      position: relative;
      z-index: 1;
      width: min(440px, 100%);
      margin: auto;
      padding: 24px 22px;
      border-radius: 20px;
      background: #fff;
      border: 1px solid var(--vos-border, #e8e0d4);
      box-shadow: 0 24px 60px rgba(10, 10, 10, 0.22);
    }
    .modal h2 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.03em;
    }
    .modal > p {
      margin: 0 0 16px;
      color: var(--vos-ink-muted);
      line-height: 1.45;
    }
    .modal__err {
      color: #b42318;
      font-weight: 700;
      margin: 0 0 12px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #fff5f3;
      border: 1px solid rgba(180, 35, 24, 0.22);
      font-size: 0.9rem;
    }
    .modal__actions {
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; margin-top: 8px;
    }
    .modal__actions .btn, .modal__actions .ghost {
      min-height: 44px; padding: 10px 18px; border-radius: 999px;
      font-weight: 700; font: inherit; cursor: pointer; border: 0;
    }
    .modal__actions .btn {
      background: linear-gradient(135deg, #FD4A29, #E03E20); color: #fff;
    }
    .modal__actions .btn--danger {
      background: #B42318;
    }
    .modal__actions .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .modal__actions .ghost {
      background: #fff; border: 1px solid var(--vos-border, #e8e0d4); color: var(--vos-ink);
    }
    .modal__actions .ghost:disabled { opacity: 0.55; cursor: not-allowed; }
  `],
})
export class PetDetailComponent implements OnInit {
  readonly pet = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly removeOpen = signal(false);
  readonly removing = signal(false);
  readonly removeError = signal('');
  private id = '';

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private router: Router,
    private activePet: ActivePetService,
    private bookingGate: BookingGateService,
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
    void this.bookingGate.refresh();
  }

  bookingBlocked(petId: string): boolean {
    return this.bookingGate.isBlocked(petId, this.pet()?.name);
  }

  line(p: any): string {
    return [p.species, p.breed, p.gender || p.sex].filter(Boolean).join(' · ') || 'Pet profile';
  }

  openRemove() {
    this.removeError.set('');
    this.removeOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeRemove() {
    if (this.removing()) return;
    this.removeOpen.set(false);
    this.removeError.set('');
    document.body.style.overflow = '';
  }

  async confirmRemove() {
    if (!this.id || this.removing()) return;
    const pet = this.pet();
    this.removing.set(true);
    this.removeError.set('');
    try {
      const result = await this.api.deletePet(this.id, {
        petName: String(pet?.name || '').trim() || undefined,
        reason: 'Removed by customer from pet profile',
      });

      if (result.via === 'api') {
        try {
          const raw = await this.api.pets();
          const remaining = Array.isArray(raw) ? raw : raw?.pets || [];
          this.activePet.syncFromPets(remaining);
        } catch {
          this.activePet.set(null);
        }
        void this.bookingGate.refresh();
        document.body.style.overflow = '';
        this.removeOpen.set(false);
        await this.router.navigate(['/pets'], {
          queryParams: { removed: '1', via: 'api' },
        });
        return;
      }

      // Support request — pet stays until admin acts
      document.body.style.overflow = '';
      this.removeOpen.set(false);
      await this.router.navigate(['/pets'], {
        queryParams: {
          removed: '1',
          via: 'request',
          ticket: result.ticketId || null,
        },
      });
    } catch (e: any) {
      const raw = String(e?.error?.message || e?.message || '').trim();
      this.removeError.set(
        /route not found/i.test(raw)
          ? 'Couldn’t remove right now. Please try again or contact Support.'
          : raw || 'Could not remove this pet. Try again.',
      );
    } finally {
      this.removing.set(false);
    }
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await this.api.pet(this.id);
      this.pet.set(p);
      if (p?.id) this.activePet.set(p.id);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
