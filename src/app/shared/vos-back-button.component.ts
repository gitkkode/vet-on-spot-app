import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { NavBackService } from '../services/nav-back.service';

/**
 * Smart back control:
 * - If the previous page was Home → label "Home"
 * - Otherwise → previous page name (or "Back")
 * - Click returns to the actual previous in-app URL
 * - Uses `fallback` only when history is empty (refresh / deep link)
 */
@Component({
  standalone: true,
  selector: 'vos-back-button',
  template: `
    <button type="button" class="vos-back" (click)="onBack()">
      <span class="vos-back__chev" aria-hidden="true">‹</span>
      {{ label() }}
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      button.vos-back {
        font-family: inherit;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
      }
    `,
  ],
})
export class VosBackButtonComponent implements OnInit, OnDestroy {
  /** Used only when there is no previous in-app page (refresh / direct open). */
  @Input() fallback: string | any[] = '/home';
  /** Label when falling back and history is empty. */
  @Input() fallbackLabel = 'Home';

  readonly label = signal('Back');

  private readonly navBack = inject(NavBackService);
  private readonly router = inject(Router);
  private sub?: Subscription;

  ngOnInit() {
    this.navBack.start();
    this.refreshLabel();
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.refreshLabel());
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  onBack() {
    this.navBack.goBack(this.fallback);
  }

  private refreshLabel() {
    const prev = this.navBack.previousUrl();
    if (prev) {
      this.label.set(this.navBack.labelFor(prev, 'Back'));
      return;
    }
    this.label.set(this.fallbackLabel || 'Home');
  }
}
