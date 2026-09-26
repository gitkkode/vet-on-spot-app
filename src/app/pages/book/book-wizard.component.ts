import { Component, HostListener, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { AuthService } from '../../services/auth.service';
import { BookingGateService } from '../../services/booking-gate.service';
import { blockingBookings, bookingBlocksPet } from '../../utils/booking-pending';
import { resolvePetPhotoUrl } from '../../utils/pet-photo';
import { displayPetName } from '../../utils/health-records';
import { NavBackService } from '../../services/nav-back.service';
const REASONS = [
  'sick',
  'vomiting / diarrhea',
  'not eating',
  'injury / limping',
  'skin / itching',
  'ear / eye',
  'dental',
  'vaccination',
  'routine checkup',
  'follow-up',
  'other',
];

type IntakeQ = {
  label: string;
  placeholder?: string;
  /** When set, render as selection pills instead of free text. */
  options?: string[];
};

const INTAKE: Record<string, IntakeQ[]> = {
  sick: [
    { label: 'What have you noticed?', placeholder: 'Lethargy, feverish, coughing…' },
    { label: 'When did it start?', placeholder: 'e.g. yesterday evening' },
  ],
  'vomiting / diarrhea': [
    {
      label: 'How often?',
      options: ['Once', 'Several times today', 'Ongoing for days'],
    },
    {
      label: 'Any blood or unusual color?',
      options: ['No', 'Yes — blood', 'Unusual color', 'Not sure'],
    },
  ],
  'not eating': [
    { label: 'Last normal meal?', placeholder: 'When and what' },
    {
      label: 'Still drinking water?',
      options: ['Yes', 'A little', 'No'],
    },
  ],
  'injury / limping': [
    { label: 'Which area?', placeholder: 'Leg, paw, head…' },
    {
      label: 'Can they bear weight?',
      options: ['Yes', 'With difficulty', 'No'],
    },
  ],
  'skin / itching': [
    { label: 'Where on the body?', placeholder: 'Ears, belly, paws…' },
    {
      label: 'Any hair loss or sores?',
      options: ['No', 'Hair loss', 'Sores', 'Both', 'Not sure'],
    },
  ],
  'ear / eye': [
    {
      label: 'Which side?',
      options: ['Left', 'Right', 'Both'],
    },
    {
      label: 'Discharge or odor?',
      options: ['No', 'Discharge', 'Odor', 'Both'],
    },
  ],
  dental: [
    { label: 'Breath / chewing issues?', placeholder: 'Describe' },
    {
      label: 'Visible broken tooth or swelling?',
      options: ['Yes', 'No', 'Unsure'],
    },
  ],
  vaccination: [{ label: 'Which vaccines needed?', placeholder: 'e.g. annual boosters' }],
  'routine checkup': [{ label: 'Anything you want checked?', placeholder: 'Optional notes' }],
  'follow-up': [{ label: 'What is this follow-up for?', placeholder: 'Prior visit or condition' }],
  other: [{ label: 'Tell us more', placeholder: 'What would you like help with?' }],
};

const STEP_TITLES: Record<number, { title: string; sub: string }> = {
  1: { title: 'Who needs care?', sub: 'Pick one or more pets for this home visit.' },
  2: { title: 'What’s going on?', sub: 'A quick reason helps us prepare the right vet.' },
  3: { title: 'A little more detail', sub: 'Answer the quick questions so we can prepare the right vet.' },
  4: { title: 'Where should we come?', sub: 'Home visits happen at your place.' },
  5: { title: 'When works?', sub: 'We’ll confirm the slot with the care team.' },
  6: {
    title: 'Looking good?',
    sub: 'We’ll match the best available vet nearby — no picking required.',
  },
};

const STEP_NODES = [
  { n: 1, label: 'Pet' },
  { n: 2, label: 'Reason' },
  { n: 3, label: 'Details' },
  { n: 4, label: 'Address' },
  { n: 5, label: 'Time' },
  { n: 6, label: 'Review' },
];

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

/** Base home-visit consultation shown on review (diagnostics/meds extra). */
const CONSULT_FEE = '₹799';
const CONSULT_FEE_NOTE =
  'Base home-visit consultation. Diagnostics, procedures, or medicines are billed separately if needed.';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
  'Other',
];

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-book-wizard',
  template: `
    <button type="button" class="vos-back" (click)="onTopBack()">
      <span class="vos-back__chev" aria-hidden="true">‹</span>
      {{ topBackLabel() }}
    </button>

    <header class="head">
      <p class="head__kicker">Book a home visit</p>
      <h1>{{ meta().title }}</h1>
      <p class="head__sub">{{ meta().sub }}</p>

      <nav class="stepper" aria-label="Booking progress">
        @for (node of stepNodes; track node.n) {
          <div
            class="stepper__node"
            [class.stepper__node--done]="step() > node.n"
            [class.stepper__node--current]="step() === node.n"
          >
            <span class="stepper__dot" aria-hidden="true">
              @if (step() > node.n) { ✓ } @else { {{ node.n }} }
            </span>
            <span class="stepper__label">{{ node.label }}</span>
          </div>
        }
      </nav>
      <div
        class="progress"
        role="progressbar"
        [attr.aria-valuenow]="progressPercent()"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-label]="'Booking ' + progressPercent() + ' percent complete'"
      >
        <span [style.width.%]="progressPercent()"></span>
      </div>
      <p class="progress__label">Step {{ step() }} of 6 · {{ progressPercent() }}%</p>
    </header>

    @if (exitOpen()) {
      <div class="modal-backdrop" (click)="exitOpen.set(false)"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="exit-title">
        <h2 id="exit-title">Leave booking?</h2>
        <p>Your progress on this visit draft will be discarded.</p>
        <div class="modal__actions">
          <button type="button" class="ghost" (click)="exitOpen.set(false)">Keep booking</button>
          <button type="button" class="btn btn--danger" (click)="discardAndLeave()">
            Discard &amp; leave
          </button>
        </div>
      </div>
    }

    @if (error()) {
      <div class="vos-err" role="alert">
        {{ error() }}
        @if (sessionExpired()) {
          <a routerLink="/login" class="err-link">Sign in again</a>
        } @else {
          <button type="button" class="err-link" (click)="reload()">Try again</button>
        }
      </div>
    }

    @if (booting()) {
      <div class="panel panel--boot" aria-busy="true" aria-label="Loading pets">
        <div class="vos-skel vos-skel--gloss boot-row"></div>
        <div class="vos-skel vos-skel--gloss boot-row"></div>
        <div class="vos-skel vos-skel--gloss boot-row boot-row--short"></div>
      </div>
    } @else {
      <div class="panel">
        @if (step() === 1) {
          @if (sessionExpired()) {
            <div class="empty-state">
              <p class="empty-state__title">Sign in to continue</p>
              <p class="empty">Your session ended — sign in again and we’ll bring you back to booking.</p>
              <a class="btn" routerLink="/login">Sign in</a>
            </div>
          } @else if (!pets().length) {
            <div class="empty-state">
              <p class="empty-state__title">Add a pet first</p>
              <p class="empty">Create a pet profile so we can book the right home visit.</p>
              <a class="btn" routerLink="/pets/new">Add a pet</a>
            </div>
          } @else {
            <p class="hint">Select every pet who needs care on this visit</p>
            <div class="chips">
              @for (p of pets(); track p.id) {
                <button
                  type="button"
                  class="chip"
                  [class.on]="isPetOn(p.id)"
                  [class.chip--blocked]="petHasActiveVisit(p.id)"
                  [attr.aria-pressed]="isPetOn(p.id)"
                  [disabled]="petHasActiveVisit(p.id)"
                  [attr.title]="petHasActiveVisit(p.id) ? (p.name + ' already has an upcoming or ongoing visit') : null"
                  (click)="togglePet(p.id)"
                >
                  <span class="chip__avatar" aria-hidden="true">
                    @if (petPhotoUrl(p)) {
                      <img [src]="petPhotoUrl(p)" alt="" (error)="onPetPhotoError(p.id)" />
                    } @else {
                      <span class="chip__mono">{{ petInitial(p.name) }}</span>
                    }
                  </span>
                  <span class="chip__copy">
                    <strong>{{ displayPetName(p.name) }}</strong>
                    <em>{{ petHasActiveVisit(p.id) ? 'Visit already booked' : prettySpecies(p.species) }}</em>
                  </span>
                </button>
              }
            </div>
            @if (conflictBooking(); as conflict) {
              <div class="conflict" role="status">
                <p>
                  <strong>{{ displayPetName(conflict.petName, 'This pet') }}</strong> already has an upcoming or ongoing visit
                  ({{ conflict.scheduledDate || 'upcoming' }}{{ conflict.scheduledTime ? ' · ' + conflict.scheduledTime : '' }}).
                  Finish or reschedule that visit before booking another for this pet.
                </p>
                <div class="conflict__actions">
                  <a class="btn" [routerLink]="['/bookings', conflict.id]">Open existing visit</a>
                </div>
              </div>
            }
            @if (!bookablePets().length && pets().length) {
              <div class="conflict" role="status">
                <p>Every pet already has a visit booked. Open an existing visit, or cancel one to book again.</p>
                <div class="conflict__actions">
                  <a class="btn" routerLink="/bookings">View appointments</a>
                </div>
              </div>
            }
          }
          <div class="nav">
            <button
              type="button"
              class="btn"
              [disabled]="!petIds.length || sessionExpired() || !!conflictBooking()"
              (click)="go(2)"
            >Continue</button>
          </div>
        }

        @if (step() === 2) {
          <p class="hint">Select every symptom that applies</p>
          <div class="pills" role="group" aria-label="Symptoms">
            @for (r of reasons; track r) {
              <button
                type="button"
                class="pill"
                [class.on]="isReasonOn(r)"
                [attr.aria-pressed]="isReasonOn(r)"
                (click)="toggleReason(r)"
              >
                {{ pretty(r) }}
              </button>
            }
          </div>
          <div class="nav">
            <button type="button" class="ghost" (click)="go(1)">Back</button>
            <button type="button" class="btn" [disabled]="!reasonsSelected.length" (click)="go(3)">Continue</button>
          </div>
        }

        @if (step() === 3) {
          <div class="fields">
            @for (q of intakeQs(); track q.label) {
              <div class="field">
                <span class="field__label">
                  {{ q.label }}
                  @if (q.options?.length) {
                    <span class="req" aria-hidden="true">*</span>
                  }
                </span>
                @if (q.options?.length) {
                  <div class="pills" role="group" [attr.aria-label]="q.label">
                    @for (opt of q.options; track opt) {
                      <button
                        type="button"
                        class="pill"
                        [class.on]="intakeAnswerMap[q.label] === opt"
                        (click)="setIntakeAnswer(q.label, opt)"
                      >{{ opt }}</button>
                    }
                  </div>
                  @if (fieldError() === q.label) {
                    <span class="field-err">Please choose an option</span>
                  }
                } @else {
                  <textarea
                    [ngModel]="intakeAnswerMap[q.label] || ''"
                    (ngModelChange)="setIntakeAnswer(q.label, $event)"
                    [name]="'iq-' + q.label"
                    rows="2"
                    [placeholder]="q.placeholder || ''"
                  ></textarea>
                }
              </div>
            }
            <label class="field">
              <span class="field__label">Anything else? <em>(optional)</em></span>
              <textarea [(ngModel)]="intakeExtra" name="intakeExtra" rows="2" placeholder="Optional notes"></textarea>
            </label>
            <div class="field">
              <span class="field__label">Photo <em>(optional)</em></span>
              <label class="upload" [class.upload--has]="!!photoPreview()">
                <input type="file" accept="image/*" (change)="onPhoto($event)" />
                @if (photoPreview()) {
                  <img class="upload__preview" [src]="photoPreview()" alt="Selected photo" />
                  <span class="upload__change">Change photo</span>
                } @else {
                  <span class="upload__icon" aria-hidden="true">＋</span>
                  <strong>Add a photo</strong>
                  <em>Helps the vet prepare before arriving</em>
                }
              </label>
            </div>
          </div>
          <div class="nav">
            <button type="button" class="ghost" (click)="go(2)">Back</button>
            <button type="button" class="btn" [disabled]="!canContinueIntake()" (click)="go(4)">Continue</button>
          </div>
        }

        @if (step() === 4) {
          <div class="addr-block">
            <div class="addr-block__head">
              <p class="hint">Saved addresses</p>
              <a routerLink="/addresses" class="addr-link">Add / manage</a>
            </div>
            @if (addresses().length) {
              <div class="chips">
                @for (a of addresses(); track a.id) {
                  <button
                    type="button"
                    class="chip chip--block"
                    [class.on]="selectedSavedId === a.id"
                    (click)="pickAddress(a)"
                  >
                    <strong>{{ a.label || 'Home' }}@if (a.isDefault) { <span class="chip-tag">Default</span> }</strong>
                    <em>{{ a.address }}</em>
                  </button>
                }
              </div>
            } @else {
              <p class="addr-empty">No saved places yet — enter the visit address below, or <a routerLink="/addresses">save one for next time</a>.</p>
            }
          </div>

          <p class="hint hint--spaced">{{ selectedSavedId ? 'Or enter a different address' : 'Visit address' }}</p>
          <div class="fields addr-grid">
            <label class="field field--full">
              <span class="field__label">Street address <span class="req" aria-hidden="true">*</span></span>
              <input
                type="text"
                [(ngModel)]="addrStreet"
                name="addrStreet"
                required
                placeholder="House / flat, street, landmark"
                (ngModelChange)="onStructuredAddressEdit()"
              />
            </label>
            <label class="field">
              <span class="field__label">Apartment / suite</span>
              <input
                type="text"
                [(ngModel)]="addrApt"
                name="addrApt"
                placeholder="Optional"
                (ngModelChange)="onStructuredAddressEdit()"
              />
            </label>
            <label class="field">
              <span class="field__label">City <span class="req" aria-hidden="true">*</span></span>
              <input
                type="text"
                [(ngModel)]="addrCity"
                name="addrCity"
                required
                placeholder="e.g. Bengaluru"
                (ngModelChange)="onStructuredAddressEdit()"
              />
            </label>
            <div class="field">
              <span class="field__label">State <span class="req" aria-hidden="true">*</span></span>
              <div class="dd" [class.dd--open]="stateOpen()">
                <button
                  type="button"
                  class="dd__trigger"
                  [attr.aria-expanded]="stateOpen()"
                  aria-haspopup="listbox"
                  (click)="toggleStateDd($event)"
                >
                  <span [class.dd__placeholder]="!addrState">{{ addrState || 'Select state' }}</span>
                  <span class="dd__chev" aria-hidden="true">▾</span>
                </button>
                @if (stateOpen()) {
                  <ul class="dd__menu" role="listbox" (click)="$event.stopPropagation()">
                    @for (s of states; track s) {
                      <li role="none">
                        <button
                          type="button"
                          class="dd__opt"
                          role="option"
                          [attr.aria-selected]="addrState === s"
                          [class.on]="addrState === s"
                          (click)="pickState(s)"
                        >{{ s }}</button>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
            <label class="field">
              <span class="field__label">PIN code <span class="req" aria-hidden="true">*</span></span>
              <input
                type="text"
                [(ngModel)]="addrPin"
                name="addrPin"
                required
                inputmode="numeric"
                maxlength="6"
                placeholder="6-digit PIN"
                (ngModelChange)="onStructuredAddressEdit()"
              />
            </label>
          </div>
          @if (fieldError() === 'address') {
            <span class="field-err">Enter a complete address (street, city, state, PIN) or pick a saved place.</span>
          }
          <div class="nav">
            <button type="button" class="ghost" (click)="go(3)">Back</button>
            <button type="button" class="btn" [disabled]="!canContinueAddress()" (click)="go(5)">Continue</button>
          </div>
        }

        @if (step() === 5) {
          <div class="fields">
            <div class="field">
              <span class="field__label">Date <span class="req" aria-hidden="true">*</span></span>
              <div class="dd dd--cal" [class.dd--open]="calOpen()">
                <button
                  type="button"
                  class="dd__trigger"
                  [attr.aria-expanded]="calOpen()"
                  aria-haspopup="dialog"
                  (click)="toggleCalDd($event)"
                >
                  <span [class.dd__placeholder]="!preferredDate">{{ dateTriggerLabel() }}</span>
                  <span class="dd__chev" aria-hidden="true">▾</span>
                </button>
                @if (calOpen()) {
                  <div class="dd__menu dd__menu--cal" role="dialog" aria-label="Calendar" (click)="$event.stopPropagation()">
                    <div class="cal">
                      <div class="cal__head">
                        <button type="button" class="cal__nav" (click)="shiftMonth(-1)" aria-label="Previous month">‹</button>
                        <strong>{{ calLabel() }}</strong>
                        <button type="button" class="cal__nav" (click)="shiftMonth(1)" aria-label="Next month">›</button>
                      </div>
                      <div class="cal__dow" aria-hidden="true">
                        @for (d of dow; track d) { <span>{{ d }}</span> }
                      </div>
                      <div class="cal__grid">
                        @for (cell of calDays(); track cell.key) {
                          @if (cell.blank) {
                            <span class="cal__blank"></span>
                          } @else {
                            <button
                              type="button"
                              class="cal__day"
                              [class.on]="cell.iso === preferredDate"
                              [class.today]="cell.iso === minDate"
                              [disabled]="cell.past"
                              (click)="pickDate(cell.iso!)"
                            >{{ cell.n }}</button>
                          }
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
              @if (fieldError() === 'date') {
                <span class="field-err">Pick a date for the visit</span>
              }
            </div>
            <div class="field">
              <span class="field__label">Time <span class="req" aria-hidden="true">*</span></span>
              <div class="dd" [class.dd--open]="timeOpen()">
                <button
                  type="button"
                  class="dd__trigger"
                  [attr.aria-expanded]="timeOpen()"
                  aria-haspopup="listbox"
                  (click)="toggleTimeDd($event)"
                >
                  <span [class.dd__placeholder]="!preferredTime">{{ preferredTime || 'Select time' }}</span>
                  <span class="dd__chev" aria-hidden="true">▾</span>
                </button>
                @if (timeOpen()) {
                  <ul class="dd__menu" role="listbox" (click)="$event.stopPropagation()">
                    @for (t of timeSlots; track t) {
                      <li role="none">
                        <button
                          type="button"
                          class="dd__opt"
                          role="option"
                          [attr.aria-selected]="preferredTime === t"
                          [class.on]="preferredTime === t"
                          [disabled]="isSlotPast(t)"
                          (click)="pickTime(t)"
                        >{{ t }}@if (isSlotPast(t)) { <em>Passed</em> }</button>
                      </li>
                    }
                  </ul>
                }
              </div>
              @if (preferredDate === minDate) {
                <p class="slot-hint">Past times for today are unavailable.</p>
              }
              @if (fieldError() === 'time') {
                <span class="field-err">{{ timeErrorMessage() }}</span>
              }
            </div>
          </div>
          <div class="nav">
            <button type="button" class="ghost" (click)="go(4)">Back</button>
            <button
              type="button"
              class="btn"
              [disabled]="!preferredDate || !preferredTime || isSlotPast(preferredTime)"
              (click)="go(6)"
            >Review</button>
          </div>
        }

        @if (step() === 6) {
          <div class="review">
            <div class="review__row">
              <div class="review__meta"><em>Pet</em><button type="button" class="review__edit" (click)="go(1)">Edit</button></div>
              <strong>{{ petNames() }}</strong>
            </div>
            <div class="review__row">
              <div class="review__meta"><em>Reason</em><button type="button" class="review__edit" (click)="go(2)">Edit</button></div>
              <strong>{{ reasonLabel() }}</strong>
            </div>
            <div class="review__row">
              <div class="review__meta"><em>Details</em><button type="button" class="review__edit" (click)="go(3)">Edit</button></div>
              <strong>{{ detailsForReview() }}</strong>
            </div>
            <div class="review__row">
              <div class="review__meta"><em>Where</em><button type="button" class="review__edit" (click)="go(4)">Edit</button></div>
              <strong>{{ composedAddress() }}</strong>
            </div>
            <div class="review__row">
              <div class="review__meta"><em>When</em><button type="button" class="review__edit" (click)="go(5)">Edit</button></div>
              <strong>{{ formatWhen() }}</strong>
            </div>
            <div class="review__row">
              <em>Doctor</em>
              <strong>Best available match — assigned by our care team</strong>
            </div>
            <div class="review__pay">
              <em>Payment</em>
              <strong>Pay later · {{ consultFee }}</strong>
              <span>{{ consultFeeNote }}</span>
              <span>You’ll pay when the veterinarian arrives — nothing charged to book.</span>
            </div>
          </div>
          <div class="nav">
            <button type="button" class="ghost" (click)="go(5)">Back</button>
            <button type="button" class="btn" [disabled]="submitting()" (click)="confirm()">
              @if (submitting()) {
                <span class="spin" aria-hidden="true"></span>
                Booking…
              } @else {
                Confirm visit
              }
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .head { margin-bottom: 22px; animation: rise 0.4s var(--vos-ease, ease) both; }
    .head__kicker {
      margin: 0 0 8px;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--vos-brand);
      font-weight: 700;
    }
    .head h1 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: clamp(1.7rem, 4vw, 2.3rem);
      letter-spacing: -0.04em;
      line-height: 1.1;
    }
    .head__sub {
      margin: 0 0 16px;
      color: var(--vos-ink-muted);
      font-size: 1.05rem;
      line-height: 1.4;
      max-width: 40ch;
    }
    .stepper {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 4px;
      margin: 0 0 16px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .stepper__node {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      min-width: 44px;
      flex: 1 1 0;
    }
    .stepper__dot {
      width: 28px; height: 28px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800;
      background: #f0ece4; color: var(--vos-ink-muted);
      border: 1.5px solid transparent;
      line-height: 1;
      box-sizing: border-box;
    }
    .stepper__node--current .stepper__dot {
      background: var(--vos-brand); color: #fff;
      box-shadow: 0 6px 14px rgba(253, 74, 41, 0.28);
    }
    .stepper__node--done .stepper__dot {
      background: #0a0a0a; color: #fff;
    }
    .stepper__label {
      font-family: var(--vos-mono);
      font-size: 9px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-weight: 700;
      white-space: nowrap;
    }
    .stepper__node--current .stepper__label,
    .stepper__node--done .stepper__label {
      color: var(--vos-ink);
    }
    .progress {
      height: 12px;
      border-radius: 999px;
      background: rgba(20, 16, 12, 0.08);
      overflow: hidden;
    }
    .progress span {
      display: block; height: 100%;
      background: linear-gradient(90deg, #FD4A29, #E03E20);
      border-radius: inherit;
      transition: width 0.35s ease;
      min-width: 0;
    }
    .progress__label {
      margin: 10px 0 0;
      font-family: var(--vos-mono);
      font-size: 11px;
      color: var(--vos-ink-muted);
      letter-spacing: 0.06em;
    }

    .panel {
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 22px;
      padding: 24px 22px 22px;
      box-shadow: 0 12px 32px rgba(20, 16, 12, 0.05);
      margin-bottom: 28px;
      min-height: 320px;
      display: flex;
      flex-direction: column;
    }
    .panel .nav { margin-top: auto; padding-top: 24px; }
    .panel--boot { display: grid; gap: 12px; min-height: 200px; }
    .boot-row { height: 64px; border-radius: 16px; margin: 0; }
    .boot-row--short { width: 62%; }

    .conflict {
      margin-top: 16px;
      padding: 14px 16px;
      border-radius: 16px;
      background: #fff7ed;
      border: 1px solid rgba(253, 74, 41, 0.28);
    }
    .conflict p { margin: 0 0 12px; font-size: 0.95rem; line-height: 1.45; color: var(--vos-ink); }
    .conflict__actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .conflict__actions .btn,
    .conflict__actions .ghost { min-height: 42px; padding: 10px 16px; font-size: 0.92rem; text-decoration: none; }

    .modal-backdrop {
      position: fixed; inset: 0; z-index: 80;
      background: rgba(10, 10, 10, 0.45);
      backdrop-filter: blur(4px);
    }
    .modal {
      position: fixed; z-index: 81;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      width: min(420px, calc(100vw - 32px));
      padding: 24px 22px;
      border-radius: 20px;
      background: #fff;
      border: 1px solid var(--vos-border);
      box-shadow: 0 24px 60px rgba(10, 10, 10, 0.22);
    }
    .modal h2 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.03em;
    }
    .modal p {
      margin: 0 0 18px;
      color: var(--vos-ink-muted);
      line-height: 1.45;
    }
    .modal__actions {
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end;
    }
    .modal__actions .btn,
    .modal__actions .ghost { text-decoration: none; }
    .btn--danger {
      background: #0a0a0a !important;
      box-shadow: none !important;
    }

    .chips { display: grid; gap: 10px; }
    .chip {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      text-align: left;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid var(--vos-border);
      background: #faf8f4;
      cursor: pointer;
      font-family: inherit;
      color: inherit;
      transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
      box-sizing: border-box;
    }
    .chip__avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      background: var(--vos-brand-soft, #ffe4dc);
      border: 2px solid rgba(253, 74, 41, 0.18);
      box-sizing: border-box;
    }
    .chip__avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    .chip.on .chip__avatar {
      border-color: var(--vos-brand);
      box-shadow: 0 0 0 3px rgba(253, 74, 41, 0.16);
    }
    .chip__copy {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .chip__copy em {
      display: block;
      font-style: normal;
      color: var(--vos-ink-muted);
      font-size: 0.9rem;
      line-height: 1.3;
    }
    .chip__copy strong {
      display: block;
      font-family: var(--vos-display);
      font-size: 1.12rem;
      letter-spacing: -0.02em;
      line-height: 1.2;
      font-weight: 700;
      color: var(--vos-ink);
    }
    .chip.on {
      border-color: var(--vos-brand);
      background: var(--vos-brand-soft);
      box-shadow: 0 0 0 3px rgba(253, 74, 41, 0.12);
    }
    .chip--blocked,
    .chip--blocked:hover {
      opacity: 0.55;
      cursor: not-allowed;
      background: #f0eee8;
      border-color: var(--vos-border);
      box-shadow: none;
    }
    .chip--blocked.chip.on {
      border-color: var(--vos-border);
      background: #f0eee8;
      box-shadow: none;
    }
    .chip__mono {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--vos-display);
      font-weight: 700;
      font-size: 1.15rem;
      line-height: 1;
      color: var(--vos-brand, #FD4A29);
      text-transform: uppercase;
      box-sizing: border-box;
    }

    .pills {
      display: flex; flex-wrap: wrap; gap: 10px;
    }
    .pill {
      border: 1px solid var(--vos-border);
      background: #fff;
      border-radius: 14px;
      padding: 12px 16px;
      min-height: 46px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      font-family: inherit;
      color: var(--vos-ink);
      box-shadow: 0 2px 8px rgba(10, 10, 10, 0.03);
      transition: transform 0.12s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .pill:hover {
      border-color: rgba(253, 74, 41, 0.35);
      transform: translateY(-1px);
    }
    .pill.on {
      background: #0a0a0a;
      color: #fff;
      border-color: #0a0a0a;
      box-shadow: 0 8px 18px rgba(10, 10, 10, 0.18);
    }

    .fields { display: grid; gap: 16px; }
    .field {
      display: block;
    }
    .field__label {
      display: block;
      margin-bottom: 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-family: var(--vos-mono);
    }
    .field__label em {
      font-style: normal;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 600;
      color: #9a968e;
      font-family: var(--vos-font);
      font-size: 0.85rem;
    }
    .req {
      color: var(--vos-brand);
      margin-left: 2px;
      font-weight: 800;
    }
    .field-err {
      display: block;
      margin-top: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      color: #b42318;
    }
    .field .pills { margin-top: 2px; }
    .field input, .field textarea {
      width: 100%;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--vos-border);
      background: #faf8f4;
      font-size: 1.02rem;
      font-family: inherit;
      color: var(--vos-ink);
      box-sizing: border-box;
      min-height: 52px;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .field textarea { min-height: 88px; resize: vertical; line-height: 1.45; }
    .field input:focus, .field textarea:focus {
      outline: none;
      background: #fff;
      border-color: rgba(253, 74, 41, 0.45);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
    }

    .upload {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 132px;
      padding: 18px;
      border-radius: 16px;
      border: 1.5px dashed rgba(217, 212, 200, 0.95);
      background: linear-gradient(180deg, #fffef9 0%, #faf8f4 100%);
      cursor: pointer;
      text-align: center;
      overflow: hidden;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .upload:hover { border-color: rgba(253, 74, 41, 0.45); }
    .upload input {
      position: absolute; inset: 0;
      opacity: 0; cursor: pointer;
      width: 100%; height: 100%;
      min-height: 0; padding: 0; border: 0;
    }
    .upload__icon {
      width: 36px; height: 36px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--vos-brand-soft); color: var(--vos-brand);
      font-size: 1.2rem; font-weight: 700; margin-bottom: 4px;
    }
    .upload strong {
      font-family: var(--vos-display);
      font-size: 1.05rem;
      letter-spacing: -0.02em;
      color: var(--vos-ink);
    }
    .upload em {
      font-style: normal;
      font-size: 0.88rem;
      color: var(--vos-ink-muted);
    }
    .upload--has {
      padding: 0;
      border-style: solid;
      border-color: var(--vos-border);
      min-height: 180px;
      background: #f7f4ee;
    }
    .upload__preview {
      width: 100%;
      max-height: min(52vh, 420px);
      height: auto;
      object-fit: contain;
      object-position: center;
      display: block;
      background: #f7f4ee;
    }
    .upload__change {
      position: absolute; left: 12px; bottom: 12px;
      padding: 6px 10px; border-radius: 999px;
      background: rgba(10, 10, 10, 0.72); color: #fff;
      font-size: 0.8rem; font-weight: 700;
      pointer-events: none;
    }

    .hint {
      margin: 0 0 10px;
      font-size: 0.92rem;
      color: var(--vos-ink-muted);
      font-weight: 600;
    }
    .hint--spaced { margin-top: 18px; }
    .addr-block { margin-bottom: 4px; }
    .addr-block__head {
      display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
    }
    .addr-block__head .hint { margin-bottom: 10px; }
    .addr-link {
      font-size: 0.88rem; font-weight: 700; color: var(--vos-brand);
      text-decoration: none; white-space: nowrap;
    }
    .addr-link:hover { text-decoration: underline; }
    .addr-empty {
      margin: 0 0 8px; padding: 12px 14px; border-radius: 14px;
      background: #faf8f4; border: 1px dashed var(--vos-border);
      font-size: 0.92rem; color: var(--vos-ink-muted); line-height: 1.45;
    }
    .addr-empty a { color: var(--vos-brand); font-weight: 700; }
    .chip-tag {
      display: inline-block; margin-left: 6px; padding: 1px 7px;
      border-radius: 999px; font-size: 0.7rem; font-weight: 700;
      background: var(--vos-brand-soft); color: var(--vos-brand);
      vertical-align: middle;
    }
    .addr-grid {
      grid-template-columns: 1fr 1fr;
    }
    .addr-grid .field--full { grid-column: 1 / -1; }
    @media (max-width: 560px) {
      .addr-grid { grid-template-columns: 1fr; }
    }
    .field select {
      width: 100%;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--vos-border);
      background: #faf8f4;
      font-size: 1.02rem;
      font-family: inherit;
      color: var(--vos-ink);
      box-sizing: border-box;
      min-height: 52px;
    }
    .field select:focus {
      outline: none;
      background: #fff;
      border-color: rgba(253, 74, 41, 0.45);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
    }

    .dd {
      position: relative;
      width: 100%;
    }
    .dd__trigger {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--vos-border);
      background: #faf8f4;
      font-size: 1.02rem;
      font-family: inherit;
      font-weight: 600;
      color: var(--vos-ink);
      box-sizing: border-box;
      min-height: 52px;
      cursor: pointer;
      text-align: left;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .dd__trigger:hover {
      border-color: rgba(253, 74, 41, 0.35);
    }
    .dd--open .dd__trigger {
      background: #fff;
      border-color: rgba(253, 74, 41, 0.45);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
    }
    .dd__placeholder { color: #9a968e; font-weight: 500; }
    .dd__chev {
      flex-shrink: 0;
      font-size: 0.85rem;
      color: var(--vos-ink-muted);
      transition: transform 0.15s ease;
    }
    .dd--open .dd__chev { transform: rotate(180deg); color: var(--vos-brand); }
    .dd__menu {
      position: absolute;
      left: 0; right: 0; top: calc(100% + 6px);
      z-index: 40;
      margin: 0; padding: 8px;
      list-style: none;
      max-height: 260px;
      overflow: auto;
      border-radius: 16px;
      border: 1px solid var(--vos-border);
      background: #fff;
      box-shadow: 0 16px 40px rgba(10, 10, 10, 0.14);
      animation: ddIn 0.16s var(--vos-ease, ease) both;
    }
    .dd__menu--cal {
      padding: 10px;
      max-height: none;
      overflow: visible;
    }
    @keyframes ddIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .dd__opt {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      border: 0;
      border-radius: 12px;
      background: transparent;
      font: inherit;
      font-weight: 600;
      font-size: 0.98rem;
      color: var(--vos-ink);
      text-align: left;
      cursor: pointer;
    }
    .dd__opt:hover:not(:disabled) { background: rgba(253, 74, 41, 0.08); }
    .dd__opt.on {
      background: #0a0a0a;
      color: #fff;
    }
    .dd__opt:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      text-decoration: line-through;
    }
    .dd__opt em {
      font-style: normal;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.85;
    }

    .cal {
      border: 0;
      border-radius: 12px;
      background: transparent;
      padding: 2px;
    }
    .cal__head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 10px;
    }
    .cal__head strong {
      font-family: var(--vos-display);
      font-size: 1.05rem;
      letter-spacing: -0.02em;
    }
    .cal__nav {
      width: 36px; height: 36px; border-radius: 50%;
      border: 1px solid var(--vos-border); background: #fff;
      font-size: 1.25rem; line-height: 1; cursor: pointer; color: var(--vos-ink);
    }
    .cal__nav:hover { border-color: rgba(253, 74, 41, 0.4); }
    .cal__dow {
      display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
      margin-bottom: 4px;
      text-align: center;
      font-family: var(--vos-mono); font-size: 10px; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--vos-ink-muted); font-weight: 700;
    }
    .cal__grid {
      display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
    }
    .cal__blank { min-height: 40px; }
    .cal__day {
      min-height: 40px; border-radius: 12px; border: 0;
      background: transparent; font: inherit; font-weight: 700;
      cursor: pointer; color: var(--vos-ink);
    }
    .cal__day:hover:not(:disabled) { background: rgba(253, 74, 41, 0.1); }
    .cal__day.today { box-shadow: inset 0 0 0 1.5px rgba(253, 74, 41, 0.45); }
    .cal__day.on {
      background: #0a0a0a; color: #fff;
    }
    .cal__day:disabled {
      color: #c4bfb6; cursor: not-allowed; opacity: 0.7;
    }
    .pill:disabled {
      opacity: 0.35; cursor: not-allowed; text-decoration: line-through;
    }
    .slot-hint {
      margin: 8px 0 0;
      font-size: 0.85rem;
      color: var(--vos-ink-muted);
      font-weight: 500;
    }

    .empty-state { text-align: center; padding: 12px 8px 4px; }
    .empty-state__title {
      margin: 0 0 6px;
      font-family: var(--vos-display);
      font-size: 1.2rem;
      letter-spacing: -0.02em;
    }
    .empty { color: var(--vos-ink-muted); margin: 0 0 16px; }
    .empty-state .btn { width: auto; display: inline-flex; }
    .err-link {
      margin-left: 10px;
      background: none;
      border: 0;
      padding: 0;
      color: #FD4A29;
      font-weight: 700;
      cursor: pointer;
      text-decoration: underline;
      font: inherit;
    }

    .review { display: grid; gap: 12px; }
    .review__row {
      display: grid; gap: 4px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vos-border);
    }
    .review__row:last-child { border-bottom: 0; padding-bottom: 0; }
    .review__meta {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .review em {
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-weight: 600;
    }
    .review__edit {
      border: 0; background: none; padding: 0;
      font: inherit; font-size: 0.85rem; font-weight: 700;
      color: var(--vos-brand); cursor: pointer; text-decoration: underline;
      text-underline-offset: 2px;
    }
    .review strong {
      font-family: var(--vos-display);
      font-size: 1.08rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      white-space: pre-wrap;
      line-height: 1.35;
    }
    .review__pay {
      background: var(--vos-brand-soft);
      border: 1px solid rgba(253, 74, 41, 0.18) !important;
      border-radius: 14px;
      padding: 14px 14px !important;
      margin-top: 4px;
      display: grid; gap: 4px;
    }
    .review__pay strong { color: var(--vos-brand); }
    .review__pay span {
      font-size: 0.92rem;
      color: var(--vos-ink-muted);
      line-height: 1.4;
      font-weight: 500;
    }

    .nav {
      display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;
      margin-top: 20px;
    }
    .btn, .ghost {
      min-height: 48px;
      padding: 12px 22px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      font-family: inherit;
      border: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn {
      background: linear-gradient(135deg, #FD4A29, #E03E20);
      color: #fff;
      box-shadow: 0 10px 24px rgba(253, 74, 41, 0.3);
    }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .ghost {
      background: #fff;
      color: var(--vos-ink);
      border: 1px solid var(--vos-border);
      box-shadow: 0 2px 8px rgba(10, 10, 10, 0.03);
    }
    .ghost:hover { border-color: rgba(253, 74, 41, 0.3); }
    .spin {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
      animation: spin 0.7s linear infinite;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class BookWizardComponent implements OnInit {
  reasons = REASONS;
  timeSlots = TIME_SLOTS;
  states = INDIAN_STATES;
  stepNodes = STEP_NODES;
  dow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  consultFee = CONSULT_FEE;
  consultFeeNote = CONSULT_FEE_NOTE;
  readonly step = signal(1);
  readonly pets = signal<any[]>([]);
  readonly addresses = signal<any[]>([]);
  readonly activeBookings = signal<any[]>([]);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly photoPreview = signal('');
  readonly brokenPhotos = signal<Set<string>>(new Set());
  readonly booting = signal(true);
  readonly sessionExpired = signal(false);
  readonly exitOpen = signal(false);
  petIds: string[] = [];
  reasonsSelected: string[] = [];
  intakeAnswerMap: Record<string, string> = {};
  intakeExtra = '';
  selectedSavedId = '';
  addrStreet = '';
  addrApt = '';
  addrCity = '';
  addrState = '';
  addrPin = '';
  preferredDate = '';
  preferredTime = '';
  consultationType = 'Home Visit';
  photoFile: File | null = null;
  minDate = '';
  /** Calendar month cursor (1st of month). */
  calCursor = new Date();
  private idempotencyKey = '';
  readonly fieldError = signal('');
  readonly stateOpen = signal(false);
  readonly calOpen = signal(false);
  readonly timeOpen = signal(false);

  constructor(
    private api: CustomerApiService,
    private router: Router,
    private route: ActivatedRoute,
    private activePet: ActivePetService,
    private auth: AuthService,
    private bookingGate: BookingGateService,
    private navBack: NavBackService,
  ) {}

  @HostListener('document:click')
  onDocClick() {
    this.closeDropdowns();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeDropdowns();
  }

  closeDropdowns() {
    this.stateOpen.set(false);
    this.calOpen.set(false);
    this.timeOpen.set(false);
  }

  toggleStateDd(ev: Event) {
    ev.stopPropagation();
    const next = !this.stateOpen();
    this.closeDropdowns();
    this.stateOpen.set(next);
  }

  toggleCalDd(ev: Event) {
    ev.stopPropagation();
    const next = !this.calOpen();
    this.closeDropdowns();
    this.calOpen.set(next);
    if (next && this.preferredDate) {
      const [y, m] = this.preferredDate.split('-').map(Number);
      this.calCursor = new Date(y, (m || 1) - 1, 1);
    }
  }

  toggleTimeDd(ev: Event) {
    ev.stopPropagation();
    const next = !this.timeOpen();
    this.closeDropdowns();
    this.timeOpen.set(next);
  }

  pickState(s: string) {
    this.addrState = s;
    this.onStructuredAddressEdit();
    this.stateOpen.set(false);
  }

  dateTriggerLabel() {
    if (!this.preferredDate) return 'Select date';
    const [y, m, d] = this.preferredDate.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  meta() {
    return STEP_TITLES[this.step()] || STEP_TITLES[1];
  }

  progressPercent() {
    return Math.round((this.step() / 6) * 100);
  }

  onTopBack() {
    if (this.step() > 1) {
      this.go(this.step() - 1);
      return;
    }
    this.exitOpen.set(true);
  }

  topBackLabel(): string {
    if (this.step() > 1) return 'Back';
    const prev = this.navBack.previousUrl();
    return this.navBack.labelFor(prev, 'Home');
  }

  discardAndLeave() {
    this.exitOpen.set(false);
    this.navBack.goBack('/home');
  }

  ngOnInit() {
    const today = new Date();
    this.minDate = this.toIsoDate(today);
    this.calCursor = new Date(today.getFullYear(), today.getMonth(), 1);
    this.preferredDate = '';
    void this.reload();
  }

  async reload() {
    this.booting.set(true);
    this.error.set('');
    this.sessionExpired.set(false);
    try {
      await this.auth.waitUntilReady();
      if (!this.auth.isLoggedIn()) {
        this.sessionExpired.set(true);
        this.error.set('Sign in to book a home visit.');
        return;
      }

      await this.auth.getIdTokenFresh(true);

      const [pets, me, addrsRaw, bookingsRaw] = await Promise.all([
        this.api.pets(),
        this.api.me(),
        this.api.addresses().catch(() => []),
        this.api.bookings().catch(() => []),
      ]);
      this.pets.set(pets || []);
      const addrs = this.normalizeAddresses(addrsRaw);
      this.addresses.set(addrs);
      this.activeBookings.set(blockingBookings(bookingsRaw));
      this.bookingGate.syncFromBookings(bookingsRaw, pets || []);
      const def = addrs.find((a: any) => a.isDefault) || addrs[0];
      if (def) {
        this.applySavedAddress(def);
      } else if (me?.address) {
        this.addrStreet = String(me.address);
      }

      const bookable = (pets || []).filter((p: any) => !this.petHasActiveVisit(p.id));
      const q = this.route.snapshot.queryParamMap.get('petId') || this.activePet.get();

      // Never pre-select a pet that already has a visit
      if (q && bookable.some((p: any) => p.id === q)) {
        this.petIds = [q];
        this.activePet.set(q);
        this.step.set(2);
      } else if (bookable.length === 1) {
        this.petIds = [bookable[0].id];
        this.activePet.set(bookable[0].id);
        this.step.set(2);
      } else if (q && this.petHasActiveVisit(q)) {
        this.petIds = [];
        this.activePet.set(q);
        this.step.set(1);
        const pet = (pets || []).find((p: any) => p.id === q);
        this.error.set(
          `${pet?.name || 'This pet'} already has an upcoming or ongoing visit. Pick a different pet, or open the existing visit.`,
        );
      } else {
        this.petIds = [];
      }

      if (!bookable.length && (pets || []).length) {
        this.error.set(
          'Every pet already has an upcoming or ongoing visit. Finish or cancel one before booking another.',
        );
      }
    } catch (e: any) {
      const status = e?.status as number | undefined;
      if (status === 401) {
        this.sessionExpired.set(true);
        this.pets.set([]);
        this.error.set('Your session expired. Sign in again to book for your pet.');
      } else {
        this.error.set(
          e?.error?.message || 'Couldn’t load your pets. Please try again.',
        );
      }
    } finally {
      this.booting.set(false);
    }
  }

  private normalizeAddresses(raw: any): any[] {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.addresses)) return raw.addresses;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }

  private toIsoDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  petPhotoUrl(p: any): string {
    if (!p?.id || this.brokenPhotos().has(p.id)) return '';
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

  petInitial(name: string | null | undefined): string {
    const n = String(name || '?').trim();
    return (n.charAt(0) || '?').toUpperCase();
  }

  displayPetName(name: string | null | undefined, fallback = 'Pet'): string {
    return displayPetName(name, fallback);
  }

  prettySpecies(species: string | null | undefined): string {
    const s = String(species || '').trim();
    if (!s || /^other$/i.test(s)) return 'Pet';
    return displayPetName(s);
  }

  isPetOn(id: string) {
    return this.petIds.includes(id);
  }

  /** Pets that can still be booked (no upcoming / ongoing visit). */
  bookablePets(): any[] {
    return (this.pets() || []).filter((p) => !this.petHasActiveVisit(p.id));
  }

  togglePet(id: string) {
    if (this.petHasActiveVisit(id)) return;
    if (this.isPetOn(id)) {
      this.petIds = this.petIds.filter((x) => x !== id);
    } else {
      this.petIds = [...this.petIds, id];
    }
    if (this.petIds[0]) this.activePet.set(this.petIds[0]);
    this.error.set('');
  }

  /** True when this pet already has an upcoming / ongoing visit. */
  petHasActiveVisit(id: string): boolean {
    const pet = this.pets().find((p) => p.id === id);
    if (this.bookingGate.isBlocked(id, pet?.name)) return true;
    return this.activeBookings().some((b) => bookingBlocksPet(b, id, pet?.name));
  }

  conflictBooking(): any | null {
    for (const id of this.petIds) {
      if (!this.petHasActiveVisit(id)) continue;
      const pet = this.pets().find((p) => p.id === id);
      const hit = this.activeBookings().find((b) => bookingBlocksPet(b, id, pet?.name));
      if (hit) {
        return { ...hit, petName: hit.petName || pet?.name };
      }
    }
    return null;
  }

  pickPet(id: string) {
    this.petIds = [id];
    this.activePet.set(id);
  }

  pretty(r: string) {
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : r;
  }

  isReasonOn(r: string) {
    return this.reasonsSelected.includes(r);
  }

  toggleReason(r: string) {
    if (this.isReasonOn(r)) {
      this.reasonsSelected = this.reasonsSelected.filter((x) => x !== r);
    } else {
      this.reasonsSelected = [...this.reasonsSelected, r];
    }
  }

  reasonLabel() {
    if (!this.reasonsSelected.length) return '—';
    return this.reasonsSelected.map((r) => this.pretty(r)).join(', ');
  }

  /** Merge intake questions across all selected symptoms (unique by label). */
  intakeQs(): IntakeQ[] {
    const seen = new Set<string>();
    const out: IntakeQ[] = [];
    for (const r of this.reasonsSelected) {
      for (const q of INTAKE[r] || INTAKE['other']) {
        if (seen.has(q.label)) continue;
        seen.add(q.label);
        out.push(q);
      }
    }
    return out;
  }

  setIntakeAnswer(label: string, value: string) {
    this.intakeAnswerMap = { ...this.intakeAnswerMap, [label]: value };
    if (this.fieldError() === label) this.fieldError.set('');
  }

  canContinueIntake() {
    return this.intakeQs().every(
      (q) => !q.options?.length || !!(this.intakeAnswerMap[q.label] || '').trim(),
    );
  }

  clearFieldError() {
    this.fieldError.set('');
  }

  onPhoto(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0] || null;
    this.photoFile = file;
    if (this.photoPreview()) URL.revokeObjectURL(this.photoPreview());
    this.photoPreview.set(file ? URL.createObjectURL(file) : '');
  }

  private applySavedAddress(a: any) {
    this.selectedSavedId = a.id || '';
    const text = String(a.address || '').trim();
    // Prefer putting the full saved string in street so dispatch gets the exact saved place;
    // clear structured extras unless we can spot a 6-digit PIN.
    this.addrStreet = text;
    this.addrApt = '';
    this.addrCity = '';
    this.addrState = '';
    this.addrPin = '';
    const pin = text.match(/\b(\d{6})\b/);
    if (pin) this.addrPin = pin[1];
    this.clearFieldError();
  }

  pickAddress(a: any) {
    this.applySavedAddress(a);
  }

  onStructuredAddressEdit() {
    this.selectedSavedId = '';
    this.clearFieldError();
  }

  composedAddress(): string {
    if (this.selectedSavedId) {
      const saved = this.addresses().find((a) => a.id === this.selectedSavedId);
      if (saved?.address) return String(saved.address);
    }
    const parts = [
      this.addrStreet.trim(),
      this.addrApt.trim() ? `Apt ${this.addrApt.trim()}` : '',
      [this.addrCity.trim(), this.addrState.trim()].filter(Boolean).join(', '),
      this.addrPin.trim(),
    ].filter(Boolean);
    return parts.join(', ');
  }

  canContinueAddress() {
    if (this.selectedSavedId) return true;
    const pinOk = /^\d{6}$/.test(this.addrPin.trim());
    return !!(
      this.addrStreet.trim() &&
      this.addrCity.trim() &&
      this.addrState.trim() &&
      pinOk
    );
  }

  shiftMonth(delta: number) {
    this.calCursor = new Date(this.calCursor.getFullYear(), this.calCursor.getMonth() + delta, 1);
  }

  calLabel() {
    return this.calCursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  calDays(): { key: string; blank?: boolean; n?: number; iso?: string; past?: boolean }[] {
    const y = this.calCursor.getFullYear();
    const m = this.calCursor.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const out: { key: string; blank?: boolean; n?: number; iso?: string; past?: boolean }[] = [];
    for (let i = 0; i < firstDow; i++) out.push({ key: `b-${i}`, blank: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = this.toIsoDate(new Date(y, m, d));
      out.push({ key: iso, n: d, iso, past: iso < this.minDate });
    }
    return out;
  }

  pickDate(iso: string) {
    this.preferredDate = iso;
    this.clearFieldError();
    if (this.preferredTime && this.isSlotPast(this.preferredTime)) {
      this.preferredTime = '';
    }
    this.calOpen.set(false);
  }

  pickTime(t: string) {
    if (this.isSlotPast(t)) return;
    this.preferredTime = t;
    this.clearFieldError();
    this.timeOpen.set(false);
  }

  /** Minutes from midnight for a slot like "10:00 AM". */
  private slotMinutes(t: string): number | null {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }

  isSlotPast(t: string): boolean {
    if (!this.preferredDate || this.preferredDate !== this.minDate) return false;
    const mins = this.slotMinutes(t);
    if (mins == null) return false;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return mins <= nowMins;
  }

  timeErrorMessage() {
    if (this.preferredTime && this.isSlotPast(this.preferredTime)) {
      return 'Please select a valid future time';
    }
    return 'Pick a time slot for the visit';
  }

  formatWhen() {
    if (!this.preferredDate) return '—';
    const [y, m, d] = this.preferredDate.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const datePart = dt.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return this.preferredTime ? `${datePart} at ${this.preferredTime}` : datePart;
  }

  /** Validate before moving forward; always allow going back. */
  go(n: number) {
    this.error.set('');
    if (n > this.step()) {
      if (!this.validateBefore(n)) return;
    }
    if (this.petIds[0]) this.activePet.set(this.petIds[0]);
    this.fieldError.set('');
    this.closeDropdowns();
    this.step.set(n);
    if (n === 5 && this.preferredDate) {
      const [y, m] = this.preferredDate.split('-').map(Number);
      this.calCursor = new Date(y, (m || 1) - 1, 1);
    }
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private validateBefore(target: number): boolean {
    if (this.step() === 1 && target >= 2) {
      if (!this.petIds.length) {
        this.error.set('Select at least one pet to continue.');
        return false;
      }
      if (this.conflictBooking()) {
        this.error.set('This pet already has an upcoming or ongoing visit. Open it instead of booking another.');
        return false;
      }
    }
    if (this.step() === 2 && target >= 3) {
      if (!this.reasonsSelected.length) {
        this.error.set('Select at least one symptom to continue.');
        return false;
      }
    }
    if (this.step() === 3 && target >= 4) {
      for (const q of this.intakeQs()) {
        if (q.options?.length && !(this.intakeAnswerMap[q.label] || '').trim()) {
          this.fieldError.set(q.label);
          this.error.set(`Please answer: ${q.label}`);
          return false;
        }
      }
    }
    if (this.step() === 4 && target >= 5) {
      if (!this.canContinueAddress()) {
        this.fieldError.set('address');
        this.error.set('Enter a complete address or pick a saved place.');
        return false;
      }
    }
    if (this.step() === 5 && target >= 6) {
      if (!this.preferredDate) {
        this.fieldError.set('date');
        this.error.set('Pick a date for the visit.');
        return false;
      }
      if (this.preferredDate < this.minDate) {
        this.fieldError.set('date');
        this.error.set('Please pick today or a future date.');
        return false;
      }
      if (!this.preferredTime) {
        this.fieldError.set('time');
        this.error.set('Pick a time slot for the visit.');
        return false;
      }
      if (this.isSlotPast(this.preferredTime)) {
        this.fieldError.set('time');
        this.error.set('Please select a valid future time.');
        this.preferredTime = '';
        return false;
      }
    }
    return true;
  }

  petNames() {
    const names = this.petIds
      .map((id) => this.pets().find((p) => p.id === id)?.name)
      .filter(Boolean)
      .map((n) => displayPetName(n as string));
    return names.length ? names.join(', ') : '—';
  }

  intakeText() {
    const parts = this.intakeQs()
      .map((q) => {
        const a = (this.intakeAnswerMap[q.label] || '').trim();
        return a ? `${q.label}: ${a}` : '';
      })
      .filter(Boolean);
    if (this.intakeExtra.trim()) parts.push(this.intakeExtra.trim());
    if (this.petIds.length > 1) {
      parts.unshift(`Pets on this visit: ${this.petNames()}`);
    }
    return parts.join('\n');
  }

  detailsForReview() {
    const t = this.intakeText().trim();
    if (!t) return 'None provided';
    if (t.toLowerCase() === this.reasonLabel().toLowerCase()) return 'None provided';
    return t;
  }

  async confirm() {
    const address = this.composedAddress();
    if (
      !this.petIds.length ||
      !address.trim() ||
      !this.preferredDate ||
      !this.preferredTime ||
      !this.reasonsSelected.length
    ) {
      this.error.set('Please complete pets, address, date, time, and symptoms before confirming.');
      return;
    }
    if (this.isSlotPast(this.preferredTime)) {
      this.error.set('Please select a valid future time.');
      this.step.set(5);
      return;
    }
    if (this.conflictBooking()) {
      this.error.set('This pet already has an upcoming or ongoing visit.');
      this.step.set(1);
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    try {
      const baseKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `bk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const created: any[] = [];
      for (let i = 0; i < this.petIds.length; i++) {
        const petId = this.petIds[i];
        const booking = await this.api.createBooking(
          {
            petId,
            petIds: this.petIds,
            reasonForVisit: this.reasonsSelected.join(', '),
            intakeText: this.intakeText() || this.reasonLabel(),
            address,
            preferredDate: this.preferredDate,
            preferredTime: this.preferredTime,
            consultationType: this.consultationType,
            mediaUrls: [],
          },
          `${baseKey}-${i}`,
        );
        created.push(booking);
        if (this.photoFile && booking?.id && i === 0) {
          try {
            await this.api.uploadBookingFiles(booking.id, [this.photoFile]);
          } catch {
            /* booking still created — surface soft warning via query param */
            sessionStorage.setItem(
              'vos.booking.uploadWarn',
              'Visit booked, but the photo could not be uploaded. You can add it from the visit page if available.',
            );
          }
        }
      }
      const primary = created[0];
      const intakeId = this.route.snapshot.queryParamMap.get('intakeId');
      if (intakeId && primary?.id) {
        try {
          await this.api.linkIntakeToBooking(intakeId, primary.id);
        } catch {
          /* non-blocking */
        }
      }
      await this.router.navigate(['/bookings', primary.id], {
        queryParams: { booked: '1' },
      });
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Booking failed');
      if (e?.error?.errors) this.error.set((e.error.errors || []).join(', '));
    } finally {
      this.submitting.set(false);
    }
  }
}
