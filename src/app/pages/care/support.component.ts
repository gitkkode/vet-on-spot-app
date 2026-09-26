import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { VosSelectComponent, VosSelectOption } from '../../shared/vos-select.component';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, VosSelectComponent, VosBackButtonComponent],
  selector: 'app-support',
  template: `
    <div class="wrap">
      <vos-back-button />

      <header class="head">
        <h1>Need help?</h1>
        <p class="lede">Send a request to our care team — track replies here.</p>
      </header>

      @if (ok()) {
        <div class="vos-ok">{{ ok() }}</div>
      }
      @if (error()) {
        <div class="vos-err">{{ error() }}</div>
      }

      <div class="layout">
        <section class="panel" aria-labelledby="support-new-title">
          <header class="panel__head">
            <h2 id="support-new-title">New request</h2>
            <p>Tell us what’s going on — we’ll pick it up from here.</p>
          </header>
          <form class="panel__body form" (ngSubmit)="submit()">
            <div class="form__fields">
              <label class="vos-field"
                >Topic
                <vos-select
                  name="category"
                  [options]="categoryOptions"
                  [(ngModel)]="category"
                  ariaLabel="Topic"
                />
              </label>
              <label class="vos-field">Subject<input [(ngModel)]="subject" name="subject" required /></label>
              <label class="vos-field"
                >Details<textarea [(ngModel)]="body" name="body" rows="4" required></textarea
              ></label>
            </div>
            <div class="form__actions">
              <button class="vos-btn" type="submit" [disabled]="saving()">
                {{ saving() ? 'Sending…' : 'Submit' }}
              </button>
            </div>
          </form>
        </section>

        <section class="panel" aria-labelledby="support-list-title">
          <header class="panel__head">
            <div class="panel__head-row">
              <h2 id="support-list-title">Your requests</h2>
              @if (tickets().length) {
                <span class="count">{{ tickets().length }}</span>
              }
            </div>
            <p>Open a ticket to see details and leave a comment.</p>
          </header>

          <div class="panel__body list">
            @if (!tickets().length) {
              <div class="empty">
                <strong>No requests yet</strong>
                <p>Submit one on the left and it’ll show up here.</p>
              </div>
            } @else {
              @for (t of tickets(); track t.id) {
                <button
                  type="button"
                  class="ticket"
                  [class.ticket--open]="selectedId() === t.id"
                  (click)="toggle(t)"
                >
                  <div class="ticket__top">
                    <strong>{{ t.displayId || t.id }}</strong>
                    <span class="badge" [attr.data-status]="(t.status || '').toLowerCase()">{{ prettyStatus(t.status) }}</span>
                  </div>
                  <p class="ticket__subject">{{ t.subject || 'Support request' }}</p>
                  <span class="ticket__hint">{{ selectedId() === t.id ? 'Hide details' : 'View details' }}</span>
                </button>

                @if (selectedId() === t.id) {
                  <article class="detail">
                    <p class="meta">
                      {{ prettyCategory(t.category) }}
                      @if (t.createdAt) {
                        · Opened {{ (t.createdAt || '').slice(0, 10) }}
                      }
                    </p>
                    @if (t.body || t.description || t.message) {
                      <p class="body">{{ t.body || t.description || t.message }}</p>
                    } @else {
                      <p class="vos-muted">No written details on file for this request.</p>
                    }

                    @if (t.responses?.length || t.replies?.length || t.messages?.length) {
                      <h3>Team replies</h3>
                      @for (r of t.responses || t.replies || t.messages; track $index) {
                        <div class="reply">
                          <strong>{{ r.authorName || r.from || 'VetonSpot Support' }}</strong>
                          <p>{{ r.body || r.message || r.text }}</p>
                          @if (r.createdAt) {
                            <span class="vos-muted">{{ (r.createdAt || '').slice(0, 16).replace('T', ' ') }}</span>
                          }
                        </div>
                      }
                    } @else {
                      <p class="vos-muted">No in-app replies yet — we’ll also email you when there’s an update.</p>
                    }

                    <label class="vos-field"
                      >Add a comment
                      <textarea [(ngModel)]="comment" name="comment" rows="3" placeholder="Share more detail for the care team…"></textarea>
                    </label>
                    <button type="button" class="vos-btn vos-btn-secondary" [disabled]="!comment.trim() || commenting()" (click)="addComment(t)">
                      {{ commenting() ? 'Sending…' : 'Send comment' }}
                    </button>
                  </article>
                }
              }
            }
          </div>
        </section>
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

    .head { margin: 2px 0 20px; }
    h1 {
      font-family: var(--vos-display);
      margin: 0;
      font-size: clamp(1.65rem, 3vw, 2.15rem);
      letter-spacing: -0.03em;
    }
    .lede {
      margin: 6px 0 0;
      color: var(--vos-ink-muted);
      max-width: 52ch;
      line-height: 1.45;
    }

    .layout {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
      align-items: stretch;
      height: min(560px, calc(100dvh - 250px));
    }

    .panel {
      display: flex;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
      height: 100%;
      border: 1px solid var(--vos-border);
      border-radius: 20px;
      background: #fff;
      box-shadow: 0 10px 28px rgba(10, 10, 10, 0.04);
      overflow: hidden;
    }

    .panel__head {
      flex: 0 0 auto;
      padding: 18px 20px 14px;
      border-bottom: 1px solid var(--vos-border);
      background: #faf8f4;
      min-height: 78px;
      box-sizing: border-box;
    }
    .panel__head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .panel__head h2 {
      font-family: var(--vos-display);
      margin: 0;
      font-size: 1.15rem;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .panel__head p {
      margin: 6px 0 0;
      color: var(--vos-ink-muted);
      font-size: 0.9rem;
      line-height: 1.35;
    }
    .count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      border-radius: 999px;
      background: var(--vos-brand-soft);
      color: var(--vos-brand);
      font-size: 0.8rem;
      font-weight: 800;
    }

    .panel__body {
      flex: 1 1 auto;
      min-height: 0;
      padding: 18px 20px 20px;
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 0;
    }
    .form__fields {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .form__actions {
      display: flex;
      justify-content: flex-start;
      padding-top: 2px;
    }
    .form__actions .vos-btn {
      min-width: 140px;
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }

    .empty {
      margin: auto 0;
      text-align: center;
      padding: 28px 12px;
      color: var(--vos-ink-muted);
    }
    .empty strong {
      display: block;
      color: var(--vos-ink);
      font-family: var(--vos-display);
      font-size: 1.05rem;
      margin-bottom: 6px;
    }
    .empty p { margin: 0; }

    .ticket {
      display: block;
      width: 100%;
      text-align: left;
      cursor: pointer;
      margin: 0;
      padding: 14px 14px 12px;
      border-radius: 14px;
      border: 1px solid var(--vos-border);
      background: #fffef9;
      font: inherit;
      color: inherit;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }
    .ticket:hover, .ticket--open {
      border-color: rgba(253, 74, 41, 0.35);
      background: #fff;
      box-shadow: 0 8px 20px rgba(10, 10, 10, 0.05);
    }
    .ticket__top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 8px;
      background: #fff7e8;
      color: #8a5a12;
      text-transform: capitalize;
      flex-shrink: 0;
    }
    .badge[data-status='closed'], .badge[data-status='resolved'] {
      background: #ecfdf3; color: #1F7A4C;
    }
    .badge[data-status='open'], .badge[data-status='pending'] {
      background: var(--vos-brand-soft); color: var(--vos-brand);
    }
    .ticket__subject {
      margin: 8px 0 6px;
      font-weight: 600;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .ticket__hint {
      font-size: 0.85rem;
      color: var(--vos-brand);
      font-weight: 700;
    }

    .detail {
      margin: 0;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid rgba(253, 74, 41, 0.22);
      background: #fff;
    }
    h3 {
      font-family: var(--vos-display);
      margin: 8px 0;
      font-size: 1rem;
    }
    .meta { margin: 0 0 10px; color: var(--vos-ink-muted); font-size: 0.9rem; }
    .body { margin: 0 0 12px; white-space: pre-wrap; line-height: 1.45; }
    .reply {
      padding: 10px 0;
      border-top: 1px solid var(--vos-border);
    }
    .reply strong { display: block; margin-bottom: 4px; }
    .reply p { margin: 0 0 4px; }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
        height: auto;
        gap: 16px;
      }
      .panel {
        height: auto;
      }
      .list {
        max-height: min(420px, 50dvh);
      }
    }
  `],
})
export class SupportComponent implements OnInit {
  category = 'booking_issue';
  readonly categoryOptions: VosSelectOption[] = [
    { value: 'booking_issue', label: 'Booking issue' },
    { value: 'doctor_issue', label: 'Doctor issue' },
    { value: 'payment_issue', label: 'Payment issue' },
    { value: 'prescription_issue', label: 'Prescription issue' },
    { value: 'technical_issue', label: 'Technical issue' },
    { value: 'other', label: 'Other' },
  ];
  subject = '';
  body = '';
  comment = '';
  bookingId = '';
  petId = '';

  readonly tickets = signal<any[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly commenting = signal(false);
  readonly error = signal('');
  readonly ok = signal('');

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.bookingId = this.route.snapshot.queryParamMap.get('bookingId') || '';
    this.petId = this.route.snapshot.queryParamMap.get('petId') || '';
    void this.load();
  }

  prettyStatus(s: string) {
    return String(s || 'open').replace(/_/g, ' ');
  }

  prettyCategory(c: string) {
    return String(c || 'support')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  toggle(t: any) {
    const id = t.id || t.displayId;
    this.selectedId.set(this.selectedId() === id ? null : id);
    this.comment = '';
  }

  async load() {
    try {
      const raw = await this.api.supportTickets();
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.tickets)
          ? (raw as any).tickets
          : Array.isArray((raw as any)?.items)
            ? (raw as any).items
            : [];
      this.tickets.set(list);
    } catch {
      /* ignore */
    }
  }

  async submit() {
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      const t = await this.api.createSupport({
        category: this.category,
        subject: this.subject,
        body: this.body,
        bookingId: this.bookingId || undefined,
        petId: this.petId || undefined,
      });
      this.ok.set(`Request ${t?.displayId || ''} submitted.`.trim());
      this.subject = '';
      this.body = '';
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.saving.set(false);
    }
  }

  async addComment(t: any) {
    const text = this.comment.trim();
    if (!text) return;
    this.commenting.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      // Prefer a ticket follow-up endpoint when available; fall back to a linked support note.
      try {
        await this.api.createSupport({
          category: t.category || this.category || 'other',
          subject: `Re: ${t.subject || t.displayId || 'Support request'}`,
          body: text,
          parentTicketId: t.id,
          ticketId: t.id,
        });
      } catch {
        await this.api.createSupport({
          category: 'other',
          subject: `Follow-up on ${t.displayId || t.id}`,
          body: text,
        });
      }
      this.ok.set('Comment sent to support.');
      this.comment = '';
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not send comment');
    } finally {
      this.commenting.set(false);
    }
  }
}
