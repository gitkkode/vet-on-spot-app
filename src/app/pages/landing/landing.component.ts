import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-landing',
  imports: [RouterLink],
  template: `
    <div class="land">
      <header class="land-nav">
        <div class="wrap">
          <a routerLink="/" class="brand" aria-label="VetonSpot home">
            <span class="brand__mark">Vetonsp<span class="o">●</span>t</span>
          </a>
          <nav class="land-nav__links" aria-label="Page">
            <a href="#how">How it works</a>
            <a href="#care">Care</a>
          </nav>
          <div class="land-nav__actions">
            @if (authed()) {
              <a class="btn btn--dark" routerLink="/home">Go to portal</a>
            } @else {
              <a class="nav-link" routerLink="/login">Log in</a>
              <a class="btn btn--dark" routerLink="/login">Get started</a>
            }
          </div>
        </div>
      </header>

      <section class="hero" aria-label="VetonSpot">
        <div class="wrap hero__grid">
          <div class="hero__copy">
            <p class="hero__brand">Vetonsp<span class="o">●</span>t</p>
            <h1>Vet care that comes to you.</h1>
            <p class="hero__lede">
              Home visits, televet, and a living health record — built for pet parents who want calm, clear care.
            </p>
            <div class="hero__ctas">
              @if (authed()) {
                <a class="btn btn--brand" routerLink="/home">Open your portal</a>
                <a class="btn btn--ghost" routerLink="/book/new">Book a visit</a>
              } @else {
                <a class="btn btn--brand" routerLink="/login">Get started</a>
                <a class="btn btn--ghost" routerLink="/login">Book a visit</a>
              }
            </div>
          </div>

          <aside class="hero__stage" aria-hidden="true">
            <div class="hero__stage-bg"></div>
            <div class="hero__stage-body">
              <p class="hero__stage-kicker">At your door</p>
              <h2>Home veterinary visit</h2>
              <p class="hero__stage-sub">Book · Track · Care — one calm flow from the first tap to the visit summary.</p>
              <ul class="hero__stage-list">
                <li>Vet arrives at your home</li>
                <li>Live booking status</li>
                <li>Health notes that stick</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section class="block" id="how" aria-labelledby="how-title">
        <div class="wrap">
          <div class="block__head">
            <p class="eyebrow">How it works</p>
            <h2 id="how-title">Three steps to calmer care</h2>
          </div>
          <ol class="steps">
            <li>
              <span class="steps__num">01</span>
              <strong>Add your pets</strong>
              <span>Profiles, vaccines, and notes live in one place.</span>
            </li>
            <li>
              <span class="steps__num">02</span>
              <strong>Book or talk</strong>
              <span>Home visit or televet — clear next steps, less guesswork.</span>
            </li>
            <li>
              <span class="steps__num">03</span>
              <strong>Stay on track</strong>
              <span>Meds, follow-ups, and visit history follow every pet.</span>
            </li>
          </ol>
        </div>
      </section>

      <section class="block block--tint" id="care" aria-labelledby="care-title">
        <div class="wrap">
          <div class="block__head">
            <p class="eyebrow">Care paths</p>
            <h2 id="care-title">Choose how you want help</h2>
          </div>
          <div class="paths">
            <a class="path" [routerLink]="authed() ? '/book/new' : '/login'">
              <span class="path__tag">Visit</span>
              <strong>Home visit</strong>
              <span>A vet at your door when it matters.</span>
            </a>
            <a class="path" [routerLink]="authed() ? '/televet' : '/login'">
              <span class="path__tag">Consult</span>
              <strong>Televet</strong>
              <span>Quick phone consult with a veterinarian.</span>
            </a>
            <a class="path path--urgent" [routerLink]="authed() ? '/emergency' : '/login'">
              <span class="path__tag">Urgent</span>
              <strong>Emergency</strong>
              <span>Guidance when you can’t wait.</span>
            </a>
          </div>
        </div>
      </section>

      <p class="trust">Hospital · Emergency · Diagnostics · Pharmacy · Wellness</p>

      <footer class="land-foot">
        <div class="wrap land-foot__grid">
          <div>
            <strong class="brand__mark">Vetonsp<span class="o">●</span>t</strong>
            <p>Vet care that comes to you — home visits, televet, and a living health record for every pet.</p>
          </div>
          <div class="land-foot__cols">
            <div>
              <span class="land-foot__label">Care</span>
              <a routerLink="/login">Book a visit</a>
              <a routerLink="/login">Talk to a vet</a>
              <a routerLink="/login">Something wrong</a>
            </div>
            <div>
              <span class="land-foot__label">Portal</span>
              <a routerLink="/login">Log in</a>
              <a routerLink="/login">Pet profiles</a>
              <a routerLink="/login">Health</a>
            </div>
            <div>
              <span class="land-foot__label">Account</span>
              <a routerLink="/login">Support</a>
              <a routerLink="/login">Get started</a>
            </div>
          </div>
        </div>
        <div class="wrap land-foot__bottom">
          <p class="land-foot__services">Veterinary hospital · Emergency · Diagnostics · Pharmacy · Wellness</p>
          <nav class="land-foot__legal" aria-label="Legal">
            <a href="https://vetonspot.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            <a href="https://vetonspot.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            <a href="mailto:hello@vetonspot.com">Contact Us</a>
          </nav>
          <p class="land-foot__copy">© {{ year }} VetonSpot. All rights reserved.</p>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .land {
      min-height: 100vh;
      background: #FCFCFB;
      color: #0a0a0a;
      font-family: var(--vos-font);
    }

    .wrap {
      width: 100%;
      max-width: 1680px;
      margin: 0 auto;
      padding: 0 clamp(16px, 2.2vw, 32px);
      box-sizing: border-box;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 12px 22px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 1rem;
      text-decoration: none;
      border: 0;
      cursor: pointer;
      transition: transform 0.18s var(--vos-ease), box-shadow 0.18s ease;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn--brand {
      background: linear-gradient(135deg, #FD4A29, #E03E20);
      color: #fff;
      box-shadow: 0 12px 28px rgba(253, 74, 41, 0.3);
    }
    .btn--dark {
      background: #0a0a0a;
      color: #fff;
    }
    .btn--ghost {
      background: #fff;
      color: #0a0a0a;
      border: 1px solid #E8E4DC;
    }

    .brand, .brand__mark {
      font-family: var(--vos-display);
      font-weight: 700;
      letter-spacing: -0.04em;
      text-decoration: none;
      color: inherit;
    }
    .brand__mark { font-size: 1.45rem; }
    .o { color: #FD4A29; }

    .land-nav {
      position: sticky;
      top: 0;
      z-index: 40;
      background: rgba(252, 252, 251, 0.94);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(232, 228, 220, 0.9);
    }
    .land-nav .wrap {
      min-height: 72px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 24px;
    }
    .land-nav__links {
      display: none;
      justify-content: center;
      gap: 28px;
    }
    .land-nav__links a {
      color: #5C5A55;
      text-decoration: none;
      font-weight: 650;
      font-size: 0.95rem;
    }
    .land-nav__links a:hover { color: #FD4A29; }
    .land-nav__actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nav-link {
      color: #5C5A55;
      text-decoration: none;
      font-weight: 700;
    }
    .nav-link:hover { color: #FD4A29; }
    @media (min-width: 720px) {
      .land-nav__links { display: flex; }
    }
    @media (max-width: 520px) {
      .nav-link { display: none; }
      .land-nav .wrap { grid-template-columns: 1fr auto; }
    }

    /* Full-bleed hero with contained grid */
    .hero {
      position: relative;
      padding: clamp(48px, 8vh, 88px) 0 clamp(64px, 10vh, 100px);
      background:
        radial-gradient(ellipse 55% 70% at 100% 0%, rgba(253, 74, 41, 0.14) 0%, transparent 55%),
        radial-gradient(ellipse 40% 50% at 0% 100%, rgba(253, 74, 41, 0.07) 0%, transparent 50%),
        linear-gradient(180deg, #FFF8F5 0%, #FCFCFB 55%, #FCFCFB 100%);
      overflow: hidden;
    }
    .hero__grid {
      display: grid;
      gap: 36px;
      align-items: stretch;
      animation: rise 0.5s var(--vos-ease) both;
    }
    @media (min-width: 960px) {
      .hero__grid {
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
        gap: clamp(32px, 4vw, 56px);
      }
    }
    .hero__brand {
      margin: 0 0 14px;
      font-family: var(--vos-display);
      font-size: clamp(1.75rem, 3.5vw, 2.35rem);
      font-weight: 700;
      letter-spacing: -0.05em;
      line-height: 1;
    }
    .hero h1 {
      margin: 0 0 16px;
      font-family: var(--vos-display);
      font-size: clamp(2.35rem, 5.5vw, 3.75rem);
      letter-spacing: -0.045em;
      line-height: 1.02;
      max-width: 11ch;
    }
    .hero__lede {
      margin: 0 0 28px;
      max-width: 40ch;
      font-size: clamp(1.05rem, 1.6vw, 1.2rem);
      line-height: 1.45;
      color: #5C5A55;
    }
    .hero__ctas {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .hero__stage {
      position: relative;
      border-radius: 28px;
      overflow: hidden;
      min-height: 360px;
      display: flex;
      align-items: flex-end;
      box-shadow: 0 28px 64px rgba(253, 74, 41, 0.22);
    }
    .hero__stage-bg {
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 80% 70% at 20% 20%, rgba(255,255,255,0.22) 0%, transparent 50%),
        linear-gradient(145deg, #FD4A29 0%, #E03E20 42%, #1a100e 100%);
    }
    .hero__stage-body {
      position: relative;
      width: 100%;
      padding: 28px 28px 30px;
      background: linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.55) 38%, rgba(10,10,10,0.82) 100%);
      color: #fff;
    }
    .hero__stage-kicker {
      margin: 0 0 8px;
      font-family: var(--vos-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0.9;
    }
    .hero__stage h2 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: clamp(1.45rem, 2.5vw, 1.85rem);
      letter-spacing: -0.03em;
    }
    .hero__stage-sub {
      margin: 0 0 16px;
      opacity: 0.88;
      line-height: 1.4;
      max-width: 36ch;
    }
    .hero__stage-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .hero__stage-list li {
      position: relative;
      padding-left: 18px;
      font-weight: 600;
      font-size: 0.95rem;
    }
    .hero__stage-list li::before {
      content: '';
      position: absolute;
      left: 0; top: 0.55em;
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #FD4A29;
      box-shadow: 0 0 0 3px rgba(253, 74, 41, 0.25);
    }

    .block {
      padding: var(--vos-section) 0;
    }
    .block--tint {
      background: #F5F4F1;
      border-top: 1px solid #E8E4DC;
      border-bottom: 1px solid #E8E4DC;
    }
    .block__head { margin-bottom: 28px; max-width: 28ch; }
    .eyebrow {
      margin: 0 0 10px;
      font-family: var(--vos-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #FD4A29;
    }
    .block__head h2 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: clamp(1.7rem, 3vw, 2.25rem);
      letter-spacing: -0.04em;
      line-height: 1.1;
    }

    .steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 14px;
    }
    @media (min-width: 800px) {
      .steps { grid-template-columns: repeat(3, 1fr); gap: 18px; }
    }
    .steps li {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 24px 22px;
      border-radius: 22px;
      background: #fff;
      border: 1px solid #E8E4DC;
      box-shadow: 0 8px 24px rgba(10, 10, 10, 0.04);
      min-height: 180px;
    }
    .steps__num {
      font-family: var(--vos-mono);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #FD4A29;
    }
    .steps strong {
      font-family: var(--vos-display);
      font-size: 1.25rem;
      letter-spacing: -0.02em;
    }
    .steps span:last-child {
      color: #5C5A55;
      line-height: 1.45;
    }

    .paths {
      display: grid;
      gap: 14px;
    }
    @media (min-width: 800px) {
      .paths { grid-template-columns: repeat(3, 1fr); gap: 16px; }
    }
    .path {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 26px 24px;
      min-height: 180px;
      border-radius: 22px;
      background: #fff;
      border: 1px solid #E8E4DC;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 8px 24px rgba(10, 10, 10, 0.04);
      transition: transform 0.18s var(--vos-ease), border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .path:hover {
      transform: translateY(-3px);
      border-color: rgba(253, 74, 41, 0.4);
      box-shadow: 0 16px 36px rgba(10, 10, 10, 0.08);
    }
    .path--urgent { border-color: rgba(180, 35, 24, 0.28); }
    .path__tag {
      font-family: var(--vos-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #FD4A29;
    }
    .path strong {
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.02em;
    }
    .path > span:last-child {
      color: #5C5A55;
      line-height: 1.4;
      margin-top: auto;
    }

    .trust {
      margin: 0;
      padding: 28px clamp(20px, 4vw, 56px);
      text-align: center;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #8A8680;
    }

    .land-foot {
      background: #0a0a0a;
      color: rgba(255,255,255,0.78);
      padding: 56px 0 40px;
    }
    .land-foot__grid {
      display: grid;
      gap: 40px;
    }
    @media (min-width: 860px) {
      .land-foot__grid { grid-template-columns: 1.1fr 2fr; gap: 56px; }
    }
    .land-foot .brand__mark { color: #fff; font-size: 1.4rem; }
    .land-foot p {
      margin: 14px 0 0;
      max-width: 38ch;
      line-height: 1.5;
    }
    .land-foot__cols {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .land-foot__label {
      display: block;
      margin-bottom: 12px;
      font-family: var(--vos-mono);
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.92);
      font-weight: 700;
    }
    .land-foot__cols a {
      display: block;
      color: rgba(255,255,255,0.72);
      text-decoration: none;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .land-foot__cols a:hover { color: #FD4A29; }
    .land-foot__bottom {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.12);
      display: grid;
      gap: 12px;
    }
    @media (min-width: 860px) {
      .land-foot__bottom {
        grid-template-columns: 1.4fr 1fr auto;
        align-items: center;
        gap: 20px;
      }
    }
    .land-foot__services {
      margin: 0 !important;
      max-width: none !important;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.48);
      font-weight: 600;
    }
    .land-foot__legal {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
    }
    .land-foot__legal a {
      color: rgba(255,255,255,0.78);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
    }
    .land-foot__legal a:hover { color: #FD4A29; }
    .land-foot__copy {
      margin: 0 !important;
      max-width: none !important;
      font-size: 13px !important;
      color: rgba(255,255,255,0.55);
      white-space: nowrap;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .hero__grid, .path:hover, .btn:hover { animation: none; transform: none; }
    }
  `],
})
export class LandingComponent implements OnInit {
  readonly authed = signal(false);
  readonly year = new Date().getFullYear();

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  async ngOnInit() {
    await this.auth.waitUntilReady();
    if (this.auth.isLoggedIn() && this.auth.hasCustomerProfile()) {
      this.authed.set(true);
      await this.router.navigateByUrl('/home');
    }
  }
}
