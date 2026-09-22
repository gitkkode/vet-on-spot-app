import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { CustomerApiService } from '../services/customer-api.service';
import { ActivePetService } from '../services/active-pet.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="portal" [class.portal--menu-open]="menuOpen()">
      <header class="portal-top">
        <div class="portal-top__inner">
          <a routerLink="/home" class="portal-brand" (click)="closeMenu()">
            <span class="portal-brand__mark">Vetonsp<span class="o">●</span>t</span>
            <span class="portal-brand__sub">Pet Parent Portal</span>
          </a>

          <div class="portal-top__actions">
            @if (!inBookingFlow()) {
              <a routerLink="/book/new" class="portal-top__cta" [queryParams]="fabPet()" (click)="closeMenu()">
                Book a visit
              </a>
            }
            <a
              routerLink="/notifications"
              class="portal-top__icon"
              [attr.aria-label]="unreadAriaLabel()"
              [attr.title]="unreadTitle()"
              (click)="closeMenu()"
            >
              <span class="portal-top__bell" aria-hidden="true"></span>
              @if (unread() > 0) {
                <span class="portal-top__count">{{ unreadLabel() }}</span>
              }
            </a>
            <button
              type="button"
              class="portal-top__menu-btn"
              [attr.aria-expanded]="menuOpen()"
              aria-controls="portal-drawer"
              aria-label="Open menu"
              (click)="toggleMenu()"
            >
              <span class="burger" [class.burger--open]="menuOpen()" aria-hidden="true">
                <i></i><i></i><i></i>
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        class="drawer-backdrop"
        [class.on]="menuOpen()"
        (click)="closeMenu()"
        aria-hidden="true"
      ></div>

      <aside
        id="portal-drawer"
        class="drawer"
        [class.on]="menuOpen()"
        role="dialog"
        aria-modal="true"
        [attr.aria-hidden]="!menuOpen()"
        aria-label="Account menu"
      >
        <div class="drawer__head">
          <div class="drawer__avatar" aria-hidden="true">{{ initials() }}</div>
          <div class="drawer__who">
            <p class="drawer__kicker">Signed in</p>
            <strong>{{ displayName() }}</strong>
            @if (displayMobile()) {
              <span>{{ formatPhone(displayMobile()) }}</span>
            }
          </div>
          <button type="button" class="drawer__close" aria-label="Close menu" (click)="closeMenu()">
            ✕
          </button>
        </div>

        <nav class="drawer__nav" aria-label="Main">
          <p class="drawer__label">Navigate</p>
          <a routerLink="/home" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }" (click)="closeMenu()">
            Home
          </a>
          <a routerLink="/pets" routerLinkActive="on" (click)="closeMenu()">Pets</a>
          <a routerLink="/bookings" routerLinkActive="on" (click)="closeMenu()">Appointments</a>
          <a routerLink="/health" routerLinkActive="on" (click)="closeMenu()">Health</a>
          <a routerLink="/medications" routerLinkActive="on" (click)="closeMenu()">Medications</a>
          <a routerLink="/televet" routerLinkActive="on" (click)="closeMenu()">Talk to a vet</a>
        </nav>

        <nav class="drawer__nav" aria-label="Account">
          <p class="drawer__label">Account</p>
          <a routerLink="/profile" routerLinkActive="on" (click)="closeMenu()">Profile</a>
          <a routerLink="/notifications" routerLinkActive="on" (click)="closeMenu()">
            Notifications
            @if (unread() > 0) {
              <em>{{ unreadLabel() }}</em>
            }
          </a>
          <a routerLink="/addresses" routerLinkActive="on" (click)="closeMenu()">Saved addresses</a>
          <a routerLink="/support" routerLinkActive="on" (click)="closeMenu()">Support</a>
          <a routerLink="/settings" routerLinkActive="on" (click)="closeMenu()">Settings</a>
        </nav>

        <div class="drawer__foot">
          <button type="button" class="drawer__logout" [disabled]="loggingOut()" (click)="logout()">
            {{ loggingOut() ? 'Signing out…' : 'Log out' }}
          </button>
        </div>
      </aside>

      <main class="portal-main">
        <router-outlet />
      </main>

      <footer class="portal-foot">
        <div class="portal-foot__inner">
          <div>
            <strong class="portal-brand__mark">Vetonsp<span class="o">●</span>t</strong>
            <p>Vet care that comes to you — home visits, televet, and a living health record for every pet.</p>
          </div>
          <div class="portal-foot__cols">
            <div>
              <span class="portal-foot__label">Care</span>
              <a routerLink="/book/new" [queryParams]="fabPet()">Book a visit</a>
              <a routerLink="/televet">Talk to a vet</a>
              <a routerLink="/intake">Something wrong</a>
            </div>
            <div>
              <span class="portal-foot__label">Your pets</span>
              <a routerLink="/pets">Pet profiles</a>
              <a routerLink="/health">Health</a>
              <a routerLink="/medications">Medications</a>
            </div>
            <div>
              <span class="portal-foot__label">Account</span>
              <a routerLink="/profile">Profile</a>
              <a routerLink="/support">Support</a>
              <a routerLink="/settings">Settings</a>
            </div>
          </div>
        </div>
        <div class="portal-foot__bottom">
          <p class="portal-foot__services">Veterinary hospital · Emergency · Diagnostics · Pharmacy · Wellness</p>
          <nav class="portal-foot__legal-links" aria-label="Legal">
            <a href="https://vetonspot.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            <a href="https://vetonspot.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            <a routerLink="/support">Contact Us</a>
          </nav>
          <p class="portal-foot__copy">© {{ year }} VetonSpot. All rights reserved.</p>
        </div>
      </footer>

      @if (!inBookingFlow()) {
        <a class="fab" routerLink="/book/new" [queryParams]="fabPet()" aria-label="Book a visit">
          <span class="fab__plus" aria-hidden="true">+</span>
        </a>
      }
      <nav class="portal-bottom" aria-label="Mobile">
        <a routerLink="/home" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">Home</a>
        <a routerLink="/pets" routerLinkActive="on">Pets</a>
        <a routerLink="/bookings" routerLinkActive="on">Appts</a>
        <a routerLink="/health" routerLinkActive="on">Health</a>
        <button type="button" class="portal-bottom__menu" (click)="toggleMenu()">
          Menu
          @if (unread() > 0) {
            <span class="dot" [attr.aria-label]="unread() + ' unread'"></span>
          }
        </button>
      </nav>
    </div>
  `,
  styles: [`
    .portal {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      color: var(--vos-ink);
      font-family: var(--vos-font);
      padding-bottom: var(--vos-nav-clearance);
      background:
        radial-gradient(ellipse 55% 32% at 100% 0%, rgba(253, 74, 41, 0.04) 0%, transparent 60%),
        var(--vos-bg);
    }
    .portal--menu-open { overflow: hidden; }
    @media (min-width: 900px) {
      .portal { padding-bottom: 0; }
      .fab, .portal-bottom { display: none !important; }
    }

    .portal-top {
      position: sticky; top: 0; z-index: 50;
      background: rgba(252, 252, 251, 0.94);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(232, 228, 220, 0.9);
      padding: 12px 0;
    }
    .portal-top__inner {
      width: 100%;
      max-width: var(--vos-max);
      margin: 0 auto;
      padding: 0 var(--vos-gutter);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      box-sizing: border-box;
    }
    .portal-brand { text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 2px; }
    .portal-brand__mark {
      font-family: var(--vos-display); font-weight: 700; font-size: 1.4rem;
      letter-spacing: -0.04em; color: var(--vos-ink);
    }
    .portal-brand__mark .o { color: var(--vos-brand); }
    .portal-brand__sub {
      font-family: var(--vos-mono); font-size: 10px; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--vos-ink-muted); font-weight: 600;
    }

    .portal-top__actions {
      display: flex; align-items: center; gap: 20px;
    }
    .portal-top__cta {
      display: none;
      align-items: center; justify-content: center;
      min-height: 42px; padding: 10px 18px; border-radius: 999px;
      background: #0a0a0a; color: #fff; font-weight: 700; text-decoration: none; font-size: 14px;
      transition: background 0.15s ease, transform 0.15s var(--vos-ease);
    }
    .portal-top__cta:hover { background: #1a1a1a; transform: translateY(-1px); }
    @media (min-width: 640px) {
      .portal-top__cta { display: inline-flex; }
    }
    .portal-top__icon {
      position: relative;
      width: 44px; height: 44px;
      border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      text-decoration: none;
      background: #fff;
      border: 1px solid var(--vos-border);
      transition: border-color 0.15s ease;
    }
    .portal-top__icon:hover { border-color: rgba(253, 74, 41, 0.35); }
    .portal-top__bell {
      width: 16px; height: 16px;
      border: 2px solid var(--vos-ink);
      border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
      position: relative;
    }
    .portal-top__bell::after {
      content: '';
      position: absolute; top: -5px; left: 50%;
      width: 4px; height: 4px; margin-left: -2px;
      border-radius: 50%; background: var(--vos-ink);
    }
    .portal-top__count {
      position: absolute; top: 0; right: 0;
      min-width: 20px; height: 20px; padding: 0 6px;
      border-radius: 999px; background: var(--vos-brand); color: #fff;
      font-size: 10px; font-weight: 800;
      display: inline-flex; align-items: center; justify-content: center;
      line-height: 1;
      box-shadow: 0 0 0 2px #FCFCFB;
      white-space: nowrap;
    }
    .portal-top__menu-btn {
      width: 44px; height: 44px; border-radius: 50%;
      border: 1px solid var(--vos-border); background: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; padding: 0;
    }
    .burger {
      width: 18px; height: 12px; position: relative; display: block;
    }
    .burger i {
      position: absolute; left: 0; right: 0; height: 2px;
      background: var(--vos-ink); border-radius: 2px;
      transition: transform 0.2s ease, opacity 0.2s ease, top 0.2s ease;
    }
    .burger i:nth-child(1) { top: 0; }
    .burger i:nth-child(2) { top: 5px; }
    .burger i:nth-child(3) { top: 10px; }
    .burger--open i:nth-child(1) { top: 5px; transform: rotate(45deg); }
    .burger--open i:nth-child(2) { opacity: 0; }
    .burger--open i:nth-child(3) { top: 5px; transform: rotate(-45deg); }

    .drawer-backdrop {
      position: fixed; inset: 0; z-index: 80;
      background: rgba(10, 10, 10, 0.42);
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
    }
    .drawer-backdrop.on { opacity: 1; pointer-events: auto; }

    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 90;
      width: min(360px, 92vw);
      background: #fff;
      box-shadow: -24px 0 64px rgba(10, 10, 10, 0.18);
      transform: translateX(104%);
      transition: transform 0.28s var(--vos-ease);
      display: flex; flex-direction: column;
      padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
      overflow-y: auto;
    }
    .drawer.on { transform: translateX(0); }

    .drawer__head {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--vos-border);
      margin-bottom: 8px;
    }
    .drawer__avatar {
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(145deg, #FD4A29, #E03E20);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--vos-display); font-weight: 700; font-size: 1.15rem;
      box-shadow: 0 10px 24px rgba(253, 74, 41, 0.28);
    }
    .drawer__kicker {
      margin: 0;
      font-family: var(--vos-mono);
      font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--vos-ink-muted); font-weight: 700;
    }
    .drawer__who strong {
      display: block;
      font-family: var(--vos-display);
      font-size: 1.15rem; letter-spacing: -0.02em;
      margin: 2px 0;
    }
    .drawer__who span {
      display: block; color: var(--vos-ink-muted); font-size: 0.88rem;
    }
    .drawer__close {
      width: 36px; height: 36px; border-radius: 50%;
      border: 1px solid var(--vos-border); background: #fff;
      cursor: pointer; color: var(--vos-ink-muted); font-size: 14px;
    }

    .drawer__label {
      margin: 14px 4px 6px;
      font-family: var(--vos-mono);
      font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--vos-ink-muted); font-weight: 700;
    }
    .drawer__nav a {
      display: flex; align-items: center; justify-content: space-between;
      text-decoration: none; color: var(--vos-ink);
      font-weight: 650; font-size: 1.02rem;
      padding: 12px 12px; border-radius: 14px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .drawer__nav a:hover { background: rgba(253, 74, 41, 0.06); }
    .drawer__nav a.on {
      background: var(--vos-brand-soft); color: var(--vos-brand); font-weight: 700;
    }
    .drawer__nav a em {
      font-style: normal;
      min-width: 22px; height: 22px; padding: 0 6px;
      border-radius: 999px; background: var(--vos-brand); color: #fff;
      font-size: 11px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center;
    }

    .drawer__foot {
      margin-top: auto;
      padding-top: 18px;
      border-top: 1px solid var(--vos-border);
    }
    .drawer__logout {
      width: 100%;
      min-height: 48px; border-radius: 999px;
      border: 1.5px solid rgba(180, 35, 24, 0.25);
      background: #fff; color: #B42318;
      font-weight: 700; font-size: 1rem; cursor: pointer;
    }
    .drawer__logout:disabled { opacity: 0.6; cursor: wait; }

    .portal-main {
      flex: 1;
      width: 100%;
      max-width: var(--vos-max);
      margin: 0 auto;
      padding: 28px var(--vos-gutter) 48px;
      box-sizing: border-box;
      animation: vos-rise 0.4s var(--vos-ease) both;
    }

    .portal-foot {
      margin-top: auto;
      border-top: 1px solid var(--vos-border);
      background: #0a0a0a;
      color: rgba(255,255,255,0.78);
      padding: 40px 0 28px;
    }
    @media (max-width: 899px) {
      .portal-foot { display: none; }
    }
    .portal-foot__inner {
      max-width: var(--vos-max); margin: 0 auto;
      padding: 0 var(--vos-gutter);
      display: grid; grid-template-columns: 1.2fr 2fr; gap: 40px;
      box-sizing: border-box;
    }
    .portal-foot p { margin: 10px 0 0; max-width: 36ch; line-height: 1.5; font-size: 14px; }
    .portal-foot .portal-brand__mark { color: #fff; }
    .portal-foot__cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .portal-foot__label {
      display: block; margin-bottom: 12px;
      font-family: var(--vos-mono); font-size: 12px; letter-spacing: 0.14em;
      text-transform: uppercase; color: rgba(255,255,255,0.92); font-weight: 700;
    }
    .portal-foot__cols a {
      display: block; color: rgba(255,255,255,0.72); text-decoration: none;
      font-weight: 600; font-size: 14px; margin-bottom: 8px;
    }
    .portal-foot__cols a:hover { color: #FD4A29; }
    .portal-foot__bottom {
      max-width: var(--vos-max); margin: 28px auto 0; padding: 18px var(--vos-gutter) 0;
      border-top: 1px solid rgba(255,255,255,0.12);
      display: grid; gap: 12px;
      box-sizing: border-box;
    }
    @media (min-width: 900px) {
      .portal-foot__bottom {
        grid-template-columns: 1.4fr 1fr auto;
        align-items: center; gap: 20px;
      }
    }
    .portal-foot__services {
      margin: 0 !important; max-width: none !important;
      font-family: var(--vos-mono); font-size: 10px; letter-spacing: 0.12em;
      text-transform: uppercase; color: rgba(255,255,255,0.48); font-weight: 600;
    }
    .portal-foot__legal-links {
      display: flex; flex-wrap: wrap; gap: 8px 18px;
    }
    .portal-foot__legal-links a {
      color: rgba(255,255,255,0.78); text-decoration: none;
      font-size: 13px; font-weight: 600;
    }
    .portal-foot__legal-links a:hover { color: #FD4A29; }
    .portal-foot__copy {
      margin: 0 !important; max-width: none !important;
      font-size: 13px !important; color: rgba(255,255,255,0.55);
      white-space: nowrap;
    }

    .fab {
      position: fixed; right: 16px; bottom: calc(72px + env(safe-area-inset-bottom));
      z-index: 45; width: 56px; height: 56px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: var(--vos-accent); color: #fff; text-decoration: none;
      box-shadow: 0 10px 28px rgba(253, 74, 41, 0.38);
    }
    .fab__plus { font-size: 28px; font-weight: 500; line-height: 1; margin-top: -2px; }

    .portal-bottom {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px;
      background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(12px);
      border-top: 1px solid var(--vos-border);
      padding: 8px 6px calc(8px + env(safe-area-inset-bottom));
    }
    .portal-bottom a,
    .portal-bottom__menu {
      position: relative; display: flex; align-items: center; justify-content: center;
      text-decoration: none; color: var(--vos-ink-muted); font-size: 12px; font-weight: 600;
      min-height: var(--vos-tap); padding: 8px 4px; border-radius: 12px;
      border: 0; background: transparent; cursor: pointer; font: inherit;
    }
    .portal-bottom a.on { color: var(--vos-brand); background: var(--vos-brand-soft); font-weight: 700; }
    .dot {
      position: absolute; top: 8px; right: 12px;
      width: 8px; height: 8px; border-radius: 50%; background: var(--vos-accent);
    }
  `],
})
export class ShellComponent implements OnInit, OnDestroy {
  readonly unread = signal(0);
  readonly menuOpen = signal(false);
  readonly loggingOut = signal(false);
  /** Hide redundant Book CTAs while the user is already in the booking funnel. */
  readonly inBookingFlow = signal(false);
  readonly year = new Date().getFullYear();
  private navSub?: Subscription;

  constructor(
    private readonly api: CustomerApiService,
    private readonly activePet: ActivePetService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.syncBookingFlow(this.router.url);
    void this.refreshUnread();
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.syncBookingFlow(e.urlAfterRedirects);
        void this.refreshUnread();
        this.scrollToTop();
      });
  }

  private scrollToTop() {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    try {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {
      /* ignore */
    }
  }

  private syncBookingFlow(url: string) {
    const path = (url || '').split('?')[0];
    this.inBookingFlow.set(path.startsWith('/book/'));
  }

  ngOnDestroy() {
    this.navSub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeMenu();
  }

  toggleMenu() {
    this.menuOpen.update((v) => !v);
    if (this.menuOpen()) void this.refreshUnread();
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  fabPet() {
    const id = this.activePet.get();
    return id ? { petId: id } : {};
  }

  unreadLabel(): string {
    const n = this.unread();
    if (n <= 0) return '';
    // Same truncation rule for header badge and drawer badge
    if (n > 99) return '99+';
    return String(n);
  }

  unreadTitle(): string {
    const n = this.unread();
    if (n <= 0) return 'Notifications';
    return n === 1 ? '1 unread notification' : `${n} unread notifications`;
  }

  unreadAriaLabel(): string {
    const n = this.unread();
    if (n <= 0) return 'Notifications';
    return `Notifications, ${n} unread`;
  }

  displayName(): string {
    const p = this.auth.profile() as any;
    const name =
      p?.fullName ||
      p?.customer?.fullName ||
      p?.customer?.name ||
      '';
    return String(name).trim() || 'Pet parent';
  }

  displayMobile(): string {
    const p = this.auth.profile() as any;
    return String(p?.customer?.mobile || p?.mobile || '').trim();
  }

  /** Format mobile for display — India (+91) by default when 10–12 digits. */
  formatPhone(raw: string): string {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';

    // 91XXXXXXXXXX or 0XXXXXXXXXX → +91 XXXXX XXXXX
    let national = digits;
    let country = '';
    if (digits.length === 12 && digits.startsWith('91')) {
      country = '+91';
      national = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      country = '+91';
      national = digits.slice(1);
    } else if (digits.length === 10) {
      country = '+91';
      national = digits;
    } else if (digits.length > 10 && digits.startsWith('91')) {
      country = '+91';
      national = digits.slice(2);
    }

    if (country === '+91' && national.length === 10) {
      return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
    }

    // Generic international grouping
    if (digits.length > 10) {
      return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -5)} ${digits.slice(-5)}`;
    }
    return digits.replace(/(\d{3,5})(?=\d)/g, '$1 ').trim();
  }

  initials(): string {
    const parts = this.displayName().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'P';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async logout() {
    this.loggingOut.set(true);
    try {
      await this.auth.logout();
      this.closeMenu();
      await this.router.navigateByUrl('/');
    } finally {
      this.loggingOut.set(false);
    }
  }

  async refreshUnread() {
    try {
      const raw = await this.api.notifications(false);
      const { unreadCount } = this.api.parseNotifications(raw);
      this.unread.set(Math.max(0, unreadCount || 0));
    } catch {
      this.unread.set(0);
    }
  }
}
