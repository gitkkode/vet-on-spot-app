import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="gate">
      <section class="gate-form">
        <a routerLink="/" class="back-land">← VetonSpot</a>
        <div class="gate-form__card">
          <p class="gate-form__eyebrow">Almost there</p>
          <h2>Create your care profile</h2>
          <p class="gate-form__sub">
            Your mobile is verified. Tell us who you are so we can attach pets and visits.
          </p>

          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }

          <form (ngSubmit)="submit()">
            <label class="field">
              Your name
              <input
                [(ngModel)]="fullName"
                name="fullName"
                placeholder="Full name"
                required
                autocomplete="name"
              />
            </label>
            <label class="field">
              Home address <span class="opt">(optional)</span>
              <input
                [(ngModel)]="address"
                name="address"
                placeholder="Area, street, city"
                autocomplete="street-address"
              />
            </label>
            <button type="submit" class="submit" [disabled]="loading()">
              {{ loading() ? 'Saving…' : 'Start caring' }}
            </button>
          </form>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .gate {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
      background:
        radial-gradient(ellipse 60% 40% at 80% 10%, rgba(253, 74, 41, 0.12) 0%, transparent 55%),
        radial-gradient(ellipse 40% 30% at 10% 90%, rgba(253, 74, 41, 0.06) 0%, transparent 50%),
        #FCFCFB;
      font-family: var(--vos-font);
    }
    .gate-form { width: min(440px, 100%); }
    .back-land {
      display: inline-block;
      margin-bottom: 14px;
      font-weight: 700;
      color: var(--vos-ink-muted);
      text-decoration: none;
      font-size: 0.92rem;
    }
    .back-land:hover { color: var(--vos-brand); }
    .gate-form__card {
      width: 100%;
      background: #fff;
      border-radius: 24px;
      padding: 36px 32px 28px;
      border: 1px solid var(--vos-border);
      box-shadow: 0 18px 48px rgba(20, 16, 12, 0.08);
      animation: vos-rise 0.45s var(--vos-ease) both;
    }
    .gate-form__eyebrow {
      margin: 0 0 8px;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #FD4A29;
      font-weight: 600;
    }
    h2 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: 1.7rem;
      letter-spacing: -0.04em;
    }
    .gate-form__sub {
      margin: 0 0 22px;
      color: var(--vos-ink-muted);
      line-height: 1.45;
    }
    .field {
      display: block;
      margin-bottom: 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
    }
    .opt { text-transform: none; font-weight: 600; letter-spacing: 0; color: #9a968e; }
    .field input {
      width: 100%;
      margin-top: 7px;
      min-height: 48px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid transparent;
      background: #eef2f7;
      font-size: 1rem;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
      box-sizing: border-box;
      font-family: inherit;
    }
    .field input:focus {
      outline: none;
      background: #fff;
      border-color: rgba(253, 74, 41, 0.45);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
    }
    .submit {
      width: 100%;
      min-height: 52px;
      margin-top: 8px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #FD4A29, #E03E20);
      color: #fff;
      font-weight: 700;
      font-size: 1.05rem;
      cursor: pointer;
      font-family: inherit;
      box-shadow: 0 12px 28px rgba(253, 74, 41, 0.3);
    }
    .submit:disabled { opacity: 0.55; cursor: not-allowed; }
    .error-msg {
      background: #fdecec;
      color: #B42318;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
    }
  `],
})
export class SignupComponent {
  fullName = '';
  address = '';
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  async submit() {
    this.loading.set(true);
    this.error.set('');
    try {
      const name = this.fullName.trim();
      if (!name) throw new Error('Enter your name');
      await this.auth.completeCustomerSignup(name, this.address.trim() || undefined);
      await this.router.navigateByUrl('/home');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not save profile');
    } finally {
      this.loading.set(false);
    }
  }
}
