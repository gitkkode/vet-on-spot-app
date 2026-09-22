import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-support',
  template: `
    <div class="wrap">
      <a [routerLink]="backLink" class="vos-back">← {{ backLabel }}</a>
      <h1>Need help?</h1>
      <p class="vos-muted">Send a request to our care team — track replies here.</p>

      @if (ok()) {
        <div class="vos-ok">{{ ok() }}</div>
      }
      @if (error()) {
        <div class="vos-err">{{ error() }}</div>
      }

      <form class="vos-card form" (ngSubmit)="submit()">
        <label class="vos-field"
          >Topic
          <select [(ngModel)]="category" name="category">
            <option value="booking_issue">Booking issue</option>
            <option value="doctor_issue">Doctor issue</option>
            <option value="payment_issue">Payment issue</option>
            <option value="prescription_issue">Prescription issue</option>
            <option value="technical_issue">Technical issue</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label class="vos-field">Subject<input [(ngModel)]="subject" name="subject" required /></label>
        <label class="vos-field"
          >Details<textarea [(ngModel)]="body" name="body" rows="4" required></textarea
        ></label>
        <button class="vos-btn" type="submit" [disabled]="saving()">
          {{ saving() ? 'Sending…' : 'Submit' }}
        </button>
      </form>

      @if (tickets().length) {
        <h2>Your requests</h2>
        @for (t of tickets(); track t.id) {
          <button
            type="button"
            class="vos-card ticket"
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
            <article class="vos-card detail">
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
  `,
  styles: [`
    .wrap { max-width: 720px; margin: 0 auto; }
    h1, h2, h3 { font-family: var(--vos-display); margin: 8px 0; }
    h2 { font-size: 1.15rem; margin-top: 22px; }
    h3 { font-size: 1rem; }
    .form { margin-bottom: 8px; }
    .ticket {
      display: block; width: 100%; text-align: left; cursor: pointer;
      margin-bottom: 8px; border: 1px solid var(--vos-border);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .ticket:hover, .ticket--open {
      border-color: rgba(253, 74, 41, 0.35);
      box-shadow: 0 10px 24px rgba(10, 10, 10, 0.06);
    }
    .ticket__top {
      display: flex; justify-content: space-between; align-items: center; gap: 10px;
    }
    .badge {
      font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 8px;
      background: #fff7e8; color: #8a5a12; text-transform: capitalize;
    }
    .badge[data-status='closed'], .badge[data-status='resolved'] {
      background: #ecfdf3; color: #1F7A4C;
    }
    .badge[data-status='open'], .badge[data-status='pending'] {
      background: var(--vos-brand-soft); color: var(--vos-brand);
    }
    .ticket__subject { margin: 8px 0 4px; font-weight: 600; }
    .ticket__hint { font-size: 0.85rem; color: var(--vos-brand); font-weight: 700; }
    .detail { margin: -2px 0 12px; }
    .meta { margin: 0 0 10px; color: var(--vos-ink-muted); font-size: 0.9rem; }
    .body { margin: 0 0 12px; white-space: pre-wrap; line-height: 1.45; }
    .reply {
      padding: 10px 0; border-top: 1px solid var(--vos-border);
    }
    .reply strong { display: block; margin-bottom: 4px; }
    .reply p { margin: 0 0 4px; }
  `],
})
export class SupportComponent implements OnInit {
  category = 'booking_issue';
  subject = '';
  body = '';
  comment = '';
  bookingId = '';
  petId = '';
  backLink: any[] = ['/home'];
  backLabel = 'Home';
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
    const from = this.route.snapshot.queryParamMap.get('from');
    if (from === 'profile') {
      this.backLink = ['/profile'];
      this.backLabel = 'Profile';
    } else if (from === 'settings') {
      this.backLink = ['/settings'];
      this.backLabel = 'Settings';
    } else {
      this.backLink = ['/home'];
      this.backLabel = 'Home';
    }
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
