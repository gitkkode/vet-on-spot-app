import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CustomerApiService } from '../../services/customer-api.service';
import { VosSelectComponent, VosSelectOption } from '../../shared/vos-select.component';

const PREFS_KEY = 'vos.notification.prefs';
const EXTRA_KEY = 'vos.account.prefs';

type Prefs = {
  emailAlerts: boolean;
  smsAlerts: boolean;
  pushAlerts: boolean;
  marketing: boolean;
};

type Extra = {
  reminderLeadHours: string;
  weightUnit: 'kg' | 'lbs';
  quietHours: boolean;
};

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, VosSelectComponent],
  selector: 'app-settings',
  template: `
    <div class="wrap">
      <header class="head">
        <a [routerLink]="backLink" class="vos-back">← {{ backLabel }}</a>
        <h1>Settings</h1>
        <p class="vos-muted">Manage how VetonSpot contacts you and how care tools behave.</p>
        @if (ok()) {
          <div class="vos-ok">{{ ok() }}</div>
        }
      </header>

      <div class="layout">
        <section class="vos-card panel panel--notify">
          <h2>Notifications</h2>
          <p class="intro">Turn channels on or off anytime. Changes save automatically.</p>

          <div class="switches">
            <label class="switch-row">
              <span>
                <strong>Email alerts</strong>
                <em>Visit updates and care reminders</em>
              </span>
              <input type="checkbox" role="switch" [(ngModel)]="prefs.emailAlerts" name="emailAlerts" (ngModelChange)="persist()" />
            </label>
            <label class="switch-row">
              <span>
                <strong>SMS alerts</strong>
                <em>Time-sensitive visit and arrival texts</em>
              </span>
              <input type="checkbox" role="switch" [(ngModel)]="prefs.smsAlerts" name="smsAlerts" (ngModelChange)="persist()" />
            </label>
            <label class="switch-row">
              <span>
                <strong>Push notifications</strong>
                <em>In-app alerts while you’re in the portal</em>
              </span>
              <input type="checkbox" role="switch" [(ngModel)]="prefs.pushAlerts" name="pushAlerts" (ngModelChange)="persist()" />
            </label>
            <label class="switch-row">
              <span>
                <strong>Tips & offers</strong>
                <em>Occasional product news (optional)</em>
              </span>
              <input type="checkbox" role="switch" [(ngModel)]="prefs.marketing" name="marketing" (ngModelChange)="persist()" />
            </label>
            <label class="switch-row">
              <span>
                <strong>Quiet hours</strong>
                <em>Pause non-urgent alerts from 10 PM – 7 AM</em>
              </span>
              <input type="checkbox" role="switch" [(ngModel)]="extra.quietHours" name="quietHours" (ngModelChange)="persistExtra()" />
            </label>
          </div>

          <a class="inbox" routerLink="/notifications" [queryParams]="{ from: 'settings' }">Open notification inbox</a>
        </section>

        <section class="vos-card panel panel--care">
          <h2>Care defaults</h2>
          <label class="field">
            <span>Remind me before visits</span>
            <vos-select
              name="reminderLead"
              [options]="reminderOptions"
              [(ngModel)]="extra.reminderLeadHours"
              (ngModelChange)="persistExtra()"
            />
          </label>
          <label class="field">
            <span>Preferred weight unit</span>
            <vos-select
              name="weightUnit"
              [options]="weightOptions"
              [(ngModel)]="extra.weightUnit"
              (ngModelChange)="persistExtra()"
            />
          </label>
        </section>

        <section class="vos-card panel panel--links links-card">
          <h2>Shortcuts</h2>
          <div class="links-grid">
            <a routerLink="/medications" [queryParams]="{ from: 'settings' }">Medication tracker</a>
            <a routerLink="/follow-ups" [queryParams]="{ from: 'settings' }">Follow-ups</a>
            <a routerLink="/support" [queryParams]="{ from: 'settings' }">Support</a>
            <a routerLink="/emergency" [queryParams]="{ from: 'settings' }">Emergency help</a>
            <a routerLink="/profile">Edit profile</a>
            <a routerLink="/addresses" [queryParams]="{ from: 'settings' }">Saved addresses</a>
          </div>
        </section>

        <div class="logout-row">
          <button type="button" class="vos-btn vos-btn-ghost logout" (click)="logout()">Log out</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .wrap {
      width: 100%;
      max-width: none;
      margin: 0;
    }
    .head { margin-bottom: 18px; }
    h1, h2 { font-family: var(--vos-display); }
    h1 { margin: 4px 0 6px; font-size: clamp(1.6rem, 3vw, 2rem); letter-spacing: -0.03em; }
    h2 { font-size: 1.08rem; margin: 0 0 8px; }
    .intro { margin: 0 0 4px; color: var(--vos-ink-muted); font-size: 0.92rem; }

    .layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      align-items: start;
    }

    /* Tablet: Care + Shortcuts side by side under Notifications */
    @media (min-width: 700px) {
      .layout {
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .panel--notify { grid-column: 1 / -1; }
      .logout-row { grid-column: 1 / -1; }
      .switches {
        grid-template-columns: 1fr 1fr;
        column-gap: 24px;
      }
      .switch-row { border-top: 1px solid var(--vos-border); }
      .switches .switch-row:nth-child(1),
      .switches .switch-row:nth-child(2) { border-top: 0; }
    }

    /* Desktop: three columns across the full portal width */
    @media (min-width: 1000px) {
      .layout {
        grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.85fr) minmax(220px, 0.85fr);
        gap: 18px;
      }
      .panel--notify { grid-column: auto; }
      .logout-row { grid-column: 1 / -1; justify-self: start; }
    }

    .panel { margin: 0; height: 100%; box-sizing: border-box; }
    .switches {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
    }

    .switch-row {
      display: flex; justify-content: space-between; align-items: center; gap: 14px;
      padding: 12px 0; border-top: 1px solid var(--vos-border);
      cursor: pointer;
    }
    .switch-row:first-of-type { border-top: 0; }
    .switch-row strong { display: block; font-size: 0.96rem; }
    .switch-row em {
      display: block; font-style: normal; color: var(--vos-ink-muted);
      font-size: 0.84rem; margin-top: 2px; line-height: 1.35;
    }
    .switch-row input[type='checkbox'] {
      appearance: none; -webkit-appearance: none;
      width: 48px; height: 28px; border-radius: 999px; flex-shrink: 0;
      background: #d4cfc4; border: 0; position: relative; cursor: pointer;
      transition: background 0.2s ease;
    }
    .switch-row input[type='checkbox']::after {
      content: ''; position: absolute; top: 3px; left: 3px;
      width: 22px; height: 22px; border-radius: 50%; background: #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      transition: transform 0.2s ease;
    }
    .switch-row input[type='checkbox']:checked { background: var(--vos-brand); }
    .switch-row input[type='checkbox']:checked::after { transform: translateX(20px); }

    .field {
      display: flex; flex-direction: column; gap: 6px;
      margin-top: 12px; font-size: 12px; font-weight: 700;
      color: var(--vos-ink-muted); letter-spacing: 0.04em; text-transform: uppercase;
    }
    .field:first-of-type { margin-top: 4px; }
    .field vos-select { text-transform: none; letter-spacing: 0; font-weight: 600; }
    .inbox {
      display: inline-block; margin-top: 14px;
      color: var(--vos-brand); font-weight: 700; text-decoration: none;
    }

    .links-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
    }
    .links-card a {
      display: block; padding: 11px 0; border-top: 1px solid var(--vos-border);
      text-decoration: none; color: var(--vos-ink); font-weight: 600;
    }
    .links-card a:first-of-type { border-top: 0; }

    .logout-row { margin-top: 2px; }
    .logout { min-width: 160px; }
  `],
})
export class SettingsComponent implements OnInit {
  backLink: any[] = ['/profile'];
  backLabel = 'Profile';
  prefs: Prefs = {
    emailAlerts: true,
    smsAlerts: true,
    pushAlerts: true,
    marketing: false,
  };
  extra: Extra = {
    reminderLeadHours: '24',
    weightUnit: 'kg',
    quietHours: false,
  };
  readonly ok = signal('');
  readonly reminderOptions: VosSelectOption[] = [
    { value: '1', label: '1 hour before' },
    { value: '2', label: '2 hours before' },
    { value: '24', label: '1 day before' },
    { value: '48', label: '2 days before' },
  ];
  readonly weightOptions: VosSelectOption[] = [
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 'lbs', label: 'Pounds (lbs)' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private api: CustomerApiService,
  ) {}

  ngOnInit() {
    const from = this.route.snapshot.queryParamMap.get('from');
    if (from === 'home') {
      this.backLink = ['/home'];
      this.backLabel = 'Home';
    } else {
      this.backLink = ['/profile'];
      this.backLabel = 'Profile';
    }
    this.prefs = this.readPrefs();
    this.extra = this.readExtra();
  }

  private readPrefs(): Prefs {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) return { ...this.prefs, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return this.prefs;
  }

  private readExtra(): Extra {
    try {
      const raw = localStorage.getItem(EXTRA_KEY);
      if (raw) return { ...this.extra, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return this.extra;
  }

  persist() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* ignore */
    }
    this.ok.set('Notification preferences saved.');
    void this.api
      .updateMe({
        notificationPrefs: this.prefs,
        emailAlerts: this.prefs.emailAlerts,
        smsAlerts: this.prefs.smsAlerts,
        pushAlerts: this.prefs.pushAlerts,
        marketingOptIn: this.prefs.marketing,
      })
      .catch(() => null);
  }

  persistExtra() {
    try {
      localStorage.setItem(EXTRA_KEY, JSON.stringify(this.extra));
    } catch {
      /* ignore */
    }
    this.ok.set('Care defaults saved.');
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
