import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

type FilterTab = 'all' | 'unread' | 'urgent';

const DISMISS_KEY = 'vos.notifications.dismissed';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-notifications',
  template: `
    <a [routerLink]="backLink" class="vos-back"><span class="vos-back__chev" aria-hidden="true">‹</span> {{ backLabel }}</a>

    <header class="head">
      <div>
        <h1>Notifications</h1>
        <p class="head__sub">{{ unreadCount() }} unread · {{ visible().length }} showing</p>
      </div>
      <div class="head__actions">
        <button
          type="button"
          class="ghost"
          [disabled]="!unreadCount() || busy()"
          (click)="markAllRead()"
        >
          {{ busy() === 'read' ? 'Marking…' : 'Mark all read' }}
        </button>
        <button
          type="button"
          class="ghost"
          [disabled]="!visible().length || busy()"
          (click)="clearVisible()"
        >
          Clear all
        </button>
      </div>
    </header>

    @if (error()) {
      <div class="vos-err">{{ error() }}</div>
    }
    @if (ok()) {
      <div class="vos-ok">{{ ok() }}</div>
    }

    <div class="tabs" role="tablist" aria-label="Filter notifications">
      <button type="button" role="tab" class="tab" [class.on]="filter() === 'all'" (click)="filter.set('all')">
        All
      </button>
      <button type="button" role="tab" class="tab" [class.on]="filter() === 'unread'" (click)="filter.set('unread')">
        Unread
        @if (unreadCount() > 0) {
          <em>{{ unreadCount() }}</em>
        }
      </button>
      <button type="button" role="tab" class="tab" [class.on]="filter() === 'urgent'" (click)="filter.set('urgent')">
        Care updates
      </button>
    </div>

    @if (loading()) {
      <div class="vos-skel"></div>
      <div class="vos-skel"></div>
    } @else if (!visible().length) {
      <p class="vos-empty">
        @if (filter() === 'unread') {
          You’re all caught up — no unread alerts.
        } @else if (filter() === 'urgent') {
          No care-update alerts right now.
        } @else {
          You’re all caught up.
        }
      </p>
    } @else {
      <div class="list">
        @for (n of visible(); track n.id) {
          <button
            type="button"
            class="item"
            [class.unread]="isUnread(n)"
            (click)="open(n)"
          >
            <div class="item__top">
              <strong>{{ displayTitle(n) }}</strong>
              @if (isUnread(n)) {
                <span class="dot" aria-label="Unread"></span>
              }
            </div>
            <p>{{ displayBody(n) }}</p>
            <small>{{ prettyWhen(n.createdAt) }}</small>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    .head {
      display: flex; flex-wrap: wrap; align-items: flex-end;
      justify-content: space-between; gap: 14px; margin-bottom: 16px;
    }
    h1 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: clamp(1.7rem, 4vw, 2.2rem);
      letter-spacing: -0.03em;
    }
    .head__sub {
      margin: 6px 0 0;
      color: var(--vos-ink-muted);
      font-size: 0.92rem;
    }
    .head__actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .ghost {
      min-height: 40px; padding: 8px 14px; border-radius: 999px;
      border: 1px solid var(--vos-border); background: #fff;
      font: inherit; font-weight: 700; font-size: 0.88rem;
      color: var(--vos-ink); cursor: pointer;
    }
    .ghost:hover:not(:disabled) { border-color: rgba(253, 74, 41, 0.35); }
    .ghost:disabled { opacity: 0.45; cursor: not-allowed; }

    .tabs {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
    }
    .tab {
      border: 1px solid var(--vos-border); background: #fff;
      border-radius: 999px; padding: 8px 14px;
      font: inherit; font-size: 0.88rem; font-weight: 700;
      color: var(--vos-ink-muted); cursor: pointer;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .tab.on {
      background: #0a0a0a; color: #fff; border-color: #0a0a0a;
    }
    .tab em {
      font-style: normal; font-size: 0.75rem;
      background: var(--vos-brand); color: #fff;
      border-radius: 999px; padding: 1px 7px; font-weight: 800;
    }
    .tab.on em { background: #fff; color: #0a0a0a; }

    .list { display: grid; gap: 10px; margin-bottom: 28px; }
    .item {
      display: block; width: 100%; text-align: left; cursor: pointer;
      padding: 16px 18px; border-radius: 18px;
      border: 1px solid var(--vos-border); background: #fff;
      color: inherit; font: inherit;
      box-shadow: 0 6px 18px rgba(20, 16, 12, 0.04);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .item:hover {
      border-color: rgba(253, 74, 41, 0.28);
      box-shadow: 0 10px 24px rgba(20, 16, 12, 0.07);
    }
    .item.unread {
      border-color: rgba(253, 74, 41, 0.45);
      background: linear-gradient(180deg, #fff8f5 0%, #fff 100%);
    }
    .item__top {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
    }
    .item strong {
      font-family: var(--vos-display); font-size: 1.05rem;
      letter-spacing: -0.02em; line-height: 1.25;
    }
    .dot {
      width: 9px; height: 9px; border-radius: 50%;
      background: var(--vos-brand); flex-shrink: 0; margin-top: 6px;
    }
    .item p {
      margin: 6px 0 0; color: var(--vos-ink-muted);
      font-size: 0.95rem; line-height: 1.45;
    }
    small {
      display: block; margin-top: 10px;
      font-family: var(--vos-mono); font-size: 11px;
      letter-spacing: 0.04em; color: var(--vos-ink-muted); font-weight: 600;
    }
  `],
})
export class NotificationsComponent implements OnInit {
  backLink: any[] = ['/home'];
  backLabel = 'Home';
  readonly rawItems = signal<any[]>([]);
  readonly filter = signal<FilterTab>('all');
  readonly loading = signal(true);
  readonly busy = signal<'' | 'read' | 'clear'>('');
  readonly error = signal('');
  readonly ok = signal('');
  private dismissed = new Set<string>(this.readDismissed());

  readonly prepared = computed(() => {
    const cleaned = this.rawItems()
      .filter((n) => n && !this.isDebugOnly(n))
      .map((n) => this.normalizeItem(n))
      .filter(Boolean);
    return this.dedupe(cleaned);
  });

  readonly visible = computed(() => {
    const list = this.prepared().filter((n) => !this.dismissed.has(String(n.id)));
    const f = this.filter();
    if (f === 'unread') return list.filter((n) => this.isUnread(n));
    if (f === 'urgent') return list.filter((n) => this.isUrgent(n));
    return list;
  });

  readonly unreadCount = computed(
    () => this.prepared().filter((n) => this.isUnread(n) && !this.dismissed.has(String(n.id))).length,
  );

  constructor(
    private api: CustomerApiService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
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

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const raw = await this.api.notifications();
      const { items } = this.api.parseNotifications(raw);
      this.rawItems.set(items);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load notifications');
    } finally {
      this.loading.set(false);
    }
  }

  isUnread(n: any) {
    return !n?.readAt && !n?.read;
  }

  displayTitle(n: any) {
    return this.fixDr(String(n?.title || 'Update'));
  }

  displayBody(n: any) {
    return this.friendlyBody(this.fixDr(String(n?.body || n?.message || '')));
  }

  prettyWhen(v: string | null | undefined) {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  async open(n: any) {
    if (this.isUnread(n)) {
      try {
        await this.api.markNotificationRead(n.id);
        this.rawItems.update((list) =>
          list.map((x) => (x.id === n.id ? { ...x, read: true, readAt: new Date().toISOString() } : x)),
        );
      } catch {
        /* still allow deep link */
      }
    }
    const target = this.deepLink(n);
    if (target) await this.router.navigateByUrl(target);
  }

  async markAllRead() {
    const unread = this.prepared().filter((n) => this.isUnread(n) && !this.dismissed.has(String(n.id)));
    if (!unread.length) return;
    this.busy.set('read');
    this.error.set('');
    this.ok.set('');
    try {
      await this.api.markAllNotificationsRead(unread.map((n) => n.id));
      const now = new Date().toISOString();
      const ids = new Set(unread.map((n) => n.id));
      this.rawItems.update((list) =>
        list.map((x) => (ids.has(x.id) ? { ...x, read: true, readAt: now } : x)),
      );
      this.ok.set('All notifications marked as read.');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not mark all as read');
    } finally {
      this.busy.set('');
    }
  }

  async clearVisible() {
    const list = this.visible();
    if (!list.length) return;
    this.busy.set('clear');
    this.error.set('');
    this.ok.set('');
    try {
      const unread = list.filter((n) => this.isUnread(n));
      if (unread.length) {
        await this.api.markAllNotificationsRead(unread.map((n) => n.id));
        const now = new Date().toISOString();
        const ids = new Set(unread.map((n) => n.id));
        this.rawItems.update((rows) =>
          rows.map((x) => (ids.has(x.id) ? { ...x, read: true, readAt: now } : x)),
        );
      }
      for (const n of list) this.dismissed.add(String(n.id));
      this.persistDismissed();
      this.ok.set('Notification list cleared.');
      // Force computed refresh via rawItems touch
      this.rawItems.update((x) => [...x]);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not clear notifications');
    } finally {
      this.busy.set('');
    }
  }

  private normalizeItem(n: any) {
    if (!n) return null;
    return {
      ...n,
      title: this.fixDr(String(n.title || 'Update')),
      body: this.friendlyBody(this.fixDr(String(n.body || n.message || ''))),
    };
  }

  /** Hide raw lifecycle/debug dump notifications. */
  private isDebugOnly(n: any): boolean {
    const text = `${n?.title || ''} ${n?.body || n?.message || ''}`.toLowerCase();
    if (!text.trim()) return true;
    const debugHints = [
      'gps is not fabricated',
      'status updated from the booking lifecycle',
      'fabricated',
      'debug',
      'internal only',
      'stacktrace',
      'null pointer',
      'todo:',
    ];
    return debugHints.some((h) => text.includes(h));
  }

  private friendlyBody(body: string): string {
    const t = body.trim();
    if (!t) return '';
    const lower = t.toLowerCase();
    if (lower.includes('gps is not fabricated') || lower.includes('booking lifecycle')) {
      return 'Your visit status was updated. Open the appointment for the latest details.';
    }
    return t;
  }

  /** Collapse "Dr. Dr. Name" → "Dr. Name". */
  private fixDr(text: string): string {
    return text
      .replace(/\bDr\.?\s*Dr\.?\s+/gi, 'Dr. ')
      .replace(/\bDoctor\s+Dr\.?\s+/gi, 'Dr. ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private dedupe(items: any[]): any[] {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const n of items) {
      const key = this.dedupeKey(n);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
    return out;
  }

  private dedupeKey(n: any): string {
    const title = String(n?.title || '')
      .trim()
      .toLowerCase();
    const body = String(n?.body || '')
      .trim()
      .toLowerCase();
    const t = n?.createdAt ? new Date(n.createdAt) : null;
    const minute =
      t && !Number.isNaN(t.getTime())
        ? `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}-${t.getHours()}-${t.getMinutes()}`
        : String(n?.createdAt || '');
    // Prefer entity+booking when present so same event with different ids still collapses
    const entity = `${n?.entity || n?.payload?.entity || ''}:${n?.entityId || n?.payload?.entityId || n?.payload?.bookingId || ''}`;
    return `${title}|${body}|${minute}|${entity}`;
  }

  private isUrgent(n: any): boolean {
    const text = `${n?.title || ''} ${n?.body || ''}`.toLowerCase();
    return /emergency|urgent|arrived|en route|on the way|started the visit|accepted|bleeding|critical|dispatch/.test(
      text,
    );
  }

  private deepLink(n: any): string | null {
    const entity = n.entity || n.payload?.entity;
    const entityId = n.entityId || n.payload?.entityId || n.payload?.bookingId;
    if (entity === 'booking' && entityId) return `/bookings/${entityId}`;
    if (entity === 'visit' && entityId) return `/visits/${entityId}`;
    if (n.payload?.bookingId) return `/bookings/${n.payload.bookingId}`;
    if (n.payload?.visitId) return `/visits/${n.payload.visitId}`;
    if (n.payload?.petId) return `/pets/${n.payload.petId}`;
    const body = String(n.body || '');
    const bk = body.match(/\bBK-?\d+\b/i);
    if (bk) {
      // best-effort: list page if we only have display id
      return '/bookings';
    }
    return null;
  }

  private readDismissed(): string[] {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private persistDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...this.dismissed]));
    } catch {
      /* ignore */
    }
  }
}
