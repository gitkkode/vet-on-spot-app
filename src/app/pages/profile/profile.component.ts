import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-profile',
  template: `
    @if (error()) {
      <div class="vos-err">{{ error() }}</div>
    }
    @if (ok()) {
      <div class="vos-ok">{{ ok() }}</div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
      <div class="vos-skel"></div>
    } @else {
      <header class="profile-hero">
        <div class="profile-hero__avatar" aria-hidden="true">{{ initials() }}</div>
        <div>
          <p class="profile-hero__eyebrow">Your household</p>
          <h1>{{ fullName || 'Pet parent' }}</h1>
          @if (email) {
            <p class="profile-hero__email">{{ email }}</p>
          }
          <p class="profile-hero__status">{{ petStatus() }}</p>
        </div>
      </header>

      <form class="profile-form" (ngSubmit)="save()">
        <label class="vos-field">Full name<input [(ngModel)]="fullName" name="fullName" /></label>
        <label class="vos-field">Mobile<input [(ngModel)]="mobile" name="mobile" /></label>
        <label class="vos-field">Email<input [(ngModel)]="email" name="email" /></label>
        <label class="vos-field"
          >Address<textarea [(ngModel)]="address" name="address" rows="3"></textarea
        ></label>
        <label class="vos-field"
          >Emergency contact<input [(ngModel)]="emergencyContact" name="emergencyContact"
        /></label>
        <button type="submit" class="vos-btn" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save profile' }}
        </button>
      </form>

      <div class="links">
        <a routerLink="/pets">Your pets</a>
        <a routerLink="/settings">Settings</a>
        <a routerLink="/notifications">Notifications</a>
        <a routerLink="/support">Support</a>
        <a routerLink="/addresses" class="muted-link">Saved addresses</a>
      </div>

      <button type="button" class="vos-btn vos-btn-ghost" (click)="logout()">Log out</button>
    }
  `,
  styles: [`
    .profile-hero {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-bottom: 22px;
      padding: 4px 2px 8px;
    }
    .profile-hero__avatar {
      flex-shrink: 0;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vos-brand-soft);
      color: var(--vos-brand);
      font-family: var(--vos-display);
      font-weight: 700;
      font-size: 1.5rem;
      box-shadow: 0 8px 24px rgba(20, 16, 12, 0.08);
    }
    .profile-hero__eyebrow {
      margin: 0 0 4px;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-weight: 600;
    }
    h1 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: 1.45rem;
      letter-spacing: -0.03em;
      color: var(--vos-ink);
    }
    .profile-hero__email {
      margin: 4px 0 0;
      color: var(--vos-ink-muted);
      font-size: 0.92rem;
    }
    .profile-hero__status {
      margin: 8px 0 0;
      font-weight: 600;
      color: var(--vos-brand);
      font-size: 0.92rem;
    }
    .profile-form .vos-btn { margin-top: 12px; }
    .links { margin: 18px 0 8px; display: grid; gap: 8px; }
    .links a {
      display: block;
      padding: 12px 14px;
      background: var(--vos-surface);
      border-radius: var(--vos-radius-sm);
      border: 1px solid var(--vos-border);
      text-decoration: none;
      color: var(--vos-ink);
      font-weight: 600;
    }
    .muted-link { display: none; }
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
