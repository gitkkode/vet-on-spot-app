import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="gate">
      <section class="gate-form">
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
        radial-gradient(ellipse 60% 40% at 80% 10%, rgba(253, 74, 41, 0.1) 0%, transparent 55%),
        #faf8f4;
      font-family: "Anek Latin", system-ui, sans-serif;
    }
    .gate-form__card {
      width: min(440px, 100%);
      background: #fff;
      border-radius: 24px;
      padding: 36px 32px 28px;
      box-shadow: 0 18px 48px rgba(20, 16, 12, 0.08);
    }
    .gate-form__eyebrow {
      margin: 0 0 8px;
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #FD4A29;
      font-weight: 600;
    }
    h2 {
      margin: 0 0 8px;
      font-family: "Gabarito", system-ui, sans-serif;
      font-size: 1.75rem;
      letter-spacing: -0.035em;
      color: #0a0a0a;
    }
    .gate-form__sub {
      margin: 0 0 22px;
      color: #5c5a55;
      line-height: 1.45;
      font-size: 1.02rem;
    }
    .field {
      display: block;
      margin-bottom: 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #5c5a55;
    }
    .opt { text-transform: none; font-weight: 600; letter-spacing: 0; color: #9a968e; }
    .field input {
      width: 100%;
      margin-top: 7px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: #eef2f7;
      font-size: 1.05rem;
      color: #0a0a0a;
      box-sizing: border-box;
      min-height: 50px;
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
      margin-top: 8px;
      min-height: 52px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #FD4A29, #E03E20);
      color: #fff;
      font-weight: 700;
      font-size: 1.05rem;
      cursor: pointer;
      box-shadow: 0 10px 28px rgba(253, 74, 41, 0.35);
      font-family: inherit;
    }
    .submit:disabled { opacity: 0.65; cursor: not-allowed; }
    .error-msg {
      padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; margin-bottom: 12px;
      background: #fef2f2; color: #b42318;
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
      await this.router.navigateByUrl('/');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not save profile');
    } finally {
      this.loading.set(false);
    }
  }
}
