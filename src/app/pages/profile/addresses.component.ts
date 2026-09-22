import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-addresses',
  template: `
    <div class="wrap">
      <a [routerLink]="backLink" class="vos-back">← {{ backLabel }}</a>
      <h1>Saved addresses</h1>
      <p class="vos-muted">Home-visit locations for booking and your profile.</p>

      @if (error()) {
        <div class="vos-err">{{ error() }}</div>
      }
      @if (ok()) {
        <div class="vos-ok">{{ ok() }}</div>
      }

      @if (loading()) {
        <div class="vos-skel"></div>
      } @else {
        @for (a of list(); track trackA(a)) {
          <article class="vos-card item" [class.item--soft]="a._fromProfile">
            <div class="top">
              <strong>{{ a.label || 'Address' }}</strong>
              @if (a.isDefault || a._fromProfile) {
                <span class="vos-badge">Default</span>
              }
            </div>
            <p>{{ a.address }}</p>
            @if (a._fromProfile) {
              <p class="hint">From your profile · save it below to keep it in your address book.</p>
              <button type="button" class="vos-btn vos-btn-secondary" [disabled]="saving()" (click)="promoteProfile(a)">
                Add to address book
              </button>
            }
          </article>
        }

        @if (!list().length) {
          <div class="empty">
            <div class="empty__mark" aria-hidden="true"></div>
            <h2>No saved addresses yet</h2>
            <p>Add a home or clinic address so booking can reuse it.</p>
          </div>
        }
      }

      <form class="vos-card form" (ngSubmit)="save()">
        <h2>Add address</h2>
        <label class="vos-field">Label<input [(ngModel)]="label" name="label" placeholder="Home" /></label>
        <label class="vos-field"
          >Address<textarea [(ngModel)]="address" name="address" rows="3" required></textarea
        ></label>
        <label class="check"><input type="checkbox" [(ngModel)]="isDefault" name="isDefault" /> Default</label>
        <button class="vos-btn" type="submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save address' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .wrap { max-width: 720px; margin: 0 auto; }
    h1, h2 { font-family: var(--vos-display); margin: 4px 0 6px; }
    h2 { font-size: 1.1rem; }
    .item { margin-bottom: 10px; }
    .item--soft { background: linear-gradient(180deg, #fffef9, #fff5f3); }
    .top { display: flex; align-items: center; gap: 8px; }
    .vos-badge { margin-left: 0; }
    .hint { margin: 6px 0 10px; color: var(--vos-ink-muted); font-size: 0.9rem; }
    .form { margin-top: 14px; }
    .check { display: flex; align-items: center; gap: 8px; margin: 10px 0; font-weight: 600; }
    .empty {
      text-align: center; padding: 28px 18px; margin-bottom: 12px;
      border-radius: 20px; background: #fffef9; border: 1px solid var(--vos-border);
    }
    .empty__mark {
      width: 44px; height: 44px; margin: 0 auto 10px; border-radius: 12px;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      box-shadow: inset 0 0 0 2px rgba(253, 74, 41, 0.2);
    }
    .empty h2 { margin-bottom: 6px; }
    .empty p { margin: 0; color: var(--vos-ink-muted); }
  `],
})
export class AddressesComponent implements OnInit {
  label = 'Home';
  address = '';
  isDefault = false;
  backLink: any[] = ['/profile'];
  backLabel = 'Profile';
  readonly list = signal<any[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ok = signal('');

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    const from = this.route.snapshot.queryParamMap.get('from');
    if (from === 'settings') {
      this.backLink = ['/settings'];
      this.backLabel = 'Settings';
    } else {
      this.backLink = ['/profile'];
      this.backLabel = 'Profile';
    }
    void this.load();
  }

  trackA(a: any) {
    return a.id || a._fromProfile || a.address;
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
