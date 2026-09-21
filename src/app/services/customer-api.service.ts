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
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/follow-ups${q}`)));
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
    );
  }
  vaccinations(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/vaccinations`)),
    );
  }
  carePlans(petId: string) {
    return this.data(
      firstValueFrom(this.http.get<any>(`${this.base}/customers/me/pets/${petId}/care-plans`)),
    );
  }
  updateCarePlanItem(id: string, body: { status: string }) {
    return this.data(
      firstValueFrom(this.http.patch<any>(`${this.base}/customers/me/care-plan-items/${id}`, body)),
    );
  }
  reminders(petId?: string | null) {
    const q = petId ? `?petId=${encodeURIComponent(petId)}` : '';
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/reminders${q}`)));
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
    );
  }

  addresses() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/addresses`)));
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
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/documents${q}`)));
  }

  supportTickets() {
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/support`)));
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
    );
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
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/bookings`)));
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
  markNotificationRead(id: string) {
    return this.data(
      firstValueFrom(this.http.post<any>(`${this.base}/customers/me/notifications/${id}/read`, {})),
    );
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
    return this.data(firstValueFrom(this.http.get<any>(`${this.base}/customers/me/diagnostics${q}`)));
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
