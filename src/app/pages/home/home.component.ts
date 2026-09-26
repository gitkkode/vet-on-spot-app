import { AfterViewChecked, Component, ElementRef, HostListener, OnInit, ViewChild, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { BookingGateService } from '../../services/booking-gate.service';
import { filterUpcomingBookings, normalizeBookingsList, bookingBlocksPet } from '../../utils/booking-pending';
import { normalizePetRecord, normalizePetsList, resolvePetPhotoUrl } from '../../utils/pet-photo';
import { displayPetName } from '../../utils/health-records';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-home',
  template: `
    <div class="vos-page home">
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
          <div class="hub__main">
          <header class="stage" aria-label="Your pet">
            <div
              class="stage__pets-wrap"
              [class.stage__pets-wrap--overflow]="petsOverflow()"
              [class.stage__pets-wrap--left]="canScrollPetsLeft()"
              [class.stage__pets-wrap--right]="canScrollPetsRight()"
            >
              @if (canScrollPetsLeft()) {
                <button type="button" class="pets-nav pets-nav--prev" aria-label="Scroll pets left" (click)="scrollPets(-1)">‹</button>
              }
              <div
                class="stage__pets"
                #petsRow
                role="listbox"
                aria-label="Switch pet"
                (scroll)="onPetsScroll()"
              >
                @for (p of h.pets; track p.id) {
                  <button
                    type="button"
                    class="pet-chip"
                    role="option"
                    [attr.aria-selected]="h.activePet?.id === p.id"
                    [class.on]="h.activePet?.id === p.id"
                    [attr.aria-label]="displayPetName(p.name)"
                    (click)="selectPet(p.id)"
                  >
                    <span class="pet-chip__avatar">
                      @if (showPetPhoto(p)) {
                        <img [src]="petPhotoUrl(p)" alt="" (error)="onPetPhotoError(p.id)" />
                      } @else {
                        <span class="ph">{{ petInitial(p.name) }}</span>
                      }
                    </span>
                    <span class="pet-chip__name">{{ displayPetName(p.name) }}</span>
                  </button>
                }
                <a class="pet-add" routerLink="/pets/new" aria-label="Add pet">
                  <span class="pet-add__icon" aria-hidden="true">+</span>
                  <span class="pet-add__label">Add</span>
                </a>
              </div>
              @if (canScrollPetsRight()) {
                <button type="button" class="pets-nav pets-nav--next" aria-label="Scroll pets right" (click)="scrollPets(1)">›</button>
              }
            </div>

            <h1 class="stage__title">
              @if (h.activePet?.name; as petName) {
                How’s {{ displayPetName(petName) }} today?
              } @else {
                {{ h.greeting }}
              }
            </h1>
            <p class="stage__whisper">{{ healthWhisper() }}</p>

            @if (healthSnapshot(); as snaps) {
              @if (snaps.length) {
                <ul class="stats" aria-label="Pet health snapshot">
                  @for (s of snaps; track s.key) {
                    <li>
                      <a class="stat" [routerLink]="s.commands" [queryParams]="s.queryParams || {}">
                        <em>{{ s.label }}</em>
                        <strong>{{ s.value }}</strong>
                      </a>
                    </li>
                  }
                </ul>
              }
            }
          </header>

          @if (nextAction(); as na) {
            <section class="moment" aria-label="Up next">
              <div class="moment__inner">
                <div class="moment__copy">
                  <p class="moment__label">{{ hasUpcoming() ? 'Up next' : 'Suggested for you' }}</p>
                  <strong class="moment__title">{{ na.title }}</strong>
                  <p class="moment__detail">{{ na.detail }}</p>
                  <div class="moment__ctas">
                    <a
                      class="moment__cta"
                      [routerLink]="na.commands"
                      [queryParams]="na.queryParams || {}"
                    >{{ na.cta }}</a>
                    @if (na.secondaryCommands) {
                      <a
                        class="moment__cta moment__cta--ghost"
                        [routerLink]="na.secondaryCommands"
                        [queryParams]="{ edit: '1' }"
                      >{{ na.secondaryCta || 'Modify visit' }}</a>
                    }
                    @if (na.cancelCommands) {
                      <a
                        class="moment__cta moment__cta--ghost moment__cta--cancel"
                        [routerLink]="na.cancelCommands"
                        [queryParams]="{ cancel: '1' }"
                      >{{ na.cancelCta || 'Cancel visit' }}</a>
                    }
                  </div>
                </div>
                <div class="moment__art" aria-hidden="true">
                  <span class="moment__paw"></span>
                </div>
              </div>
            </section>
          }

          <section class="paths" aria-label="Care options">
            <h2 class="sec-h">Care options</h2>
            <div class="paths__row">
              @if (activeVisitForPet(); as visit) {
                <a class="path" [routerLink]="['/bookings', visit.id]">
                  <strong>Open visit</strong>
                  <span>{{ displayPetName(visit.petName, 'Active') }} · already booked</span>
                </a>
              } @else if (bookingBlocked()) {
                <a class="path" routerLink="/bookings">
                  <strong>View appointments</strong>
                  <span>A visit is already booked</span>
                </a>
              } @else {
                <a class="path" routerLink="/book/new" [queryParams]="petQuery()">
                  <strong>Home visit</strong>
                  <span>A vet at your door</span>
                </a>
              }
              <a class="path" routerLink="/televet" [queryParams]="petQuery()">
                <strong>Televet</strong>
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
          </div>

          <aside class="hub__side">
          @if (careBits(); as bits) {
            @if (bits.length) {
              <section class="care" aria-label="Care for your pet">
                <div class="sec-row">
                  <h2 class="sec-h">
                    @if (h.activePet?.name; as n) {
                      Caring for {{ displayPetName(n) }}
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

          <section class="appt-panel" aria-label="Appointments">
            <div class="appt-panel__inner">
              <div class="sec-row appt-panel__head">
                <p class="appt-panel__label">Appointments</p>
                <a class="sec-link" routerLink="/bookings">All</a>
              </div>

              @if (petAppointments(); as appts) {
                @if (appts.length || bookingBlocked()) {
                  @if (appts.length) {
                    <div class="appt-panel__list">
                      @for (b of appts; track b.id) {
                        <div class="upcom__card upcom__card--row">
                          <a class="upcom__main" [routerLink]="['/bookings', b.id]">
                            <span class="upcom__pill">{{ b.customerStatus?.label || b.status }}</span>
                            <strong>{{ appointmentPetLabel(b) }}</strong>
                            <span class="upcom__when">{{ prettyWhen(b.scheduledDate, b.scheduledTime) }}</span>
                          </a>
                          <div class="upcom__acts">
                            <a [routerLink]="['/bookings', b.id]">Open</a>
                            <a [routerLink]="['/bookings', b.id]" [queryParams]="{ cancel: '1' }" class="upcom__cancel">Cancel</a>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <strong class="appt-panel__title">
                      @if (h.activePet?.name; as n) {
                        {{ displayPetName(n) }} already has a visit booked
                      } @else {
                        A visit is already booked for this pet
                      }
                    </strong>
                    <p class="appt-panel__detail">
                      Finish or cancel the existing visit before booking another.
                    </p>
                    <a class="appt-panel__cta" routerLink="/bookings" style="margin-bottom: 12px">
                      View appointments
                    </a>
                  }
                  <button
                    type="button"
                    class="appt-panel__cta appt-panel__cta--disabled"
                    disabled
                    aria-disabled="true"
                    title="This pet already has an upcoming or ongoing appointment"
                  >
                    Book an appointment
                  </button>
                  <p class="appt-panel__hint">
                    Booking is disabled while this pet has an upcoming or ongoing visit.
                  </p>
                } @else {
                  <strong class="appt-panel__title">
                    @if (h.activePet?.name; as n) {
                      No upcoming or ongoing appointments for {{ displayPetName(n) }}
                    } @else {
                      No upcoming or ongoing appointments
                    }
                  </strong>
                  <p class="appt-panel__detail">
                    Schedule a home visit when you’re ready — a vet at your door.
                  </p>
                  <a class="appt-panel__cta" routerLink="/book/new" [queryParams]="petQuery()">
                    Book an appointment
                  </a>
                }
              }
            </div>
          </section>

          <nav class="util" aria-label="More">
            @if (h.activePet?.id; as pid) {
              <a [routerLink]="['/pets', pid]">{{ displayPetName(h.activePet?.name) || 'Pet' }} profile</a>
              <a [routerLink]="['/pets', pid, 'vaccinations']">Vaccines</a>
            }
            <a routerLink="/medications">Medications</a>
            <a routerLink="/assistant" [queryParams]="petQuery()">Ask / Support</a>
            <a routerLink="/notifications">Alerts</a>
          </nav>
          </aside>
        </div>
      }
    }
    </div>
  `,
  styles: [`
    .home { max-width: none; animation: home-in 0.45s var(--vos-ease, ease) both; }
    :host { display: block; }

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
      max-width: none;
      margin: 0;
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
      width: 100%;
      max-width: none;
      margin: 0;
      padding-bottom: 8px;
      display: grid;
      gap: 28px;
    }
    @media (min-width: 1100px) {
      .hub {
        grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.85fr);
        gap: 28px 32px;
        align-items: stretch;
      }
    }
    .hub__main {
      display: grid;
      gap: 24px;
      min-width: 0;
    }
    .hub__side {
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-width: 0;
      min-height: 100%;
      height: 100%;
      align-self: stretch;
    }
    .hub__side > .care,
    .hub__side > .util {
      flex-shrink: 0;
    }
    .hub__main > *,
    .hub__side > * {
      animation: hub-rise 0.5s var(--vs-ease, ease) both;
    }
    .hub__main > *:nth-child(1) { animation-delay: 0.02s; }
    .hub__main > *:nth-child(2) { animation-delay: 0.08s; }
    .hub__main > *:nth-child(3) { animation-delay: 0.14s; }
    .hub__side > *:nth-child(1) { animation-delay: 0.1s; }
    .hub__side > *:nth-child(2) { animation-delay: 0.16s; }

    .hub > * {
      animation: none;
    }

    .stage {
      padding: 2px 0 2px;
      text-align: left;
    }
    .stage__pets-wrap {
      position: relative;
      margin-bottom: 20px;
    }
    .stage__pets-wrap--overflow::before,
    .stage__pets-wrap--overflow::after {
      content: '';
      position: absolute;
      top: 0; bottom: 8px;
      width: 28px;
      z-index: 1;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .stage__pets-wrap--left::before {
      left: 0;
      background: linear-gradient(to right, #FCFCFB 20%, transparent);
      opacity: 1;
    }
    .stage__pets-wrap--right::after {
      right: 0;
      background: linear-gradient(to left, #FCFCFB 20%, transparent);
      opacity: 1;
    }
    .stage__pets {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      overflow-x: auto;
      padding: 4px 2px 8px;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .stage__pets::-webkit-scrollbar { display: none; }
    .pets-nav {
      position: absolute;
      top: 14px;
      z-index: 2;
      width: 32px; height: 32px;
      border-radius: 50%;
      border: 1px solid var(--vos-border);
      background: #fff;
      color: var(--vos-ink);
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(10, 10, 10, 0.08);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .pets-nav--prev { left: 0; }
    .pets-nav--next { right: 0; }

    .stage__title {
      margin: 0;
      font-family: var(--vos-display);
      font-size: clamp(1.95rem, 4.5vw, 2.75rem);
      letter-spacing: -0.045em;
      line-height: 1.08;
      max-width: none;
    }
    .stage__whisper {
      margin: 10px 0 0;
      color: var(--vos-ink-muted);
      font-size: 1.08rem;
      line-height: 1.45;
      max-width: 52ch;
    }

    .stats {
      list-style: none;
      margin: 18px 0 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      padding: 14px 16px;
      border-radius: 16px;
      background: #fff;
      border: 1px solid var(--vos-border);
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s ease, transform 0.15s ease;
      box-shadow: 0 4px 14px rgba(10, 10, 10, 0.03);
    }
    .stat:hover {
      border-color: rgba(253, 74, 41, 0.35);
      transform: translateY(-1px);
    }
    .stat em {
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
    }
    .stat strong {
      font-family: var(--vos-display);
      font-size: 0.95rem;
      letter-spacing: -0.02em;
      font-weight: 700;
      line-height: 1.25;
    }

    .pet-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: 64px;
      border: 0;
      padding: 0;
      background: transparent;
      cursor: pointer;
      flex-shrink: 0;
      scroll-snap-align: start;
      transition: transform 0.18s ease;
    }
    .pet-chip:hover { transform: translateY(-2px); }
    .pet-chip__avatar {
      width: 52px; height: 52px;
      border-radius: 50%;
      border: 2.5px solid transparent;
      overflow: hidden;
      background: #fffef9;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .pet-chip.on .pet-chip__avatar {
      border-color: #FD4A29;
      box-shadow: 0 0 0 4px rgba(253,74,41,0.16);
    }
    .pet-chip__name {
      max-width: 64px;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1.2;
      text-align: center;
      color: var(--vos-ink-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pet-chip.on .pet-chip__name { color: var(--vos-ink); }
    .pet-chip__avatar img {
      width: 100%; height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    .pet-chip__avatar .ph {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--vos-display);
      font-weight: 700; font-size: 1.15rem;
      text-transform: uppercase;
      color: #FD4A29;
      background: var(--vos-brand-soft);
    }
    .pet-add {
      width: 64px;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      color: var(--vos-ink-muted);
      flex-shrink: 0;
      scroll-snap-align: start;
      transition: color 0.18s ease;
    }
    .pet-add__icon {
      width: 52px; height: 52px;
      border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1.5px dashed var(--vos-border);
      background: #fffef9;
      color: var(--vos-ink);
      font-size: 1.35rem;
      font-weight: 600;
      line-height: 1;
      transition: border-color 0.18s ease, color 0.18s ease;
    }
    .pet-add__label {
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1.2;
    }
    .pet-add:hover { color: #FD4A29; }
    .pet-add:hover .pet-add__icon { border-color: #FD4A29; color: #FD4A29; }

    .moment {
      position: relative;
      overflow: hidden;
      border-radius: 28px;
      color: #fff;
      min-height: 200px;
      background:
        radial-gradient(ellipse 90% 100% at 100% -20%, rgba(255,255,255,0.28) 0%, transparent 55%),
        linear-gradient(145deg, #FD4A29 0%, #E03E20 45%, #1a100e 100%);
      box-shadow: 0 22px 48px rgba(253, 74, 41, 0.26);
      transition: transform 0.22s var(--vs-ease, ease);
    }
    .moment:hover { transform: translateY(-3px); }
    .moment__inner {
      position: relative;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: center;
      padding: 32px clamp(22px, 3vw, 36px);
      min-height: 200px;
      box-sizing: border-box;
    }
    @media (max-width: 640px) {
      .moment__inner { grid-template-columns: 1fr; padding: 26px 22px; }
      .moment__art { display: none; }
    }
    .moment__copy { position: relative; z-index: 1; max-width: 48ch; }
    .moment__art {
      width: 110px; height: 110px;
      border-radius: 28px;
      background: rgba(255,255,255,0.12);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .moment__paw {
      width: 42px; height: 42px;
      border-radius: 50% 50% 45% 45%;
      background: rgba(255,255,255,0.35);
      position: relative;
      box-shadow:
        -18px -16px 0 -10px rgba(255,255,255,0.35),
        18px -16px 0 -10px rgba(255,255,255,0.35),
        -22px 2px 0 -12px rgba(255,255,255,0.3),
        22px 2px 0 -12px rgba(255,255,255,0.3);
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
      font-family: var(--vos-display);
      font-size: clamp(1.55rem, 3.2vw, 2.05rem);
      letter-spacing: -0.035em;
      line-height: 1.12;
      max-width: none;
    }
    .moment__detail {
      margin: 10px 0 22px;
      opacity: 0.92;
      font-size: 1.05rem;
      line-height: 1.4;
      max-width: 44ch;
    }
    .moment__cta {
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
    .moment__ctas { display: flex; flex-wrap: wrap; gap: 10px; }
    .moment__cta--ghost {
      background: transparent;
      border: 1.5px solid rgba(255,255,255,0.55);
    }
    .moment__cta--ghost:hover { background: rgba(255,255,255,0.12) !important; }
    .moment__cta--cancel {
      border-color: rgba(255,255,255,0.35);
      opacity: 0.92;
    }
    .moment__cta:hover { background: #1a1a1a; transform: translateY(-1px); }

    .sec-h {
      margin: 0 0 14px;
      font-family: var(--vos-display);
      font-size: 1.25rem;
      letter-spacing: -0.03em;
    }
    .sec-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .sec-row .sec-h { margin: 0; }
    .sec-link {
      font-weight: 700;
      font-size: 13px;
      text-decoration: none;
      color: #FD4A29;
    }

    .paths {
      width: 100%;
    }
    .paths__row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      width: 100%;
    }
    @media (min-width: 700px) {
      .paths__row {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }
    }
    .path {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 22px 20px;
      border-radius: 20px;
      background: #fff;
      border: 1px solid var(--vos-border);
      text-decoration: none;
      color: inherit;
      box-shadow: 0 8px 22px rgba(10, 10, 10, 0.04);
      transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
      min-height: 112px;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .path:hover {
      transform: translateY(-3px);
      border-color: rgba(253, 74, 41, 0.35);
      box-shadow: 0 14px 32px rgba(10, 10, 10, 0.08);
    }
    .path strong {
      font-family: var(--vos-display);
      font-size: 1.12rem;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }
    .path span {
      color: var(--vos-ink-muted);
      font-size: 0.92rem;
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
      padding: 18px 18px 8px;
      border-radius: 20px;
      background: #fff;
      border: 1px solid var(--vos-border);
      box-shadow: 0 8px 22px rgba(10, 10, 10, 0.04);
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

    .appt-panel {
      flex: 1 1 auto;
      padding: 22px 20px;
      border-radius: 20px;
      background: #fff;
      border: 1px solid var(--vos-border);
      box-shadow: 0 8px 22px rgba(10, 10, 10, 0.04);
      min-height: min(420px, 55vh);
      display: flex;
      align-items: stretch;
    }
    @media (min-width: 1100px) {
      .appt-panel {
        min-height: 0;
      }
    }
    .appt-panel__inner {
      display: flex;
      flex-direction: column;
      width: 100%;
      box-sizing: border-box;
      min-height: 100%;
    }
    .appt-panel__head {
      margin-bottom: 14px;
    }
    .appt-panel__label {
      margin: 0;
      font-family: var(--vos-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
    }
    .appt-panel__list {
      display: grid;
      gap: 8px;
      flex: 1 1 auto;
      align-content: start;
      margin-bottom: 18px;
    }
    .appt-panel__title {
      display: block;
      font-family: var(--vos-display);
      font-size: 1.15rem;
      letter-spacing: -0.025em;
      line-height: 1.25;
      margin: auto 0 8px;
    }
    .appt-panel__detail {
      margin: 0 0 auto;
      color: var(--vos-ink-muted);
      font-size: 0.92rem;
      line-height: 1.4;
      max-width: 32ch;
      padding-bottom: 20px;
    }
    .appt-panel__cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      align-self: flex-start;
      margin-top: auto;
      min-height: 44px;
      padding: 10px 18px;
      border-radius: 999px;
      border: 0;
      background: #0a0a0a;
      color: #fff;
      font-weight: 700;
      font-size: 0.95rem;
      font-family: inherit;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.18s ease, transform 0.18s ease;
    }
    .appt-panel__cta:hover {
      background: #1a1a1a;
      transform: translateY(-1px);
    }
    .appt-panel__cta--disabled,
    .appt-panel__cta--disabled:hover {
      background: #c8c4bc;
      color: #fff;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .appt-panel__hint {
      margin: 10px 0 0;
      color: var(--vos-ink-muted);
      font-size: 0.85rem;
      line-height: 1.4;
      max-width: 36ch;
    }

    .upcom {
      padding: 18px;
      border-radius: 20px;
      background: #fff;
      border: 1px solid var(--vos-border);
      box-shadow: 0 8px 22px rgba(10, 10, 10, 0.04);
    }
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
    .upcom__card--row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      grid-template-columns: unset;
      grid-template-rows: unset;
    }
    .upcom__card:hover {
      transform: translateY(-2px);
      border-color: rgba(253, 74, 41, 0.3);
    }
    .upcom__main {
      display: grid;
      gap: 2px;
      text-decoration: none;
      color: inherit;
      min-width: 0;
    }
    .upcom__pill {
      font-family: var(--vos-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #FD4A29;
      margin-bottom: 2px;
    }
    .upcom__card strong,
    .upcom__main strong {
      font-family: var(--vos-display);
      font-size: 1.02rem;
      letter-spacing: -0.02em;
    }
    .upcom__when {
      color: var(--vos-ink-muted);
      font-size: 0.88rem;
    }
    .upcom__acts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .upcom__acts a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: none;
      background: #0a0a0a;
      color: #fff;
    }
    .upcom__acts .upcom__cancel {
      background: transparent;
      color: #B42318;
      border: 1px solid rgba(180, 35, 24, 0.35);
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
      gap: 8px 14px;
      justify-content: flex-start;
      padding: 14px 16px;
      border-radius: 16px;
      background: #F7F7F5;
      border: 1px solid var(--vos-border);
      margin-top: auto;
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
export class HomeComponent implements OnInit, AfterViewChecked {
  @ViewChild('petsRow') petsRow?: ElementRef<HTMLDivElement>;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly home = signal<any>(null);
  readonly health = signal<any>(null);
  readonly careNext = signal<any>(null);
  readonly brokenPhotos = signal<Set<string>>(new Set());
  readonly petsOverflow = signal(false);
  readonly canScrollPetsLeft = signal(false);
  readonly canScrollPetsRight = signal(false);
  private petsOverflowDirty = false;

  constructor(
    private readonly api: CustomerApiService,
    private readonly activePet: ActivePetService,
    private readonly bookingGate: BookingGateService,
  ) {}

  ngOnInit() {
    void this.load();
  }

  ngAfterViewChecked() {
    if (this.petsOverflowDirty) {
      this.petsOverflowDirty = false;
      this.updatePetsOverflow();
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.updatePetsOverflow();
  }

  splashGreeting(greeting: string | null | undefined): string {
    const g = String(greeting || 'Welcome').trim();
    return g.replace(/\.$/, '');
  }

  firstName(greeting: string | null | undefined): string {
    const g = String(greeting || '').trim();
    const m = g.match(/,\s*([^.,]+)/);
    if (m?.[1]) return this.displayPetName(m[1].trim());
    const customer = this.home()?.customer;
    const fromProfile = String(customer?.fullName || '').trim().split(/\s+/)[0];
    return this.displayPetName(fromProfile || 'there');
  }

  displayPetName(name: string | null | undefined, fallback = 'Pet'): string {
    return displayPetName(name, fallback);
  }

  petInitial(name: string | null | undefined): string {
    const n = String(name || '?').trim();
    return (n.charAt(0) || '?').toUpperCase();
  }

  showPetPhoto(p: { id?: string; photoUrl?: string | null } | null | undefined): boolean {
    const url = this.petPhotoUrl(p);
    return !!(url && p?.id && !this.brokenPhotos().has(p.id));
  }

  petPhotoUrl(p: { photoUrl?: string | null } | null | undefined): string {
    return resolvePetPhotoUrl(p);
  }

  onPetPhotoError(id: string) {
    if (!id) return;
    this.brokenPhotos.update((set) => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
  }

  onPetsScroll() {
    this.updatePetsOverflow();
  }

  scrollPets(dir: -1 | 1) {
    const el = this.petsRow?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  }

  private updatePetsOverflow() {
    const el = this.petsRow?.nativeElement;
    if (!el) {
      this.petsOverflow.set(false);
      this.canScrollPetsLeft.set(false);
      this.canScrollPetsRight.set(false);
      return;
    }
    const overflow = el.scrollWidth > el.clientWidth + 4;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    if (this.petsOverflow() !== overflow) this.petsOverflow.set(overflow);
    if (this.canScrollPetsLeft() !== left) this.canScrollPetsLeft.set(left);
    if (this.canScrollPetsRight() !== (overflow && right)) this.canScrollPetsRight.set(overflow && right);
  }

  petQuery(): Record<string, string> {
    const id = this.home()?.activePet?.id || this.activePet.get();
    return id ? { petId: String(id) } : {};
  }

  dueDate(v: string | null | undefined) {
    return (v || '').slice(0, 10) || '—';
  }

  healthWhisper(): string {
    const h = this.home();
    const hs = this.health();
    const petRaw = h?.activePet?.name;
    const pet = petRaw ? this.displayPetName(petRaw) : 'your pet';
    const up = this.petAppointments()[0];
    if (up) {
      return `${pet} has a visit ${this.prettyWhen(up.scheduledDate, up.scheduledTime)}.`;
    }
    const med = hs?.careStatus?.activeMedications?.[0];
    if (med) {
      const who = med.petName ? this.displayPetName(med.petName) : pet;
      return `${med.medicine} is on today’s list for ${who}.`;
    }
    const fu = hs?.careStatus?.upcomingFollowUp;
    if (fu) return `A follow-up is coming up${fu.dueAt ? ` · ${String(fu.dueAt).slice(0, 10)}` : ''}.`;
    const vax = hs?.careStatus?.nextVaccination;
    if (vax) return `${vax.vaccineName} is next on the calendar.`;
    if (h?.healthHint) return h.healthHint;
    return `We’re here whenever ${pet} needs a vet at home.`;
  }

  healthSnapshot(): Array<{
    key: string;
    label: string;
    value: string;
    commands: any[];
    queryParams?: Record<string, string>;
  }> {
    const h = this.home();
    const hs = this.health();
    if (!h?.pets?.length) return [];
    const snaps: Array<{
      key: string;
      label: string;
      value: string;
      commands: any[];
      queryParams?: Record<string, string>;
    }> = [];

    const up = this.petAppointments()[0];
    if (up) {
      snaps.push({
        key: 'appt',
        label: 'Next visit',
        value: this.prettyWhen(up.scheduledDate, up.scheduledTime),
        commands: ['/bookings', up.id],
      });
    } else if (this.bookingBlocked()) {
      snaps.push({
        key: 'appt',
        label: 'Next visit',
        value: 'Already booked',
        commands: ['/bookings'],
      });
    } else {
      snaps.push({
        key: 'appt',
        label: 'Next visit',
        value: 'None scheduled',
        commands: ['/book/new'],
        queryParams: this.petQuery(),
      });
    }

    const vax = hs?.careStatus?.nextVaccination;
    if (vax) {
      snaps.push({
        key: 'vax',
        label: 'Next vaccine',
        value: `${vax.vaccineName} · ${vax.nextDueOn || 'soon'}`,
        commands: h.activePet?.id ? ['/pets', h.activePet.id, 'vaccinations'] : ['/reminders'],
      });
    }

    const med = hs?.careStatus?.activeMedications?.[0] || h.medications?.[0];
    if (med) {
      snaps.push({
        key: 'med',
        label: 'Medication',
        value: med.medicine || 'Active meds',
        commands: ['/medications'],
      });
    }

    const recent = h.recentVisit;
    if (recent && snaps.length < 3) {
      snaps.push({
        key: 'recent',
        label: 'Last visit',
        value: this.formatVisitWhen(recent.date || recent.occurredAt) || recent.title || 'Recent',
        commands: this.visitLink(recent),
      });
    }

    return snaps.slice(0, 3);
  }

  hasUpcoming(): boolean {
    return this.petAppointments().length > 0 || this.bookingBlocked();
  }

  bookingBlocked(): boolean {
    if (this.petAppointments().length > 0) return true;
    const h = this.home();
    return this.bookingGate.isBlocked(h?.activePet?.id, h?.activePet?.name);
  }

  activeVisitForPet(): any | null {
    return this.petAppointments()[0] || null;
  }

  /**
   * Upcoming / ongoing visits for the selected pet.
   * Home is loaded with ?petId=, but API items often omit petId / use a generic
   * petName like "Visit" — so we attribute unmatched items to the active pet
   * when they don't clearly belong to another pet in the household.
   */
  petAppointments(): any[] {
    const h = this.home();
    const list: any[] = h?.upcoming || [];
    if (!list.length) return [];

    const active = h?.activePet;
    const petId = String(active?.id || '').trim();
    const petName = this.normPetName(active?.name);
    if (!petId && !petName) return list.slice(0, 4);

    const matched = list.filter((u) => this.bookingBelongsToPet(u, petId, petName));
    if (matched.length) return matched;

    const otherPets: Array<{ id?: string; name?: string }> = (h?.pets || []).filter(
      (p: any) => String(p?.id || '') !== petId,
    );
    const orphans = list.filter((u) => {
      if (this.bookingBelongsToPet(u, petId, petName)) return true;
      // Clearly tagged for another pet → skip
      for (const o of otherPets) {
        if (this.bookingBelongsToPet(u, String(o.id || ''), this.normPetName(o.name))) {
          return false;
        }
      }
      // No usable identity (or generic "Visit") → treat as this pet's when home is pet-scoped
      const bid = String(u?.petId || u?.pet?.id || '').trim();
      const bName = this.normPetName(u?.petName);
      if (bid) return false;
      if (!bName || bName === 'visit' || bName === 'pet' || bName === 'your pet') return true;
      return false;
    });
    return orphans;
  }

  private bookingBelongsToPet(b: any, petId: string, petName: string): boolean {
    return bookingBlocksPet(b, petId, petName);
  }

  private normPetName(name: string | null | undefined): string {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  /** Prefer the active pet’s name when the booking label is missing/generic. */
  appointmentPetLabel(b: any): string {
    const raw = String(b?.petName || '').trim();
    const n = this.normPetName(raw);
    if (raw && n && n !== 'visit' && n !== 'pet' && n !== 'your pet' && n !== 'home visit') {
      return this.displayPetName(raw);
    }
    return this.displayPetName(this.home()?.activePet?.name) || 'Home visit';
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
        detail: `${this.formatVisitWhen(h.recentVisit.date || h.recentVisit.occurredAt)}${
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
    secondaryCommands?: any[];
    secondaryCta?: string;
    cancelCommands?: any[];
    cancelCta?: string;
  } | null {
    const h = this.home();
    const hs = this.health();
    if (!h?.pets?.length) return null;

    const up = this.petAppointments()[0];
    if (up?.id) {
      const pet = this.displayPetName(h.activePet?.name || up.petName || 'Your pet');
      return {
        title: `${pet}’s home visit`,
        detail: `${up.customerStatus?.label || 'Scheduled'} · ${this.prettyWhen(up.scheduledDate, up.scheduledTime)}`,
        commands: ['/bookings', up.id],
        cta: 'Open visit',
        secondaryCommands: ['/bookings', up.id],
        secondaryCta: 'Modify visit',
        cancelCommands: ['/bookings', up.id],
        cancelCta: 'Cancel visit',
      };
    }

    // Gate says blocked even when home upcoming list didn't match — don't offer Book
    if (this.bookingBlocked()) {
      const pet = this.displayPetName(h.activePet?.name || 'Your pet');
      return {
        title: `${pet} already has a visit`,
        detail: 'Finish or cancel the existing appointment before booking another.',
        commands: ['/bookings'],
        cta: 'View appointments',
      };
    }

    const med = hs?.careStatus?.activeMedications?.[0] || h.medications?.[0];
    if (med) {
      return {
        title: `Time for ${med.medicine}`,
        detail: `${this.displayPetName(med.petName || h.activePet?.name || 'Your pet')} · ${med.frequency || 'Today'}`,
        commands: ['/medications'],
        cta: 'Open medications',
      };
    }
    const fu = hs?.careStatus?.upcomingFollowUp || h.followUps?.[0];
    if (fu) {
      return {
        title: fu.reason || 'Follow-up due',
        detail: `${this.displayPetName(fu.petName || h.activePet?.name || '')} · ${(fu.dueAt || '').slice(0, 10)}`,
        commands: ['/follow-ups'],
        cta: 'View follow-up',
      };
    }
    const vax = hs?.careStatus?.nextVaccination;
    if (vax && h.activePet?.id) {
      return {
        title: `${vax.vaccineName} coming up`,
        detail: `Due ${vax.nextDueOn || 'soon'} for ${this.displayPetName(h.activePet.name)}`,
        commands: ['/pets', h.activePet.id, 'vaccinations'],
        cta: 'View vaccines',
      };
    }
    if (h.activePet?.id) {
      const pet = this.displayPetName(h.activePet.name);
      return {
        title: `Ready when ${pet} needs you`,
        detail: 'Book a vet at your door, or talk through what’s going on.',
        commands: ['/book/new'],
        queryParams: { petId: h.activePet.id },
        cta: `Schedule ${pet}’s checkup`,
      };
    }
    return {
      title: 'Ready for a home visit?',
      detail: 'A vet at your door — pick a time that works.',
      commands: ['/book/new'],
      cta: 'Schedule a checkup',
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

  formatVisitWhen(raw?: string | null): string {
    if (!raw) return '';
    const s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return this.prettyWhen(s);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return this.prettyWhen(s.slice(0, 10));
    return s;
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
      const pets = normalizePetsList(data.pets || []);
      const activePet = normalizePetRecord(data.activePet) || data.activePet;
      this.activePet.syncFromPets(pets, activePet?.id || id);
      const upcoming = filterUpcomingBookings(
        normalizeBookingsList(data.upcoming || data.bookings || []),
      ).filter((b) => {
        const when = b?.scheduledDate || b?.preferredDate;
        if (!when) return true;
        const t = new Date(String(when).includes('T') ? when : `${String(when).slice(0, 10)}T12:00:00`).getTime();
        return Number.isNaN(t) || t >= Date.now() - 4 * 3600 * 1000;
      });
      this.home.set({
        ...data,
        pets,
        activePet,
        upcoming,
      });
      this.brokenPhotos.set(new Set());
      this.petsOverflowDirty = true;
      // Sync Book CTAs from full bookings list — never clear blocks when home
      // upcoming is empty/mismatched (that was re-enabling Book incorrectly).
      void this.bookingGate.refresh().then(() => {
        const active = this.home()?.activePet;
        if (this.petAppointments().length > 0) {
          this.bookingGate.markPetBlocked(active?.id, active?.name);
        }
      });
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
        this.petsOverflowDirty = true;
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
