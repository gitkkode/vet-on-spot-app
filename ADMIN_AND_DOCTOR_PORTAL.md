# Admin and doctor portal — appointment, profile, and API handoff

This file is the shared spec for the **admin portal** and the **doctor portal**. The same rules also apply to the Pet Parent (customer) portal. The backend should own reminders, missed-visit checks, and automatic termination so all three apps stay in sync.

Base URL used by the customer app: `https://api.vetonspot.com/api/v1`

Customer routes below are under `/customers/me`. Admin and doctor apps need the same booking fields and status changes on their own authorized routes (for example `/admin/bookings` and `/doctors/me/bookings`). Do not invent a second meaning for `status`, `petIds`, or `reasonForVisit`.

---

## 1. Appointment lifecycle to implement

These jobs are **not** in the customer app yet. Build them once on the server, then show the result in the customer, admin, and doctor appointment lists.

### 1.1 Who gets notified

Every notice below goes to all three parties:

| Party | Who |
| --- | --- |
| Customer | The pet parent who booked the visit |
| Admin | The care-team / admin queue |
| Doctor | The veterinarian assigned to that booking. If nobody is assigned yet, notify admin only for the doctor slot and still notify the customer. |

Use the existing customer notification inbox (`GET /customers/me/notifications`) and the same pattern for admin and doctor inboxes. A notification must include `bookingId`, pet names, scheduled date, scheduled time, and the reason it was sent (`reminder`, `needs_reschedule`, or `terminated`).

### 1.2 Reminder when the slot is near

When a booking is still active (not cancelled, not completed, not terminated):

| When | Notice |
| --- | --- |
| 24 hours before `scheduledDate` + `scheduledTime` | “Your visit is tomorrow.” |
| 1 hour before the slot | “Your visit is in about an hour.” |

Send each reminder once. Do not send a reminder for a booking that is already cancelled, completed, or terminated.

### 1.3 Not approved, or missed — ask for a reschedule

Treat the visit as **not approved** when the slot time has arrived and the booking was never accepted by a doctor (status still `pending`, `sent`, or `received`, with no assigned doctor who has accepted).

Treat the visit as **missed** when the slot time has passed and the visit never started (no en-route, arrived, or in-consult step) and it was not cancelled.

In both cases:

1. Set a visible status the apps can filter on: `needs_reschedule` (keep the old status in history if you need it).
2. Notify customer, admin, and the assigned doctor: the visit was not approved or was missed, and it needs a new date and time.
3. Keep the booking in Upcoming until it is rescheduled or terminated, with a clear “Reschedule” action in all three portals.

Customer reschedule already calls the modify flow in section 3. Admin and doctor must be able to propose or confirm a new slot on the same booking, and the customer must see that new slot.

### 1.4 Still unused — terminate automatically

If a booking stays `needs_reschedule` for **24 hours** after the notice in section 1.3, and nobody has booked a new slot:

1. Set status to `terminated`.
2. Store `terminatedAt` and `terminateReason` (`unapproved` or `missed`).
3. Notify customer, admin, and the assigned doctor that the appointment was closed because it was not rescheduled.
4. Remove it from Upcoming.
5. Show it under **Cancelled** (section 2), labeled terminated, not as a normal completed visit.

Do not hard-delete the row. Keep it so support, admin, and the doctor can still open it. “Delete” in the product means it no longer occupies the calendar and the pet can be booked again.

### 1.5 Suggested timing (change in one place)

| Rule | Default |
| --- | --- |
| First reminder | 24 hours before the slot |
| Second reminder | 1 hour before the slot |
| Mark needs reschedule | At slot time if not approved, or 30 minutes after the slot if the visit never started |
| Auto-terminate | 24 hours after the needs-reschedule notice, if still unused |

---

## 2. Cancelled appointments section

The Pet Parent appointment list now has **Upcoming**, **Past**, **Cancelled**, and **All**.

| Tab | What it shows |
| --- | --- |
| Upcoming | Active visits only. Cancelled and rescheduled-away visits are excluded. |
| Past | Completed or missed-and-finished visits. Not cancellations. |
| Cancelled | Customer-cancelled, admin-cancelled, doctor-cancelled, and auto-terminated (`terminated`, `void`). |
| All | Every booking, including cancelled. |

A customer cancel sets `status: "cancelled"` and `customerStatus.label: "Cancelled"`. Until the server echoes that status, the customer app also keeps a local flag so the visit moves to **Cancelled** immediately.

Admin and doctor appointment lists need the same four tabs and the same status values.

### 2.1 Cancel notification

When a customer cancels, the Pet Parent **Notifications** list shows:

| Field | Value |
| --- | --- |
| `title` | `Appointment cancelled` |
| `body` | `{displayId} for {petName} was cancelled. You can book again anytime.` |
| `entity` | `booking` |
| `entityId` | booking id |

The customer app writes that notice locally if `GET /customers/me/notifications` does not already contain a cancel alert for that booking. **The server should create the same notification** for the customer, and matching notices for admin and the assigned doctor, so it survives a new device. Opening it goes to `/bookings/:id`.

Each cancelled row shows every pet on the visit, the original date and time, and the reason. Upcoming must hide cancelled and terminated bookings.

---

## 3. Cancel and modify — already used by the customer app

Admin must act on these. Doctor must see the updated slot when they are assigned. The customer app writes through the routes below and, if the write route is missing, opens a support ticket the admin queue already has to process.

### 3.1 Create a home visit

`POST /customers/me/bookings`  
Header: `Idempotency-Key`

```json
{
  "petId": "primary-pet-id",
  "petIds": ["pet-a", "pet-b", "pet-c"],
  "reasonForVisit": "Doggy: Sick · Blacky: Not eating · Tom: Routine checkup",
  "intakeText": "Pets on this visit: Doggy, Blacky, Tom\n\nDoggy — Sick\nWhat have you noticed?: Not well\n\nBlacky — Not eating\nLast normal meal?: Last night",
  "address": "…",
  "preferredDate": "2026-10-08",
  "preferredTime": "6:00 PM",
  "consultationType": "Home Visit",
  "mediaUrls": []
}
```

Rules:

- One appointment for several pets is **one booking**, not one booking per pet.
- `petId` is the primary pet. `petIds` is every pet on that visit. Persist and return both.
- Symptoms are **per pet**. `reasonForVisit` uses `Name: issues` joined with ` · `.
- `intakeText` starts with `Pets on this visit: Name, Name` when there is more than one pet, then a block per pet.
- A pet with an upcoming or ongoing visit cannot be booked again until that visit is completed, cancelled, or terminated.
- Response must include `id` or `displayId` (the app links to `/bookings/:id`). Return `petName` and, for multiple pets, the full name list (`pets[].name` or keep `petIds` so clients can resolve names).
- Optional photo: `POST /customers/me/bookings/:id/files` with multipart `files` and `category=problemMedia`.

Admin and doctor lists must show **all pet names** and the per-pet reason, not only `petName` of the primary pet.

### 3.2 Cancel

The customer app tries these, in order, against  
`/customers/me/bookings/:bookingId`:

| Call | Body |
| --- | --- |
| `POST …/cancel` | `{ "reason": "…" }` also tried with `status: "cancelled"` and `cancelReason` |
| `POST …/cancelled` | same |
| `POST …/void` | same |
| `PATCH` or `PUT` the booking | `{ "status": "cancelled", "reason": "…" }` |
| `DELETE` the booking | — |

**Preferred API (implement this and stop relying on the fallback):**

`POST /customers/me/bookings/:bookingId/cancel`

```json
{ "reason": "Cancelled by customer" }
```

Response: the booking with `status: "cancelled"`, `cancelReason`, and `cancelledAt`.

If that route is missing, the app creates a support ticket:

| Field | Value |
| --- | --- |
| `category` | `booking_issue` |
| `type` | `customer_cancel` |
| `subject` | `[CANCEL REQUEST] Booking {id}` |
| `bookingId` | the visit id |

Admin must cancel that booking from the ticket. After a real cancel, the pet is free to book again. Doctor assigned to it must see it under Cancelled, not Upcoming.

### 3.3 Modify / reschedule

The customer can change date, time, and address from the visit page. The app tries, in order:

| Call | Body |
| --- | --- |
| `POST /customers/me/bookings/:id/reschedule` | date, time, address, reason |
| `POST …/modify` and `POST …/update` | same |
| `PATCH` or `PUT /customers/me/bookings/:id` | `preferredDate`, `preferredTime`, `address`, `reasonForVisit` (also mirrored as `scheduledDate`, `scheduledTime`, `location`, `reason`) |

**Preferred API:**

`POST /customers/me/bookings/:bookingId/reschedule`

```json
{
  "petId": "…",
  "petIds": ["…"],
  "preferredDate": "2026-10-09",
  "preferredTime": "4:00 PM",
  "address": "…",
  "reasonForVisit": "Doggy: Sick · Blacky: Not eating"
}
```

Update the same booking id. Return the new slot. Notify customer, admin, and the assigned doctor.

If reschedule is not available, the app:

1. Cancels the old booking (API only, no ticket).
2. `POST /customers/me/bookings` with `rescheduleOf`, `previousBookingId`, and `replaceBookingId` set to the old id.
3. Opens a support ticket so admin does not keep editing the old id.

| Ticket | When |
| --- | --- |
| Subject `[RESCHEDULED] {oldId} → {newId}` | A replacement booking was created. Admin opens the **new** id. |
| Subject `[RESCHEDULE REQUEST] Booking {id}` | The new booking could not be created. Admin edits the original to the date, time, and address in the ticket. |

Ticket `category` is `booking_issue`. The body includes pet id, date, time, address, and reason.

Admin and doctor must show the new slot, not a stale copy of the old one.

### 3.4 Read models the other portals must accept

| Method | Path |
| --- | --- |
| `GET` | `/customers/me/bookings` |
| `GET` | `/customers/me/bookings/:id` |
| `GET` | `/customers/me/bookings/:id/journey` |

List and detail should return `petId`, `petIds`, `petName` or `pets[]`, `reason` / `reasonForVisit`, `intakeText`, `scheduledDate`, `scheduledTime`, `location`, `status`, `customerStatus.label`, `assignedDoctor`, and `paymentStatus`.

Journey steps the customer app already understands include scheduled, accepted, en route, arrived, and in consult. Doctor actions that move those steps must show on the customer track page.

---

## 4. Pet profile photo

The customer app uploads and removes a pet photo. Admin and doctor pet views must show the same image after a refresh, not a device-only cache.

**Preferred**

| Action | Call |
| --- | --- |
| Upload | `POST /customers/me/pets/:petId/photo` multipart field `file` |
| Remove | `DELETE /customers/me/pets/:petId/photo` |
| Read | `GET /customers/me/pets/:petId` and pet lists include a durable `photoUrl` |

The upload response, or the following GET pet, must return `photoUrl` (absolute or a stable path the apps can load). The customer app also accepts `photo`, `avatarUrl`, `imageUrl`, and `profilePhotoUrl` on the pet object, but **`photoUrl` is the field to persist**.

Until the preferred route exists, the app also tries:

- `POST …/pets/:id/avatar`, `/image`, `/profile-photo`, `/upload-photo`, `/photos`
- Multipart field names `file`, `photo`, `image`, `avatar`, `profilePhoto`, `files` (`files` also sends `category=pet_photo`)
- `PATCH /customers/me/pets/:id` with `photoUrl` or `photoBase64`

Those fallbacks are compatibility only. Admin and doctor should read `photoUrl` from the pet record.

---

## 5. Customer profile and addresses

`GET /customers/me`  
`PATCH /customers/me`

Fields the profile screen saves:

| Field | Meaning |
| --- | --- |
| `fullName` | Parent name |
| `mobile` | Phone |
| `email` | Email |
| `address` | Home address text |
| `emergencyContact` | Emergency contact |

When address is saved and that exact text is not already stored, the app also calls:

`POST /customers/me/addresses`

```json
{ "label": "Home", "address": "…", "isDefault": true }
```

`GET /customers/me/addresses` returns the book used at booking time. Admin should see the same default address on the customer and on the booking.

---

## 6. Emergency request (customer)

`POST /customers/me/emergencies`

`category` must be **one** valid intake category (a single chip label such as `Breathing difficulty`). Sending several labels joined together returns: `category is required and must be a valid intake category`.

The customer can select more than one issue on screen. The app sends:

| Field | Content |
| --- | --- |
| `category` | The first selected issue only |
| `whatHappened` | `Issues: Breathing difficulty, Accident/trauma` plus the parent’s description |
| `notes` | The same `Issues:` line, then optional notes |

Admin and doctor emergency views must show every issue, not only `category`. Parse the `Issues:` line in `whatHappened` or `notes` until the API accepts a `categories` array.

Other fields: `petId`, `location`, `whenStarted`, `conscious`, `breathingNormally`, `bleeding`, `possiblePoisoning`, `accident`, `phone`, `safetyAck`.

`GET /customers/me/emergencies/:id` is the status page.

---

## 7. Checklist for admin portal

- Appointment list tabs: Upcoming, Past, **Cancelled**, All. The Pet Parent portal already has these four tabs. Admin and doctor still need the same split.
- One row shows every pet and the per-pet reason (`Name: issues · Name: issues`).
- Reminders, needs-reschedule, and auto-terminate from section 1, including admin notification.
- Persist an `Appointment cancelled` notification (section 2.1) for the customer, admin, and assigned doctor. The Pet Parent app shows a local copy until that server notice exists.
- Process `[CANCEL REQUEST]` by cancelling the booking, and `[RESCHEDULED]` by using the new booking id.
- Doctor assignment is visible on the booking the customer and doctor both open.
- Pet `photoUrl` and customer profile fields match section 4 and 5.
- Emergency detail lists every issue, not only the single `category`.

## 8. Checklist for doctor portal

- “My appointments” uses the same tabs, including **Cancelled**.
- The assigned doctor receives the 24-hour reminder, the 1-hour reminder, the reschedule notice, and the termination notice.
- Accepting a visit clears the “not approved” path. Starting the visit (en route / arrived) clears the “missed” path.
- Multi-pet visits show every pet and that pet’s own symptoms before the doctor arrives.
- Pet photo on the visit is the stored `photoUrl`.
- Reschedule and cancel from the customer appear on the doctor’s list without a manual refresh of a stale slot.
