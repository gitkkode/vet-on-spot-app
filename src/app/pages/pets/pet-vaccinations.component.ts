import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-pet-vaccinations',
  template: `
    <a class="vos-back" [routerLink]="['/pets', petId, 'health']">← Health</a>
    <h1>Vaccinations</h1>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <p class="vos-empty">No vaccination records yet. Your vet can add them after a visit.</p>
    } @else {
      @for (v of items(); track v.id) {
        <article class="vos-card">
          <h2>{{ v.vaccineName }}</h2>
          <p class="vos-muted">Given {{ v.givenOn || '—' }}</p>
          @if (v.nextDueOn) {
            <p><strong>Next due</strong> {{ v.nextDueOn }}</p>
          }
          @if (v.providerName) {
            <p class="vos-muted">{{ v.providerName }}</p>
          }
          @if (v.notes) {
            <p>{{ v.notes }}</p>
          }
        </article>
      }
    }
  `,
  styles: [`
    h1, h2 { margin: 8px 0; font-family: var(--vos-display); }
    h2 { font-size: 1.1rem; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class PetVaccinationsComponent implements OnInit {
  readonly items = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  petId = '';

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.items.set((await this.api.vaccinations(this.petId)) || []);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
