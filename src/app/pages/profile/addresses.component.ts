import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-addresses',
  template: `
    <a routerLink="/profile" class="vos-back">← Profile</a>
    <h1>Saved addresses</h1>
    @if (error()) { <div class="vos-err">{{ error() }}</div> }
    @if (ok()) { <div class="vos-ok">{{ ok() }}</div> }
    @for (a of list(); track a.id) {
      <div class="vos-card">
        <strong>{{ a.label }}</strong>@if (a.isDefault) { <span class="vos-badge">Default</span> }
        <p>{{ a.address }}</p>
      </div>
    }
    @if (!list().length && !loading()) {
      <p class="vos-empty">No saved addresses yet.</p>
    }
    <form class="vos-card" (ngSubmit)="save()">
      <label class="vos-field">Label<input [(ngModel)]="label" name="label" placeholder="Home" /></label>
      <label class="vos-field">Address<textarea [(ngModel)]="address" name="address" rows="3" required></textarea></label>
      <label><input type="checkbox" [(ngModel)]="isDefault" name="isDefault" /> Default</label>
      <button class="vos-btn" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save address' }}</button>
    </form>
  `,
  styles: [`h1{font-family:var(--vos-display)}.vos-badge{margin-left:8px}`],
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
  ngOnInit() { void this.load(); }
  async load() {
    this.loading.set(true);
    try { this.list.set(await this.api.addresses() || []); }
    catch (e: any) { this.error.set(e?.message || 'Failed'); }
    finally { this.loading.set(false); }
  }
  async save() {
    this.saving.set(true); this.error.set(''); this.ok.set('');
    try {
      await this.api.createAddress({ label: this.label || 'Home', address: this.address, isDefault: this.isDefault });
      this.ok.set('Saved');
      this.address = '';
      await this.load();
    } catch (e: any) { this.error.set(e?.error?.message || e?.message || 'Failed'); }
    finally { this.saving.set(false); }
  }
}
