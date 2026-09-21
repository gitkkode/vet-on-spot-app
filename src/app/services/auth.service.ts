import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithCustomToken,
  signOut,
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { firebaseAuth } from '../core/firebase';

export interface MeProfile {
  uid: string;
  email?: string | null;
  actorType?: string;
  role?: string;
  fullName?: string;
  permissions?: string[];
  customer?: unknown;
  doctor?: unknown;
  staff?: unknown;
}

export interface OtpVerifyResult {
  customToken: string;
  mobile: string;
  mobileDisplay?: string;
  needsProfile: boolean;
  customer?: unknown;
  uid: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isLoggedIn = signal(false);
  readonly authReady = signal(false);
  readonly profile = signal<MeProfile | null>(null);
  private readonly idTokenSignal = signal<string | null>(null);
  private readonly readyPromise: Promise<void>;
  /** Survives browser restart (unlike sessionStorage) for mid-signup resume. */
  private static readonly OTP_SIGNUP_GATE = 'vos_otp_signup_gate';
  /** Gate valid for 7 days — then user must OTP again to finish signup. */
  private static readonly OTP_SIGNUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  /** Soft reminder marker that this browser should keep the session (until logout). */
  private static readonly SESSION_KEEP = 'vos_auth_keep';

  constructor(private readonly http: HttpClient) {
    let resolveReady!: () => void;
    this.readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    void setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
      /* already set via initializeAuth */
    });

    onAuthStateChanged(
      firebaseAuth,
      async (user) => {
        this.isLoggedIn.set(!!user);
        if (!user) {
          this.idTokenSignal.set(null);
          this.profile.set(null);
        }
        if (!this.authReady()) {
          this.authReady.set(true);
          resolveReady();
        }
        if (user) {
          try {
            this.idTokenSignal.set(await user.getIdToken());
            await this.fetchProfile();
            this.markSessionKeep();
          } catch {
            this.profile.set({ uid: user.uid, email: user.email });
          }
        }
      },
      () => {
        if (!this.authReady()) {
          this.authReady.set(true);
          resolveReady();
        }
      },
    );
    setTimeout(() => {
      if (!this.authReady()) {
        this.authReady.set(true);
        resolveReady();
      }
    }, 2500);
  }

  idToken(): string | null {
    return this.idTokenSignal();
  }

  /**
   * Fresh Firebase ID token for API calls.
   * Waits for auth restore, then asks Firebase for a current (or force-refreshed) token.
   */
  async getIdTokenFresh(force = false): Promise<string | null> {
    await this.waitUntilReady();

    let user = firebaseAuth.currentUser;
    if (!user) {
      // Tiny grace for IndexedDB restore races right after ready.
      await new Promise((r) => setTimeout(r, 80));
      user = firebaseAuth.currentUser;
    }
    if (!user) {
      this.idTokenSignal.set(null);
      return null;
    }

    try {
      const token = await user.getIdToken(force);
      this.idTokenSignal.set(token);
      return token;
    } catch {
      if (!force) {
        try {
          const token = await user.getIdToken(true);
          this.idTokenSignal.set(token);
          return token;
        } catch {
          this.idTokenSignal.set(null);
          return null;
        }
      }
      this.idTokenSignal.set(null);
      return null;
    }
  }

  waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  hasCustomerProfile(): boolean {
    return !!this.profile()?.customer;
  }

  /** True after OTP when a new parent must finish /signup (localStorage, 7d TTL). */
  canAccessSignup(): boolean {
    try {
      const raw = localStorage.getItem(AuthService.OTP_SIGNUP_GATE);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { v?: number; exp?: number };
      if (!parsed?.exp || Date.now() > parsed.exp) {
        localStorage.removeItem(AuthService.OTP_SIGNUP_GATE);
        return false;
      }
      return parsed.v === 1;
    } catch {
      return false;
    }
  }

  markOtpSignupRequired() {
    try {
      localStorage.setItem(
        AuthService.OTP_SIGNUP_GATE,
        JSON.stringify({
          v: 1,
          exp: Date.now() + AuthService.OTP_SIGNUP_TTL_MS,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  clearOtpSignupGate() {
    try {
      localStorage.removeItem(AuthService.OTP_SIGNUP_GATE);
    } catch {
      /* ignore */
    }
  }

  private markSessionKeep() {
    try {
      localStorage.setItem(
        AuthService.SESSION_KEEP,
        JSON.stringify({ since: Date.now(), untilLogout: true }),
      );
    } catch {
      /* ignore */
    }
  }

  private clearSessionKeep() {
    try {
      localStorage.removeItem(AuthService.SESSION_KEEP);
    } catch {
      /* ignore */
    }
  }

  async refreshProfile(): Promise<MeProfile> {
    return this.fetchProfile();
  }

  private async fetchProfile(): Promise<MeProfile> {
    const response = await firstValueFrom(
      this.http.get<{ success: boolean; data: MeProfile }>(`${environment.apiUrl}/auth/me`),
    );
    this.profile.set(response.data);
    if (response.data?.customer) this.clearOtpSignupGate();
    return response.data;
  }

  /** Record lead intent before MSG91 sends SMS (best-effort). */
  async captureOtpIntent(mobile: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/auth/otp/intent`, { mobile, source: 'customer_app' }),
      );
    } catch {
      /* never block OTP send if lead capture fails */
    }
  }

  async verifyOtpAccessToken(accessToken: string): Promise<OtpVerifyResult> {
    const response = await firstValueFrom(
      this.http.post<{ success: boolean; data: OtpVerifyResult }>(
        `${environment.apiUrl}/auth/otp/verify`,
        { accessToken, provider: 'msg91' },
      ),
    );
    return response.data;
  }

  async loginWithCustomToken(customToken: string): Promise<MeProfile> {
    await setPersistence(firebaseAuth, browserLocalPersistence);
    const cred = await signInWithCustomToken(firebaseAuth, customToken);
    this.idTokenSignal.set(await cred.user.getIdToken());
    this.isLoggedIn.set(true);
    this.markSessionKeep();
    return this.fetchProfile();
  }

  async completeCustomerSignup(fullName: string, address?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/auth/customer/register`, {
        fullName,
        address: address || undefined,
      }),
    );
    await this.fetchProfile();
    this.clearOtpSignupGate();
    this.markSessionKeep();
  }

  async logout(): Promise<void> {
    this.clearOtpSignupGate();
    this.clearSessionKeep();
    await signOut(firebaseAuth);
    this.idTokenSignal.set(null);
    this.profile.set(null);
    this.isLoggedIn.set(false);
  }
}
