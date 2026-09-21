import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [DatePipe, RouterLink],
  selector: 'app-notifications',
  template: `
    <a routerLink="/" class="vos-back">← Home</a>
    <h1>Notifications</h1>
    @if (error()) { <div class="vos-err">{{ error() }}</div> }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <p class="vos-empty">You're all caught up.</p>
    } @else {
      @for (n of items(); track n.id) {
        <button type="button" class="vos-card item" [class.unread]="!n.readAt && !n.read" (click)="open(n)">
          <strong>{{ n.title }}</strong>
          <p>{{ n.body }}</p>
          <small>{{ n.createdAt | date:'short' }}</small>
        </button>
      }
    }
  `,
  styles: [`
    h1 { font-family: var(--vos-display); }
    .item {
      display: block; width: 100%; text-align: left; cursor: pointer;
      border: 1px solid transparent; color: inherit; font: inherit;
    }
    .item.unread { border-color: var(--vos-brand); background: #f7fbf8; }
    .item p { margin: 6px 0; color: var(--vos-ink-muted); }
    small { color: var(--vos-ink-muted); }
  `],
})
export class NotificationsComponent implements OnInit {
  readonly items = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private api: CustomerApiService, private router: Router) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      this.items.set((await this.api.notifications()) || []);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async open(n: any) {
    if (!n.readAt && !n.read) {
      try {
        await this.api.markNotificationRead(n.id);
        this.items.update((list) =>
          list.map((x) => (x.id === n.id ? { ...x, read: true, readAt: new Date().toISOString() } : x)),
        );
      } catch {
        /* still allow deep link */
      }
    }
    const target = this.deepLink(n);
    if (target) await this.router.navigateByUrl(target);
  }

  private deepLink(n: any): string | null {
    const entity = n.entity || n.payload?.entity;
    const entityId = n.entityId || n.payload?.entityId || n.payload?.bookingId;
    if (entity === 'booking' && entityId) return `/bookings/${entityId}`;
    if (entity === 'visit' && entityId) return `/visits/${entityId}`;
    if (n.payload?.bookingId) return `/bookings/${n.payload.bookingId}`;
    if (n.payload?.visitId) return `/visits/${n.payload.visitId}`;
    if (n.payload?.petId) return `/pets/${n.payload.petId}`;
    return null;
  }
}
