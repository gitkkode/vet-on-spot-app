import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'vos-health-empty',
  template: `
    <div class="empty">
      <div class="empty__icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2" />
          <path d="M24 16v8M24 30h.02" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </div>
      <h2>{{ title }}</h2>
      @if (message) {
        <p>{{ message }}</p>
      }
      <div class="empty__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .empty {
      text-align: center;
      padding: 36px 22px;
      border-radius: 24px;
      background: #fffef9;
      border: 1px solid var(--vos-border);
    }
    .empty__icon {
      width: 56px; height: 56px; margin: 0 auto 12px;
      border-radius: 50%;
      display: grid; place-items: center;
      color: var(--vos-brand);
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      box-shadow: 0 0 0 6px rgba(253, 74, 41, 0.08);
    }
    .empty__icon svg { width: 28px; height: 28px; display: block; }
    h2 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: 1.2rem;
    }
    p {
      margin: 0 auto 18px;
      max-width: 42ch;
      color: var(--vos-ink-muted);
      line-height: 1.45;
    }
    .empty__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
    .empty__actions:empty { display: none; }
  `],
})
export class HealthEmptyComponent {
  @Input() title = 'Nothing here yet';
  @Input() message = '';
}
