import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private async data(p: Promise<{ success: boolean; data: any }>): Promise<any> {
    const res = await p;
    return res.data;
  }

  private listOf(raw: unknown, keys: string[]): any[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      for (const k of keys) {
        if (Array.isArray(obj[k])) return obj[k] as any[];
      }
    }
    return [];
  }

  me() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me`)));
  }
  updateMe(body: Record<string, unknown>) {
    return this.data(firstValueFrom(this.http.patch<any>(`${this.base}/customers/me`, body)));
  }

  home(petId?: string | null) {
    const q = petId ? `?petId=${encodeURIComponent(petId)}` : '';
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/home${q}`)));
  }

  pets() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets`)));
  }
  pet(id: string) {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${id}`)));
  }
  createPet(body: Record<string, unknown>) {
    return this.data(firstValueFrom(this.http.post<any>(`${this.base}/customers/me/pets`, body)));
  }
  updatePet(id: string, body: Record<string, unknown>) {
    return this.data(firstValueFrom(this.http.patch<any>(`${this.base}/customers/me/pets/${id}`, body)));
  }
  /**
   * Remove a pet profile. Production may not expose DELETE — tries alternate
   * routes, then falls back to a support ticket for admin to remove.
   */
  async deletePet(
    id: string,
    opts?: { petName?: string; reason?: string },
  ): Promise<{ via: 'api' | 'request'; id: string; ticketId?: string }> {
    const petId = String(id || '').trim();
    if (!petId) throw new Error('Missing pet id');

    const reason =
      String(opts?.reason || 'Customer requested pet profile removal').trim() ||
      'Customer requested pet profile removal';
    const petName = String(opts?.petName || '').trim();
    const base = `${this.base}/customers/me/pets/${encodeURIComponent(petId)}`;
    let lastErr: any = null;

    const tryOk = (res: any): boolean => {
      if (res && typeof res === 'object' && res.success === false) {
        lastErr = res;
        const msg = String(res.message || '').toLowerCase();
        if (/route not found|not found|cannot|not allowed|method/.test(msg)) return false;
        throw Object.assign(new Error(res.message || 'Could not remove pet'), { error: res, status: 400 });
      }
      return true;
    };

    // 1) Dedicated remove / archive / delete actions
    for (const action of ['delete', 'remove', 'archive', 'deactivate'] as const) {
      for (const payload of [{}, { reason }, { status: 'deleted' }, { archived: true }]) {
        try {
          const res = await firstValueFrom(this.http.post<any>(`${base}/${action}`, payload));
          if (tryOk(res)) return { via: 'api', id: petId };
        } catch (e: any) {
          lastErr = e;
          if (e?.status === 401 || e?.status === 403) throw e;
          if (this.isMissingRouteError(e)) continue;
          const msg = String(e?.error?.message || e?.message || '').toLowerCase();
          if (e?.status === 400 && /route not found|not found/.test(msg)) continue;
          throw e;
        }
      }
    }

    // 2) DELETE / PATCH soft-delete on the pet resource
    for (const payload of [
      { status: 'deleted' },
      { status: 'archived' },
      { archived: true, active: false },
      { isActive: false },
      { reason },
    ]) {
      for (const method of ['delete', 'patch', 'put'] as const) {
        try {
          const res =
            method === 'delete'
              ? await firstValueFrom(this.http.delete<any>(base))
              : method === 'patch'
                ? await firstValueFrom(this.http.patch<any>(base, payload))
                : await firstValueFrom(this.http.put<any>(base, payload));
          if (tryOk(res)) return { via: 'api', id: petId };
        } catch (e: any) {
          lastErr = e;
          if (e?.status === 401 || e?.status === 403) throw e;
          if (this.isMissingRouteError(e)) continue;
          const msg = String(e?.error?.message || e?.message || '').toLowerCase();
          if (e?.status === 400 && /route not found|not found/.test(msg)) continue;
          // DELETE with no body may 400 for other reasons — keep trying
          if (method === 'delete') continue;
          throw e;
        }
      }
    }

    // 3) No remove route on prod — open a support ticket so admin can remove
    const subject = `[REMOVE PET] ${petName || petId}`;
    const bodyLines = [
      'Customer requested removal of a pet profile from the Pet Parent Portal.',
      '',
      `Pet ID: ${petId}`,
      petName ? `Pet name: ${petName}` : null,
      `Reason: ${reason}`,
      '',
      'ACTION FOR ADMIN:',
      `Delete / archive pet ${petId} for this customer in admin.`,
    ].filter((l) => l != null && String(l).length);

    try {
      const ticket = await this.createSupport({
        category: 'other',
        subject,
        body: bodyLines.join('\n'),
        petId,
        type: 'customer_remove_pet',
      });
      return {
        via: 'request',
        id: petId,
        ticketId: String(ticket?.id || ticket?.displayId || '').trim() || undefined,
      };
    } catch (supportErr: any) {
      const msg =
        supportErr?.error?.message ||
        supportErr?.message ||
        lastErr?.message ||
        lastErr?.error?.message ||
        'Could not remove pet';
      if (/route not found/i.test(String(msg))) {
        throw Object.assign(
          new Error('Couldn’t reach the care team to remove this pet. Please try Support.'),
          {
            error: supportErr?.error || lastErr,
            status: supportErr?.status || lastErr?.status,
          },
        );
      }
      throw supportErr || lastErr || new Error(String(msg));
    }
  }

  uploadPetPhoto(petId: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/pets/${petId}/photo`, fd)),
    );
  }

  doctors() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/doctors`)));
  }

  followUps(petId?: string | null) {
    const q = petId ? `?petId=${encodeURIComponent(petId)}` : '';
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/follow-ups${q}`))).then(
      (d) => this.listOf(d, ['followUps', 'items', 'data']),
    );
  }
  ackFollowUp(id: string) {
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/follow-ups/${id}/ack`, {})),
    );
  }

  healthSummary(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/health-summary`)),
    );
  }
  healthCalendar(petId: string, from?: string | null, to?: string | null) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params}` : '';
    return this.data(
      firstValueFrom(
        this.http.get<any>(`${this.base}/customers/me/pets/${petId}/health-calendar${q}`),
      ),
    );
  }
  conditions(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/conditions`)),
    ).then((d) => this.listOf(d, ['conditions', 'items', 'data']));
  }
  vaccinations(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/vaccinations`)),
    ).then((d) => this.listOf(d, ['vaccinations', 'items', 'data']));
  }
  carePlans(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/care-plans`)),
    ).then((d) => this.listOf(d, ['carePlans', 'plans', 'items', 'data']));
  }
  updateCarePlanItem(id: string, body: { status: string }) {
    return this.data(
      firstValueFrom(this.http.patch<any>(`${this.base}/customers/me/care-plan-items/${id}`, body)),
    );
  }
  reminders(petId?: string | null) {
    const q = petId ? `?petId=${encodeURIComponent(petId)}` : '';
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/reminders${q}`))).then(
      (d) => this.listOf(d, ['reminders', 'items', 'data']),
    );
  }
  refreshReminders(petId: string) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/pets/${petId}/reminders/refresh`, {}),
      ),
    );
  }
  reminderAction(id: string, action: string, body?: Record<string, unknown>) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/reminders/${id}/${action}`, body || {}),
      ),
    );
  }
  passportFull(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/passport/full`)),
    );
  }
  createPassportShare(petId: string, body: Record<string, unknown>) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/pets/${petId}/passport/shares`, body),
      ),
    );
  }
  revokePassportShare(id: string) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/passport-shares/${id}/revoke`, {}),
      ),
    );
  }
  weightTrend(petId: string) {
    return this.data(
      firstValueFrom(
        this.http.get<any>(`${this.base}/customers/me/pets/${petId}/vitals/weight`),
      ),
    ).then((d) => this.listOf(d, ['points', 'weights', 'items', 'data', 'vitals']));
  }

  addWeight(petId: string, body: { value: number; unit?: string; recordedAt?: string; note?: string }) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/pets/${petId}/vitals/weight`, body),
      ),
    );
  }

  addresses() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/addresses`))).then((d) =>
      this.listOf(d, ['addresses', 'items', 'data']),
    );
  }
  createAddress(body: Record<string, unknown>) {
    return this.data(firstValueFrom(this.http.post<any>(`${this.base}/customers/me/addresses`, body)));
  }

  medications(petId?: string | null) {
    const q = petId ? `?petId=${encodeURIComponent(petId)}` : '';
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/medications${q}`)));
  }
  createMedication(body: Record<string, unknown>) {
    return this.data(firstValueFrom(this.http.post<any>(`${this.base}/customers/me/medications`, body)));
  }
  logMedicationDose(
    id: string,
    body: { slot: string; status: 'taken' | 'skipped' | 'unable' | 'snoozed'; note?: string },
  ) {
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/medications/${id}/doses`, body)),
    );
  }

  documents(petId?: string | null) {
    const q = petId ? `?petId=${encodeURIComponent(petId)}` : '';
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/documents${q}`))).then(
      (d) => this.listOf(d, ['documents', 'files', 'items', 'data']),
    );
  }

  supportTickets() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/support`))).then((d) =>
      this.listOf(d, ['tickets', 'items', 'data', 'support']),
    );
  }
  createSupport(body: Record<string, unknown>) {
    return this.data(firstValueFrom(this.http.post<any>(`${this.base}/customers/me/support`, body)));
  }

  petPassport(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/passport`)),
    );
  }

  caregivers(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/caregivers`)),
    ).then((d) => this.listOf(d, ['caregivers', 'items', 'data']));
  }
  inviteCaregiver(petId: string, body: Record<string, unknown>) {
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/pets/${petId}/caregivers`, body)),
    );
  }
  revokeCaregiver(petId: string, id: string) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/pets/${petId}/caregivers/${id}/revoke`, {}),
      ),
    );
  }

  bookings() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/bookings`))).then(
      (d) => this.listOf(d, ['bookings', 'items', 'data', 'upcoming', 'results']),
    );
  }
  booking(id: string) {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/bookings/${id}`)));
  }
  createBooking(body: Record<string, unknown>, idempotencyKey?: string) {
    const headers = idempotencyKey
      ? new HttpHeaders({ 'Idempotency-Key': idempotencyKey })
      : undefined;
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/bookings`, body, { headers })),
    );
  }

  /**
   * Cancel a booking. Production may not expose cancel routes — falls back to a
   * support ticket so admin sees the cancel request (same pattern as reschedule).
   */
  async cancelBooking(
    id: string,
    opts?: {
      reason?: string;
      petId?: string;
      petName?: string;
      preferredDate?: unknown;
      preferredTime?: unknown;
      address?: unknown;
      /** When false, only real API cancel counts (used by reschedule). Default true. */
      fallbackToRequest?: boolean;
    },
  ): Promise<{ via: 'api' | 'request'; ticketId?: string; id: string }> {
    const bookingId = String(id || '').trim();
    if (!bookingId) throw new Error('Missing booking id');

    const reason = String(opts?.reason || 'Cancelled by customer').trim() || 'Cancelled by customer';
    const allowRequest = opts?.fallbackToRequest !== false;
    const payloads = [
      {},
      { reason },
      { reason, status: 'cancelled' },
      { status: 'cancelled', cancelReason: reason },
      { reason: 'customer_cancel' },
      { reason: 'customer_reschedule' },
    ];

    let lastErr: any = null;

    // 1) Dedicated cancel / status update routes
    for (const base of [
      `${this.base}/customers/me/bookings/${encodeURIComponent(bookingId)}`,
    ]) {
      for (const action of ['cancel', 'cancelled', 'void'] as const) {
        for (const payload of payloads) {
          try {
            const res = await firstValueFrom(this.http.post<any>(`${base}/${action}`, payload));
            if (res && typeof res === 'object' && res.success === false) {
              lastErr = res;
              const msg = String(res.message || '').toLowerCase();
              if (/route not found|not found|cannot|not allowed|method/.test(msg)) continue;
              if (/already|cancel/.test(msg)) {
                return { via: 'api', id: bookingId };
              }
              continue;
            }
            return { via: 'api', id: bookingId, ...(res?.data && typeof res.data === 'object' ? res.data : {}) };
          } catch (e: any) {
            lastErr = e;
            if (e?.status === 401 || e?.status === 403) throw e;
            if (this.isMissingRouteError(e)) continue;
            const msg = String(e?.error?.message || e?.message || '').toLowerCase();
            if (e?.status === 400 && /route not found|not found/.test(msg)) continue;
            if (e?.status === 400 && /already|cancel/.test(msg)) {
              return { via: 'api', id: bookingId };
            }
          }
        }
      }

      // DELETE / PATCH / PUT status
      for (const payload of [{ status: 'cancelled' }, { status: 'cancelled', reason }, { reason }]) {
        for (const method of ['delete', 'patch', 'put'] as const) {
          try {
            const res =
              method === 'delete'
                ? await firstValueFrom(this.http.delete<any>(base))
                : method === 'patch'
                  ? await firstValueFrom(this.http.patch<any>(base, payload))
                  : await firstValueFrom(this.http.put<any>(base, payload));
            if (res && typeof res === 'object' && res.success === false) {
              lastErr = res;
              const msg = String(res.message || '').toLowerCase();
              if (/route not found|not found|cannot|not allowed|method/.test(msg)) continue;
              if (/already|cancel/.test(msg)) return { via: 'api', id: bookingId };
              continue;
            }
            return { via: 'api', id: bookingId };
          } catch (e: any) {
            lastErr = e;
            if (e?.status === 401 || e?.status === 403) throw e;
            if (this.isMissingRouteError(e)) continue;
            const msg = String(e?.error?.message || e?.message || '').toLowerCase();
            if (e?.status === 400 && /route not found|not found/.test(msg)) continue;
            if (e?.status === 400 && /already|cancel/.test(msg)) return { via: 'api', id: bookingId };
          }
        }
      }
    }

    if (!allowRequest) {
      throw lastErr || new Error('Could not cancel booking');
    }

    // 2) No cancel route on prod — open a support ticket so admin can cancel
    const subject = `[CANCEL REQUEST] Booking ${bookingId}`;
    const bodyLines = [
      'Customer requested cancellation from the Pet Parent Portal.',
      '',
      `Booking ID: ${bookingId}`,
      opts?.petId ? `Pet ID: ${opts.petId}` : null,
      opts?.petName ? `Pet: ${opts.petName}` : null,
      opts?.preferredDate != null ? `Scheduled date: ${opts.preferredDate}` : null,
      opts?.preferredTime != null ? `Scheduled time: ${opts.preferredTime}` : null,
      opts?.address != null ? `Address: ${opts.address}` : null,
      `Reason: ${reason}`,
      '',
      'ACTION FOR ADMIN:',
      `Cancel / void booking ${bookingId} in admin.`,
    ].filter((l) => l != null && String(l).length);

    try {
      const ticket = await this.createSupport({
        category: 'booking_issue',
        subject,
        body: bodyLines.join('\n'),
        bookingId,
        relatedBookingId: bookingId,
        petId: opts?.petId || undefined,
        type: 'customer_cancel',
      });
      return {
        via: 'request',
        id: bookingId,
        ticketId: String(ticket?.id || ticket?.displayId || '').trim() || undefined,
      };
    } catch (supportErr: any) {
      const msg =
        supportErr?.error?.message ||
        supportErr?.message ||
        lastErr?.message ||
        lastErr?.error?.message ||
        'Could not cancel booking';
      if (/route not found/i.test(String(msg))) {
        throw Object.assign(new Error('Couldn’t reach the care team to cancel. Please try Support.'), {
          error: supportErr?.error || lastErr,
          status: supportErr?.status || lastErr?.status,
        });
      }
      throw supportErr || lastErr || new Error(String(msg));
    }
  }

  private isMissingRouteError(err: any): boolean {
    const status = err?.status;
    const msg = String(err?.error?.message || err?.message || '').toLowerCase();
    if (status === 404 || status === 405 || status === 501) return true;
    return /route not found|cannot (patch|put|post)|method not allowed|not implemented/.test(msg);
  }

  private unwrapApiResult(res: any): any {
    if (res && typeof res === 'object' && res.success === false) {
      throw Object.assign(new Error(res.message || 'Request failed'), {
        error: res,
        status: 400,
      });
    }
    return res?.data !== undefined ? res.data : res;
  }

  /**
   * Notify admin/care team of a schedule change (support queue + optional booking notes).
   * Production customer API has no booking PATCH, so this is what the admin portal can see.
   */
  async notifyAdminBookingChange(opts: {
    bookingId: string;
    petId?: string;
    preferredDate: unknown;
    preferredTime: unknown;
    address: unknown;
    reasonForVisit: unknown;
    replacementId?: string | null;
    cancelledOld?: boolean;
    mode: 'update' | 'recreate' | 'request';
    extra?: string;
  }): Promise<{ ticketId?: string; notified: boolean }> {
    const {
      bookingId,
      petId,
      preferredDate,
      preferredTime,
      address,
      reasonForVisit,
      replacementId,
      cancelledOld,
      mode,
      extra,
    } = opts;

    const subject =
      mode === 'recreate' && replacementId
        ? `[RESCHEDULED] ${bookingId} → ${replacementId}`
        : `[RESCHEDULE REQUEST] Booking ${bookingId}`;

    const bodyLines = [
      mode === 'recreate'
        ? 'Customer rescheduled a home visit from the Pet Parent Portal.'
        : 'Customer requested a schedule change from the Pet Parent Portal.',
      '',
      `Booking ID: ${bookingId}`,
      replacementId ? `New booking ID: ${replacementId}` : null,
      petId ? `Pet ID: ${petId}` : null,
      cancelledOld != null ? `Old booking cancelled: ${cancelledOld ? 'yes' : 'no'}` : null,
      '',
      'Requested details:',
      `• Date: ${preferredDate}`,
      `• Time: ${preferredTime}`,
      `• Address: ${address}`,
      `• Reason: ${reasonForVisit}`,
      '',
      'ACTION FOR ADMIN:',
      mode === 'recreate' && replacementId
        ? `Open the NEW booking ${replacementId} (do not edit ${bookingId} — it was replaced).`
        : `Update booking ${bookingId} in admin to the date/time/address above.`,
      extra || null,
    ].filter((l) => l != null && String(l).length);

    // Best-effort note on the booking itself (shows on admin booking detail if route exists)
    const notePayload = {
      note: bodyLines.join('\n'),
      message: bodyLines.join('\n'),
      type: 'customer_reschedule',
      preferredDate,
      preferredTime,
      address,
      reasonForVisit,
      replacementId: replacementId || undefined,
    };
    const notePaths = ['notes', 'comments', 'messages', 'change-request', 'request-change'];
    for (const path of notePaths) {
      try {
        const res = await firstValueFrom(
          this.http.post<any>(
            `${this.base}/customers/me/bookings/${encodeURIComponent(bookingId)}/${path}`,
            notePayload,
          ),
        );
        this.unwrapApiResult(res);
        break;
      } catch (err: any) {
        if (err?.status === 401 || err?.status === 403) break;
        if (this.isMissingRouteError(err)) continue;
        const msg = String(err?.error?.message || '').toLowerCase();
        if (/route not found/.test(msg)) continue;
      }
    }

    const ticket = await this.createSupport({
      category: 'booking_issue',
      subject,
      body: bodyLines.join('\n'),
      bookingId,
      relatedBookingId: replacementId || bookingId,
      petId: petId || undefined,
    });

    return {
      ticketId: String(ticket?.id || ticket?.displayId || '').trim() || undefined,
      notified: true,
    };
  }

  /**
   * Persist visit changes against production API.
   * Order: dedicated reschedule → PATCH/PUT → cancel-then-create → admin support ticket.
   * Admin portal only sees DB writes (support tickets / new bookings), never localStorage.
   */
  async updateBooking(id: string, body: Record<string, unknown>) {
    const ids = [id, body['bookingId'], body['uuid'], body['_id']]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    const preferred = {
      preferredDate: body['preferredDate'],
      preferredTime: body['preferredTime'],
      address: body['address'],
      reasonForVisit: body['reasonForVisit'],
    };
    const scheduled = {
      scheduledDate: preferred.preferredDate,
      scheduledTime: preferred.preferredTime,
      location: preferred.address,
      reason: preferred.reasonForVisit,
      ...preferred,
    };
    const actionPayloads = [
      preferred,
      scheduled,
      { ...preferred, ...scheduled, petId: body['petId'] },
    ];

    let lastErr: any = null;
    const petId = String(body['petId'] || '').trim();

    // 1) Dedicated action routes (if the API exposes them)
    for (const bookingId of ids) {
      const base = `${this.base}/customers/me/bookings/${encodeURIComponent(bookingId)}`;
      for (const action of ['reschedule', 'modify', 'update'] as const) {
        for (const payload of actionPayloads) {
          try {
            const res = await firstValueFrom(this.http.post<any>(`${base}/${action}`, payload));
            const data = this.unwrapApiResult(res);
            // Confirm to admin even when direct update worked
            try {
              await this.notifyAdminBookingChange({
                bookingId,
                petId,
                ...preferred,
                mode: 'update',
              });
            } catch {
              /* booking row itself was updated */
            }
            return {
              ...(data && typeof data === 'object' ? data : {}),
              id: bookingId,
              ...preferred,
              via: 'api' as const,
              adminNotified: true,
            };
          } catch (err: any) {
            lastErr = err;
            if (err?.status === 401 || err?.status === 403) throw err;
            if (this.isMissingRouteError(err)) continue;
            if (err?.status === 400 && /route not found/.test(String(err?.error?.message || '').toLowerCase())) {
              continue;
            }
            if (err?.status === 400 || err?.status === 422) throw err;
          }
        }
      }
    }

    // 2) PATCH / PUT on the booking resource
    for (const bookingId of ids) {
      const base = `${this.base}/customers/me/bookings/${encodeURIComponent(bookingId)}`;
      for (const payload of actionPayloads) {
        for (const method of ['patch', 'put'] as const) {
          try {
            const res =
              method === 'patch'
                ? await firstValueFrom(this.http.patch<any>(base, payload))
                : await firstValueFrom(this.http.put<any>(base, payload));
            const data = this.unwrapApiResult(res);
            try {
              await this.notifyAdminBookingChange({
                bookingId,
                petId,
                ...preferred,
                mode: 'update',
              });
            } catch {
              /* booking row itself was updated */
            }
            return {
              ...(data && typeof data === 'object' ? data : {}),
              id: bookingId,
              ...preferred,
              via: 'api' as const,
              adminNotified: true,
            };
          } catch (err: any) {
            lastErr = err;
            if (err?.status === 401 || err?.status === 403) throw err;
            if (this.isMissingRouteError(err)) continue;
            const msg = String(err?.error?.message || err?.message || '').toLowerCase();
            if (err?.status === 400 && /route not found|not found/.test(msg)) continue;
            if (err?.status === 400 || err?.status === 422) throw err;
            if (!err?.status || err.status >= 500) continue;
          }
        }
      }
    }

    // 3) No customer update route on prod — cancel + create so admin sees a real new booking
    if (!petId) {
      throw lastErr || new Error('Cannot reschedule without a pet id');
    }

    let cancelled = false;
    try {
      await this.cancelBooking(id, { fallbackToRequest: false });
      cancelled = true;
    } catch (cancelErr: any) {
      lastErr = cancelErr;
    }

    const idem =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? `reschedule-${id}-${crypto.randomUUID()}`
        : `reschedule-${id}-${Date.now()}`;

    const createBody: Record<string, unknown> = {
      petId,
      petIds: body['petIds'] || [petId],
      reasonForVisit: preferred.reasonForVisit,
      intakeText:
        body['intakeText'] ||
        `[RESCHEDULE of ${id}] ${preferred.reasonForVisit || 'Home visit'} — new slot ${preferred.preferredDate} ${preferred.preferredTime}`,
      address: preferred.address,
      preferredDate: preferred.preferredDate,
      preferredTime: preferred.preferredTime,
      consultationType: body['consultationType'] || 'Home Visit',
      mediaUrls: [],
      rescheduleOf: id,
      previousBookingId: id,
      allowOverlap: true,
      replaceBookingId: id,
    };

    try {
      const created = await this.createBooking(createBody, idem);
      const newId = String(created?.id || created?.bookingId || created?.displayId || '').trim();

      if (!cancelled) {
        try {
          await this.cancelBooking(id, { fallbackToRequest: false });
          cancelled = true;
        } catch {
          /* old visit may remain — admin notified below */
        }
      }

      let adminNotified = false;
      let ticketId: string | undefined;
      try {
        const n = await this.notifyAdminBookingChange({
          bookingId: id,
          petId,
          ...preferred,
          replacementId: newId || null,
          cancelledOld: cancelled,
          mode: 'recreate',
        });
        adminNotified = n.notified;
        ticketId = n.ticketId;
      } catch {
        /* new booking still exists in admin list */
      }

      return {
        ...(created && typeof created === 'object' ? created : {}),
        id: newId || created?.id,
        ...preferred,
        scheduledDate: preferred.preferredDate,
        scheduledTime: preferred.preferredTime,
        location: preferred.address,
        reason: preferred.reasonForVisit,
        via: 'recreate' as const,
        replacedId: id,
        cancelledOld: cancelled,
        pendingCareTeam: false,
        adminNotified,
        ticketId,
      };
    } catch (createErr: any) {
      // Create failed — admin must still get a ticket so they can edit the original booking
      let ticketId: string | undefined;
      try {
        const n = await this.notifyAdminBookingChange({
          bookingId: id,
          petId,
          ...preferred,
          cancelledOld: cancelled,
          mode: 'request',
          extra: `Create-replacement failed: ${createErr?.error?.message || createErr?.message || 'unknown'}`,
        });
        ticketId = n.ticketId;
      } catch (supportErr: any) {
        throw Object.assign(
          new Error(
            supportErr?.error?.message ||
              createErr?.error?.message ||
              'Could not save changes for the care team. Please try Support.',
          ),
          { error: supportErr?.error || createErr?.error, status: supportErr?.status || createErr?.status },
        );
      }

      return {
        id,
        ...preferred,
        scheduledDate: preferred.preferredDate,
        scheduledTime: preferred.preferredTime,
        location: preferred.address,
        reason: preferred.reasonForVisit,
        via: 'pending' as const,
        pendingCareTeam: true,
        adminNotified: true,
        ticketId,
        cancelledOld: cancelled,
        _createError: createErr?.error?.message || createErr?.message || null,
      };
    }
  }
  uploadBookingFiles(bookingId: string, files: File[], category = 'problemMedia') {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    fd.append('category', category);
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/bookings/${bookingId}/files`, fd)),
    );
  }
  bookingJourney(id: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/bookings/${id}/journey`)),
    );
  }

  notifications(unreadOnly = false) {
    const q = unreadOnly ? '?unread=true' : '';
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/notifications${q}`)));
  }

  /** Normalize notifications list + unread count from varied API shapes. */
  parseNotifications(raw: any): { items: any[]; unreadCount: number } {
    const items = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.notifications)
          ? raw.notifications
          : Array.isArray(raw?.data)
            ? raw.data
            : [];
    const unreadFromItems = items.filter((n: any) => !n?.readAt && !n?.read && n?.unread !== false).length;
    const declared =
      typeof raw?.unreadCount === 'number'
        ? raw.unreadCount
        : typeof raw?.unread === 'number'
          ? raw.unread
          : typeof raw?.meta?.unreadCount === 'number'
            ? raw.meta.unreadCount
            : null;
    return { items, unreadCount: declared != null ? declared : unreadFromItems };
  }
  markNotificationRead(id: string) {
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/notifications/${id}/read`, {})),
    );
  }

  /** Mark many as read — tries bulk endpoint, then falls back to per-id. */
  async markAllNotificationsRead(ids: string[]) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return;
    try {
      await this.data(
        firstValueFrom(
          this.http.post<any>(`${this.base}/customers/me/notifications/read-all`, { ids: list }),
        ),
      );
      return;
    } catch {
      /* fall through */
    }
    await Promise.all(list.map((id) => this.markNotificationRead(id).catch(() => null)));
  }

  petTimeline(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/timeline`)),
    );
  }
  visit(id: string) {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/visits/${id}`)));
  }
  visitPrescription(id: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/visits/${id}/prescription`)),
    );
  }

  createEmergency(body: Record<string, unknown>) {
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/emergencies`, body)),
    );
  }
  emergencies() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/emergencies`)));
  }
  emergency(id: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/emergencies/${id}`)),
    );
  }

  createTelevet(body: Record<string, unknown>) {
    return this.data(firstValueFrom(this.http.post<any>(`${this.base}/customers/me/televet`, body)));
  }
  televetList() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/televet`)));
  }
  confirmHomeVisit(bookingId: string) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/televet/${bookingId}/confirm-home-visit`, {}),
      ),
    );
  }

  diagnostics(petId?: string | null) {
    const q = petId ? `?petId=${encodeURIComponent(petId)}` : '';
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/diagnostics${q}`))).then(
      (d) => this.listOf(d, ['diagnostics', 'items', 'orders', 'data']),
    );
  }
  diagnostic(id: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/diagnostics/${id}`)),
    );
  }
  diagnosticsCatalog() {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/diagnostics/catalog`)),
    );
  }

  referrals() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/referrals`)));
  }
  createSecondOpinion(body: Record<string, unknown>) {
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/second-opinions`, body)),
    );
  }

  // ─── Phase 10 intelligence (customer) ─────────────────────────────────────
  startIntake(body: { petId: string; freeText: string }) {
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/intelligence/intake`, body)),
    );
  }
  getIntake(id: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/intelligence/intake/${id}`)),
    );
  }
  saveIntakeAnswer(id: string, body: { questionKey: string; value: unknown }) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/intelligence/intake/${id}/answers`, body),
      ),
    );
  }
  updateIntakeExtraction(id: string, body: Record<string, unknown>) {
    return this.data(
      firstValueFrom(
        this.http.patch<any>(`${this.base}/customers/me/intelligence/intake/${id}/extraction`, body),
      ),
    );
  }
  completeIntake(id: string) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/intelligence/intake/${id}/complete`, {}),
      ),
    );
  }
  linkIntakeToBooking(id: string, bookingId: string) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/intelligence/intake/${id}/link-booking`, {
          bookingId,
        }),
      ),
    );
  }
  intelligenceAssistant(body: { petId: string; question: string }) {
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/intelligence/assistant`, body)),
    );
  }
  prepareBookingIntelligence(body: Record<string, unknown>) {
    return this.data(
      firstValueFrom(
        this.http.post<any>(`${this.base}/customers/me/intelligence/booking/prepare`, body),
      ),
    );
  }
  careNext(petId: string) {
    return this.data(
      firstValueFrom(
        this.http.get<any>(`${this.base}/customers/me/intelligence/care-next/${petId}`),
      ),
    );
  }
  bookingMatch(bookingId: string) {
    return this.data(
      firstValueFrom(
        this.http.get<any>(`${this.base}/customers/me/intelligence/bookings/${bookingId}/match`),
      ),
    );
  }
}
