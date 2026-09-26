import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomerApiService } from '../../services/customer-api.service';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';

@Component({
  standalone: true,
  imports: [FormsModule, VosBackButtonComponent],
  selector: 'app-addresses',
  template: `
    <div class="wrap">
      <vos-back-button [fallback]="'/profile'" fallbackLabel="Profile" />

      <header class="head">
        <h1>Saved addresses</h1>
        <p class="lede">Home-visit locations for booking and your profile.</p>
      </header>

      @if (error()) {
        <div class="vos-err">{{ error() }}</div>
      }
      @if (ok()) {
        <div class="vos-ok">{{ ok() }}</div>
      }

      <div class="layout">
        <section class="panel panel--list" aria-labelledby="addr-list-title">
          <header class="panel__head">
            <div class="panel__head-row">
              <h2 id="addr-list-title">Your addresses</h2>
              @if (list().length) {
                <span class="count">{{ list().length }}</span>
              }
            </div>
            <p>Tap an address book entry when booking a home visit.</p>
          </header>

          <div class="panel__body list">
            @if (loading()) {
              <div class="vos-skel"></div>
              <div class="vos-skel"></div>
            } @else if (!list().length) {
              <div class="empty">
                <div class="empty__mark" aria-hidden="true"></div>
                <strong>No saved addresses yet</strong>
                <p>Add a home or clinic address on the right so booking can reuse it.</p>
              </div>
            } @else {
              @for (a of list(); track trackA(a)) {
                <article class="item" [class.item--soft]="a._fromProfile">
                  <div class="top">
                    <strong>{{ a.label || 'Address' }}</strong>
                    @if (a.isDefault || a._fromProfile) {
                      <span class="vos-badge">Default</span>
                    }
                  </div>
                  <p class="addr">{{ prettyAddress(a.address) }}</p>
                  @if (a._fromProfile) {
                    <p class="hint">From your profile · save it to keep it in your address book.</p>
                    <button
                      type="button"
                      class="vos-btn vos-btn-secondary"
                      [disabled]="saving()"
                      (click)="promoteProfile(a)"
                    >
                      Add to address book
                    </button>
                  }
                </article>
              }
            }
          </div>
        </section>

        <section class="panel panel--form" aria-labelledby="addr-add-title">
          <header class="panel__head">
            <h2 id="addr-add-title">Add address</h2>
            <p>Label it clearly — Home, Parents’, Clinic pickup, etc.</p>
          </header>

          <form class="panel__body form" (ngSubmit)="save()">
            <label class="vos-field"
              >Label<input [(ngModel)]="label" name="label" placeholder="Home" autocomplete="organization"
            /></label>
            <label class="vos-field"
              >Address<textarea
                [(ngModel)]="address"
                name="address"
                rows="4"
                required
                placeholder="Street, area, city, PIN"
                autocomplete="street-address"
              ></textarea>
            </label>
            <label class="vos-check">
              <input type="checkbox" [(ngModel)]="isDefault" name="isDefault" />
              <span>Set as default for booking</span>
            </label>
            <div class="form__actions">
              <button class="vos-btn" type="submit" [disabled]="saving() || !address.trim()">
                {{ saving() ? 'Saving…' : 'Save address' }}
              </button>
            </div>
          </form>
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

    .head { margin: 2px 0 18px; }
    h1 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: clamp(1.65rem, 3vw, 2.15rem);
      letter-spacing: -0.03em;
    }
    .lede {
      margin: 6px 0 0;
      color: var(--vos-ink-muted);
      max-width: 48ch;
      line-height: 1.45;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.95fr);
      gap: 20px;
      align-items: stretch;
      min-height: min(520px, calc(100dvh - 260px));
    }

    .panel {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
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
      margin: 0;
      font-family: var(--vos-display);
      font-size: 1.15rem;
      letter-spacing: -0.02em;
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
      padding: 16px 18px 18px;
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }

    .item {
      margin: 0;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid var(--vos-border);
      background: #fffef9;
    }
    .item--soft {
      background: linear-gradient(180deg, #fffef9, #fff5f3);
    }
    .top {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .vos-badge { margin-left: 0; }
    .addr {
      margin: 8px 0 0;
      line-height: 1.45;
      color: var(--vos-ink);
      word-break: break-word;
    }
    .hint {
      margin: 8px 0 10px;
      color: var(--vos-ink-muted);
      font-size: 0.9rem;
    }

    .form { margin: 0; }
    .vos-check { margin: 10px 0 14px; }
    .form__actions {
      display: flex;
      justify-content: flex-start;
    }
    .form__actions .vos-btn { min-width: 148px; }

    .empty {
      margin: auto 0;
      text-align: center;
      padding: 28px 12px;
      color: var(--vos-ink-muted);
    }
    .empty__mark {
      width: 44px;
      height: 44px;
      margin: 0 auto 10px;
      border-radius: 12px;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      box-shadow: inset 0 0 0 2px rgba(253, 74, 41, 0.2);
    }
    .empty strong {
      display: block;
      color: var(--vos-ink);
      font-family: var(--vos-display);
      font-size: 1.05rem;
      margin-bottom: 6px;
    }
    .empty p { margin: 0; }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
        min-height: 0;
        height: auto;
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
export class AddressesComponent implements OnInit {
  label = 'Home';
  address = '';
  isDefault = false;

  readonly list = signal<any[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ok = signal('');

  constructor(private api: CustomerApiService) {}

  ngOnInit() {
    void this.load();
  }

  trackA(a: any) {
    return a.id || a._fromProfile || a.address;
  }

  /** Collapse accidental repeated address segments for cleaner display. */
  prettyAddress(raw: unknown): string {
    const text = String(raw || '').trim();
    if (!text) return '—';
    const parts = text
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const p of parts) {
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(p);
    }
    return unique.join(', ') || text;
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [raw, me] = await Promise.all([
        this.api.addresses().catch(() => []),
        this.api.me().catch(() => null),
      ]);
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.addresses)
          ? (raw as any).addresses
          : Array.isArray((raw as any)?.items)
            ? (raw as any).items
            : [];

      const profileAddr = String(me?.address || '').trim();
      const hasMatch =
        !!profileAddr &&
        list.some(
          (a: any) =>
            String(a.address || '')
              .trim()
              .toLowerCase() === profileAddr.toLowerCase(),
        );

      const merged = [...list];
      if (profileAddr && !hasMatch) {
        merged.unshift({
          id: 'profile-address',
          label: 'Home',
          address: profileAddr,
          isDefault: !list.some((a: any) => a.isDefault),
          _fromProfile: true,
        });
      }
      this.list.set(merged);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async promoteProfile(a: any) {
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      await this.api.createAddress({
        label: a.label || 'Home',
        address: a.address,
        isDefault: true,
      });
      this.ok.set('Address added to your book.');
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.saving.set(false);
    }
  }

  async save() {
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      await this.api.createAddress({
        label: this.label || 'Home',
        address: this.address,
        isDefault: this.isDefault,
      });
      this.ok.set('Saved');
      this.address = '';
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.saving.set(false);
    }
  }
}
