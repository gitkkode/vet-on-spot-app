import { AfterViewChecked, Component, ElementRef, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Msg91OtpService } from '../../services/msg91-otp.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="gate" [class.gate--busy]="loading()">
      <aside class="story">
        <div class="story__wash" aria-hidden="true"></div>
        <div class="story__mesh" aria-hidden="true"></div>
        <div class="story__orb story__orb--a" aria-hidden="true"></div>
        <div class="story__orb story__orb--b" aria-hidden="true"></div>

        <div class="story__top">
          <a routerLink="/" class="story__brand">Vetonsp<span class="o">●</span>t</a>
          <div class="locale" role="status" aria-label="Now serving Bengaluru City">
            <span class="locale__pin" aria-hidden="true">
              <span class="locale__pulse"></span>
            </span>
            <span class="locale__copy">
              <span class="locale__live">Live in</span>
              <span class="locale__city">Bengaluru</span>
            </span>
          </div>
        </div>

        <div class="story__body">
          <h1>Veterinary care,<br />right at your door.</h1>
          <p class="story__lede">
            Home visits, tele-vet, and your pet’s health — all in one place.
          </p>
        </div>

        <p class="story__foot">Hospital · Emergency · Diagnostics · Wellness</p>
      </aside>

      <section class="panel">
        <div class="panel__inner">
          <div class="mobile-brand">
            <a routerLink="/">Vetonsp<span class="o">●</span>t</a>
            <div class="locale locale--compact" role="status" aria-label="Now serving Bengaluru City">
              <span class="locale__pin" aria-hidden="true">
                <span class="locale__pulse"></span>
              </span>
              <span class="locale__city">Bengaluru</span>
            </div>
          </div>

          <a routerLink="/" class="back-land">← Back to VetonSpot</a>

          <div class="card" [class.card--busy]="loading()">
            <div class="steps" aria-hidden="true">
              <span class="steps__dot" [class.steps__dot--on]="true"></span>
              <span class="steps__line" [class.steps__line--on]="step() === 'otp'"></span>
              <span class="steps__dot" [class.steps__dot--on]="step() === 'otp'"></span>
            </div>

            <div class="card__head">
              <p class="card__eyebrow">Pet Parent Portal</p>
              <h2>{{ step() === 'phone' ? 'Log in' : 'Enter OTP' }}</h2>
              <p class="card__sub">
                @if (step() === 'phone') {
                  Enter your mobile number to continue
                } @else {
                  Sent to <strong>+91 {{ localMobile }}</strong>
                }
              </p>
            </div>

            @if (error()) {
              <div class="banner banner--err" role="alert">{{ error() }}</div>
            }
            @if (info()) {
              <div class="banner banner--ok" role="status">{{ info() }}</div>
            }

            <div class="stage" [attr.data-step]="step()">
              @if (step() === 'phone') {
                <div class="pane">
                  <form (ngSubmit)="sendOtp()" class="form">
                    <label class="field">
                      <span class="field__label">Mobile number</span>
                      <div class="phone" [class.phone--ok]="canSend()">
                        <span class="phone__cc">+91</span>
                        <input
                          #mobileInput
                          type="tel"
                          inputmode="numeric"
                          autocomplete="tel-national"
                          maxlength="10"
                          [(ngModel)]="localMobile"
                          name="mobile"
                          placeholder="98XXXXXXXX"
                          required
                          [disabled]="loading()"
                          (input)="onMobileInput()"
                        />
                      </div>
                    </label>

                    <button
                      type="submit"
                      class="cta"
                      [class.cta--loading]="loading()"
                      [disabled]="loading() || !sdkReady() || !canSend()"
                    >
                      @if (loading()) {
                        <span class="spin" aria-hidden="true"></span>
                        <span>Sending</span>
                      } @else if (!sdkReady()) {
                        <span class="spin spin--soft" aria-hidden="true"></span>
                        <span>Preparing</span>
                      } @else {
                        <span>Continue</span>
                      }
                    </button>
                  </form>

                  <p class="terms">
                    By continuing, you agree to our
                    <a routerLink="/terms" [queryParams]="{ from: 'login' }">Terms</a>
                    and
                    <a routerLink="/privacy" [queryParams]="{ from: 'login' }">Privacy Policy</a>.
                  </p>
                </div>
              } @else {
                <div class="pane">
                  <form (ngSubmit)="verifyOtp()" class="form">
                    <label class="field">
                      <span class="field__label">OTP</span>
                      <input
                        #otpInput
                        type="text"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        maxlength="6"
                        [(ngModel)]="otp"
                        name="otp"
                        placeholder="••••••"
                        required
                        class="otp"
                        [disabled]="loading()"
                        (input)="onOtpInput()"
                      />
                    </label>

                    <button
                      type="submit"
                      class="cta"
                      [class.cta--loading]="loading()"
                      [disabled]="loading() || !canVerify()"
                    >
                      @if (loading()) {
                        <span class="spin" aria-hidden="true"></span>
                        <span>Verifying</span>
                      } @else {
                        <span>Continue</span>
                      }
                    </button>
                  </form>

                  <div class="actions">
                    <button
                      type="button"
                      class="link"
                      [disabled]="loading() || resendWait() > 0"
                      (click)="resend()"
                    >
                      @if (resending()) {
                        <span class="spin spin--sm" aria-hidden="true"></span>
                        Sending
                      } @else if (resendWait() > 0) {
                        Resend in {{ resendWait() }}s
                      } @else {
                        Resend OTP
                      }
                    </button>
                    <button
                      type="button"
                      class="link link--accent"
                      [disabled]="loading()"
                      (click)="backToPhone()"
                    >
                      Change number
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .gate {
      min-height: 100vh;
      min-height: 100dvh;
      display: grid;
      background: #f3efe8;
      font-family: var(--vos-font, "Anek Latin", system-ui, sans-serif);
      color: #0a0a0a;
      transition: filter 0.25s ease;
    }
    .gate--busy .panel { cursor: progress; }
    @media (min-width: 980px) {
      .gate { grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); }
    }

    .story {
      position: relative;
      display: none;
      flex-direction: column;
      justify-content: space-between;
      padding: clamp(40px, 5.5vw, 64px) clamp(40px, 5vw, 72px);
      color: #fff;
      overflow: hidden;
      isolation: isolate;
      min-height: 100vh;
      background: linear-gradient(165deg, #ff5a38 0%, #e03e20 28%, #3a1a14 68%, #0c0a09 100%);
    }
    @media (min-width: 980px) {
      .story { display: flex; }
    }
    .story__wash {
      position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(ellipse 80% 55% at 15% 10%, rgba(255,255,255,0.22) 0%, transparent 55%),
        radial-gradient(ellipse 60% 45% at 90% 85%, rgba(253,74,41,0.35) 0%, transparent 60%);
    }
    .story__mesh {
      position: absolute; inset: 0; opacity: 0.07; pointer-events: none;
      background-image:
        linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
    }
    .story__orb {
      position: absolute; border-radius: 50%; pointer-events: none; filter: blur(2px);
    }
    .story__orb--a {
      width: 280px; height: 280px; top: -80px; right: -60px;
      background: rgba(255,255,255,0.12);
      animation: float 10s ease-in-out infinite alternate;
    }
    .story__orb--b {
      width: 180px; height: 180px; bottom: 8%; left: -50px;
      background: rgba(255,180,140,0.16);
      animation: float 12s ease-in-out infinite alternate-reverse;
    }
    .story__top, .story__body, .story__foot { position: relative; }
    .story__brand {
      margin: 0 0 18px;
      font-family: var(--vos-display, "Gabarito", system-ui, sans-serif);
      font-weight: 700; font-size: 1.6rem; letter-spacing: -0.05em;
      color: #fff;
      text-decoration: none;
      display: inline-block;
    }
    .story__brand .o, .mobile-brand .o { color: #fff; }
    .mobile-brand a {
      color: inherit;
      text-decoration: none;
    }
    .back-land {
      display: inline-block;
      font-weight: 700;
      font-size: 0.9rem;
      color: #5c5a55;
      text-decoration: none;
      margin-bottom: 2px;
    }
    .back-land:hover { color: #FD4A29; }

    .locale {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px 10px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.28);
      box-shadow:
        0 10px 28px rgba(0, 0, 0, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.28);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      max-width: max-content;
    }
    .locale__pin {
      position: relative;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #fff;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
    }
    .locale__pin::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 46%;
      width: 9px;
      height: 9px;
      margin: -4.5px 0 0 -4.5px;
      border-radius: 50% 50% 50% 0;
      background: #FD4A29;
      transform: rotate(-45deg);
      box-shadow: 0 0 0 3px rgba(253, 74, 41, 0.18);
    }
    .locale__pulse {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 1.5px solid rgba(255, 255, 255, 0.7);
      animation: localePulse 2s ease-out infinite;
    }
    .locale__copy {
      display: flex;
      flex-direction: column;
      gap: 1px;
      line-height: 1.15;
      min-width: 0;
    }
    .locale__live {
      font-family: var(--vos-mono, "JetBrains Mono", ui-monospace, monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0.78;
    }
    .locale__city {
      font-family: var(--vos-display, "Gabarito", system-ui, sans-serif);
      font-size: 1.08rem;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .locale--compact {
      margin-top: 10px;
      padding: 7px 12px 7px 8px;
      gap: 8px;
      background: rgba(253, 74, 41, 0.1);
      border-color: rgba(253, 74, 41, 0.22);
      box-shadow: none;
      color: #0a0a0a;
      backdrop-filter: none;
    }
    .locale--compact .locale__pin {
      width: 22px;
      height: 22px;
      box-shadow: none;
      background: #fff;
      border: 1px solid rgba(253, 74, 41, 0.2);
    }
    .locale--compact .locale__pin::before {
      width: 7px;
      height: 7px;
      margin: -3.5px 0 0 -3.5px;
    }
    .locale--compact .locale__pulse {
      border-color: rgba(253, 74, 41, 0.35);
    }
    .locale--compact .locale__city {
      font-size: 0.95rem;
    }

    .story h1 {
      margin: 0 0 18px;
      font-family: var(--vos-display, "Gabarito", system-ui, sans-serif);
      font-size: clamp(2.4rem, 3.8vw, 3.35rem);
      line-height: 1.05; letter-spacing: -0.05em; max-width: 11ch;
    }
    .story__lede {
      margin: 0;
      max-width: 28ch;
      font-size: 1.12rem;
      line-height: 1.45;
      opacity: 0.9;
    }
    .story__foot {
      margin: 0;
      font-family: var(--vos-mono, "JetBrains Mono", ui-monospace, monospace);
      font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.45;
    }

    .panel {
      display: flex; align-items: center; justify-content: center;
      padding: 28px 18px 36px;
      background:
        radial-gradient(ellipse 70% 50% at 100% -10%, rgba(253,74,41,0.1) 0%, transparent 55%),
        radial-gradient(ellipse 50% 40% at 0% 100%, rgba(253,74,41,0.05) 0%, transparent 50%),
        linear-gradient(180deg, #f7f3ec 0%, #f3efe8 100%);
    }
    .panel__inner {
      width: min(440px, 100%);
      display: flex; flex-direction: column; gap: 18px;
      animation: rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .mobile-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: var(--vos-display, "Gabarito", system-ui, sans-serif);
      font-weight: 700; font-size: 1.3rem; letter-spacing: -0.04em;
    }
    @media (min-width: 980px) {
      .mobile-brand { display: none; }
    }

    .card {
      position: relative;
      background: #fff;
      border-radius: 32px;
      padding: 32px 34px 32px;
      border: 1px solid rgba(217, 212, 200, 0.7);
      box-shadow:
        0 1px 0 rgba(255,255,255,0.9) inset,
        0 28px 64px rgba(20, 16, 12, 0.09);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
      overflow: hidden;
    }
    .card--busy {
      box-shadow:
        0 1px 0 rgba(255,255,255,0.9) inset,
        0 28px 64px rgba(20, 16, 12, 0.09),
        0 0 0 1px rgba(253, 74, 41, 0.12);
    }
    .card--busy::after {
      content: '';
      position: absolute;
      left: 0; right: 0; top: 0;
      height: 3px;
      background: linear-gradient(90deg, transparent, #FD4A29, transparent);
      background-size: 200% 100%;
      animation: shimmer 1.1s linear infinite;
    }

    .steps {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin: 0 0 22px;
    }
    .steps__dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #e8e2d6;
      transition: background 0.35s ease, transform 0.35s ease, box-shadow 0.35s ease;
    }
    .steps__dot--on {
      background: #FD4A29;
      transform: scale(1.15);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.15);
    }
    .steps__line {
      width: 36px; height: 2px;
      background: #e8e2d6;
      margin: 0 6px;
      border-radius: 2px;
      position: relative;
      overflow: hidden;
    }
    .steps__line::after {
      content: '';
      position: absolute; inset: 0;
      background: #FD4A29;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .steps__line--on::after { transform: scaleX(1); }

    .card__head { margin-bottom: 24px; }
    .card__eyebrow {
      margin: 0 0 12px;
      font-family: var(--vos-mono, "JetBrains Mono", ui-monospace, monospace);
      font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
      color: #FD4A29; font-weight: 700;
    }
    .card h2 {
      margin: 0 0 10px;
      font-family: var(--vos-display, "Gabarito", system-ui, sans-serif);
      font-size: clamp(2rem, 4.5vw, 2.35rem);
      letter-spacing: -0.045em; line-height: 1.05;
    }
    .card__sub {
      margin: 0; color: #5c5a55; line-height: 1.4; font-size: 1.02rem;
    }
    .card__sub strong { color: #0a0a0a; font-weight: 700; }

    .stage { position: relative; min-height: 180px; }
    .pane {
      animation: paneIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .form { display: grid; gap: 4px; }
    .field { display: block; }
    .field__label {
      display: block;
      font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: #5c5a55;
    }

    .phone {
      display: flex; align-items: stretch;
      margin-top: 10px; border-radius: 16px; overflow: hidden;
      background: #f4f0e8; border: 1.5px solid transparent;
      transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .phone:focus-within {
      background: #fff;
      border-color: rgba(253, 74, 41, 0.55);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
    }
    .phone--ok:not(:focus-within) {
      border-color: rgba(31, 122, 76, 0.3);
      background: #f3faf6;
    }
    .phone__cc {
      display: flex; align-items: center; padding: 0 18px;
      font-family: var(--vos-display, "Gabarito", system-ui, sans-serif);
      font-weight: 700; font-size: 1.1rem;
      border-right: 1px solid rgba(20, 16, 12, 0.08);
      background: rgba(255,255,255,0.4);
    }
    .phone input {
      flex: 1; border: 0; background: transparent;
      padding: 16px 18px; font-size: 1.22rem; letter-spacing: 0.08em;
      min-height: 58px; font-family: inherit; color: #0a0a0a; outline: none; width: 100%;
    }
    .phone input:disabled, .otp:disabled { opacity: 0.65; }

    .otp {
      width: 100%; margin-top: 10px; padding: 16px 18px;
      border-radius: 16px; border: 1.5px solid transparent;
      background: #f4f0e8; font-size: 1.65rem; letter-spacing: 0.45em;
      text-align: center; color: #0a0a0a; box-sizing: border-box;
      min-height: 64px;
      font-family: var(--vos-display, "Gabarito", system-ui, sans-serif);
      font-weight: 700;
      transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    }
    .otp:focus {
      outline: none; background: #fff;
      border-color: rgba(253, 74, 41, 0.55);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
      transform: scale(1.01);
    }

    .cta {
      width: 100%; margin-top: 22px; min-height: 56px;
      border: 0; border-radius: 999px;
      background: linear-gradient(135deg, #FD4A29 0%, #E03E20 100%);
      color: #fff; font-weight: 700; font-size: 1.08rem;
      letter-spacing: -0.01em; cursor: pointer;
      box-shadow: 0 14px 34px rgba(253, 74, 41, 0.36);
      font-family: inherit;
      display: inline-flex; align-items: center; justify-content: center; gap: 10px;
      transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
    }
    .cta:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 18px 40px rgba(253, 74, 41, 0.42);
    }
    .cta:active:not(:disabled) { transform: scale(0.985); }
    .cta:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
    .cta--loading {
      opacity: 1 !important;
      cursor: wait;
      box-shadow: 0 14px 34px rgba(253, 74, 41, 0.28);
    }

    .spin {
      width: 18px; height: 18px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    .spin--soft {
      border-color: rgba(255,255,255,0.25);
      border-top-color: rgba(255,255,255,0.85);
    }
    .spin--sm {
      width: 12px; height: 12px;
      border-width: 1.5px;
      border-color: rgba(92,90,85,0.25);
      border-top-color: #5c5a55;
      display: inline-block;
      vertical-align: -1px;
      margin-right: 6px;
    }

    .terms {
      margin: 20px 0 0; text-align: center;
      font-size: 12px; line-height: 1.45; color: #8a8680;
      animation: rise 0.45s ease 0.1s both;
    }
    .terms a {
      color: #5c5a55; font-weight: 700;
      text-decoration: underline; text-underline-offset: 2px;
    }
    .terms a:hover { color: #FD4A29; }

    .actions {
      margin-top: 22px;
      display: flex; flex-direction: column; gap: 12px; align-items: center;
      animation: rise 0.4s ease 0.08s both;
    }
    .link {
      border: 0; background: none; cursor: pointer;
      font-weight: 700; font-size: 0.94rem; color: #5c5a55;
      font-family: inherit; padding: 4px 8px;
      display: inline-flex; align-items: center; justify-content: center;
      transition: color 0.15s ease, opacity 0.15s ease;
    }
    .link:hover:not(:disabled) { color: #0a0a0a; }
    .link:disabled { opacity: 0.45; cursor: not-allowed; }
    .link--accent { color: #FD4A29; }
    .link--accent:hover:not(:disabled) { color: #E03E20; }

    .banner {
      padding: 12px 14px; border-radius: 14px;
      font-size: 0.92rem; font-weight: 600; line-height: 1.35;
      margin-bottom: 16px;
      animation: bannerIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .banner--err { background: #fef2f2; color: #b42318; }
    .banner--ok { background: #ecfdf3; color: #1f7a4c; }

    @keyframes rise {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes paneIn {
      from { opacity: 0; transform: translateY(14px) scale(0.985); }
      to { opacity: 1; transform: none; }
    }
    @keyframes bannerIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes float {
      from { transform: translate(0, 0); }
      to { transform: translate(-14px, 16px); }
    }
    @keyframes localePulse {
      0% { transform: scale(0.85); opacity: 0.75; }
      70% { transform: scale(1.4); opacity: 0; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .story__orb, .panel__inner, .pane, .banner, .terms, .actions,
      .spin, .spin--sm, .card--busy::after, .locale__pulse {
        animation: none !important;
      }
      .cta:hover:not(:disabled) { transform: none; }
      .otp:focus { transform: none; }
    }
  `],
})
export class LoginComponent implements OnInit, AfterViewChecked {
  localMobile = '';
  otp = '';
  readonly step = signal<'phone' | 'otp'>('phone');
  readonly loading = signal(false);
  readonly resending = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly sdkReady = signal(false);
  readonly resendWait = signal(0);

  private readonly otpInput = viewChild<ElementRef<HTMLInputElement>>('otpInput');
  private resendTimer: ReturnType<typeof setInterval> | null = null;
  private infoTimer: ReturnType<typeof setTimeout> | null = null;
  private focusOtp = false;

  constructor(
    private readonly auth: AuthService,
    private readonly msg91: Msg91OtpService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    if (!environment.msg91?.tokenAuth) {
      this.error.set('OTP login isn’t ready yet.');
    }
    void this.bootSdk();
  }

  ngAfterViewChecked() {
    if (this.focusOtp && this.step() === 'otp') {
      const el = this.otpInput()?.nativeElement;
      if (el) {
        el.focus();
        this.focusOtp = false;
      }
    }
  }

  canSend(): boolean {
    return this.localMobile.replace(/\D/g, '').length === 10;
  }

  canVerify(): boolean {
    return this.otp.replace(/\D/g, '').length >= 4;
  }

  onMobileInput() {
    this.localMobile = this.localMobile.replace(/\D/g, '').slice(0, 10);
  }

  onOtpInput() {
    this.otp = this.otp.replace(/\D/g, '').slice(0, 6);
  }

  private flashInfo(msg: string) {
    this.info.set(msg);
    if (this.infoTimer) clearTimeout(this.infoTimer);
    this.infoTimer = setTimeout(() => {
      this.info.set('');
      this.infoTimer = null;
    }, 2800);
  }

  private async bootSdk() {
    try {
      await this.msg91.ensureReady();
      this.sdkReady.set(true);
    } catch (e: any) {
      this.sdkReady.set(false);
      this.error.set(e?.message || 'Could not load OTP');
    }
  }

  private identifier(): string {
    const digits = this.localMobile.replace(/\D/g, '');
    if (digits.length !== 10) throw new Error('Enter a valid mobile number');
    return `91${digits}`;
  }

  async sendOtp() {
    this.loading.set(true);
    this.error.set('');
    this.info.set('');
    try {
      const id = this.identifier();
      await this.auth.captureOtpIntent(id);
      await this.msg91.sendOtp(id);
      this.step.set('otp');
      this.focusOtp = true;
      this.flashInfo('OTP sent');
      this.startResendCooldown(30);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not send OTP');
    } finally {
      this.loading.set(false);
    }
  }

  async verifyOtp() {
    this.loading.set(true);
    this.error.set('');
    this.info.set('');
    try {
      const code = this.otp.replace(/\D/g, '');
      if (code.length < 4) throw new Error('Enter the OTP');
      const { accessToken } = await this.msg91.verifyOtp(code);
      const result = await this.auth.verifyOtpAccessToken(accessToken);
      await this.auth.loginWithCustomToken(result.customToken);
      const needsSignup = result.needsProfile || !this.auth.hasCustomerProfile();
      if (needsSignup) {
        this.auth.markOtpSignupRequired();
        await this.router.navigateByUrl('/signup');
      } else {
        this.auth.clearOtpSignupGate();
        await this.router.navigateByUrl('/home');
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Invalid OTP');
    } finally {
      this.loading.set(false);
    }
  }

  async resend() {
    if (this.resendWait() > 0 || this.resending()) return;
    this.resending.set(true);
    this.error.set('');
    try {
      await this.msg91.retryOtp(null);
      this.flashInfo('OTP resent');
      this.startResendCooldown(30);
    } catch (e: any) {
      this.error.set(e?.message || 'Could not resend OTP');
    } finally {
      this.resending.set(false);
    }
  }

  backToPhone() {
    this.step.set('phone');
    this.otp = '';
    this.error.set('');
    this.info.set('');
  }

  private startResendCooldown(seconds: number) {
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendWait.set(seconds);
    this.resendTimer = setInterval(() => {
      const next = this.resendWait() - 1;
      this.resendWait.set(Math.max(0, next));
      if (next <= 0 && this.resendTimer) {
        clearInterval(this.resendTimer);
        this.resendTimer = null;
      }
    }, 1000);
  }
}
