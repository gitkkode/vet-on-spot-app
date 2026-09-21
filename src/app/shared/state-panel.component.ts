import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-state-panel',
  standalone: true,
  template: `
    @if (loading) {
      <div class="state">
        <div class="spinner" aria-hidden="true"></div>
        <p>{{ loadingText || 'Loading…' }}</p>
      </div>
    } @else if (error) {
      <div class="state error">
        <p>{{ error }}</p>
        <button type="button" class="btn" (click)="retry.emit()">Try again</button>
      </div>
    } @else if (empty) {
      <div class="state empty">
        <p>{{ emptyText || 'Nothing here yet.' }}</p>
        <ng-content />
      </div>
    }
  `,
  styles: [
    `
      .state {
        text-align: center;
        padding: 2rem 1rem;
        color: var(--muted);
      }
      .state.error {
        color: var(--danger);
      }
      .spinner {
        width: 28px;
        height: 28px;
        margin: 0 auto 12px;
        border: 3px solid #d7e4dc;
        border-top-color: var(--brand);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .btn {
        margin-top: 10px;
      }
    `,
  ],
})
export class StatePanelComponent {
  @Input() loading = false;
  @Input() error = '';
  @Input() empty = false;
  @Input() loadingText = '';
  @Input() emptyText = '';
  @Output() retry = new EventEmitter<void>();
}
