import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CustomerApiService } from '../../services/customer-api.service';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';
import { VosTitleCasePipe } from '../../shared/vos-title-case.pipe';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, VosBackButtonComponent, VosTitleCasePipe],
  selector: 'app-profile',
  template: `
    <div class="wrap">
      <vos-back-button />

      <header class="head">
        <h1>Profile</h1>
        <p class="lede">Manage your household details and account shortcuts.</p>
      </header>

      @if (error()) {
        <div class="vos-err">{{ error() }}</div>
      }
      @if (ok()) {
        <div class="vos-ok">{{ ok() }}</div>
      }

      @if (loading()) {
        <div class="layout">
          <div class="vos-skel panel-skel"></div>
          <div class="vos-skel panel-skel"></div>
        </div>
      } @else {
        <div class="layout">
          <aside class="panel panel--side" aria-label="Account overview">
            <div class="identity">
              <div class="identity__avatar" aria-hidden="true">{{ initials() }}</div>
              <p class="identity__eyebrow">Your household</p>
              <h2>{{ fullName | vosTitleCase:'Pet parent' }}</h2>
              @if (email) {
                <p class="identity__email">{{ email }}</p>
              }
              <p class="identity__status">{{ petStatus() }}</p>
            </div>

            <nav class="links" aria-label="Account">
              <a routerLink="/pets" [queryParams]="{ from: 'profile' }">Your pets</a>
              <a routerLink="/settings" [queryParams]="{ from: 'profile' }">Settings</a>
              <a routerLink="/notifications" [queryParams]="{ from: 'profile' }">Notifications</a>
              <a routerLink="/support" [queryParams]="{ from: 'profile' }">Support</a>
              <a routerLink="/addresses" [queryParams]="{ from: 'profile' }">Saved addresses</a>
            </nav>

            <button type="button" class="vos-btn vos-btn-ghost logout" (click)="logout()">Log out</button>
          </aside>

          <section class="panel panel--form" aria-labelledby="profile-edit-title">
            <header class="panel__head">
              <h2 id="profile-edit-title">Edit details</h2>
              <p>Keep your contact info current so the care team can reach you.</p>
            </header>

            <form class="panel__body form" (ngSubmit)="save()">
              <div class="form__grid">
                <label class="vos-field"
                  >Full name<input [(ngModel)]="fullName" name="fullName" autocomplete="name"
                /></label>
                <label class="vos-field"
                  >Mobile<input [(ngModel)]="mobile" name="mobile" type="tel" autocomplete="tel"
                /></label>
                <label class="vos-field field--full"
                  >Email<input [(ngModel)]="email" name="email" type="email" autocomplete="email"
                /></label>
                <label class="vos-field field--full"
                  >Address<textarea [(ngModel)]="address" name="address" rows="3" autocomplete="street-address"></textarea
                ></label>
                <label class="vos-field field--full"
                  >Emergency contact<input
                    [(ngModel)]="emergencyContact"
                    name="emergencyContact"
                    autocomplete="tel"
                /></label>
              </div>
              <div class="form__actions">
                <button type="submit" class="vos-btn" [disabled]="saving()">
                  {{ saving() ? 'Saving…' : 'Save profile' }}
                </button>
              </div>
            </form>
          </section>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .wrap {
      width: 100%;
      max-width: none;
      margin: 0;
    }

    .head { margin: 2px 0 18px; }
    h1 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: clamp(1.65rem, 3vw, 2.15rem);
      letter-spacing: -0.03em;
    }
    .lede {
      margin: 6px 0 0;
      color: var(--vos-ink-muted);
      max-width: 48ch;
      line-height: 1.45;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.3fr);
      gap: 20px;
      align-items: stretch;
    }

    .panel {
      display: flex;
      flex-direction: column;
      min-width: 0;
      border: 1px solid var(--vos-border);
      border-radius: 20px;
      background: #fff;
      box-shadow: 0 10px 28px rgba(10, 10, 10, 0.04);
      overflow: hidden;
    }

    .panel--side {
      padding: 22px 20px 18px;
      background: linear-gradient(180deg, #fffef9 0%, #fff 42%);
    }

    .identity {
      text-align: center;
      padding: 4px 4px 18px;
      border-bottom: 1px solid var(--vos-border);
      margin-bottom: 14px;
    }
    .identity__avatar {
      width: 76px;
      height: 76px;
      margin: 0 auto 12px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vos-brand-soft);
      color: var(--vos-brand);
      font-family: var(--vos-display);
      font-weight: 700;
      font-size: 1.55rem;
      box-shadow: 0 8px 24px rgba(20, 16, 12, 0.08);
    }
    .identity__eyebrow {
      margin: 0 0 4px;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-weight: 600;
    }
    .identity h2 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .identity__email {
      margin: 6px 0 0;
      color: var(--vos-ink-muted);
      font-size: 0.92rem;
      word-break: break-word;
    }
    .identity__status {
      margin: 10px 0 0;
      font-weight: 700;
      color: var(--vos-brand);
      font-size: 0.92rem;
    }

    .links {
      display: grid;
      gap: 8px;
      flex: 1 1 auto;
    }
    .links a {
      display: block;
      padding: 12px 14px;
      background: #fff;
      border-radius: 12px;
      border: 1px solid var(--vos-border);
      text-decoration: none;
      color: var(--vos-ink);
      font-weight: 600;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .links a:hover {
      border-color: rgba(253, 74, 41, 0.35);
      box-shadow: 0 8px 18px rgba(10, 10, 10, 0.05);
    }

    .logout {
      margin-top: 14px;
      width: 100%;
    }

    .panel__head {
      padding: 18px 20px 14px;
      border-bottom: 1px solid var(--vos-border);
      background: #faf8f4;
    }
    .panel__head h2 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }
    .panel__head p {
      margin: 6px 0 0;
      color: var(--vos-ink-muted);
      font-size: 0.9rem;
      line-height: 1.35;
    }

    .panel__body {
      padding: 18px 20px 20px;
    }

    .form { margin: 0; }
    .form__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 14px;
    }
    .field--full { grid-column: 1 / -1; }
    .form__actions {
      margin-top: 10px;
      display: flex;
      justify-content: flex-start;
    }
    .form__actions .vos-btn { min-width: 148px; }

    .panel-skel {
      min-height: 360px;
      border-radius: 20px;
    }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .form__grid {
        grid-template-columns: 1fr;
      }
      .identity {
        text-align: left;
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-areas:
          'avatar eyebrow'
          'avatar name'
          'avatar email'
          'status status';
        column-gap: 14px;
        align-items: center;
      }
      .identity__avatar {
        grid-area: avatar;
        margin: 0;
        width: 64px;
        height: 64px;
        font-size: 1.35rem;
      }
      .identity__eyebrow { grid-area: eyebrow; margin: 0; }
      .identity h2 { grid-area: name; }
      .identity__email { grid-area: email; margin-top: 2px; }
      .identity__status { grid-area: status; margin-top: 10px; }
    }
  `],
})
export class ProfileComponent implements OnInit {
  fullName = '';
  mobile = '';
  email = '';
  address = '';
  emergencyContact = '';
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ok = signal('');
  readonly petCount = signal(0);

  constructor(
    private api: CustomerApiService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    void this.load();
  }

  initials(): string {
    const parts = (this.fullName || 'P').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'P';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  petStatus(): string {
    const n = this.petCount();
    if (n <= 0) return 'Add a pet to personalize care';
    if (n === 1) return 'Caring for 1 pet';
    return `Caring for ${n} pets`;
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [me, pets] = await Promise.all([
        this.api.me(),
        this.api.pets().catch(() => []),
      ]);
      this.fullName = me.fullName || '';
      this.mobile = me.mobile || '';
      this.email = me.email || '';
      this.address = me.address || '';
      this.emergencyContact = me.emergencyContact || '';
      this.petCount.set(Array.isArray(pets) ? pets.length : 0);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load profile');
    } finally {
      this.loading.set(false);
    }
  }

  async save() {
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      await this.api.updateMe({
        fullName: this.fullName,
        mobile: this.mobile,
        email: this.email,
        address: this.address,
        emergencyContact: this.emergencyContact,
      });
      const addr = String(this.address || '').trim();
      if (addr) {
        try {
          const list = (await this.api.addresses()) || [];
          const exists = list.some(
            (a: any) =>
              String(a.address || '')
                .trim()
                .toLowerCase() === addr.toLowerCase(),
          );
          if (!exists) {
            await this.api.createAddress({
              label: 'Home',
              address: addr,
              isDefault: !list.some((a: any) => a.isDefault),
            });
          }
        } catch {
          /* address book optional */
        }
      }
      this.ok.set('Saved');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Save failed');
    } finally {
      this.saving.set(false);
    }
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
