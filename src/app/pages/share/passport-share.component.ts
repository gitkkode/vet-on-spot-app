import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerApiService } from '../../services/customer-api.service';
import { VosTitleCasePipe } from '../../shared/vos-title-case.pipe';
import { VosPetAvatarComponent } from '../../shared/vos-pet-avatar.component';
import { petInitial } from '../../utils/health-records';
import { readShareCache, shareIsClosed } from '../../utils/passport-share';

type ViewState = 'loading' | 'active' | 'closed' | 'error';

@Component({
  standalone: true,
  imports: [RouterLink, VosTitleCasePipe, VosPetAvatarComponent],
  selector: 'app-passport-share',
  template: `
    <div class="page">
      <header class="top">
        <a class="brand" routerLink="/" aria-label="Vetonspot">Vetonsp<span>●</span>t</a>
        <span class="tag">Read-only passport</span>
      </header>

      @if (view() === 'loading') {
        <div class="skel" aria-busy="true"></div>
      } @else if (view() === 'closed') {
        <section class="closed" role="status">
          <span class="closed__mark" aria-hidden="true">!</span>
          <h1>Access revoked or expired</h1>
          <p>This temporary passport link is no longer available.</p>
        </section>
      } @else if (view() === 'error') {
        <section class="closed" role="alert">
          <h1>Couldn’t open this link</h1>
          <p>{{ error() }}</p>
          <button type="button" class="btn" (click)="load()">Try again</button>
        </section>
      } @else if (passport(); as d) {
        <p class="notice">Temporary read-only link@if (expiresLabel()) { · expires {{ expiresLabel() }} }</p>
        <div class="layout">
          <section class="pass card" aria-label="Shared pet passport">
            <header class="pass__top">
              <div>
                <span class="pass__logo">Vetonsp<span>●</span>t</span>
                <em>Official Pet Passport</em>
              </div>
              <span class="pass__chip">Digital ID</span>
            </header>
            <div class="pass__body">
              <div class="pass__avatar" aria-hidden="true">
                <vos-pet-avatar [pet]="d.pet" tone="inverse" />
              </div>
              <div>
                <p class="pass__species">{{ d.pet?.species | vosTitleCase:'Pet' }} · {{ d.pet?.breed | vosTitleCase:'Mixed' }}</p>
                <h1>{{ d.pet?.name | vosTitleCase:'Pet' }}</h1>
                <p class="pass__ref">{{ d.reference || 'Shared record' }}</p>
              </div>
            </div>
            <div class="pass__meta">
              <div><em>Sex</em><strong>{{ sexLabel(d.pet) }}</strong></div>
              <div><em>Age</em><strong>{{ ageLabel(d.pet) }}</strong></div>
              <div><em>Color</em><strong>{{ colorLabel(d.pet) }}</strong></div>
            </div>
          </section>

          <section class="panel card">
            <h2>Emergency snapshot</h2>
            <div class="grid">
              <div><em>Allergies</em><strong>{{ d.emergency?.allergies || 'None recorded' }}</strong></div>
              <div><em>Special needs</em><strong>{{ d.emergency?.specialNeeds || '—' }}</strong></div>
              <div class="wide"><em>Medical notes</em><strong>{{ d.emergency?.medicalNotes || '—' }}</strong></div>
              <div class="wide">
                <em>Current medications</em>
                <strong>{{ medsLine(d) }}</strong>
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
        </div>

        <div class="more">
          @if (d.medications?.length) {
            <section class="panel">
              <h2>Medications</h2>
              <ul>
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
              <h2>Vaccinations</h2>
              <ul>
                @for (v of d.vaccinations; track v.id || v.vaccineName) {
                  <li>
                    <strong>{{ v.vaccineName }}</strong>
                    <span>Given {{ prettyDate(v.givenOn) }}@if (v.nextDueOn) { · next {{ prettyDate(v.nextDueOn) }} }</span>
                  </li>
                }
              </ul>
            </section>
          }

          @if (d.conditions?.length) {
            <section class="panel">
              <h2>Conditions</h2>
              <ul>
                @for (c of d.conditions; track c.id || c.name) {
                  <li>
                    <strong>{{ c.name }}</strong>
                    <span>{{ c.status }}</span>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; min-height: 100dvh; background: #f7f4ee; color: #1a1a1a; }
    .page { min-height: 100vh; min-height: 100dvh; width: 100%; }
    .top {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 18px clamp(20px, 4vw, 48px);
      background: #f7f4ee;
    }
    .brand { font-family: var(--vos-display, Georgia, serif); font-size: 1.35rem; font-weight: 700; color: inherit; text-decoration: none; letter-spacing: -0.03em; }
    .brand span { color: #FD4A29; }
    .tag { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #5c5a55; }
    .notice { margin: 0 clamp(16px, 3vw, 40px) 14px; color: #5c5a55; font-size: 0.95rem; }
    .layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: stretch;
      padding: 0 clamp(16px, 3vw, 40px) 16px;
    }
    .more {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      align-items: stretch;
      padding: 0 clamp(16px, 3vw, 40px) 48px;
    }
    .skel {
      height: 280px;
      margin: 0 clamp(16px, 3vw, 40px) 24px; border-radius: 28px;
      background: linear-gradient(120deg, #1a1210, #3a221c, #1a1210);
      background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite;
    }
    @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
    .closed {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; margin: 24px auto; max-width: 560px;
      background: #fff; border: 1px solid rgba(10,10,10,0.08);
      border-radius: 28px; padding: 48px 24px; box-shadow: 0 16px 40px rgba(10,10,10,0.06);
      box-sizing: border-box;
    }
    .closed__mark {
      width: 56px; height: 56px; margin: 0 auto 14px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: #fff1ee; color: #FD4A29; font-weight: 800; font-size: 1.4rem;
    }
    .closed h1 { margin: 0 0 8px; font-family: var(--vos-display, Georgia, serif); font-size: clamp(1.6rem, 4vw, 2.1rem); letter-spacing: -0.03em; }
    .closed p { margin: 0 auto 16px; max-width: 36ch; color: #5c5a55; }
    .btn {
      min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; cursor: pointer;
      background: #FD4A29; color: #fff; font-weight: 700;
    }
    .layout > .card {
      height: 100%;
      margin: 0;
      box-sizing: border-box;
      border-radius: 28px;
    }
    .pass {
      display: flex;
      flex-direction: column;
      padding: 22px;
      color: #fff;
      background:
        radial-gradient(ellipse 80% 70% at 100% -10%, rgba(253, 74, 41, 0.5), transparent 55%),
        linear-gradient(145deg, #1a1210 0%, #2c1814 42%, #0d0b0a 100%);
      box-shadow: 0 18px 40px rgba(10, 10, 10, 0.18);
    }
    .pass__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
    .pass__body { display: flex; align-items: center; justify-content: flex-start; gap: 16px; }
    .pass__logo { font-family: var(--vos-display, Georgia, serif); font-size: 1.25rem; font-weight: 700; }
    .pass__logo span, .pass em { color: #ffb4a6; }
    .pass em { display: block; margin-top: 4px; font-style: normal; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
    .pass__chip { border: 1px solid rgba(255,255,255,0.25); border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 700; }
    .pass__avatar {
      position: relative;
      width: 84px; height: 84px; border-radius: 50%; overflow: hidden; flex: 0 0 auto;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.12); font-size: 1.8rem; font-weight: 700;
    }
    .pass__avatar img { width: 100%; height: 100%; object-fit: cover; }
    .pass__species { margin: 0; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; color: #ffb4a6; }
    .pass h1 { margin: 4px 0; font-family: var(--vos-display, Georgia, serif); font-size: clamp(1.8rem, 3vw, 2.4rem); letter-spacing: -0.03em; line-height: 1; }
    .pass__ref { margin: 0; opacity: 0.75; font-size: 0.9rem; word-break: break-all; }
    .pass__meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: auto; padding-top: 22px; }
    .pass__meta strong { font-size: 1.05rem; }
    .pass__meta em, .panel em { display: block; font-style: normal; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-bottom: 4px; }
    .panel {
      background: #fff; border: 1px solid rgba(10,10,10,0.08); border-radius: 28px;
      padding: 22px; margin: 0;
      box-shadow: 0 18px 40px rgba(10, 10, 10, 0.06);
    }
    .layout .panel { display: flex; flex-direction: column; }
    .panel h2 { margin: 0 0 16px; font-family: var(--vos-display, Georgia, serif); font-size: clamp(1.25rem, 2vw, 1.6rem); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 28px; }
    .layout .grid { flex: 1; align-content: space-between; }
    .wide { grid-column: 1 / -1; }
    .panel strong, .pass strong { font-weight: 700; }
    .panel span, .panel strong { display: block; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { padding: 10px 0; border-top: 1px solid rgba(10,10,10,0.08); }
    li span { color: #5c5a55; font-size: 0.92rem; }
    @media (max-width: 860px) {
      .layout, .more { grid-template-columns: 1fr; }
      .grid { grid-template-columns: 1fr; }
      .layout .grid { align-content: start; gap: 14px; }
    }
  `],
})
export class PassportShareComponent implements OnInit, OnDestroy {
  readonly view = signal<ViewState>('loading');
  readonly passport = signal<any>(null);
  readonly error = signal('');
  readonly expiresLabel = signal('');
  private token = '';
  private sub?: Subscription;
  private poll?: ReturnType<typeof setInterval>;
  private onStorage = () => void this.load(true);
  private onVisible = () => {
    if (document.visibilityState === 'visible') void this.load(true);
  };

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
  ) {}

  petInitial = petInitial;

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe((pm) => {
      this.token = decodeURIComponent(pm.get('token') || '');
      void this.load();
    });
    window.addEventListener('storage', this.onStorage);
    document.addEventListener('visibilitychange', this.onVisible);
    this.poll = setInterval(() => void this.load(true), 15000);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    window.removeEventListener('storage', this.onStorage);
    document.removeEventListener('visibilitychange', this.onVisible);
    if (this.poll) clearInterval(this.poll);
  }

  sexLabel(pet: any): string {
    const s = String(pet?.sex || pet?.gender || '').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '—';
  }

  colorLabel(pet: any): string {
    return String(pet?.color || pet?.colorMarks || pet?.marks || '').trim() || '—';
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
    const raw = String(pet.age || pet.ageOrDob || pet.dateOfBirth || pet.dob || '').trim();
    return raw || '—';
  }

  medsLine(d: any): string {
    const list = d?.emergency?.currentMedications;
    if (Array.isArray(list) && list.length) return list.join(', ');
    return 'None listed';
  }

  prettyDate(v: string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async load(silent = false) {
    const token = this.token;
    if (!token) {
      this.view.set('closed');
      return;
    }
    if (!silent) this.view.set('loading');
    try {
      const remote = await this.api.getPublicPassportShare(token);
      if (token !== this.token) return;
      const local = readShareCache(token);
      if (remote.state === 'closed' || local?.revoked) {
        this.showClosed();
        return;
      }
      if (remote.state === 'active') {
        if (shareIsClosed('', remote.expiresAt)) {
          this.showClosed();
          return;
        }
        this.showActive(remote.passport, remote.expiresAt);
        return;
      }
      if (!local || shareIsClosed('', local.expiresAt, local.revoked) || !local.passport) {
        if (remote.message) {
          this.error.set(remote.message);
          this.view.set('error');
          return;
        }
        this.showClosed();
        return;
      }
      this.showActive(local.passport, local.expiresAt || null);
    } catch {
      if (token !== this.token) return;
      const local = readShareCache(token);
      if (local?.revoked || shareIsClosed('', local?.expiresAt, local?.revoked)) {
        this.showClosed();
        return;
      }
      if (local?.passport) {
        this.showActive(local.passport, local.expiresAt || null);
        return;
      }
      this.error.set('Could not open this share link.');
      this.view.set('error');
    }
  }

  private showActive(passport: any, expiresAt: string | null) {
    this.passport.set(passport || {});
    this.expiresLabel.set(this.formatExpiry(expiresAt));
    this.view.set('active');
    document.title = 'Pet passport · Vetonspot';
  }

  private showClosed() {
    this.passport.set(null);
    this.view.set('closed');
    document.title = 'Access revoked or expired · Vetonspot';
  }

  private formatExpiry(v: string | null | undefined): string {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
