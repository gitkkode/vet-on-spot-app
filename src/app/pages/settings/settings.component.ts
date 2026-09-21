import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-settings',
  template: `
    <a routerLink="/profile" class="vos-back">← Profile</a>
    <h1>Settings</h1>
    <p class="vos-muted">Preferences for your VetonSpot account.</p>

    <div class="vos-card">
      <h2>Preferences</h2>
      <p class="vos-muted">Notification delivery preferences will expand when push is enabled. For now, use the in-app inbox.</p>
      <a routerLink="/notifications">Open notifications</a>
    </div>

    <div class="vos-card">
      <h2>Care</h2>
      <a routerLink="/medications">Medication tracker</a>
      <a routerLink="/follow-ups">Follow-ups</a>
      <a routerLink="/support">Support</a>
      <a routerLink="/emergency">Emergency help</a>
    </div>

    <div class="vos-card">
      <h2>Account</h2>
      <a routerLink="/profile">Edit profile</a>
      <button type="button" class="vos-btn vos-btn-ghost" (click)="logout()">Log out</button>
    </div>
  `,
  styles: [`
    h1, h2 { font-family: var(--vos-display); }
    h2 { font-size: 1rem; margin: 0 0 10px; }
    .vos-card a {
      display: block; padding: 10px 0; border-top: 1px solid var(--vos-border);
      text-decoration: none; color: var(--vos-ink); font-weight: 600;
    }
    .vos-card a:first-of-type { border-top: 0; }
    .vos-btn { margin-top: 12px; }
  `],
})
export class SettingsComponent {
  constructor(private auth: AuthService, private router: Router) {}
  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
