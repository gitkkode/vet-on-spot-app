import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-documents',
  template: `
    <a class="vos-back" [routerLink]="petId ? ['/pets', petId] : '/'">← Back</a>
    <h1>Documents</h1>
    @if (error()) { <div class="vos-err">{{ error() }}</div> }
    @if (loading()) { <div class="vos-skel"></div> }
    @else if (!docs().length) {
      <p class="vos-empty">No health documents yet. Files from visits will appear here.</p>
    } @else {
      @for (d of docs(); track d.id) {
        <button type="button" class="vos-card item" (click)="open(d.id)">
          <strong>{{ d.fileName || d.category }}</strong>
          <span class="vos-muted">{{ d.category }} · {{ (d.createdAt || '').slice(0,10) }} · {{ d.petName || '' }}</span>
        </button>
      }
    }
  `,
  styles: [`
    .item{display:flex;flex-direction:column;gap:4px;width:100%;text-align:left;cursor:pointer;margin-bottom:10px;border:0}
  `],
})
export class DocumentsComponent implements OnInit {
  readonly docs = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  petId = '';
  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}
  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }
  async load() {
    this.loading.set(true);
    try {
      this.docs.set((await this.api.documents(this.petId || null)) || []);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
  async open(id: string) {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: { url: string } }>(
          `${environment.apiUrl}/files/${id}/signed-url`,
        ),
      );
      if (res.data?.url) window.open(res.data.url, '_blank', 'noopener');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Unable to open file');
    }
  }
}
