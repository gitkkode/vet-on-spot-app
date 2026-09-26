import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/** In-app navigation history for smart back buttons. */
@Injectable({ providedIn: 'root' })
export class NavBackService {
  private readonly router = inject(Router);
  private history: string[] = [];
  private started = false;
  private readonly max = 50;

  /** Call once from the app root so history is tracked for every route. */
  start(): void {
    if (this.started) return;
    this.started = true;

    const initial = this.normalize(this.router.url);
    if (initial) this.history = [initial];

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = this.normalize(e.urlAfterRedirects);
        if (!url) return;
        if (this.isAuthOrPublic(url)) {
          this.history = [url];
          return;
        }
        const last = this.history[this.history.length - 1];
        if (last === url) return;
        this.history.push(url);
        if (this.history.length > this.max) this.history.splice(0, this.history.length - this.max);
      });
  }

  /** Previous in-app URL, or null if none. */
  previousUrl(currentUrl?: string): string | null {
    const current = this.normalize(currentUrl ?? this.router.url);
    if (this.history.length >= 2) {
      const last = this.history[this.history.length - 1];
      const prev = this.history[this.history.length - 2];
      if (last === current) return prev;
      // Current may not be last yet (first paint) — still prefer stack tip's previous
      if (prev && prev !== current) return prev;
    }
    return null;
  }

  /** Friendly label for a URL (Home when coming from home). */
  labelFor(url: string | null | undefined, fallbackLabel = 'Back'): string {
    if (!url) return fallbackLabel;
    const path = url.split('?')[0].replace(/\/+$/, '') || '/';

    if (path === '/' || path === '/home') return 'Home';
    if (path === '/pets') return 'Pets';
    if (path === '/pets/new') return 'Add pet';
    if (/^\/pets\/[^/]+\/edit$/.test(path)) return 'Edit pet';
    if (/^\/pets\/[^/]+\/health$/.test(path)) return 'Health';
    if (/^\/pets\/[^/]+$/.test(path)) return 'Pet';
    if (path === '/bookings') return 'Appointments';
    if (/^\/bookings\//.test(path)) return 'Appointment';
    if (path === '/book/new' || path.startsWith('/book/')) return 'Book';
    if (path === '/profile') return 'Profile';
    if (path === '/settings') return 'Settings';
    if (path === '/notifications') return 'Notifications';
    if (path === '/support') return 'Support';
    if (path === '/addresses') return 'Addresses';
    if (path === '/health') return 'Health';
    if (path === '/follow-ups') return 'Follow-ups';
    if (path === '/medications') return 'Medications';
    if (path === '/documents' || /\/documents$/.test(path)) return 'Documents';
    if (path === '/reminders') return 'Reminders';
    if (path === '/diagnostics' || /\/diagnostics/.test(path)) return 'Diagnostics';
    if (path === '/televet') return 'TeleVet';
    if (path === '/emergency' || path.startsWith('/emergency/')) return 'Urgent care';
    if (path === '/assistant') return 'Assistant';
    if (path === '/smart-intake') return 'Smart intake';
    if (path.startsWith('/visits/')) return 'Visit';
    if (path === '/login') return 'Sign in';

    const seg = path.split('/').filter(Boolean).pop() || '';
    if (!seg) return fallbackLabel;
    return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Navigate to the previous page.
   * Falls back to `fallback` when there is no in-app history (refresh / deep link).
   */
  goBack(fallback: string | any[] = '/home'): void {
    const current = this.normalize(this.router.url);
    let prev: string | null = null;

    // Walk back over consecutive duplicates of current
    while (this.history.length && this.history[this.history.length - 1] === current) {
      this.history.pop();
    }
    if (this.history.length) {
      prev = this.history.pop() || null;
    }

    // Avoid landing on auth/public shell if we were inside the portal
    if (prev && this.isAuthOrPublic(prev) && !this.isAuthOrPublic(current)) {
      prev = null;
    }

    if (prev && prev !== current) {
      void this.router.navigateByUrl(prev);
      return;
    }

    if (Array.isArray(fallback)) {
      void this.router.navigate(fallback);
    } else {
      void this.router.navigateByUrl(String(fallback || '/home'));
    }
  }

  private normalize(url: string): string {
    if (!url) return '';
    // Keep query string (petId, from, etc.) so back restores context
    const bare = url.trim();
    if (!bare || bare === '/') return bare || '/';
    return bare.startsWith('/') ? bare : `/${bare}`;
  }

  private isAuthOrPublic(url: string): boolean {
    const path = url.split('?')[0];
    return (
      path === '/' ||
      path === '/login' ||
      path === '/signup' ||
      path.startsWith('/legal')
    );
  }
}
