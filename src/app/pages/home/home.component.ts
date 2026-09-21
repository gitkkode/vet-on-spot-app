import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-home',
  template: `
    @if (error()) {
      <div class="vos-err">
        {{ error() }}
        <button type="button" class="linkish" (click)="load()">Try again</button>
      </div>
    }

    @if (loading()) {
      <section class="boot" aria-busy="true" aria-label="Loading your portal">
        <div class="boot__mark" aria-hidden="true">
          <span class="boot__ring"></span>
          <span class="boot__dot"></span>
        </div>
        <p class="boot__kicker">Pet Parent Portal</p>
        <h1 class="boot__title">Preparing your care home</h1>
        <p class="boot__sub">Just a moment…</p>
        <div class="boot__bars" aria-hidden="true">
          <div class="boot__bar"></div>
          <div class="boot__bar boot__bar--short"></div>
          <div class="boot__bar boot__bar--mid"></div>
        </div>
      </section>
    } @else if (home(); as h) {
      @if (!(h.pets?.length)) {
        <section class="onboard" aria-label="Get started">
          <div class="onboard__progress" aria-label="Setup progress">
            <span class="onboard__pill">Getting started</span>
            <span class="onboard__steps"><strong>1</strong> / 3 · Add your pet</span>
          </div>

          <header class="onboard__hero">
            <p class="onboard__eyebrow">Welcome</p>
            <h1>{{ firstName(h.greeting) }}, your care home is ready.</h1>
            <p class="onboard__lede">
              Add a pet to unlock visits, tele-vet, medications, and a living health timeline —
              all in one place.
            </p>
          </header>

          <a class="onboard__primary" routerLink="/pets/new">
            <span class="onboard__primary-kicker">Start here</span>
            <span class="onboard__primary-title">Add your first pet</span>
            <span class="onboard__primary-sub">Name, species, and a few basics — takes under a minute.</span>
            <span class="onboard__primary-arrow" aria-hidden="true">→</span>
          </a>

          <div class="onboard__secondary" aria-label="Also available">
            <a routerLink="/book/new" class="onboard__sec">
              <strong>Book a visit</strong>
              <span>Home visit when you’re ready</span>
            </a>
            <a routerLink="/televet" class="onboard__sec">
              <strong>Talk to a vet</strong>
              <span>Quick consult by phone</span>
            </a>
          </div>

          <section class="onboard__path" aria-label="How it works">
            <h2>How your portal works</h2>
            <ol>
              <li>
                <em>01</em>
                <div>
                  <strong>Add pets</strong>
                  <span>Their profile becomes the center of every visit and note.</span>
                </div>
              </li>
              <li>
                <em>02</em>
                <div>
                  <strong>Book or talk</strong>
                  <span>Home visit or tele-vet — clear next steps, less guesswork.</span>
                </div>
              </li>
              <li>
                <em>03</em>
                <div>
                  <strong>Stay on track</strong>
                  <span>Meds, vaccines, and follow-ups live on one timeline.</span>
                </div>
              </li>
            </ol>
          </section>

          <p class="onboard__trust">Hospital · Emergency · Diagnostics · Wellness</p>
        </section>
      } @else {
        <!-- Pet-parent care home: one moment, three paths, soft care strip -->
        <div class="hub">
          <header class="stage" aria-label="Your pet">
            <div class="stage__pets" role="listbox" aria-label="Switch pet">
              @for (p of h.pets; track p.id) {
                <button
                  type="button"
                  class="pet-chip"
                  role="option"
                  [attr.aria-selected]="h.activePet?.id === p.id"
                  [class.on]="h.activePet?.id === p.id"
                  [attr.aria-label]="p.name"
                  (click)="selectPet(p.id)"
                >
                  @if (p.photoUrl) {
                    <img [src]="p.photoUrl" alt="" />
                  } @else {
                    <span class="ph">{{ (p.name || '?').charAt(0) }}</span>
                  }
                </button>
              }
              <a class="pet-add" routerLink="/pets/new" aria-label="Add pet">+</a>
            </div>
            <p class="stage__kicker">{{ firstName(h.greeting) }} · Pet Parent</p>
            <h1 class="stage__title">
              @if (h.activePet?.name; as petName) {
                How’s {{ petName }} today?
              } @else {
                {{ h.greeting }}
              }
            </h1>
            <p class="stage__whisper">{{ healthWhisper() }}</p>
          </header>

          @if (nextAction(); as na) {
            <section class="moment" aria-label="Up next">
              <div class="moment__glow" aria-hidden="true"></div>
              <p class="moment__label">{{ hasUpcoming() ? 'Up next' : 'Suggested for you' }}</p>
              <strong class="moment__title">{{ na.title }}</strong>
              <p class="moment__detail">{{ na.detail }}</p>
              <a
                class="moment__cta"
                [routerLink]="na.commands"
                [queryParams]="na.queryParams || {}"
              >{{ na.cta }}</a>
            </section>
          }

          <section class="paths" aria-label="What would you like to do?">
            <h2 class="sec-h">Start here</h2>
            <div class="paths__row">
              <a class="path path--primary" routerLink="/book/new" [queryParams]="petQuery()">
                <strong>Book a home visit</strong>
                <span>A vet at your door</span>
              </a>
              <a class="path" routerLink="/televet" [queryParams]="petQuery()">
                <strong>Talk to a vet</strong>
                <span>Quick phone consult</span>
              </a>
              <a class="path" routerLink="/intake" [queryParams]="petQuery()">
                <strong>Not feeling well</strong>
                <span>Tell us what’s going on</span>
              </a>
            </div>
            <a class="paths__emer" routerLink="/emergency" [queryParams]="petQuery()">
              Need urgent care? Open emergency
            </a>
          </section>

          @if (careBits(); as bits) {
            @if (bits.length) {
              <section class="care" aria-label="Care for your pet">
                <div class="sec-row">
                  <h2 class="sec-h">
                    @if (h.activePet?.name; as n) {
                      Caring for {{ n }}
                    } @else {
                      Care today
                    }
                  </h2>
                  @if (h.activePet?.id; as pid) {
                    <a class="sec-link" [routerLink]="['/pets', pid, 'health']">Health</a>
                  }
                </div>
                @for (bit of bits; track bit.key) {
                  <a class="care__row" [routerLink]="bit.commands" [queryParams]="bit.queryParams || {}">
                    <strong>{{ bit.title }}</strong>
                    <span>{{ bit.detail }}</span>
                  </a>
                }
              </section>
            }
          }

          @if (extraUpcoming(); as extras) {
            @if (extras.length) {
              <section class="upcom" aria-label="More appointments">
                <div class="sec-row">
                  <h2 class="sec-h">Also upcoming</h2>
                  <a class="sec-link" routerLink="/bookings">All</a>
                </div>
                <div class="upcom__list">
                  @for (b of extras; track b.id) {
                    <a class="upcom__card" [routerLink]="['/bookings', b.id]">
                      <span class="upcom__pill">{{ b.customerStatus?.label || b.status }}</span>
                      <strong>{{ b.petName }}</strong>
                      <span class="upcom__when">{{ prettyWhen(b.scheduledDate, b.scheduledTime) }}</span>
                      <span class="upcom__chev" aria-hidden="true"></span>
                    </a>
                  }
                </div>
              </section>
            }
          }

          <nav class="util" aria-label="More">
            @if (h.activePet?.id; as pid) {
              <a [routerLink]="['/pets', pid]">{{ h.activePet?.name || 'Pet' }} profile</a>
              <a [routerLink]="['/pets', pid, 'vaccinations']">Vaccines</a>
            }
            <a routerLink="/medications">Medications</a>
            <a routerLink="/assistant" [queryParams]="petQuery()">Ask / Support</a>
            <a routerLink="/notifications">Alerts</a>
          </nav>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; animation: home-in 0.45s var(--vs-ease, ease) both; }

    @keyframes home-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: none; }
    }

    .boot {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: clamp(48px, 10vh, 96px) 20px 40px;
      animation: home-in 0.4s var(--vs-ease, ease) both;
    }
    .boot__mark {
      position: relative;
      width: 56px; height: 56px;
      margin-bottom: 22px;
    }
    .boot__ring {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 2.5px solid rgba(253, 74, 41, 0.18);
      border-top-color: #FD4A29;
      animation: boot-spin 0.85s linear infinite;
    }
    .boot__dot {
      position: absolute;
      inset: 18px;
      border-radius: 50%;
      background: #FD4A29;
      animation: boot-pulse 1.2s ease-in-out infinite;
    }
    .boot__kicker {
      margin: 0 0 8px;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #FD4A29;
      font-weight: 700;
    }
    .boot__title {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: clamp(1.6rem, 3.5vw, 2rem);
      letter-spacing: -0.04em;
      line-height: 1.15;
    }
    .boot__sub {
      margin: 0 0 28px;
      color: var(--vos-ink-muted);
      font-size: 1rem;
    }
    .boot__bars {
      width: min(360px, 100%);
      display: grid;
      gap: 10px;
    }
    .boot__bar {
      height: 12px;
      border-radius: 999px;
      background: linear-gradient(90deg, #efebe0 0%, #f7f3ea 40%, #efebe0 80%);
      background-size: 200% 100%;
      animation: boot-shimmer 1.2s ease-in-out infinite;
    }
    .boot__bar--short { width: 62%; margin: 0 auto; animation-delay: 0.12s; }
    .boot__bar--mid { width: 78%; margin: 0 auto; animation-delay: 0.22s; }

    /* —— Empty: enterprise onboarding —— */
    .onboard {
      max-width: 760px;
      margin: 0 auto;
      padding-bottom: 12px;
      animation: home-in 0.5s var(--vs-ease, ease) both;
    }
    .onboard__progress {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 28px;
    }
    .onboard__pill {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 4px 12px;
      border-radius: 999px;
      background: var(--vos-brand-soft, #ffe4dc);
      color: #FD4A29;
      font-family: var(--vos-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .onboard__steps {
      font-family: var(--vos-mono);
      font-size: 12px;
      color: var(--vos-ink-muted);
      letter-spacing: 0.04em;
    }
    .onboard__steps strong { color: var(--vos-ink); font-weight: 700; }

    .onboard__hero { margin-bottom: 28px; }
    .onboard__eyebrow {
      margin: 0 0 10px;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #FD4A29;
      font-weight: 700;
    }
    .onboard__hero h1 {
      margin: 0 0 14px;
      font-family: var(--vos-display);
      font-size: clamp(2rem, 5vw, 2.85rem);
      letter-spacing: -0.045em;
      line-height: 1.08;
      max-width: 16ch;
    }
    .onboard__lede {
      margin: 0;
      max-width: 42ch;
      font-size: 1.08rem;
      line-height: 1.5;
      color: var(--vos-ink-muted);
    }

    .onboard__primary {
      position: relative;
      display: block;
      text-decoration: none;
      color: #fff;
      border-radius: 28px;
      padding: 28px 28px 26px;
      margin-bottom: 14px;
      background:
        radial-gradient(ellipse 70% 80% at 100% 0%, rgba(255,255,255,0.18) 0%, transparent 50%),
        linear-gradient(145deg, #FD4A29 0%, #E03E20 48%, #1a100e 100%);
      box-shadow: 0 22px 48px rgba(253, 74, 41, 0.28);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      overflow: hidden;
    }
    .onboard__primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 28px 56px rgba(253, 74, 41, 0.34);
    }
    .onboard__primary:active { transform: scale(0.99); }
    .onboard__primary-kicker {
      display: block;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0.8;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .onboard__primary-title {
      display: block;
      font-family: var(--vos-display);
      font-size: clamp(1.55rem, 3.5vw, 1.9rem);
      letter-spacing: -0.03em;
      font-weight: 700;
      margin-bottom: 8px;
      padding-right: 36px;
    }
    .onboard__primary-sub {
      display: block;
      opacity: 0.88;
      font-size: 1rem;
      line-height: 1.4;
      max-width: 36ch;
      padding-right: 36px;
    }
    .onboard__primary-arrow {
      position: absolute;
      right: 24px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.4rem;
      opacity: 0.7;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }
    .onboard__primary:hover .onboard__primary-arrow {
      opacity: 1;
      transform: translateY(-50%) translateX(4px);
    }

    .onboard__secondary {
      display: grid;
      gap: 10px;
      margin-bottom: 28px;
    }
    @media (min-width: 640px) {
      .onboard__secondary { grid-template-columns: 1fr 1fr; }
    }
    .onboard__sec {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 18px 18px;
      border-radius: 20px;
      background: #fffef9;
      border: 1px solid var(--vos-border);
      text-decoration: none;
      color: inherit;
      box-shadow: 0 8px 22px rgba(20, 16, 12, 0.04);
      transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .onboard__sec:hover {
      transform: translateY(-2px);
      border-color: rgba(253, 74, 41, 0.28);
      box-shadow: 0 12px 28px rgba(20, 16, 12, 0.07);
    }
    .onboard__sec strong {
      font-family: var(--vos-display);
      font-size: 1.12rem;
      letter-spacing: -0.02em;
    }
    .onboard__sec span {
      color: var(--vos-ink-muted);
      font-size: 0.92rem;
      line-height: 1.35;
    }

    .onboard__path {
      padding: 26px 24px 22px;
      border-radius: 24px;
      background: linear-gradient(180deg, #fff 0%, #f7f3ea 100%);
      border: 1px solid var(--vos-border);
      margin-bottom: 20px;
    }
    .onboard__path h2 {
      margin: 0 0 18px;
      font-family: var(--vos-display);
      font-size: 1.25rem;
      letter-spacing: -0.03em;
    }
    .onboard__path ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 16px;
    }
    @media (min-width: 720px) {
      .onboard__path ol { grid-template-columns: repeat(3, 1fr); gap: 18px; }
    }
    .onboard__path li {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: start;
    }
    .onboard__path em {
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #FD4A29;
      margin-top: 2px;
    }
    .onboard__path strong {
      display: block;
      font-family: var(--vos-display);
      font-size: 1.05rem;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .onboard__path span {
      display: block;
      color: var(--vos-ink-muted);
      font-size: 0.92rem;
      line-height: 1.4;
    }

    .onboard__trust {
      margin: 0;
      text-align: center;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      opacity: 0.75;
    }

    @keyframes boot-spin { to { transform: rotate(360deg); } }
    @keyframes boot-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(0.72); opacity: 0.55; }
    }
    @keyframes boot-shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .boot__ring, .boot__dot, .boot__bar, .onboard, .boot, .hub, .hub > * {
        animation: none !important;
      }
      .onboard__primary:hover,
      .path:hover,
      .moment:hover,
      .upcom__card:hover { transform: none; }
    }

    /* —— Hub: pet-parent care home —— */
    @keyframes hub-rise {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: none; }
    }

    .hub {
      max-width: 720px;
      margin: 0 auto;
      padding-bottom: 8px;
      display: grid;
      gap: 22px;
    }
    .hub > * {
      animation: hub-rise 0.5s var(--vs-ease, ease) both;
    }
    .hub > *:nth-child(1) { animation-delay: 0.02s; }
    .hub > *:nth-child(2) { animation-delay: 0.08s; }
    .hub > *:nth-child(3) { animation-delay: 0.14s; }
    .hub > *:nth-child(4) { animation-delay: 0.2s; }
    .hub > *:nth-child(5) { animation-delay: 0.24s; }

    .stage {
      padding: 6px 0 2px;
      text-align: left;
    }
    .stage__pets {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
      overflow-x: auto;
      padding: 2px;
      -webkit-overflow-scrolling: touch;
    }
    .stage__kicker {
      margin: 0 0 8px;
      font-family: var(--vos-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #FD4A29;
    }
    .stage__title {
      margin: 0;
      font-family: var(--vos-display);
      font-size: clamp(1.85rem, 5vw, 2.55rem);
      letter-spacing: -0.045em;
      line-height: 1.08;
      max-width: 14ch;
    }
    .stage__whisper {
      margin: 12px 0 0;
      color: var(--vos-ink-muted);
      font-size: 1.05rem;
      line-height: 1.45;
      max-width: 38ch;
    }

    .pet-chip {
      width: 52px; height: 52px;
      border-radius: 50%;
      border: 2.5px solid transparent;
      padding: 0;
      background: #fffef9;
      cursor: pointer;
      overflow: hidden;
      flex-shrink: 0;
      transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
    }
    .pet-chip.on {
      border-color: #FD4A29;
      box-shadow: 0 0 0 4px rgba(253,74,41,0.16);
      transform: scale(1.04);
    }
    .pet-chip:hover { transform: translateY(-2px); }
    .pet-chip img, .ph {
      width: 100%; height: 100%;
      object-fit: cover;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--vos-display);
      font-weight: 700; font-size: 1.15rem;
      color: #FD4A29;
      background: var(--vos-brand-soft);
    }
    .pet-add {
      width: 48px; height: 48px;
      border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1.5px dashed var(--vos-border);
      background: #fffef9;
      color: var(--vos-ink);
      font-size: 1.35rem;
      font-weight: 600;
      text-decoration: none;
      flex-shrink: 0;
      line-height: 1;
      transition: border-color 0.18s ease, color 0.18s ease;
    }
    .pet-add:hover { border-color: #FD4A29; color: #FD4A29; }

    .moment {
      position: relative;
      overflow: hidden;
      border-radius: 28px;
      padding: 26px 24px 24px;
      color: #fff;
      background:
        radial-gradient(ellipse 90% 100% at 100% -20%, rgba(255,255,255,0.28) 0%, transparent 55%),
        linear-gradient(145deg, #FD4A29 0%, #E03E20 45%, #1a100e 100%);
      box-shadow: 0 22px 48px rgba(253, 74, 41, 0.26);
      transition: transform 0.22s var(--vs-ease, ease);
    }
    .moment:hover { transform: translateY(-3px); }
    .moment__glow {
      position: absolute; inset: auto -30% -50% 30%;
      height: 90%;
      background: radial-gradient(circle, rgba(255,255,255,0.14), transparent 68%);
      pointer-events: none;
    }
    .moment__label {
      margin: 0 0 10px;
      font-family: var(--vos-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0.88;
    }
    .moment__title {
      display: block;
      position: relative;
      font-family: var(--vos-display);
      font-size: clamp(1.5rem, 3.5vw, 1.95rem);
      letter-spacing: -0.035em;
      line-height: 1.12;
      max-width: 16ch;
    }
    .moment__detail {
      position: relative;
      margin: 10px 0 20px;
      opacity: 0.92;
      font-size: 1.02rem;
      line-height: 1.4;
      max-width: 36ch;
    }
    .moment__cta {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 12px 22px;
      border-radius: 999px;
      background: #0a0a0a;
      color: #fff;
      font-weight: 700;
      font-size: 1rem;
      text-decoration: none;
      transition: background 0.18s ease, transform 0.18s ease;
    }
    .moment__cta:hover { background: #1a1a1a; transform: translateY(-1px); }

    .sec-h {
      margin: 0 0 12px;
      font-family: var(--vos-display);
      font-size: 1.15rem;
      letter-spacing: -0.03em;
    }
    .sec-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
    }
    .sec-row .sec-h { margin: 0; }
    .sec-link {
      font-weight: 700;
      font-size: 13px;
      text-decoration: none;
      color: #FD4A29;
    }

    .paths__row {
      display: grid;
      gap: 10px;
    }
    @media (min-width: 640px) {
      .paths__row { grid-template-columns: repeat(3, 1fr); gap: 12px; }
    }
    .path {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 18px 16px;
      border-radius: 18px;
      background: #fffef9;
      border: 1px solid var(--vos-border);
      text-decoration: none;
      color: inherit;
      box-shadow: 0 8px 22px rgba(10, 10, 10, 0.04);
      transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
      min-height: 96px;
    }
    .path:hover {
      transform: translateY(-3px);
      border-color: rgba(253, 74, 41, 0.35);
      box-shadow: 0 14px 32px rgba(10, 10, 10, 0.08);
    }
    .path--primary {
      background: linear-gradient(180deg, #fffef9 0%, #fff1ec 100%);
      border-color: rgba(253, 74, 41, 0.28);
    }
    .path strong {
      font-family: var(--vos-display);
      font-size: 1.08rem;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }
    .path span {
      color: var(--vos-ink-muted);
      font-size: 0.9rem;
      line-height: 1.35;
    }
    .paths__emer {
      display: inline-block;
      margin-top: 14px;
      font-weight: 700;
      font-size: 0.92rem;
      color: #B42318;
      text-decoration: none;
    }
    .paths__emer:hover { text-decoration: underline; }

    .care {
      padding: 4px 2px 0;
    }
    .care__row {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 14px 0;
      border-top: 1px solid var(--vos-border);
      text-decoration: none;
      color: inherit;
    }
    .care__row:first-of-type { border-top: 0; }
    .care__row strong {
      font-family: var(--vos-display);
      font-size: 1.02rem;
      letter-spacing: -0.02em;
    }
    .care__row span { color: var(--vos-ink-muted); font-size: 0.9rem; }

    .upcom__list { display: grid; gap: 8px; }
    .upcom__card {
      position: relative;
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      gap: 2px 12px;
      padding: 14px 40px 14px 14px;
      border-radius: 14px;
      background: #fffef9;
      border: 1px solid var(--vos-border);
      text-decoration: none;
      color: inherit;
      box-shadow: 0 4px 14px rgba(10, 10, 10, 0.03);
      transition: transform 0.18s ease, border-color 0.18s ease;
    }
    .upcom__card:hover {
      transform: translateY(-2px);
      border-color: rgba(253, 74, 41, 0.3);
    }
    .upcom__pill {
      grid-column: 1;
      font-family: var(--vos-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #FD4A29;
      margin-bottom: 2px;
    }
    .upcom__card strong {
      grid-column: 1;
      font-family: var(--vos-display);
      font-size: 1.02rem;
      letter-spacing: -0.02em;
    }
    .upcom__when {
      grid-column: 1;
      color: var(--vos-ink-muted);
      font-size: 0.88rem;
    }
    .upcom__chev {
      position: absolute;
      right: 16px; top: 50%;
      width: 8px; height: 8px;
      border-right: 2px solid var(--vos-ink-muted);
      border-bottom: 2px solid var(--vos-ink-muted);
      transform: translateY(-50%) rotate(-45deg);
      opacity: 0.55;
    }

    .util {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
      justify-content: center;
      padding: 8px 0 2px;
    }
    .util a {
      font-family: var(--vos-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--vos-ink-muted);
      transition: color 0.15s ease;
    }
    .util a:hover { color: #FD4A29; }

    .linkish {
      margin-left: 8px; background: none; border: 0;
      color: #FD4A29; font-weight: 700; cursor: pointer;
    }
  `],
})
export class HomeComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly home = signal<any>(null);
  readonly health = signal<any>(null);
  readonly careNext = signal<any>(null);

  constructor(
    private readonly api: CustomerApiService,
    private readonly activePet: ActivePetService,
  ) {}

  ngOnInit() {
    void this.load();
  }

  splashGreeting(greeting: string | null | undefined): string {
    const g = String(greeting || 'Welcome').trim();
    return g.replace(/\.$/, '');
  }

  firstName(greeting: string | null | undefined): string {
    const g = String(greeting || '').trim();
    const m = g.match(/,\s*([^.,]+)/);
    if (m?.[1]) return m[1].trim();
    const customer = this.home()?.customer;
    const fromProfile = String(customer?.fullName || '').trim().split(/\s+/)[0];
    return fromProfile || 'there';
  }

  petQuery() {
    const id = this.home()?.activePet?.id || this.activePet.get();
    return id ? { petId: id } : {};
  }

  dueDate(v: string | null | undefined) {
    return (v || '').slice(0, 10) || '—';
  }

  healthWhisper(): string {
    const h = this.home();
    const hs = this.health();
    const pet = h?.activePet?.name || 'your pet';
    if (h?.upcoming?.[0]) {
      const up = h.upcoming[0];
      return `${up.petName || pet} has a visit ${this.prettyWhen(up.scheduledDate, up.scheduledTime)}.`;
    }
    const med = hs?.careStatus?.activeMedications?.[0];
    if (med) return `${med.medicine} is on today’s list for ${med.petName || pet}.`;
    const fu = hs?.careStatus?.upcomingFollowUp;
    if (fu) return `A follow-up is coming up${fu.dueAt ? ` · ${String(fu.dueAt).slice(0, 10)}` : ''}.`;
    const vax = hs?.careStatus?.nextVaccination;
    if (vax) return `${vax.vaccineName} is next on the calendar.`;
    if (h?.healthHint) return h.healthHint;
    return `We’re here whenever ${pet} needs a vet at home.`;
  }

  hasUpcoming(): boolean {
    return !!(this.home()?.upcoming?.[0]?.id);
  }

  extraUpcoming(): any[] {
    const list = this.home()?.upcoming || [];
    return list.slice(1, 4);
  }

  careBits(): Array<{
    key: string;
    title: string;
    detail: string;
    commands: any[];
    queryParams?: Record<string, string>;
  }> {
    const h = this.home();
    const hs = this.health();
    const bits: Array<{
      key: string;
      title: string;
      detail: string;
      commands: any[];
      queryParams?: Record<string, string>;
    }> = [];

    const med = hs?.careStatus?.activeMedications?.[0] || h?.medications?.[0];
    if (med) {
      bits.push({
        key: 'med',
        title: `Medication · ${med.medicine}`,
        detail: `${med.dose || ''} ${med.frequency || ''}`.trim() || 'Active',
        commands: ['/medications'],
      });
    }
    const fu = hs?.careStatus?.upcomingFollowUp || h?.followUps?.[0];
    if (fu) {
      bits.push({
        key: 'fu',
        title: `Follow-up · ${fu.reason || 'Recheck'}`,
        detail: `Due ${this.dueDate(fu.dueAt)}`,
        commands: ['/follow-ups'],
      });
    }
    const vax = hs?.careStatus?.nextVaccination;
    if (vax) {
      bits.push({
        key: 'vax',
        title: `Vaccine · ${vax.vaccineName}`,
        detail: `Due ${vax.nextDueOn || 'soon'}`,
        commands: h?.activePet?.id ? ['/pets', h.activePet.id, 'vaccinations'] : ['/reminders'],
      });
    }
    if (h?.recentVisit && bits.length < 3) {
      bits.push({
        key: 'visit',
        title: h.recentVisit.title || 'Recent visit',
        detail: `${h.recentVisit.date || h.recentVisit.occurredAt || ''}${
          h.recentVisit.doctorName ? ` · ${h.recentVisit.doctorName}` : ''
        }`.trim(),
        commands: this.visitLink(h.recentVisit),
      });
    }
    return bits.slice(0, 3);
  }

  nextAction(): {
    title: string;
    detail: string;
    commands: any[];
    queryParams?: Record<string, string>;
    cta: string;
  } | null {
    const h = this.home();
    const hs = this.health();
    if (!h?.pets?.length) return null;

    const up = h.upcoming?.[0];
    if (up?.id) {
      const pet = up.petName || h.activePet?.name || 'Your pet';
      return {
        title: `${pet}’s home visit`,
        detail: `${up.customerStatus?.label || 'Scheduled'} · ${this.prettyWhen(up.scheduledDate, up.scheduledTime)}`,
        commands: ['/bookings', up.id],
        cta: 'Open visit',
      };
    }

    const med = hs?.careStatus?.activeMedications?.[0] || h.medications?.[0];
    if (med) {
      return {
        title: `Time for ${med.medicine}`,
        detail: `${med.petName || h.activePet?.name || 'Your pet'} · ${med.frequency || 'Today'}`,
        commands: ['/medications'],
        cta: 'Open medications',
      };
    }
    const fu = hs?.careStatus?.upcomingFollowUp || h.followUps?.[0];
    if (fu) {
      return {
        title: fu.reason || 'Follow-up due',
        detail: `${fu.petName || h.activePet?.name || ''} · ${(fu.dueAt || '').slice(0, 10)}`,
        commands: ['/follow-ups'],
        cta: 'View follow-up',
      };
    }
    const vax = hs?.careStatus?.nextVaccination;
    if (vax && h.activePet?.id) {
      return {
        title: `${vax.vaccineName} coming up`,
        detail: `Due ${vax.nextDueOn || 'soon'} for ${h.activePet.name}`,
        commands: ['/pets', h.activePet.id, 'vaccinations'],
        cta: 'View vaccines',
      };
    }
    if (h.activePet?.id) {
      return {
        title: `Ready when ${h.activePet.name} needs you`,
        detail: 'Book a vet at your door, or talk through what’s going on.',
        commands: ['/book/new'],
        queryParams: { petId: h.activePet.id },
        cta: 'Book a visit',
      };
    }
    return {
      title: 'Book a home visit',
      detail: 'A vet at your door — pick a time that works.',
      commands: ['/book/new'],
      cta: 'Book a visit',
    };
  }

  prettyWhen(dateStr?: string | null, timeStr?: string | null): string {
    const time = String(timeStr || '').trim();
    if (!dateStr) return time || 'Schedule TBD';
    const raw = String(dateStr);
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return `${raw}${time ? ` · ${time}` : ''}`.trim();
    const day = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return time ? `${day} · ${time}` : day;
  }

  visitLink(ev: any): any[] {
    if (ev?.visitId) return ['/visits', ev.visitId];
    if (ev?.entityId && (ev?.type === 'visit' || ev?.kind === 'visit')) return ['/visits', ev.entityId];
    if (ev?.petId) return ['/pets', ev.petId, 'health'];
    return ['/health'];
  }

  careNextLink(item: any): any {
    const petId = this.home()?.activePet?.id;
    switch (item?.type) {
      case 'follow_up':
        return '/follow-ups';
      case 'medications':
        return '/medications';
      case 'vaccination':
        return petId ? ['/pets', petId, 'vaccinations'] : '/health';
      case 'lab':
        return '/diagnostics';
      case 'reminders':
        return petId ? ['/pets', petId, 'reminders'] : '/reminders';
      default:
        return petId ? ['/pets', petId, 'health'] : '/health';
    }
  }

  careNextLabel(item: any): string {
    switch (item?.type) {
      case 'follow_up':
        return item.data?.reason || 'Follow-up';
      case 'medications':
        return 'Medications';
      case 'vaccination':
        return item.data?.vaccineName || 'Vaccination';
      case 'lab':
        return item.data?.testName || 'Lab result';
      case 'reminders':
        return 'Reminders';
      default:
        return item?.type || 'Care item';
    }
  }

  careNextDetail(item: any): string {
    switch (item?.type) {
      case 'follow_up':
        return `due ${(item.data?.dueAt || '').slice(0, 10) || '—'}`;
      case 'medications':
        return `${item.count || 0} active on record`;
      case 'vaccination':
        return `due ${item.data?.nextDueOn || '—'}`;
      case 'lab':
        return item.data?.resultSummary || 'See diagnostics';
      case 'reminders':
        return `${item.count || 0} open`;
      default:
        return '';
    }
  }

  async selectPet(id: string) {
    this.activePet.set(id);
    await this.load(id);
  }

  async load(petId?: string) {
    this.loading.set(true);
    this.error.set('');
    try {
      const id = petId || this.activePet.get();
      const data = await this.api.home(id);
      this.activePet.syncFromPets(data.pets || [], data.activePet?.id || id);
      this.home.set(data);
      // Show home immediately (esp. empty-pet onboarding) before secondary fetches
      this.loading.set(false);

      const activeId = data.activePet?.id || id;
      if (activeId && (data.pets || []).length) {
        const [hs, cn] = await Promise.all([
          this.api.healthSummary(activeId).catch(() => null),
          this.api.careNext(activeId).catch(() => null),
        ]);
        this.health.set(hs);
        this.careNext.set(cn);
      } else {
        this.health.set(null);
        this.careNext.set(null);
      }
    } catch (e: any) {
      this.error.set(
        e?.status === 401
          ? 'Your session expired — sign in again.'
          : e?.error?.message || 'Couldn’t load your care home. Try again.',
      );
      this.loading.set(false);
    }
  }
}
