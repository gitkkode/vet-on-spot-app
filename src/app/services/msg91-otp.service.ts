import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

type Msg91Cb = (data: unknown) => void;

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, success?: Msg91Cb, failure?: Msg91Cb) => void;
    verifyOtp?: (otp: string | number, success?: Msg91Cb, failure?: Msg91Cb, reqId?: string) => void;
    retryOtp?: (
      channel: string | null,
      success?: Msg91Cb,
      failure?: Msg91Cb,
      reqId?: string,
    ) => void;
  }
}

const SCRIPT_SRC = 'https://verify.msg91.com/otp-provider.js';

/** MSG91 custom-widget channel codes (string). */
export const MSG91_CHANNELS = {
  sms: '11',
  voice: '4',
  email: '3',
  whatsapp: '12',
} as const;

@Injectable({ providedIn: 'root' })
export class Msg91OtpService {
  private ready: Promise<void> | null = null;
  private lastReqId: string | null = null;
  private lastIdentifier: string | null = null;

  private get config() {
    return environment.msg91;
  }

  /** Load MSG91 SDK without captcha (disabled in MSG91 widget settings). */
  ensureReady(): Promise<void> {
    if (!this.config?.widgetId || !this.config?.tokenAuth) {
      return Promise.reject(
        new Error('MSG91 is not configured. Add msg91.tokenAuth in environment.'),
      );
    }

    if (this.ready && typeof window.sendOtp === 'function') {
      return this.ready;
    }

    this.ready = new Promise<void>((resolve, reject) => {
      const finish = () => {
        try {
          if (typeof window.initSendOTP !== 'function') {
            reject(new Error('MSG91 SDK failed to load'));
            return;
          }

          window.initSendOTP({
            widgetId: this.config.widgetId,
            tokenAuth: this.config.tokenAuth,
            exposeMethods: true,
            success: () => {
              /* prefer verifyOtp callbacks */
            },
            failure: () => {
              /* prefer verifyOtp callbacks */
            },
          });

          const start = Date.now();
          const tick = () => {
            if (typeof window.sendOtp === 'function') {
              resolve();
              return;
            }
            if (Date.now() - start > 10000) {
              reject(new Error('MSG91 methods not available. Check widget tokenAuth.'));
              return;
            }
            requestAnimationFrame(tick);
          };
          tick();
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      };

      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (existing) {
        if (existing.dataset['loaded'] === '1' || typeof window.initSendOTP === 'function') {
          finish();
        } else {
          existing.addEventListener('load', finish, { once: true });
          existing.addEventListener(
            'error',
            () => reject(new Error('Failed to load MSG91 script')),
            { once: true },
          );
        }
        return;
      }

      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => {
        script.dataset['loaded'] = '1';
        finish();
      };
      script.onerror = () => reject(new Error('Failed to load MSG91 script'));
      document.body.appendChild(script);
    }).catch((err) => {
      this.ready = null;
      throw err;
    });

    return this.ready;
  }

  /** Identifier must include country code without + (e.g. 9198XXXXXXXX). */
  async sendOtp(identifier: string): Promise<unknown> {
    await this.ensureReady();
    this.lastIdentifier = identifier;
    return new Promise((resolve, reject) => {
      window.sendOtp!(
        identifier,
        (data) => {
          this.captureReqId(data);
          resolve(data);
        },
        (error) => reject(this.toError(error, 'Could not send OTP')),
      );
    });
  }

  async verifyOtp(otp: string): Promise<{ accessToken: string; raw: unknown }> {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      window.verifyOtp!(
        otp,
        (data) => {
          this.captureReqId(data);
          const accessToken = this.extractAccessToken(data);
          if (!accessToken) {
            reject(new Error('OTP verified but no access token returned'));
            return;
          }
          resolve({ accessToken, raw: data });
        },
        (error) => reject(this.toError(error, 'Invalid OTP')),
        this.lastReqId || undefined,
      );
    });
  }

  /**
   * Resend OTP via MSG91.
   * Custom widget configs require an explicit channel (SMS = '11').
   * Falls back to a fresh sendOtp if retry fails and we still have the identifier.
   */
  async retryOtp(channel?: string | null): Promise<unknown> {
    await this.ensureReady();
    const resolved =
      channel === undefined
        ? (this.config.retryChannel ?? MSG91_CHANNELS.sms)
        : channel;

    try {
      return await this.retryOtpOnce(resolved);
    } catch (err) {
      // If channel/reqId issues persist, re-send on the same number.
      if (this.lastIdentifier) {
        return this.sendOtp(this.lastIdentifier);
      }
      throw err;
    }
  }

  private retryOtpOnce(channel: string | null): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (typeof window.retryOtp !== 'function') {
        reject(new Error('MSG91 retry is not available'));
        return;
      }
      window.retryOtp!(
        channel,
        (data) => {
          this.captureReqId(data);
          resolve(data);
        },
        (error) => reject(this.toError(error, 'Could not resend OTP')),
        this.lastReqId || undefined,
      );
    });
  }

  private captureReqId(data: unknown) {
    const d = data as Record<string, unknown> | null;
    const nested = (d?.['data'] as Record<string, unknown> | undefined) || undefined;
    const id =
      (d?.['reqId'] as string) ||
      (d?.['requestId'] as string) ||
      (nested?.['reqId'] as string) ||
      null;
    if (id) this.lastReqId = String(id);
  }

  private extractAccessToken(data: unknown): string | null {
    if (!data) return null;
    if (typeof data === 'string' && data.length > 20) return data;
    const d = data as Record<string, unknown>;
    const nested = d['data'] as Record<string, unknown> | undefined;
    const candidates = [
      d['accessToken'],
      d['access-token'],
      d['token'],
      d['message'],
      nested?.['accessToken'],
      nested?.['access-token'],
      nested?.['token'],
      nested?.['message'],
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 20) return c;
    }
    return null;
  }

  private toError(error: unknown, fallback: string): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    const e = error as Record<string, unknown> | null;
    const msg = e?.['message'] || e?.['error'] || e?.['type'];
    return new Error(typeof msg === 'string' ? msg : fallback);
  }
}
