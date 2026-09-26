import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { normalizePetRecord, normalizePetsList, resolvePetPhotoUrl, unwrapPetPayload, cachePetPhotoUrl, fileToDataUrl, getCachedPetPhotoUrl } from '../utils/pet-photo';

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
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets`))).then((d) =>
      normalizePetsList(d),
    );
  }
  pet(id: string) {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${id}`))).then(
      (d) => {
        const flat = unwrapPetPayload(d) || d;
        return normalizePetRecord(flat) || flat;
      },
    );
  }
  createPet(body: Record<string, unknown>) {
    return this.data(firstValueFrom(this.http.post<any>(`${this.base}/customers/me/pets`, body))).then(
      (d) => {
        const flat = unwrapPetPayload(d) || d;
        return normalizePetRecord(flat) || flat;
      },
    );
  }
  updatePet(id: string, body: Record<string, unknown>) {
    return this.data(firstValueFrom(this.http.patch<any>(`${this.base}/customers/me/pets/${id}`, body))).then(
      (d) => {
        const flat = unwrapPetPayload(d) || d;
        // PATCH responses often omit id — keep caller's id so photo upload can proceed
        if (flat && typeof flat === 'object' && !flat.id) {
          (flat as any).id = id;
        }
        return normalizePetRecord(flat as any) || flat;
      },
    );
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

  /**
   * Upload a pet profile photo.
   * Tries multipart field/path variants, then JSON base64 PATCH fallbacks.
   * Always prefers a fresh GET pet after a successful write.
   */
  async uploadPetPhoto(petId: string, file: File): Promise<{ id: string; photoUrl: string; [k: string]: unknown }> {
    const id = String(petId || '').trim();
    if (!id) throw new Error('Missing pet id for photo upload');
    if (!file) throw new Error('Missing photo file');

    const encoded = encodeURIComponent(id);
    const petBase = `${this.base}/customers/me/pets/${encoded}`;
    const paths = [
      `${petBase}/photo`,
      `${petBase}/avatar`,
      `${petBase}/image`,
      `${petBase}/profile-photo`,
      `${petBase}/upload-photo`,
      `${petBase}/photos`,
    ];
    const fields = ['file', 'photo', 'image', 'avatar', 'profilePhoto', 'files'];
    let lastErr: any = null;
    let wroteOk = false;

    const finish = async (seed?: any): Promise<{ id: string; photoUrl: string; [k: string]: unknown }> => {
      let photoUrl =
        resolvePetPhotoUrl(seed) ||
        resolvePetPhotoUrl(seed?.pet) ||
        resolvePetPhotoUrl(seed?.file) ||
        '';
      try {
        const fresh = await this.pet(id);
        const fromGet = resolvePetPhotoUrl(fresh);
        if (fromGet) photoUrl = fromGet;
        if (photoUrl) cachePetPhotoUrl(id, photoUrl);
        return {
          ...(fresh && typeof fresh === 'object' ? fresh : {}),
          id,
          photoUrl: photoUrl || getCachedPetPhotoUrl(id) || '',
        };
      } catch {
        if (photoUrl) cachePetPhotoUrl(id, photoUrl);
        return { id, photoUrl: photoUrl || getCachedPetPhotoUrl(id) || '' };
      }
    };

    for (const path of paths) {
      for (const field of fields) {
        try {
          const fd = new FormData();
          fd.append(field, file, file.name || 'pet-photo.jpg');
          if (field === 'files') fd.append('category', 'pet_photo');
          const res = await firstValueFrom(this.http.post<any>(path, fd));
          if (res && typeof res === 'object' && res.success === false) {
            lastErr = res;
            const msg = String(res.message || '').toLowerCase();
            if (/route not found|not found|method/.test(msg)) break; // next path
            continue; // next field
          }
          wroteOk = true;
          const data = res?.data !== undefined ? res.data : res;
          const result = await finish(data);
          if (result.photoUrl) return result;
          // Write accepted but no URL yet — keep trying other contracts only if empty
          lastErr = null;
        } catch (e: any) {
          lastErr = e;
          if (e?.status === 401 || e?.status === 403) throw e;
          if (this.isMissingRouteError(e)) break; // next path
          // 400/415/422 often mean wrong field name — try next field
          if ([400, 415, 422].includes(e?.status)) continue;
          // Other errors on an existing route: stop this path
          break;
        }
      }
      if (wroteOk) {
        // Accepted by API — stop probing other paths; fill URL from GET / cache
        const result = await finish();
        if (!result.photoUrl) {
          try {
            const dataUrl = await fileToDataUrl(file);
            cachePetPhotoUrl(id, dataUrl);
            result.photoUrl = dataUrl;
          } catch {
            /* ignore */
          }
        }
        return result;
      }
    }

    // JSON / base64 fallbacks via PATCH pet
    try {
      const dataUrl = await fileToDataUrl(file);
      const payloads: Record<string, unknown>[] = [
        { photoUrl: dataUrl },
        { photo: dataUrl },
        { avatarUrl: dataUrl },
        { profilePhotoUrl: dataUrl },
        { profilePhoto: dataUrl },
        { photoBase64: dataUrl.replace(/^data:[^;]+;base64,/, '') },
        { imageBase64: dataUrl.replace(/^data:[^;]+;base64,/, '') },
      ];
      for (const body of payloads) {
        try {
          const updated = await this.updatePet(id, body);
          const url = resolvePetPhotoUrl(updated) || dataUrl;
          cachePetPhotoUrl(id, url);
          wroteOk = true;
          const result = await finish({ ...updated, photoUrl: url });
          return { ...result, photoUrl: result.photoUrl || dataUrl };
        } catch (e: any) {
          lastErr = e;
          if (e?.status === 401 || e?.status === 403) throw e;
          continue;
        }
      }
      // All server writes failed — cache locally for this device, then fail so the UI can warn
      cachePetPhotoUrl(id, dataUrl);
      throw Object.assign(
        new Error(
          lastErr?.error?.message ||
            lastErr?.message ||
            'Photo upload API missing or rejected — photo kept on this device only',
        ),
        { error: lastErr?.error || lastErr, status: lastErr?.status || 404, localPhotoUrl: dataUrl },
      );
    } catch (e: any) {
      lastErr = e;
      if (e?.localPhotoUrl) throw e;
    }

    const msg =
      lastErr?.error?.message ||
      lastErr?.message ||
      'Photo upload failed — the photo API may be missing on the server';
    throw Object.assign(new Error(String(msg)), {
      error: lastErr?.error || lastErr,
      status: lastErr?.status,
      localPhotoUrl: lastErr?.localPhotoUrl,
    });
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
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/medications${q}`))).then(
      (d) => this.listOf(d, ['medications', 'items', 'data', 'results']),
    );
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

  /**
   * Upload a customer-owned document for a pet.
   * Tries pet-scoped and account-scoped multipart routes with several field names.
   */
  async uploadPetDocument(
    petId: string,
    file: File,
    category = 'other',
  ): Promise<{ id?: string; petId: string; category: string; fileName: string; [k: string]: unknown }> {
    const id = String(petId || '').trim();
    if (!id) throw new Error('Missing pet id for document upload');
    if (!file) throw new Error('Missing document file');
    const cat = String(category || 'other').trim() || 'other';
    const encoded = encodeURIComponent(id);
    const petBase = `${this.base}/customers/me/pets/${encoded}`;
    const paths: Array<{ url: string; includePetIdField: boolean }> = [
      { url: `${petBase}/documents`, includePetIdField: false },
      { url: `${petBase}/files`, includePetIdField: false },
      { url: `${petBase}/upload`, includePetIdField: false },
      { url: `${this.base}/customers/me/documents`, includePetIdField: true },
      { url: `${this.base}/customers/me/files`, includePetIdField: true },
      { url: `${this.base}/customers/me/documents/upload`, includePetIdField: true },
    ];
    const fields = ['file', 'document', 'files', 'attachment', 'upload'];
    let lastErr: any = null;

    for (const path of paths) {
      for (const field of fields) {
        try {
          const fd = new FormData();
          fd.append(field, file, file.name || 'document');
          fd.append('category', cat);
          fd.append('type', cat);
          if (path.includePetIdField) {
            fd.append('petId', id);
            fd.append('pet_id', id);
          }
          const res = await firstValueFrom(this.http.post<any>(path.url, fd));
          if (res && typeof res === 'object' && res.success === false) {
            lastErr = res;
            const msg = String(res.message || '').toLowerCase();
            if (/route not found|not found|method/.test(msg)) break;
            continue;
          }
          const data = res?.data !== undefined ? res.data : res;
          const doc = Array.isArray(data)
            ? data[0]
            : data?.document || data?.file || data?.item || data;
          return {
            ...(doc && typeof doc === 'object' ? doc : {}),
            id: doc?.id || data?.id,
            petId: id,
            category: cat,
            fileName: doc?.fileName || doc?.name || file.name,
          };
        } catch (e: any) {
          lastErr = e;
          if (e?.status === 401 || e?.status === 403) throw e;
          if (this.isMissingRouteError(e)) break;
          if ([400, 415, 422].includes(e?.status)) continue;
          break;
        }
      }
    }

    const msg =
      lastErr?.error?.message ||
      lastErr?.message ||
      'Document upload failed — the documents API may be missing on the server';
    throw Object.assign(new Error(String(msg)), {
      error: lastErr?.error || lastErr,
      status: lastErr?.status,
    });
  }

  /** Upload several documents; returns per-file results (does not throw on partial failure). */
  async uploadPetDocuments(
    petId: string,
    items: Array<{ file: File; category: string }>,
  ): Promise<{ ok: number; failed: number; errors: string[] }> {
    let ok = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const item of items) {
      try {
        await this.uploadPetDocument(petId, item.file, item.category);
        ok += 1;
      } catch (e: any) {
        failed += 1;
        errors.push(
          `${item.file?.name || 'file'}: ${e?.error?.message || e?.message || 'upload failed'}`,
        );
      }
    }
    return { ok, failed, errors };
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
