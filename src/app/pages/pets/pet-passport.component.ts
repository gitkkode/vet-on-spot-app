import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  selector: 'app-pet-passport',
  template: `
    <a class="vos-back" [routerLink]="['/pets', petId, 'health']">← Health</a>

    @if (error()) {
      <div class="vos-err">
        {{ error() }}
        <button type="button" class="linkish" (click)="load()">Try again</button>
      </div>
    }
    @if (ok()) {
      <div class="vos-ok">{{ ok() }}</div>
    }

    @if (loading()) {
      <div class="pass-skel" aria-busy="true"></div>
      <div class="vos-skel"></div>
    } @else if (data(); as d) {
      <section class="stage" aria-label="Digital pet passport">
        <div class="pass">
          <div class="pass__shine" aria-hidden="true"></div>
          <div class="pass__orb pass__orb--a" aria-hidden="true"></div>
          <div class="pass__orb pass__orb--b" aria-hidden="true"></div>

          <header class="pass__top">
            <div class="pass__brand">
              <span class="pass__logo">Vetonsp<span>●</span>t</span>
              <em>Official Pet Passport</em>
            </div>
            <span class="pass__chip">Digital ID</span>
          </header>

          <div class="pass__body">
            <div class="pass__avatar" aria-hidden="true">
              @if (d.pet?.photoUrl) {
                <img [src]="d.pet.photoUrl" alt="" />
              } @else {
                {{ (d.pet?.name || '?').charAt(0) }}
              }
            </div>
            <div class="pass__identity">
              <p class="pass__species">{{ d.pet?.species || 'Pet' }} · {{ d.pet?.breed || 'Mixed' }}</p>
              <h1>{{ d.pet?.name || 'Your pet' }}</h1>
              <p class="pass__ref">{{ d.reference || passportRef(d) }}</p>
            </div>
          </div>

          <div class="pass__meta">
            <div>
              <em>Sex</em>
              <strong>{{ sexLabel(d.pet) }}</strong>
            </div>
            <div>
              <em>Age</em>
              <strong>{{ ageLabel(d.pet) }}</strong>
            </div>
            <div>
              <em>Color</em>
              <strong>{{ colorLabel(d.pet) }}</strong>
            </div>
          </div>

          <footer class="pass__foot">
            <span>Care that comes to you</span>
            <span class="pass__seal" aria-hidden="true">VS</span>
          </footer>
        </div>
      </section>

      <section class="panel panel--alert" aria-label="Emergency snapshot">
        <div class="panel__head">
          <h2>Emergency snapshot</h2>
          <span>Show this to any clinician</span>
        </div>
        <div class="grid">
          <div>
            <em>Allergies</em>
            <strong>{{ d.emergency?.allergies || 'None recorded' }}</strong>
          </div>
          <div>
            <em>Special needs</em>
            <strong>{{ d.emergency?.specialNeeds || '—' }}</strong>
          </div>
          <div class="grid__wide">
            <em>Medical notes</em>
            <strong>{{ d.emergency?.medicalNotes || '—' }}</strong>
          </div>
          <div class="grid__wide">
            <em>Current medications</em>
            <strong>{{ (d.emergency?.currentMedications || []).join(', ') || 'None listed' }}</strong>
          </div>
          <div>
            <em>Owner</em>
            <strong>{{ d.emergency?.ownerName || '—' }}</strong>
            <span>{{ d.emergency?.ownerMobile || '' }}</span>
          </div>
          <div>
            <em>Emergency contact</em>
            <strong>{{ d.emergency?.emergencyContact || '—' }}</strong>
          </div>
        </div>
      </section>

      @if (d.medications?.length) {
        <section class="panel">
          <div class="panel__head"><h2>Medications</h2></div>
          <ul class="rows">
            @for (m of d.medications; track m.medicine + (m.status || '')) {
              <li>
                <strong>{{ m.medicine }}</strong>
                <span>{{ m.dose }} {{ m.frequency }} · {{ m.status || 'ACTIVE' }}</span>
              </li>
            }
          </ul>
        </section>
      }

      @if (d.vaccinations?.length) {
        <section class="panel">
          <div class="panel__head"><h2>Vaccinations</h2></div>
          <ul class="rows">
            @for (v of d.vaccinations; track v.id) {
              <li>
                <strong>{{ v.vaccineName }}</strong>
                <span>
                  Given {{ prettyDate(v.givenOn) }}
                  @if (v.nextDueOn) {
                    · next {{ prettyDate(v.nextDueOn) }}
                  }
                </span>
              </li>
            }
          </ul>
        </section>
      }

      @if (d.conditions?.length) {
        <section class="panel">
          <div class="panel__head"><h2>Conditions</h2></div>
          <ul class="rows">
            @for (c of d.conditions; track c.id) {
              <li>
                <strong>{{ c.name }}</strong>
                <span>{{ c.status }}</span>
              </li>
            }
          </ul>
        </section>
      }

      <section class="panel">
        <div class="panel__head">
          <h2>Share passport</h2>
          <span>Temporary read-only link for a clinician or caregiver</span>
        </div>
        <div class="share">
          <label class="field">
            <span>Expires in (hours)</span>
            <input type="number" [(ngModel)]="shareHours" name="shareHours" min="1" max="720" />
          </label>
          <button type="button" class="btn" [disabled]="sharing()" (click)="createShare()">
            {{ sharing() ? 'Creating…' : 'Create share link' }}
          </button>
        </div>
        @if (share(); as sh) {
          <div class="share-box">
            <em>Share link</em>
            <a class="share-url" [href]="shareUrl(sh)" target="_blank" rel="noopener">{{ shareUrl(sh) }}</a>
            <p>Expires {{ prettyExpiry(sh.expiresAt) }}</p>
            <div class="share-actions">
              <button type="button" class="btn" (click)="copyShare(sh)">
                {{ copied() ? 'Copied' : 'Copy link' }}
              </button>
              <button type="button" class="ghost" (click)="revoke(sh.id)">Revoke access</button>
            </div>
          </div>
        }
      </section>

      <section class="panel">
        <div class="panel__head">
          <h2>Caregivers</h2>
          <span>Invite family to view this pet</span>
        </div>
        @if (careOk()) {
          <div class="vos-ok">{{ careOk() }}</div>
        }
        @if (careErr()) {
          <div class="vos-err">{{ careErr() }}</div>
        }
        @for (c of caregivers(); track c.id) {
          <div class="care-row">
            <div>
              <strong>{{ c.inviteeEmail || c.email }}</strong>
              <span>{{ c.role }} · {{ c.status }}</span>
            </div>
            @if (c.status !== 'revoked') {
              <button type="button" class="ghost" (click)="revokeCare(c.id)">Revoke</button>
            }
          </div>
        }
        <div class="share">
          <label class="field">
            <span>Invite email</span>
            <input [(ngModel)]="inviteEmail" name="inviteEmail" type="email" placeholder="family@email.com" />
          </label>
          <button type="button" class="btn" [disabled]="!inviteEmail || inviting()" (click)="invite()">
            {{ inviting() ? 'Sending…' : 'Invite caregiver' }}
          </button>
        </div>
      </section>
    }
  `,
  styles: [`
    :host { display: block; }

    .linkish {
      margin-left: 8px; border: 0; background: none; color: #FD4A29;
      font-weight: 700; cursor: pointer; text-decoration: underline;
    }

    .pass-skel {
      height: 280px; border-radius: 28px; margin: 8px 0 20px;
      background: linear-gradient(120deg, #1a1210 0%, #3a221c 50%, #1a1210 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
      box-shadow: 0 28px 60px rgba(10, 10, 10, 0.22);
    }
    @keyframes shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }

    .stage {
      perspective: 1200px;
      margin: 8px 0 18px;
    }

    .pass {
      position: relative;
      overflow: hidden;
      border-radius: 28px;
      padding: 22px 22px 18px;
      color: #fff;
      background:
        radial-gradient(ellipse 80% 70% at 100% -10%, rgba(253, 74, 41, 0.55) 0%, transparent 55%),
        radial-gradient(ellipse 60% 50% at 0% 100%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
        linear-gradient(145deg, #1a1210 0%, #2c1814 42%, #0d0b0a 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow:
        0 4px 8px rgba(10, 10, 10, 0.12),
        0 24px 48px rgba(10, 10, 10, 0.28),
        0 40px 80px rgba(253, 74, 41, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
      transform: rotateX(2deg);
      animation: pass-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes pass-in {
      from { opacity: 0; transform: translateY(16px) rotateX(8deg); }
      to { opacity: 1; transform: rotateX(2deg); }
    }
    .pass__shine {
      position: absolute; inset: -40% -20% auto;
      height: 70%;
      background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.14) 48%, transparent 62%);
      transform: rotate(-8deg);
      pointer-events: none;
      animation: gleam 4.5s ease-in-out infinite;
    }
    @keyframes gleam {
      0%, 100% { transform: translateX(-30%) rotate(-8deg); opacity: 0.4; }
      50% { transform: translateX(20%) rotate(-8deg); opacity: 0.85; }
    }
    .pass__orb {
      position: absolute; border-radius: 50%; pointer-events: none; filter: blur(2px);
    }
    .pass__orb--a {
      width: 160px; height: 160px; right: -40px; top: -50px;
      background: radial-gradient(circle, rgba(253,74,41,0.45), transparent 70%);
    }
    .pass__orb--b {
      width: 120px; height: 120px; left: -30px; bottom: -40px;
      background: radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%);
    }

    .pass__top {
      position: relative;
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 22px;
    }
    .pass__logo {
      display: block;
      font-family: var(--vos-display);
      font-weight: 700; font-size: 1.15rem; letter-spacing: -0.03em;
    }
    .pass__logo span { color: #FD4A29; }
    .pass__brand em {
      display: block; margin-top: 4px;
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
      opacity: 0.72; font-weight: 600;
    }
    .pass__chip {
      font-family: var(--vos-mono);
      font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
      padding: 6px 10px; border-radius: 999px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.16);
    }

    .pass__body {
      position: relative;
      display: flex; gap: 16px; align-items: center;
      margin-bottom: 22px;
    }
    .pass__avatar {
      width: 72px; height: 72px; border-radius: 22px;
      overflow: hidden; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(145deg, #FD4A29, #E03E20);
      font-family: var(--vos-display); font-weight: 700; font-size: 1.8rem;
      box-shadow: 0 12px 28px rgba(253, 74, 41, 0.35);
      border: 2px solid rgba(255,255,255,0.2);
    }
    .pass__avatar img { width: 100%; height: 100%; object-fit: cover; }
    .pass__species {
      margin: 0 0 4px;
      font-family: var(--vos-mono);
      font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
      opacity: 0.75; font-weight: 600;
    }
    .pass__identity h1 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: clamp(1.8rem, 4vw, 2.3rem);
      letter-spacing: -0.04em; line-height: 1.05;
    }
    .pass__ref {
      margin: 8px 0 0;
      font-family: var(--vos-mono);
      font-size: 12px; letter-spacing: 0.08em;
      opacity: 0.7;
    }

    .pass__meta {
      position: relative;
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      padding: 14px 0;
      border-top: 1px solid rgba(255,255,255,0.12);
      border-bottom: 1px solid rgba(255,255,255,0.12);
      margin-bottom: 14px;
    }
    .pass__meta em {
      display: block;
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
      opacity: 0.55; margin-bottom: 4px;
    }
    .pass__meta strong {
      font-family: var(--vos-display);
      font-size: 0.98rem; letter-spacing: -0.02em; font-weight: 650;
    }

    .pass__foot {
      position: relative;
      display: flex; justify-content: space-between; align-items: center;
      font-family: var(--vos-mono);
      font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
      opacity: 0.65;
    }
    .pass__seal {
      width: 34px; height: 34px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1.5px solid rgba(253, 74, 41, 0.7);
      color: #FD4A29; font-weight: 800; letter-spacing: 0;
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
    }

    .pass-note {
      margin: 0 0 18px;
      color: var(--vos-ink-muted);
      font-size: 0.95rem; line-height: 1.45;
    }

    .panel {
      margin-bottom: 14px;
      padding: 18px 18px 14px;
      border-radius: 20px;
      background: #fffef9;
      border: 1px solid var(--vos-border);
      box-shadow: 0 10px 28px rgba(10, 10, 10, 0.05);
    }
    .panel--alert {
      background: linear-gradient(180deg, #fffef9 0%, #fff5f3 100%);
      border-color: rgba(253, 74, 41, 0.22);
    }
    .panel__head {
      display: flex; flex-wrap: wrap; align-items: baseline;
      justify-content: space-between; gap: 8px;
      margin-bottom: 14px;
    }
    .panel__head h2 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: 1.15rem; letter-spacing: -0.03em;
    }
    .panel__head span {
      color: var(--vos-ink-muted); font-size: 0.85rem;
    }

    .grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px;
    }
    .grid__wide { grid-column: 1 / -1; }
    .grid em {
      display: block;
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--vos-ink-muted); margin-bottom: 4px; font-weight: 700;
    }
    .grid strong {
      display: block;
      font-family: var(--vos-display);
      font-size: 1rem; letter-spacing: -0.02em; font-weight: 650;
    }
    .grid span {
      display: block; margin-top: 2px;
      color: var(--vos-ink-muted); font-size: 0.88rem;
    }

    .rows { list-style: none; margin: 0; padding: 0; }
    .rows li {
      display: flex; flex-direction: column; gap: 2px;
      padding: 12px 0;
      border-top: 1px solid var(--vos-border);
    }
    .rows li:first-child { border-top: 0; padding-top: 0; }
    .rows strong {
      font-family: var(--vos-display);
      font-size: 1.02rem; letter-spacing: -0.02em;
    }
    .rows span { color: var(--vos-ink-muted); font-size: 0.9rem; }

    .share {
      display: grid; gap: 10px;
    }
    @media (min-width: 560px) {
      .share { grid-template-columns: 1fr auto; align-items: end; }
    }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field span {
      font-family: var(--vos-mono);
      font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--vos-ink-muted); font-weight: 700;
    }
    .field input {
      min-height: 46px; padding: 10px 12px; border-radius: 12px;
      border: 1px solid var(--vos-border); font: inherit; background: #fff;
    }
    .btn {
      min-height: 46px; padding: 10px 18px; border-radius: 999px; border: 0;
      background: #0a0a0a; color: #fff; font-weight: 700; cursor: pointer;
    }
    .btn:disabled { opacity: 0.6; cursor: wait; }

    .share-box {
      margin-top: 14px; padding-top: 14px;
      border-top: 1px solid var(--vos-border);
    }
    .share-box em {
      display: block; font-style: normal;
      font-family: var(--vos-mono); font-size: 10px; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--vos-ink-muted); margin-bottom: 6px;
    }
    .share-url {
      display: block;
      font-family: var(--vos-mono); font-size: 0.88rem;
      word-break: break-all; color: var(--vos-brand); font-weight: 600;
      background: #f7f3ea; padding: 10px 12px; border-radius: 10px;
      text-decoration: none;
    }
    .share-box p { margin: 8px 0; color: var(--vos-ink-muted); font-size: 0.9rem; }
    .share-actions {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    }

    .care-row {
      display: flex; justify-content: space-between; gap: 12px; align-items: center;
      padding: 12px 0; border-top: 1px solid var(--vos-border);
    }
    .care-row:first-of-type { border-top: 0; }
    .care-row strong { display: block; font-family: var(--vos-display); }
    .care-row span { color: var(--vos-ink-muted); font-size: 0.88rem; }

    .ghost {
      border: 1px solid rgba(180, 35, 24, 0.25); background: #fff;
      border-radius: 999px; padding: 8px 14px; cursor: pointer;
      color: #B42318; font-weight: 700; font-size: 0.88rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .pass, .pass__shine, .pass-skel { animation: none !important; }
    }
  `],
})
export class PetPassportComponent implements OnInit {
  petId = '';
  inviteEmail = '';
  shareHours = 72;
  readonly data = signal<any>(null);
  readonly caregivers = signal<any[]>([]);
  readonly share = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly ok = signal('');
  readonly careOk = signal('');
  readonly careErr = signal('');
  readonly inviting = signal(false);
  readonly sharing = signal(false);
  readonly copied = signal(false);

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }

  passportRef(d: any): string {
    const id = String(d?.pet?.id || this.petId || '').replace(/-/g, '').slice(0, 8).toUpperCase();
    return id ? `VOS-PP-${id}` : 'VOS-PP';
  }

  sexLabel(pet: any): string {
    const s = String(pet?.sex || pet?.gender || '').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '—';
  }

  colorLabel(pet: any): string {
    const c = String(pet?.color || pet?.colorMarks || pet?.color_marks || pet?.marks || '').trim();
    return c || '—';
  }

  ageLabel(pet: any): string {
    if (!pet) return '—';
    if (pet.ageYears != null || pet.ageMonths != null) {
      const y = Number(pet.ageYears || 0);
      const m = Number(pet.ageMonths || 0);
      if (y && m) return `${y}y ${m}m`;
      if (y) return `${y} yr${y === 1 ? '' : 's'}`;
      if (m) return `${m} mo`;
    }

    const raw = String(
      pet.ageOrDob || pet.age_or_dob || pet.age || pet.dateOfBirth || pet.dob || pet.birthDate || '',
    ).trim();
    if (!raw) return '—';

    // Absolute date → compute age
    if (/^\d{4}-\d{2}-\d{2}/.test(raw) || /^\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}/.test(raw)) {
      const iso = /^\d{4}-\d{2}-\d{2}/.test(raw)
        ? raw.slice(0, 10)
        : raw;
      const dob = new Date(/^\d{4}-\d{2}-\d{2}/.test(raw) ? `${iso}T12:00:00` : raw);
      if (!Number.isNaN(dob.getTime())) {
        return this.formatAgeFromDob(dob);
      }
    }

    // Already human age text ("3 years", "2y")
    if (/year|yr|month|mo|week|day|\dy\b|\dm\b/i.test(raw)) {
      return raw;
    }

    // Numeric years only
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n < 40) {
      return `${n} yr${n === 1 ? '' : 's'}`;
    }

    return raw;
  }

  private formatAgeFromDob(dob: Date): string {
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    years = Math.max(0, years);
    months = Math.max(0, months);
    if (years === 0 && months === 0) return '<1 mo';
    if (years === 0) return `${months} mo`;
    if (months === 0) return `${years} yr${years === 1 ? '' : 's'}`;
    return `${years}y ${months}m`;
  }

  prettyDate(v: string | null | undefined): string {
    if (!v) return '—';
    const raw = String(v);
    const d = new Date(raw.includes('T') ? raw : `${raw.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  prettyExpiry(v: string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 16).replace('T', ' ');
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private appOrigin(): string {
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        const o = window.location.origin;
        if (!/localhost|127\.0\.0\.1/.test(o)) return o;
      }
    } catch {
      /* ignore */
    }
    return 'https://app.vetonspot.com';
  }

  shareUrl(sh: any): string {
    const direct = String(sh?.url || sh?.shareUrl || sh?.link || sh?.shareLink || '').trim();
    if (/^https?:\/\//i.test(direct)) return direct;
    const token = String(sh?.token || sh?.shareToken || sh?.code || sh?.id || '').trim();
    if (!token) return this.appOrigin();
    if (/^https?:\/\//i.test(token)) return token;
    if (direct.startsWith('/')) return `${this.appOrigin()}${direct}`;
    return `${this.appOrigin()}/share/passport/${encodeURIComponent(token)}`;
  }

  async copyShare(sh: any) {
    const url = this.shareUrl(sh);
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      this.ok.set('Share link copied.');
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.ok.set(url);
    }
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [passport, carers, pet] = await Promise.all([
        this.api.passportFull(this.petId),
        this.api.caregivers(this.petId).catch(() => []),
        this.api.pet(this.petId).catch(() => null),
      ]);
      const merged = {
        ...(passport || {}),
        pet: { ...(passport?.pet || {}), ...(pet || {}) },
      };
      this.data.set(merged);
      const list = Array.isArray(carers)
        ? carers
        : Array.isArray((carers as any)?.caregivers)
          ? (carers as any).caregivers
          : Array.isArray((carers as any)?.items)
            ? (carers as any).items
            : [];
      this.caregivers.set(list);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Couldn’t load passport');
    } finally {
      this.loading.set(false);
    }
  }

  async createShare() {
    this.sharing.set(true);
    this.error.set('');
    this.ok.set('');
    this.copied.set(false);
    try {
      const row = await this.api.createPassportShare(this.petId, {
        expiresInHours: this.shareHours || 72,
      });
      this.share.set(row);
      const url = this.shareUrl(row);
      this.ok.set('Share link ready — copy and send it.');
      try {
        await navigator.clipboard.writeText(url);
        this.copied.set(true);
        this.ok.set('Share link created and copied.');
      } catch {
        /* user can tap Copy */
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Share failed');
    } finally {
      this.sharing.set(false);
    }
  }

  async revoke(id: string) {
    this.error.set('');
    try {
      await this.api.revokePassportShare(id);
      this.share.set(null);
      this.ok.set('Share revoked.');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Revoke failed');
    }
  }

  async invite() {
    this.inviting.set(true);
    this.careErr.set('');
    this.careOk.set('');
    const email = String(this.inviteEmail || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      this.careErr.set('Enter a valid email address.');
      this.inviting.set(false);
      return;
    }
    try {
      const res = await this.api.inviteCaregiver(this.petId, {
        email,
        inviteeEmail: email,
        role: 'family',
        sendEmail: true,
        notify: true,
      });
      const sent =
        res?.emailSent === true ||
        res?.inviteSent === true ||
        res?.notified === true ||
        /sent|email/i.test(String(res?.message || ''));
      const inviteLink = String(res?.inviteUrl || res?.url || res?.link || '').trim();
      if (sent) {
        this.careOk.set(`Invitation email sent to ${email}.`);
      } else if (inviteLink) {
        this.careOk.set(`Invite created. Share this link: ${inviteLink}`);
        try {
          await navigator.clipboard.writeText(inviteLink);
          this.careOk.set(`Invite created and link copied for ${email}.`);
        } catch {
          /* ignore */
        }
      } else {
        this.careOk.set(
          `Invite saved for ${email}. If they don’t get an email shortly, ask them to check spam or contact support.`,
        );
      }
      this.inviteEmail = '';
      const carers = await this.api.caregivers(this.petId);
      const list = Array.isArray(carers)
        ? carers
        : Array.isArray((carers as any)?.caregivers)
          ? (carers as any).caregivers
          : [];
      this.caregivers.set(list);
    } catch (e: any) {
      this.careErr.set(e?.error?.message || e?.message || 'Invite failed');
    } finally {
      this.inviting.set(false);
    }
  }

  async revokeCare(id: string) {
    this.careErr.set('');
    try {
      await this.api.revokeCaregiver(this.petId, id);
      const carers = await this.api.caregivers(this.petId);
      const list = Array.isArray(carers)
        ? carers
        : Array.isArray((carers as any)?.caregivers)
          ? (carers as any).caregivers
          : [];
      this.caregivers.set(list);
    } catch (e: any) {
      this.careErr.set(e?.message || 'Revoke failed');
    }
  }
}
