import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { BookingGateService } from '../../services/booking-gate.service';
import { VosDatePickerComponent } from '../../shared/vos-date-picker.component';
import { VosSelectComponent, VosSelectOption } from '../../shared/vos-select.component';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';
import { displayPetName, titleCase } from '../../utils/health-records';
import {
  applyPendingEditToBooking,
  markBookingSuperseded,
  readPendingEdit,
  writePendingEdit,
  type PendingBookingEdit,
} from '../../utils/booking-pending';

const CONSULT_FEE = '₹799';

/** Same slots as the booking wizard — only these times can be chosen. */
const TIME_SLOTS = [
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '2:00 PM',
  '4:00 PM',
  '6:00 PM',
  '8:00 PM',
];

type PendingEdit = PendingBookingEdit;

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, VosDatePickerComponent, VosSelectComponent, VosBackButtonComponent],
  selector: 'app-booking-detail',
  template: `
    <vos-back-button [fallback]="'/bookings'" fallbackLabel="Appointments" />

    @if (loading()) {
      <div class="vos-skel vos-skel--gloss hero-skel"></div>
      <div class="vos-skel vos-skel--gloss chip-skel"></div>
      <div class="vos-skel vos-skel--gloss"></div>
    } @else if (error()) {
      <div class="err-panel" role="alert">
        <p class="err-panel__title">Couldn’t open this appointment</p>
        <p class="err-panel__body">{{ error() }}</p>
        <div class="err-panel__actions">
          <button type="button" class="err-panel__retry" (click)="load()">Try again</button>
          <a routerLink="/home" class="err-panel__home">Back home</a>
        </div>
      </div>
    } @else if (b(); as booking) {
      @if (justBooked()) {
        <div class="toast-ok" role="status">You’re booked — we’ll nudge you here as things move.</div>
      }
      @if (uploadWarn()) {
        <div class="toast-warn" role="status">{{ uploadWarn() }}</div>
      }
      @if (editOk()) {
        <div class="toast-ok" role="status">{{ editOk() }}</div>
      }
      @if (pendingChange()) {
        <div class="pending-banner" role="status">
          Sent to care team — they’ll update the visit for
          <strong>{{ prettyDate(pendingChange()!.preferredDate) }}</strong>
          at
          <strong>{{ pendingChange()!.preferredTime }}</strong>
          @if (pendingChange()!.ticketId) {
            <span class="pending-banner__ticket"> · Ticket {{ pendingChange()!.ticketId }}</span>
          }
        </div>
      }

      <header
        class="hero"
        [class.hero--live]="journeyLive()"
        [class.hero--flash]="freshFlash()"
      >
        <div class="hero__glow" aria-hidden="true"></div>
        <div class="hero__orb hero__orb--a" aria-hidden="true"></div>
        <div class="hero__orb hero__orb--b" aria-hidden="true"></div>
        <div class="hero__top">
          <p class="hero__kicker">Home visit</p>
          @if (countdown()) {
            <span class="countdown" [class.countdown--soon]="countdownSoon()">{{ countdown() }}</span>
          }
        </div>
        <h1>{{ displayPetName(booking.petName) }}</h1>
        <span class="pill" [class.pill--pulse]="journeyLive()">
          <span class="pill__dot" aria-hidden="true"></span>
          {{ booking.customerStatus?.label || booking.status || 'Received' }}
        </span>
        <p class="hero__detail">
          {{ booking.customerStatus?.detail || 'We’re lining up the right vet for you.' }}
        </p>
        <div class="hero__foot">
          <p class="hero__when">
            <strong>{{ prettyDate(booking.scheduledDate) }}</strong>
            <span>·</span>
            <strong>{{ booking.scheduledTime || '—' }}</strong>
          </p>
          <button type="button" class="fresh" (click)="load()" [disabled]="refreshing()">
            <span class="fresh__dot" [class.fresh__dot--spin]="refreshing()" aria-hidden="true"></span>
            {{ refreshing() ? 'Updating…' : freshness() }}
          </button>
        </div>
        @if (progressPct() > 0) {
          <div class="hero__bar" aria-hidden="true">
            <span [style.width.%]="progressPct()"></span>
          </div>
        }
      </header>

      @if (booking.paymentStatus === 'failed') {
        <div class="vos-err">
          Payment didn’t go through — the visit is still listed.
          <a routerLink="/support" [queryParams]="{ bookingId: booking.id }">Get help</a>
        </div>
      }

      <section class="facts" aria-label="Visit details">
        <button type="button" class="fact" style="--i: 0" (click)="nudgeFact(0)" [class.fact--tap]="tappedFact() === 0">
          <em>Where</em>
          <strong>{{ titleCase(booking.location) || 'Address pending' }}</strong>
        </button>
        <button type="button" class="fact" style="--i: 1" (click)="nudgeFact(1)" [class.fact--tap]="tappedFact() === 1">
          <em>Doctor</em>
          <strong>{{ doctorLabel(booking) }}</strong>
        </button>
        <button type="button" class="fact" style="--i: 2" (click)="nudgeFact(2)" [class.fact--tap]="tappedFact() === 2">
          <em>Why</em>
          <strong>{{ prettyReason(booking.reason) }}</strong>
        </button>
        <button type="button" class="fact fact--pay" style="--i: 3" (click)="nudgeFact(3)" [class.fact--tap]="tappedFact() === 3">
          <em>Pay</em>
          <strong class="pay" [class.pay--open]="isUnpaid(booking.paymentStatus)">
            {{ prettyPay(booking.paymentStatus) }}
          </strong>
          @if (isUnpaid(booking.paymentStatus) && booking.paymentStatus !== 'failed') {
            <span class="fact__hint">Base fee {{ consultFee }} · when the vet arrives</span>
          }
        </button>
      </section>

      <div class="ref-row">
        <p class="ref">
          <span class="ref__label">Ref</span>
          <code class="ref__id">{{ booking.id }}</code>
        </p>
        <button
          type="button"
          class="ref-copy"
          [class.ref-copy--ok]="copied()"
          (click)="copyRef(booking.id)"
          [attr.aria-label]="copied() ? 'Copied' : 'Copy booking reference'"
        >
          {{ copied() ? 'Copied ✓' : 'Copy' }}
        </button>
      </div>

      <section class="manage" aria-label="Manage this visit">
        <h2>Take care of it</h2>
        <div class="manage__grid">
          @if (canLiveTrack()) {
            <a
              class="act act--primary"
              style="--i: 0"
              [routerLink]="['/bookings', booking.id, 'track']"
            >
              <span class="act__live" aria-hidden="true">
                <span></span><span></span><span></span>
              </span>
              <span class="act__eyebrow">Live</span>
              <span class="act__title">Track visit</span>
              <span class="act__sub">Live status as the doctor heads over</span>
              <span class="act__arrow" aria-hidden="true">→</span>
            </a>
          } @else {
            <div class="act act--muted" style="--i: 0" aria-disabled="true">
              <span class="act__eyebrow">Soon</span>
              <span class="act__title">Track visit</span>
              <span class="act__sub">Available once your vet is on the way</span>
            </div>
          }
          <button type="button" class="act" style="--i: 1" (click)="openEdit()" [disabled]="!canModify(booking)">
            <span class="act__title">Modify visit</span>
            <span class="act__sub">Change time, address, or reason</span>
          </button>
          @if (canCancel(booking)) {
            <button type="button" class="act act--danger" style="--i: 1b" (click)="openCancel()">
              <span class="act__title">Cancel appointment</span>
              <span class="act__sub">Stop this visit — you can book again later</span>
            </button>
          }
          <a class="act" style="--i: 2" routerLink="/televet" [queryParams]="petQ(booking)">
            <span class="act__title">Talk to a vet</span>
            <span class="act__sub">Quick consult while you wait</span>
          </a>
          <a class="act" style="--i: 3" routerLink="/intake" [queryParams]="petQ(booking)">
            <span class="act__title">Something changed?</span>
            <span class="act__sub">Update how {{ displayPetName(booking.petName, 'they') }} is feeling</span>
          </a>
          <a class="act" style="--i: 4" routerLink="/support" [queryParams]="{ bookingId: booking.id }">
            <span class="act__title">Need help</span>
            <span class="act__sub">Ask us anything about this visit</span>
          </a>
          @if (visitId()) {
            <a class="act" style="--i: 5" [routerLink]="['/visits', visitId()]">
              <span class="act__title">Visit summary</span>
              <span class="act__sub">Notes from the appointment</span>
            </a>
          }
          @if (booking.petId) {
            <a class="act" style="--i: 6" [routerLink]="['/pets', booking.petId, 'health']">
              <span class="act__title">Health story</span>
              <span class="act__sub">Meds, vaccines, and history</span>
            </a>
          }
        </div>
      </section>

      @if (editOpen()) {
        <div class="modal-layer" role="presentation" (click)="closeEdit()">
          <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            (click)="$event.stopPropagation()"
          >
            <h2 id="edit-title">Modify visit</h2>
            <p>Update the details below. We’ll notify the care team.</p>
            <label class="modal__field">
              <span>Date</span>
              <vos-date-picker
                name="editDate"
                [(ngModel)]="editDate"
                [min]="minEditDate"
                placeholder="Pick a future date"
                (ngModelChange)="onEditDateChange($event)"
              />
            </label>
            <label class="modal__field">
              <span>Time</span>
              <vos-select
                name="editTime"
                [options]="availableTimeOptions()"
                [(ngModel)]="editTime"
                placeholder="Select a time slot"
                ariaLabel="Visit time slot"
              />
              @if (editDate === minEditDate) {
                <em class="modal__hint">Past times for today aren’t available.</em>
              }
            </label>
            <label class="modal__field">
              <span>Address</span>
              <textarea [(ngModel)]="editAddress" name="editAddress" rows="2"></textarea>
            </label>
            <label class="modal__field">
              <span>Reason</span>
              <input type="text" [(ngModel)]="editReason" name="editReason" />
            </label>
            @if (editError()) {
              <p class="modal__err" role="alert">{{ editError() }}</p>
            }
            <div class="modal__actions">
              <button type="button" class="ghost" (click)="closeEdit()">Back</button>
              <button
                type="button"
                class="btn"
                [disabled]="editSaving()"
                (click)="saveEdit()"
              >
                {{ editSaving() ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (cancelOpen()) {
        <div class="modal-layer" role="presentation" (click)="closeCancel()">
          <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            (click)="$event.stopPropagation()"
          >
            <h2 id="cancel-title">Cancel this appointment?</h2>
            <p>
              This will cancel
              <strong>{{ displayPetName(booking.petName, 'your pet') }}’s</strong>
              visit on
              <strong>{{ prettyDate(booking.scheduledDate) }}</strong>
              @if (booking.scheduledTime) {
                at <strong>{{ booking.scheduledTime }}</strong>
              }.
              You can book again anytime.
            </p>
            <label class="modal__field">
              <span>Reason (optional)</span>
              <input
                type="text"
                [(ngModel)]="cancelReason"
                name="cancelReason"
                placeholder="e.g. Pet feeling better, schedule conflict"
              />
            </label>
            @if (cancelError()) {
              <p class="modal__err" role="alert">{{ cancelError() }}</p>
            }
            <div class="modal__actions">
              <button type="button" class="ghost" (click)="closeCancel()" [disabled]="cancelling()">
                Keep visit
              </button>
              <button
                type="button"
                class="btn btn--danger"
                [disabled]="cancelling()"
                (click)="confirmCancel()"
              >
                {{ cancelling() ? 'Cancelling…' : 'Cancel appointment' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (suggestedDoctor(); as doc) {
        <section class="match">
          <p class="match__label">{{ booking.assignedDoctor ? 'Assigned vet' : 'Suggested match' }}</p>
          <h3>{{ doc.name }}</h3>
          <p class="match__meta">{{ matchMeta(doc) }}</p>
          @if (match()?.alternatives?.length) {
            <p class="match__alts">Also in range: {{ altNames(match().alternatives) }}</p>
          }
        </section>
      }

      <section class="journey" aria-label="Visit journey">
        <div class="journey__head">
          <h2>How it’s going</h2>
          @if (journeyLive()) {
            <span class="live-tag" aria-live="polite">In progress</span>
          } @else if (progressPct() > 0) {
            <span class="pct-tag">{{ progressPct() }}%</span>
          }
        </div>

        @if (journey()?.steps?.length) {
          <div class="progress" role="progressbar" [attr.aria-valuenow]="progressPct()" aria-valuemin="0" aria-valuemax="100">
            <div class="progress__track">
              <div class="progress__fill" [style.width.%]="progressPct()"></div>
            </div>
            <p class="progress__label">{{ progressLabel() }}</p>
          </div>

          <ol class="steps">
            @for (s of journey().steps; track s.code; let i = $index) {
              <li
                [class]="'steps__item steps__item--' + (s.state || 'todo')"
                [style.--i]="i"
                (click)="focusStep(i)"
                [class.steps__item--focus]="focusedStep() === i"
              >
                <span class="steps__rail" aria-hidden="true">
                  <span class="steps__dot">
                    @if (s.state === 'done') { ✓ } @else { {{ i + 1 }} }
                  </span>
                </span>
                <div class="steps__body">
                  <strong>{{ s.label }}</strong>
                  @if ((s.state === 'current' || focusedStep() === i) && s.detail) {
                    <span class="steps__detail">{{ s.detail }}</span>
                  }
                </div>
              </li>
            }
          </ol>
        } @else if (booking.history?.length) {
          <ul class="hist">
            @for (h of booking.history; track h.time + h.label) {
              <li><time>{{ h.time }}</time> {{ h.label }}</li>
            }
          </ul>
        } @else {
          <p class="empty-j">Updates will show up here as your visit progresses.</p>
        }
      </section>

      @if (bookingBlocked(booking)) {
        <span
          class="again again--disabled"
          title="This pet already has an upcoming or ongoing appointment"
        >Book another visit →</span>
      } @else {
        <a class="again" routerLink="/book/new" [queryParams]="petQ(booking)">Book another visit →</a>
      }
    }
  `,
  styles: [`
    :host {
      display: block;
      font-family: var(--vos-font);
    }

    .back {
      display: none;
    }

    .linkish {
      border: 0; background: none; color: inherit; font-weight: 700; cursor: pointer; text-decoration: underline;
    }

    .err-panel {
      margin: 12px 0 24px;
      padding: 28px 24px;
      border-radius: 22px;
      background: linear-gradient(180deg, #fffef9 0%, #fff5f3 100%);
      border: 1px solid rgba(180, 35, 24, 0.16);
      box-shadow: 0 12px 32px rgba(10, 10, 10, 0.04);
      max-width: 520px;
    }
    .err-panel__title {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.03em;
    }
    .err-panel__body {
      margin: 0 0 18px;
      color: var(--vos-ink-muted);
      line-height: 1.45;
      font-size: 1rem;
    }
    .err-panel__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .err-panel__retry {
      min-height: 44px;
      padding: 10px 18px;
      border: 0;
      border-radius: 999px;
      background: #0a0a0a;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    .err-panel__home {
      font-weight: 700;
      text-decoration: none;
      color: #FD4A29;
      padding: 10px 8px;
    }

    .hero-skel { height: 220px; margin-bottom: 12px; border-radius: 28px; }
    .chip-skel { height: 96px; margin-bottom: 12px; border-radius: 18px; }

    .toast-ok {
      margin: 0 0 14px;
      padding: 12px 16px;
      border-radius: 14px;
      background: #ecf8f0;
      border: 1px solid rgba(31, 122, 76, 0.25);
      color: #1f7a4c;
      font-weight: 600;
    }
    .toast-warn {
      margin: 0 0 14px;
      padding: 12px 16px;
      border-radius: 14px;
      background: #fff7ed;
      border: 1px solid rgba(253, 74, 41, 0.28);
      color: var(--vos-ink);
      font-weight: 600;
      line-height: 1.4;
    }
    .pending-banner {
      margin: 0 0 14px;
      padding: 12px 16px;
      border-radius: 14px;
      background: #fff7ed;
      border: 1px solid rgba(253, 74, 41, 0.28);
      color: var(--vos-ink);
      font-weight: 600;
      line-height: 1.4;
    }
    .pending-banner__ticket {
      font-weight: 700;
      color: var(--vos-brand, #FD4A29);
    }

    .hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      border-radius: 28px;
      padding: 26px 22px 22px;
      margin-bottom: 18px;
      color: #fff;
      background: linear-gradient(145deg, #FD4A29 0%, #E03E20 42%, #1a100e 100%);
      box-shadow: 0 20px 48px rgba(253, 74, 41, 0.28);
      animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      transition: box-shadow 0.35s ease;
    }
    .hero--live {
      box-shadow: 0 20px 48px rgba(253, 74, 41, 0.34), 0 0 0 1px rgba(255,255,255,0.08) inset;
    }
    .hero--flash {
      animation: heroFlash 0.7s ease;
    }
    .hero__glow {
      position: absolute; inset: auto -20% -40% -20%;
      height: 70%;
      background: radial-gradient(ellipse at center, rgba(255,255,255,0.16), transparent 70%);
      pointer-events: none;
      animation: glowDrift 8s ease-in-out infinite alternate;
    }
    .hero__orb {
      position: absolute; border-radius: 50%;
      background: rgba(255,255,255,0.12); pointer-events: none;
    }
    .hero__orb--a {
      right: -36px; top: -44px;
      width: 150px; height: 150px;
      animation: orbFloat 7s ease-in-out infinite alternate;
    }
    .hero__orb--b {
      left: -28px; bottom: -50px;
      width: 110px; height: 110px;
      opacity: 0.7;
      animation: orbFloat 9s ease-in-out infinite alternate-reverse;
    }
    .hero__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .hero__kicker {
      margin: 0;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0.85;
      font-weight: 600;
    }
    .countdown {
      flex-shrink: 0;
      font-family: var(--vos-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.16);
      backdrop-filter: blur(6px);
    }
    .countdown--soon {
      background: rgba(255,255,255,0.28);
      animation: soonPulse 1.8s ease-in-out infinite;
    }
    .hero h1 {
      margin: 0 0 14px;
      font-family: var(--vos-display);
      font-size: clamp(2rem, 6vw, 2.75rem);
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 30px;
      padding: 4px 12px 4px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.18);
      font-weight: 700;
      font-size: 0.9rem;
      backdrop-filter: blur(6px);
    }
    .pill__dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(255,255,255,0.75);
      flex-shrink: 0;
    }
    .pill--pulse {
      box-shadow: 0 0 0 0 rgba(255,255,255,0.45);
      animation: pillPulse 2s ease-out infinite;
    }
    .pill--pulse .pill__dot {
      background: #fff;
      animation: dotPulse 1.6s ease-in-out infinite;
    }
    .hero__detail {
      margin: 12px 0 0;
      opacity: 0.92;
      font-size: 1.05rem;
      line-height: 1.4;
      max-width: 36ch;
    }
    .hero__foot {
      margin-top: 16px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .hero__when {
      margin: 0;
      display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline;
      font-size: 1.12rem;
    }
    .hero__when span { opacity: 0.55; }
    .fresh {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 0;
      background: rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.9);
      font-family: var(--vos-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 7px 10px;
      border-radius: 999px;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .fresh:hover { background: rgba(255,255,255,0.2); }
    .fresh:active { transform: scale(0.97); }
    .fresh:disabled { opacity: 0.75; cursor: wait; }
    .fresh__dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #86efac;
      box-shadow: 0 0 0 0 rgba(134, 239, 172, 0.5);
    }
    .fresh__dot--spin {
      background: transparent;
      border: 1.5px solid rgba(255,255,255,0.85);
      border-top-color: transparent;
      animation: spin 0.7s linear infinite;
    }
    .hero__bar {
      position: absolute;
      left: 0; right: 0; bottom: 0;
      height: 4px;
      background: rgba(255,255,255,0.12);
    }
    .hero__bar span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #fff, rgba(255,255,255,0.55));
      transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .facts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    @media (min-width: 720px) {
      .facts { grid-template-columns: repeat(4, 1fr); }
    }
    .fact {
      appearance: none;
      text-align: left;
      font: inherit;
      cursor: pointer;
      background: #fffef9;
      border: 1px solid var(--vos-border, #e8e0d4);
      border-radius: 18px;
      padding: 14px 14px 16px;
      box-shadow: 0 8px 22px rgba(20, 16, 12, 0.04);
      display: flex; flex-direction: column; gap: 6px;
      min-height: 88px;
      opacity: 0;
      animation: chipIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: calc(0.08s + var(--i, 0) * 0.07s);
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .fact:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(20, 16, 12, 0.07);
      border-color: rgba(253, 74, 41, 0.22);
    }
    .fact:active, .fact--tap {
      transform: scale(0.97);
      border-color: rgba(253, 74, 41, 0.4);
    }
    .fact em {
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--vos-ink-muted, #7a7168);
      font-weight: 600;
    }
    .fact strong {
      font-family: var(--vos-display);
      font-size: 1.05rem;
      letter-spacing: -0.02em;
      line-height: 1.25;
      font-weight: 700;
      color: var(--vos-ink, #1a1410);
      word-break: break-word;
    }
    .fact__hint {
      margin-top: 2px;
      font-size: 0.78rem;
      font-weight: 600;
      line-height: 1.3;
      color: var(--vos-ink-muted, #7a7168);
    }
    .fact--pay .pay--open { color: var(--vos-brand, #FD4A29); }
    .pay--open { color: var(--vos-brand, #FD4A29); }

    .ref-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 22px;
      flex-wrap: wrap;
    }
    .ref {
      margin: 0;
      color: var(--vos-ink-muted, #7a7168);
      font-size: 0.88rem;
      font-family: var(--vos-mono);
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .ref__label { opacity: 0.7; flex-shrink: 0; }
    .ref__id {
      font: inherit;
      color: inherit;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: min(52vw, 280px);
    }
    .ref-copy {
      flex-shrink: 0;
      border: 1px solid var(--vos-border, #e8e0d4);
      background: #fff;
      color: var(--vos-ink, #1a1410);
      font-family: var(--vos-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 8px 12px;
      border-radius: 999px;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }
    .ref-copy:hover {
      border-color: rgba(253, 74, 41, 0.35);
      color: var(--vos-brand, #FD4A29);
    }
    .ref-copy:active { transform: scale(0.96); }
    .ref-copy--ok {
      background: #ecfdf3;
      border-color: #86efac;
      color: #166534;
    }

    .manage { margin-bottom: 22px; }
    .manage h2, .journey h2 {
      margin: 0 0 12px;
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.03em;
      color: var(--vos-ink, #1a1410);
    }
    .manage__grid {
      display: grid;
      gap: 10px;
    }
    @media (min-width: 700px) {
      .manage__grid { grid-template-columns: 1fr 1fr; }
    }
    .act {
      position: relative;
      display: flex; flex-direction: column; gap: 4px;
      text-decoration: none; color: inherit;
      padding: 16px 18px;
      border-radius: 20px;
      background: #fffef9;
      border: 1px solid var(--vos-border, #e8e0d4);
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      box-shadow: 0 6px 18px rgba(20, 16, 12, 0.04);
      -webkit-tap-highlight-color: transparent;
      opacity: 0;
      animation: chipIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: calc(0.2s + var(--i, 0) * 0.06s);
    }
    .act:hover {
      transform: translateY(-3px);
      box-shadow: 0 14px 32px rgba(20, 16, 12, 0.09);
      border-color: rgba(253, 74, 41, 0.22);
    }
    .act:active { transform: scale(0.985) translateY(-1px); }
    button.act {
      width: 100%; text-align: left; cursor: pointer; font: inherit;
    }
    .act--muted {
      grid-column: 1 / -1;
      opacity: 0.72;
      cursor: not-allowed;
      background: #f3f0ea;
      color: var(--vos-ink-muted);
      box-shadow: none;
      animation: none;
      opacity: 1;
    }
    .act--muted:hover { transform: none; box-shadow: none; border-color: var(--vos-border, #e8e0d4); }
    .act--danger {
      border-color: rgba(180, 35, 24, 0.28);
      background: #fff8f7;
    }
    .act--danger .act__title { color: #B42318; }
    .act--danger:hover {
      border-color: rgba(180, 35, 24, 0.45);
      box-shadow: 0 10px 24px rgba(180, 35, 24, 0.12);
    }
    button.act:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .act--primary {
      background: linear-gradient(135deg, #1a100e 0%, #0a0a0a 100%);
      color: #fff;
      border-color: transparent;
      grid-column: 1 / -1;
      padding: 20px 20px 18px;
      box-shadow: 0 14px 36px rgba(20, 12, 8, 0.22);
      overflow: hidden;
    }
    .act--primary:hover {
      box-shadow: 0 18px 40px rgba(20, 12, 8, 0.28);
      border-color: transparent;
      transform: translateY(-3px);
    }
    .act--primary .act__sub { color: rgba(255,255,255,0.68); }
    .act__live {
      position: absolute;
      right: 56px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      gap: 4px;
      align-items: flex-end;
      height: 18px;
    }
    .act__live span {
      width: 3px;
      border-radius: 2px;
      background: #FD4A29;
      animation: eq 1.1s ease-in-out infinite;
    }
    .act__live span:nth-child(1) { height: 6px; animation-delay: 0s; }
    .act__live span:nth-child(2) { height: 14px; animation-delay: 0.15s; }
    .act__live span:nth-child(3) { height: 9px; animation-delay: 0.3s; }
    .act__eyebrow {
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #FD4A29;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .act__title {
      font-family: var(--vos-display);
      font-weight: 700;
      font-size: 1.12rem;
      letter-spacing: -0.02em;
    }
    .act--primary .act__title { font-size: 1.28rem; }
    .act__sub {
      color: var(--vos-ink-muted, #7a7168);
      font-size: 0.92rem;
      line-height: 1.35;
    }
    .act__arrow {
      position: absolute;
      right: 18px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.25rem;
      opacity: 0.55;
      transition: transform 0.18s ease, opacity 0.18s ease;
    }
    .act--primary:hover .act__arrow {
      opacity: 1;
      transform: translateY(-50%) translateX(3px);
    }

    .match {
      margin-bottom: 22px;
      padding: 18px 18px 16px;
      border-radius: 22px;
      background: linear-gradient(165deg, #fffef9 0%, #fff5f1 100%);
      border: 1px solid rgba(253, 74, 41, 0.12);
      box-shadow: 0 8px 24px rgba(253, 74, 41, 0.05);
      animation: rise 0.5s ease both;
      animation-delay: 0.12s;
    }
    .match__label {
      margin: 0 0 6px;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--vos-brand, #FD4A29);
      font-weight: 600;
    }
    .match h3 {
      margin: 0 0 6px;
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.03em;
      color: var(--vos-ink, #1a1410);
    }
    .match__meta, .match__alts {
      margin: 0;
      color: var(--vos-ink-muted, #7a7168);
      font-size: 0.95rem;
      line-height: 1.4;
    }
    .match__alts { margin-top: 8px; font-size: 0.88rem; }

    .journey { margin-bottom: 20px; }
    .journey__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 4px;
    }
    .journey__head h2 { margin-bottom: 8px; }
    .live-tag, .pct-tag {
      flex-shrink: 0;
      font-family: var(--vos-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--vos-brand, #FD4A29);
      background: var(--vos-brand-soft, rgba(253, 74, 41, 0.12));
      padding: 6px 10px;
      border-radius: 999px;
      margin-bottom: 8px;
    }

    .progress { margin: 4px 0 14px; }
    .progress__track {
      height: 8px;
      border-radius: 999px;
      background: #efebe0;
      overflow: hidden;
    }
    .progress__fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #FD4A29, #ff7a5c);
      transition: width 0.55s cubic-bezier(0.22, 1, 0.36, 1);
      box-shadow: 0 0 12px rgba(253, 74, 41, 0.35);
    }
    .progress__label {
      margin: 8px 0 0;
      font-size: 0.9rem;
      color: var(--vos-ink-muted, #7a7168);
    }

    .steps {
      list-style: none;
      margin: 0;
      padding: 4px 0 0;
      display: grid;
      gap: 0;
    }
    .steps__item {
      display: grid;
      grid-template-columns: 40px 1fr;
      gap: 12px;
      align-items: start;
      padding: 0;
      color: var(--vos-ink-muted, #7a7168);
      position: relative;
      cursor: pointer;
      opacity: 0;
      animation: chipIn 0.4s ease forwards;
      animation-delay: calc(0.05s + var(--i, 0) * 0.05s);
      border-radius: 14px;
      transition: background 0.15s ease;
    }
    .steps__item:hover, .steps__item--focus {
      background: rgba(253, 74, 41, 0.04);
    }
    .steps__rail {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100%;
      padding: 10px 0;
    }
    .steps__rail::after {
      content: '';
      flex: 1;
      width: 2px;
      min-height: 12px;
      margin-top: 8px;
      background: var(--vos-border, #e8e0d4);
      border-radius: 2px;
    }
    .steps__item:last-child .steps__rail::after { display: none; }
    .steps__dot {
      width: 34px; height: 34px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      font-family: var(--vos-mono); font-size: 11px; font-weight: 700;
      background: #efebe0; color: var(--vos-ink-muted, #7a7168);
      flex-shrink: 0;
      transition: box-shadow 0.2s ease, background 0.2s ease, transform 0.15s ease;
    }
    .steps__item:hover .steps__dot { transform: scale(1.06); }
    .steps__body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 14px 12px 14px 0;
      border-bottom: 1px solid var(--vos-border, #e8e0d4);
      min-width: 0;
    }
    .steps__item:last-child .steps__body { border-bottom: 0; }
    .steps__body strong {
      font-family: var(--vos-display);
      font-size: 1.05rem;
      letter-spacing: -0.02em;
      line-height: 1.25;
    }
    .steps__detail {
      font-size: 0.92rem;
      line-height: 1.35;
      color: var(--vos-ink-muted, #7a7168);
      animation: rise 0.25s ease both;
    }

    .steps__item--done { color: var(--vos-ink, #1a1410); }
    .steps__item--done .steps__dot { background: #dcfce7; color: #166534; }
    .steps__item--done .steps__rail::after { background: #bbf7d0; }

    .steps__item--current { color: var(--vos-brand, #FD4A29); }
    .steps__item--current .steps__dot {
      background: var(--vos-brand, #FD4A29);
      color: #fff;
      box-shadow: 0 0 0 0 rgba(253, 74, 41, 0.45);
      animation: stepRing 1.8s ease-out infinite;
    }
    .steps__item--current .steps__body strong { color: var(--vos-brand, #FD4A29); }
    .steps__item--current .steps__body {
      background: linear-gradient(90deg, rgba(253, 74, 41, 0.06), transparent 70%);
      border-radius: 0 14px 14px 0;
      margin-right: -4px;
      padding-left: 4px;
    }

    .hist { list-style: none; margin: 0; padding: 0; }
    .hist li {
      padding: 10px 0;
      color: var(--vos-ink-muted, #7a7168);
      border-bottom: 1px solid var(--vos-border, #e8e0d4);
      font-size: 0.95rem;
    }
    .hist time {
      font-family: var(--vos-mono);
      font-size: 11px;
      margin-right: 8px;
      color: var(--vos-ink, #1a1410);
    }
    .empty-j {
      color: var(--vos-ink-muted, #7a7168);
      margin: 8px 0 0;
      line-height: 1.45;
    }

    .again {
      display: inline-block;
      margin: 8px 0 28px;
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--vos-brand, #FD4A29);
      text-decoration: none;
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .again:hover { opacity: 0.8; }
    .again:active { transform: translateX(2px); }
    .again--disabled,
    .again--disabled:hover {
      color: #b0aba3;
      cursor: not-allowed;
      opacity: 1;
      transform: none;
    }

    @media (max-width: 480px) {
      .hero { padding: 22px 18px 18px; border-radius: 24px; }
      .fact { min-height: 80px; padding: 12px; }
      .act { padding: 14px 16px; }
      .act--primary { padding: 18px 16px; }
      .act__arrow, .act__live { display: none; }
      .ref__id { max-width: 42vw; }
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes chipIn {
      from { opacity: 0; transform: translateY(10px) scale(0.98); }
      to { opacity: 1; transform: none; }
    }
    @keyframes pillPulse {
      0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
      70% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
    }
    @keyframes dotPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.55; transform: scale(0.85); }
    }
    @keyframes stepRing {
      0% { box-shadow: 0 0 0 0 rgba(253, 74, 41, 0.45); }
      70% { box-shadow: 0 0 0 10px rgba(253, 74, 41, 0); }
      100% { box-shadow: 0 0 0 0 rgba(253, 74, 41, 0); }
    }
    @keyframes glowDrift {
      from { transform: translateX(-4%); }
      to { transform: translateX(6%); }
    }
    @keyframes orbFloat {
      from { transform: translate(0, 0); }
      to { transform: translate(-12px, 10px); }
    }
    @keyframes soonPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.04); }
    }
    @keyframes heroFlash {
      0% { filter: brightness(1); }
      35% { filter: brightness(1.12); }
      100% { filter: brightness(1); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes eq {
      0%, 100% { transform: scaleY(0.55); }
      50% { transform: scaleY(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .hero, .fact, .toast-ok, .match, .act, .steps__item,
      .pill--pulse, .pill--pulse .pill__dot,
      .steps__item--current .steps__dot,
      .hero__glow, .hero__orb, .countdown--soon, .act__live span {
        animation: none !important;
      }
      .fact, .act, .steps__item { opacity: 1; }
      .act:hover, .fact:hover { transform: none; }
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
      max-height: min(calc(100vh - 32px), 720px);
      overflow: visible;
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
    .modal__field {
      display: grid; gap: 6px; margin-bottom: 12px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--vos-ink-muted);
      font-family: var(--vos-mono);
      position: relative;
      z-index: 1;
    }
    .modal__field:focus-within {
      z-index: 5;
    }
    .modal__field input,
    .modal__field textarea {
      width: 100%; box-sizing: border-box;
      padding: 12px 14px; border-radius: 12px;
      border: 1px solid var(--vos-border, #e8e0d4);
      font: inherit; font-size: 1rem; font-weight: 600;
      text-transform: none; letter-spacing: 0;
      color: var(--vos-ink); background: #faf8f4;
    }
    .modal__err {
      color: #b42318;
      font-weight: 700;
      margin: 0 0 12px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #fff5f3;
      border: 1px solid rgba(180, 35, 24, 0.22);
      font-family: var(--vos-font);
      font-size: 0.9rem;
      letter-spacing: 0;
      text-transform: none;
    }
    .modal__hint {
      display: block;
      margin-top: 6px;
      font-style: normal;
      font-family: var(--vos-font);
      font-size: 0.82rem;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
      color: var(--vos-ink-muted);
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
  `],
})
export class BookingDetailComponent implements OnInit, OnDestroy {
  readonly b = signal<any>(null);
  readonly journey = signal<any>(null);
  readonly match = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly justBooked = signal(false);
  readonly uploadWarn = signal('');
  readonly copied = signal(false);
  readonly refreshing = signal(false);
  readonly freshness = signal('Live');
  readonly freshFlash = signal(false);
  readonly countdown = signal('');
  readonly countdownSoon = signal(false);
  readonly tappedFact = signal<number | null>(null);
  readonly focusedStep = signal<number | null>(null);
  readonly editOpen = signal(false);
  readonly editSaving = signal(false);
  readonly editError = signal('');
  readonly editOk = signal('');
  readonly cancelOpen = signal(false);
  readonly cancelling = signal(false);
  readonly cancelError = signal('');
  readonly pendingChange = signal<PendingEdit | null>(null);
  consultFee = CONSULT_FEE;
  editDate = '';
  editTime = '';
  editAddress = '';
  editReason = '';
  cancelReason = '';
  minEditDate = '';
  private readonly allTimeSlots = TIME_SLOTS;
  private editOkTimer: ReturnType<typeof setTimeout> | null = null;

  private id = '';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLoadedAt = 0;

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private router: Router,
    private bookingGate: BookingGateService,
  ) {}

  bookingBlocked(booking: any): boolean {
    const petId = booking?.petId || booking?.pet?.id || this.petQ(booking)?.petId;
    return this.bookingGate.isBlocked(petId, booking?.petName);
  }

  ngOnInit() {
    void this.bookingGate.refresh();
    this.route.paramMap.subscribe((params) => {
      const nextId = params.get('id') || '';
      if (!nextId) return;
      const changed = nextId !== this.id;
      this.id = nextId;
      this.justBooked.set(
        this.route.snapshot.queryParamMap.get('booked') === '1' ||
          this.route.snapshot.queryParamMap.get('rescheduled') === '1',
      );
      try {
        const warn = sessionStorage.getItem('vos.booking.uploadWarn') || '';
        if (warn) {
          this.uploadWarn.set(warn);
          sessionStorage.removeItem('vos.booking.uploadWarn');
        }
      } catch {
        /* ignore */
      }
      void this.load().then(() => {
        if (changed && this.route.snapshot.queryParamMap.get('edit') === '1') {
          this.openEdit();
        } else if (!changed && this.route.snapshot.queryParamMap.get('edit') === '1') {
          this.openEdit();
        }
        if (this.route.snapshot.queryParamMap.get('cancel') === '1' && this.canCancel(this.b())) {
          this.openCancel();
        }
      });
    });
    this.refreshTimer = setInterval(() => {
      void this.load(true);
    }, 20_000);
    this.tickTimer = setInterval(() => {
      this.updateCountdown();
      this.updateFreshness();
    }, 30_000);
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.copyTimer) clearTimeout(this.copyTimer);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    if (this.tapTimer) clearTimeout(this.tapTimer);
    if (this.editOkTimer) clearTimeout(this.editOkTimer);
    document.body.style.overflow = '';
  }

  journeyLive(): boolean {
    const steps = this.journey()?.steps;
    if (!Array.isArray(steps)) return false;
    return steps.some((s: any) => s?.state === 'current');
  }

  progressPct(): number {
    const steps = this.journey()?.steps;
    if (!Array.isArray(steps) || !steps.length) return 0;
    const done = steps.filter((s: any) => s?.state === 'done').length;
    const current = steps.some((s: any) => s?.state === 'current') ? 0.5 : 0;
    return Math.min(100, Math.round(((done + current) / steps.length) * 100));
  }

  progressLabel(): string {
    const steps = this.journey()?.steps;
    if (!Array.isArray(steps) || !steps.length) return '';
    const current = steps.find((s: any) => s?.state === 'current');
    if (current?.label) return `Now: ${current.label}`;
    const done = steps.filter((s: any) => s?.state === 'done').length;
    if (done === steps.length) return 'Visit complete';
    return `${done} of ${steps.length} steps done`;
  }

  nudgeFact(i: number) {
    this.tappedFact.set(i);
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => this.tappedFact.set(null), 220);
  }

  focusStep(i: number) {
    this.focusedStep.set(this.focusedStep() === i ? null : i);
  }

  async copyRef(id: string | null | undefined) {
    const text = String(id || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => {
        this.copied.set(false);
        this.copyTimer = null;
      }, 1600);
    } catch {
      this.copied.set(false);
    }
  }

  petQ(booking: any) {
    return booking?.petId ? { petId: booking.petId } : {};
  }

  visitId(): string | null {
    const b = this.b();
    if (!b) return null;
    if (b.visitId) return b.visitId;
    if (b.visit?.id) return b.visit.id;
    if (b.status === 'completed' && b.visitDisplayId) return b.visitDisplayId;
    return null;
  }

  altNames(list: any[]): string {
    return (list || [])
      .slice(0, 3)
      .map((d) => d?.name)
      .filter(Boolean)
      .join(', ');
  }

  prettyDate(v: string | null | undefined): string {
    if (!v) return 'Date TBD';
    const d = new Date(v.includes('T') ? v : `${v}T12:00:00`);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  prettyReason(r: string | null | undefined): string {
    if (!r) return 'General visit';
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  doctorLabel(booking: any): string {
    if (booking?.assignedDoctor) return booking.assignedDoctor;
    const rec = this.match()?.recommended;
    if (rec?.name) return `${rec.name} (suggested)`;
    const st = String(booking?.status || '').toLowerCase();
    if (st === 'accepted' || st === 'en_route' || st === 'arrived' || st === 'in_consult') {
      return 'Assigned — name coming soon';
    }
    if (st === 'pending' || st === 'sent') return 'Matching a nearby vet';
    return 'Finding the right match';
  }

  suggestedDoctor(): any | null {
    const booking = this.b();
    if (booking?.assignedDoctor) {
      return { name: booking.assignedDoctor, reasons: ['Assigned to your visit'] };
    }
    return this.match()?.recommended || null;
  }

  matchMeta(doc: any): string {
    const reasons = (doc?.reasons || []).filter((r: string) => {
      const s = String(r || '').trim();
      if (!s) return false;
      if (/^0(\.0+)?\s*km$/i.test(s)) return false;
      if (/distance:\s*0(\.0+)?/i.test(s)) return false;
      return true;
    });
    return reasons.slice(0, 3).join(' · ') || 'Nearby and available';
  }

  canLiveTrack(): boolean {
    const booking = this.b();
    const st = String(booking?.status || '').toLowerCase();
    if (['en_route', 'on_the_way', 'arrived', 'in_consult'].includes(st)) return true;
    const steps = this.journey()?.steps;
    if (!Array.isArray(steps)) return false;
    return steps.some((s: any) => {
      if (s?.state !== 'current') return false;
      const label = `${s.label || ''} ${s.code || ''} ${s.key || ''}`.toLowerCase();
      return /on the way|en.?route|arrived|heading|dispatched|live/.test(label);
    });
  }

  displayPetName = displayPetName;
  titleCase = titleCase;

  openEdit() {
    const booking = this.b();
    this.minEditDate = this.toIsoDate(new Date());
    const rawDate = String(booking?.scheduledDate || booking?.preferredDate || '')
      .toString()
      .slice(0, 10);
    this.editDate = rawDate && rawDate >= this.minEditDate ? rawDate : this.minEditDate;
    this.editTime = this.normalizeSlot(booking?.scheduledTime || booking?.preferredTime || '');
    this.editAddress = String(booking?.location || booking?.address || '').trim();
    this.editReason = String(booking?.reason || booking?.reasonForVisit || '').trim();
    this.ensureEditableSlot();
    this.editError.set('');
    this.editOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeEdit() {
    this.editOpen.set(false);
    document.body.style.overflow = '';
  }

  canCancel(booking: any): boolean {
    if (!booking) return false;
    if (booking._superseded || booking._hideFromUpcoming) return false;
    const st = String(
      booking?.customerStatus?.code || booking?.customerStatus?.label || booking?.status || '',
    ).toLowerCase();
    return !/(complet|cancel|done|no.?show|closed|declined|missed)/.test(st);
  }

  canModify(booking: any): boolean {
    return this.canCancel(booking);
  }

  openCancel() {
    if (!this.canCancel(this.b())) return;
    this.cancelReason = '';
    this.cancelError.set('');
    this.cancelOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeCancel() {
    this.cancelOpen.set(false);
    this.cancelling.set(false);
    this.cancelError.set('');
    document.body.style.overflow = '';
  }

  async confirmCancel() {
    const booking = this.b();
    const bookingId = String(booking?.id || booking?.uuid || booking?._id || this.id || '').trim();
    if (!bookingId) {
      this.cancelError.set('Missing booking id — refresh and try again.');
      return;
    }
    this.cancelling.set(true);
    this.cancelError.set('');
    try {
      const result = await this.api.cancelBooking(bookingId, {
        reason: this.cancelReason.trim() || 'Cancelled by customer',
        petId: String(booking?.petId || booking?.pet?.id || '').trim() || undefined,
        petName: String(booking?.petName || booking?.pet?.name || '').trim() || undefined,
        preferredDate: booking?.scheduledDate || booking?.preferredDate,
        preferredTime: booking?.scheduledTime || booking?.preferredTime,
        address: booking?.location || booking?.address,
      });

      // Hide from Upcoming immediately if API is slow to reflect
      const date = String(booking?.scheduledDate || booking?.preferredDate || '').slice(0, 10);
      const time = String(booking?.scheduledTime || booking?.preferredTime || '').trim();
      writePendingEdit(bookingId, {
        preferredDate: date || this.toIsoDate(new Date()),
        preferredTime: time || '—',
        address: String(booking?.location || booking?.address || '').trim() || '—',
        reasonForVisit: this.cancelReason.trim() || 'Cancelled by customer',
        requestedAt: new Date().toISOString(),
        hideFromUpcoming: true,
        ticketId: result?.ticketId,
      });

      const petId = String(booking?.petId || booking?.pet?.id || '').trim();
      this.bookingGate.clearPetBlocked(petId, booking?.petName);
      void this.bookingGate.refresh();

      this.closeCancel();
      await this.router.navigate(['/bookings'], {
        queryParams: {
          cancelled: '1',
          via: result?.via || 'api',
          ticket: result?.ticketId || null,
        },
      });
    } catch (e: any) {
      const raw = String(e?.error?.message || e?.message || '').trim();
      this.cancelError.set(
        /route not found/i.test(raw)
          ? 'Couldn’t cancel right now. Please try again or contact Support.'
          : raw || 'Couldn’t cancel this visit. Try again or contact support.',
      );
      this.cancelling.set(false);
    }
  }

  onEditDateChange(iso: string) {
    this.editDate = iso || this.minEditDate;
    this.ensureEditableSlot();
    this.editError.set('');
  }

  availableTimeOptions(): VosSelectOption[] {
    return this.allTimeSlots
      .filter((t) => !this.isSlotPast(t, this.editDate))
      .map((t) => ({ value: t, label: t }));
  }

  async saveEdit() {
    const booking = this.b();
    const bookingId = String(booking?.id || booking?.uuid || booking?._id || this.id || '').trim();
    const petId = String(booking?.petId || booking?.pet?.id || '').trim();
    if (!bookingId) {
      this.editError.set('Missing booking id — refresh and try again.');
      return;
    }
    if (!petId) {
      this.editError.set('Missing pet for this visit — refresh and try again.');
      return;
    }

    this.editError.set('');
    this.ensureEditableSlot();

    if (!this.editDate || this.editDate < this.minEditDate) {
      this.editError.set('Please pick today or a future date.');
      return;
    }
    if (!this.editTime) {
      this.editError.set('Pick a time slot for the visit.');
      return;
    }
    if (this.isSlotPast(this.editTime, this.editDate)) {
      this.editError.set('Please select a valid future time.');
      this.editTime = '';
      this.ensureEditableSlot();
      return;
    }
    if (!this.editAddress.trim()) {
      this.editError.set('Address is required.');
      return;
    }

    this.editSaving.set(true);
    try {
      const body: Record<string, unknown> = {
        petId,
        petIds: booking?.petIds || [petId],
        preferredDate: this.editDate,
        preferredTime: this.editTime,
        address: this.editAddress.trim(),
        reasonForVisit: this.editReason.trim() || booking?.reasonForVisit || booking?.reason || 'General visit',
        intakeText: booking?.intakeText || `Updated from portal (${bookingId})`,
        consultationType: booking?.consultationType || 'Home Visit',
        uuid: booking?.uuid,
        _id: booking?._id,
        bookingId,
      };
      const updated = await this.api.updateBooking(bookingId, body);
      const via = String((updated as any)?.via || 'api');
      const newId = String((updated as any)?.id || bookingId).trim();
      const slotEdit = {
        preferredDate: this.editDate,
        preferredTime: this.editTime,
        address: this.editAddress.trim(),
        reasonForVisit: this.editReason.trim() || String(body['reasonForVisit'] || ''),
        requestedAt: new Date().toISOString(),
        petId,
        petName: String(booking?.petName || booking?.pet?.name || '').trim() || undefined,
        consultationType: String(booking?.consultationType || 'Home Visit'),
      };

      const next = {
        preferredDate: this.editDate,
        preferredTime: this.editTime,
        scheduledDate: this.editDate,
        scheduledTime: this.editTime,
        location: this.editAddress.trim(),
        address: this.editAddress.trim(),
        reason: this.editReason.trim(),
        reasonForVisit: this.editReason.trim(),
        status: 'scheduled',
        customerStatus: {
          label: 'Scheduled',
          code: 'scheduled',
          detail: via === 'recreate' ? 'Rescheduled visit' : 'Updated visit',
        },
      };

      if (via === 'recreate' && newId && newId !== bookingId) {
        markBookingSuperseded(bookingId, newId, slotEdit);
        writePendingEdit(newId, {
          preferredDate: slotEdit.preferredDate,
          preferredTime: slotEdit.preferredTime,
          address: slotEdit.address,
          reasonForVisit: slotEdit.reasonForVisit,
          requestedAt: slotEdit.requestedAt,
          ticketId: String((updated as any)?.ticketId || '').trim() || undefined,
          synthetic: {
            id: newId,
            petId,
            petName: slotEdit.petName,
            consultationType: slotEdit.consultationType,
            status: 'scheduled',
          },
        });
        this.closeEdit();
        this.showEditOk(
          (updated as any)?.adminNotified
            ? 'Visit rescheduled — care team notified. Opening the new appointment.'
            : 'Visit rescheduled — opening your updated appointment.',
        );
        await this.router.navigate(['/bookings', newId], {
          queryParams: { booked: '1', rescheduled: '1' },
          replaceUrl: true,
        });
        return;
      }

      this.b.set({
        ...(this.b() || {}),
        ...(updated && typeof updated === 'object' ? updated : {}),
        ...next,
      });
      writePendingEdit(bookingId, {
        preferredDate: slotEdit.preferredDate,
        preferredTime: slotEdit.preferredTime,
        address: slotEdit.address,
        reasonForVisit: slotEdit.reasonForVisit,
        requestedAt: slotEdit.requestedAt,
        ticketId: String((updated as any)?.ticketId || '').trim() || undefined,
        synthetic: {
          id: bookingId,
          petId,
          petName: slotEdit.petName,
          consultationType: slotEdit.consultationType,
          status: 'scheduled',
        },
      });
      this.pendingChange.set(readPendingEdit(bookingId));
      this.showEditOk(
        via === 'api'
          ? 'Visit updated — care team can see the new details.'
          : 'Change sent to care team (Support). They’ll update this visit in admin.',
      );
      this.closeEdit();

      try {
        await this.load(true);
        const fresh = this.b();
        const savedDate = String(fresh?.scheduledDate || fresh?.preferredDate || '').slice(0, 10);
        if (savedDate !== this.editDate) {
          this.b.set({ ...this.b(), ...next });
        }
      } catch {
        /* optimistic state already applied */
      }
    } catch (e: any) {
      const apiMsg =
        e?.error?.message ||
        e?.error?.error ||
        (Array.isArray(e?.error?.errors) ? e.error.errors.join(', ') : null) ||
        (typeof e?.error === 'string' ? e.error : null) ||
        e?.message;
      this.editError.set(
        apiMsg || 'Couldn’t update this visit. Try Support if changes don’t save.',
      );
    } finally {
      this.editSaving.set(false);
    }
  }

  private showEditOk(msg: string) {
    this.editOk.set(msg);
    if (this.editOkTimer) clearTimeout(this.editOkTimer);
    this.editOkTimer = setTimeout(() => {
      this.editOk.set('');
      this.editOkTimer = null;
    }, 5000);
  }

  private applyPendingEdit(booking: any): any {
    const merged = applyPendingEditToBooking(booking);
    const id = String(merged?.id || this.id || '');
    const pending = readPendingEdit(id);
    // Don't show “pending change” banner for superseded (cancelled) stubs
    this.pendingChange.set(pending && !pending.hideFromUpcoming ? pending : null);
    return merged;
  }

  /** Keep date/time on a bookable future slot (same rules as new booking). */
  private ensureEditableSlot() {
    if (!this.minEditDate) this.minEditDate = this.toIsoDate(new Date());
    if (!this.editDate || this.editDate < this.minEditDate) {
      this.editDate = this.minEditDate;
    }

    let options = this.availableTimeOptions();
    if (!options.length) {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      this.editDate = this.toIsoDate(next);
      options = this.availableTimeOptions();
    }

    if (!this.editTime || this.isSlotPast(this.editTime, this.editDate) || !options.some((o) => o.value === this.editTime)) {
      this.editTime = options[0]?.value || '';
    }
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private normalizeSlot(raw: string): string {
    const t = String(raw || '').trim();
    if (!t) return '';
    const exact = this.allTimeSlots.find((s) => s.toLowerCase() === t.toLowerCase());
    if (exact) return exact;
    const mins = this.slotMinutes(t);
    if (mins == null) return '';
    return this.allTimeSlots.find((s) => this.slotMinutes(s) === mins) || '';
  }

  private slotMinutes(t: string): number | null {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    if (!ap && h <= 23) return h * 60 + min;
    if (!ap) return null;
    return h * 60 + min;
  }

  private isSlotPast(t: string, dateIso: string): boolean {
    if (!dateIso || dateIso !== this.minEditDate) return false;
    const mins = this.slotMinutes(t);
    if (mins == null) return false;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return mins <= nowMins;
  }

  prettyPay(p: string | null | undefined): string {
    const v = String(p || 'unpaid').toLowerCase();
    if (v === 'paid' || v === 'success') return 'Paid';
    if (v === 'failed') return 'Payment failed';
    if (v === 'pending') return `Pay later · ${CONSULT_FEE}`;
    return `Pay later · ${CONSULT_FEE}`;
  }

  isUnpaid(p: string | null | undefined): boolean {
    const v = String(p || 'unpaid').toLowerCase();
    return v === 'unpaid' || v === 'pending' || v === 'failed';
  }

  private updateCountdown() {
    const b = this.b();
    if (!b?.scheduledDate) {
      this.countdown.set('');
      this.countdownSoon.set(false);
      return;
    }
    const when = this.parseSchedule(b.scheduledDate, b.scheduledTime);
    if (!when) {
      this.countdown.set('');
      this.countdownSoon.set(false);
      return;
    }
    const diff = when.getTime() - Date.now();
    if (diff < -2 * 60 * 60 * 1000) {
      this.countdown.set('');
      this.countdownSoon.set(false);
      return;
    }
    if (diff <= 0) {
      this.countdown.set('Happening now');
      this.countdownSoon.set(true);
      return;
    }
    const mins = Math.round(diff / 60_000);
    this.countdownSoon.set(mins <= 90);
    if (mins < 60) this.countdown.set(`in ${mins}m`);
    else if (mins < 60 * 24) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      this.countdown.set(m ? `in ${h}h ${m}m` : `in ${h}h`);
    } else {
      const days = Math.ceil(mins / (60 * 24));
      this.countdown.set(days === 1 ? 'Tomorrow' : `in ${days}d`);
    }
  }

  private parseSchedule(dateStr: string, timeStr?: string): Date | null {
    const base = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    if (Number.isNaN(base.getTime())) return null;
    if (!timeStr) return base;
    const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return base;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    base.setHours(h, min, 0, 0);
    return base;
  }

  private updateFreshness() {
    if (!this.lastLoadedAt) {
      this.freshness.set('Live');
      return;
    }
    const mins = Math.floor((Date.now() - this.lastLoadedAt) / 60_000);
    if (mins < 1) this.freshness.set('Just updated');
    else if (mins === 1) this.freshness.set('1m ago');
    else this.freshness.set(`${mins}m ago · tap`);
  }

  async load(silent = false) {
    if (!silent) {
      this.loading.set(true);
      this.error.set('');
    } else {
      this.refreshing.set(true);
    }
    try {
      const [booking, journey, match] = await Promise.all([
        this.api.booking(this.id),
        this.api.bookingJourney(this.id).catch(() => null),
        this.api.bookingMatch(this.id).catch(() => null),
      ]);
      this.b.set(this.applyPendingEdit(booking));
      this.journey.set(journey);
      this.match.set(match);
      this.lastLoadedAt = Date.now();
      this.updateCountdown();
      this.updateFreshness();
      if (silent) {
        this.error.set('');
        this.freshFlash.set(true);
        if (this.flashTimer) clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => this.freshFlash.set(false), 700);
      }
    } catch (e: any) {
      const status = e?.status as number | undefined;
      if (status === 401) {
        if (this.refreshTimer) {
          clearInterval(this.refreshTimer);
          this.refreshTimer = null;
        }
        if (!silent) {
          this.error.set('Your session expired. Sign in again to view this appointment.');
        }
      } else if (status === 404) {
        // Reschedule may land here before the new booking is readable — use pending synthetic
        const pending = readPendingEdit(this.id);
        if (pending?.preferredDate) {
          const syn = pending.synthetic;
          this.b.set(
            this.applyPendingEdit({
              id: this.id,
              petId: syn?.petId,
              petName: syn?.petName || 'Your pet',
              preferredDate: pending.preferredDate,
              preferredTime: pending.preferredTime,
              scheduledDate: pending.preferredDate,
              scheduledTime: pending.preferredTime,
              location: pending.address,
              address: pending.address,
              reason: pending.reasonForVisit,
              reasonForVisit: pending.reasonForVisit,
              consultationType: syn?.consultationType || 'Home Visit',
              status: 'scheduled',
              customerStatus: {
                label: 'Scheduled',
                code: 'scheduled',
                detail: 'Rescheduled visit — syncing with care team',
              },
              _synthetic: true,
            }),
          );
          this.error.set('');
          this.lastLoadedAt = Date.now();
          this.updateCountdown();
          this.updateFreshness();
        } else if (!silent) {
          this.error.set('We couldn’t find this appointment — it may belong to another account.');
        }
      } else if (!silent) {
        this.error.set(
          e?.error?.message || 'Something went wrong loading this visit. Please try again.',
        );
      }
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }
}
