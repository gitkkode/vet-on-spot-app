# VetOnSpot Customer API — Missing Endpoints (Backend Implementation)

> Source: Pet Parent Portal (`vet-on-spot-app`) against production `https://api.vetonspot.com/api/v1`.  
> Generated from frontend client contracts and live “Route not found” / 404 failures.  
> Base path: `/api/v1`  
> Auth: Bearer Firebase ID token (same as other `/customers/me/*` routes)  
> Response envelope: `{ "success": true, "data": { ... } }` or `{ "success": false, "message": "..." }`

---

## Priority: must implement (confirmed missing / broken on production)

These flows are wired in the app but **do not have working backend routes today** (or do not persist/return usable media URLs). The frontend currently falls back to support tickets and/or a device-local photo cache.

| # | Method | Path | Used by | Current prod status |
|---|--------|------|---------|---------------------|
| 1 | `DELETE` | `/customers/me/pets/:petId` | Remove pet profile | **404 / Route not found** |
| 2 | `POST` | `/customers/me/bookings/:bookingId/cancel` | Cancel appointment | **404 / Route not found** |
| 3 | `PATCH` | `/customers/me/bookings/:bookingId` | Modify visit (date/time/address) | **Missing** (no customer PATCH) |
| 4 | `POST` | `/customers/me/bookings/:bookingId/reschedule` | Preferred alternate for modify | **Missing** |
| 5 | `POST` | `/customers/me/pets/:petId/photo` | Pet profile photo upload | **Broken / not persisting** (portal cannot show photos after save) |
| 6 | `POST` | `/customers/me/pets/:petId/documents` | Pet document upload (ID, reports, photos…) | **Missing / not wired on prod** |
| 7 | `POST` | `/customers/me/pets/:petId/vitals/weight` | Weight trend “Add weight” | **Soft broken** — falls back to pet PATCH + device `localStorage` |

Once these exist, cancel / modify / remove pet / profile photos / documents / weight sync will complete as real API mutations.

---

## 1. Delete pet profile

### Preferred

```http
DELETE /api/v1/customers/me/pets/:petId
Authorization: Bearer <token>
```

### Behavior

- Verify the pet belongs to the authenticated customer.
- Soft-delete preferred (`deletedAt` / `archived` / `isActive: false`) so health/history can remain recoverable in admin.
- Hard delete only if product requires it; cascade or nullify child refs (caregivers, passport shares, etc.) per DB constraints.
- Return `404` only if pet does not exist **or** is not owned by this customer (do not leak existence across accounts).

### Success response

```json
{
  "success": true,
  "data": {
    "id": "fa2a3504-66b5-4b2c-9da8-787a70584161",
    "deleted": true
  }
}
```

### Errors

| Status | When |
|--------|------|
| `401` | Missing / invalid token |
| `403` | Authenticated but not allowed |
| `404` | Pet not found for this customer |
| `409` | Optional: block delete while pet has an active upcoming booking |

### Also accepted by current frontend (optional aliases)

Frontend will try these if `DELETE` is missing; implementing **only** the preferred `DELETE` is enough:

- `POST /customers/me/pets/:petId/delete`
- `POST /customers/me/pets/:petId/remove`
- `POST /customers/me/pets/:petId/archive`

---

## 2. Cancel booking

### Preferred

```http
POST /api/v1/customers/me/bookings/:bookingId/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Cancelled by customer"
}
```

### Behavior

- Verify booking belongs to the authenticated customer.
- Set status to cancelled / void (match existing admin status vocabulary).
- Idempotent: if already cancelled, return success (`200`) with current booking.
- Reject cancel when visit is completed / in a non-cancellable state (`400` with clear message).

### Success response

```json
{
  "success": true,
  "data": {
    "id": "BK-1254",
    "status": "cancelled",
    "cancelReason": "Cancelled by customer"
  }
}
```

### Also accepted by current frontend (optional)

- `POST …/cancelled`, `POST …/void`
- `PATCH /customers/me/bookings/:bookingId` with `{ "status": "cancelled", "reason": "…" }`
- `DELETE /customers/me/bookings/:bookingId`

Implementing the preferred `POST …/cancel` is enough.

---

## 3. Modify / reschedule booking

### Preferred A — in-place update

```http
PATCH /api/v1/customers/me/bookings/:bookingId
Authorization: Bearer <token>
Content-Type: application/json

{
  "preferredDate": "2026-09-26",
  "preferredTime": "2:00 PM",
  "address": "12 MG Road, Bengaluru",
  "reasonForVisit": "General checkup"
}
```

### Preferred B — dedicated reschedule action

```http
POST /api/v1/customers/me/bookings/:bookingId/reschedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "preferredDate": "2026-09-26",
  "preferredTime": "2:00 PM",
  "address": "12 MG Road, Bengaluru",
  "reasonForVisit": "General checkup"
}
```

### Field notes (frontend sends both naming styles)

| Field | Notes |
|-------|--------|
| `preferredDate` / `scheduledDate` | `YYYY-MM-DD`, today or future |
| `preferredTime` / `scheduledTime` | Slot string, e.g. `"2:00 PM"` |
| `address` / `location` | Visit address |
| `reasonForVisit` / `reason` | Optional text |
| `petId` | Owning pet (already on booking; may be resent) |

### Behavior

- Verify ownership.
- Persist new date/time/address on the **same** booking id (preferred over cancel+create).
- Validate future slot server-side.
- Return updated booking object so the portal can refresh without localStorage hacks.

### Success response

```json
{
  "success": true,
  "data": {
    "id": "BK-1254",
    "preferredDate": "2026-09-26",
    "preferredTime": "2:00 PM",
    "scheduledDate": "2026-09-26",
    "scheduledTime": "2:00 PM",
    "address": "12 MG Road, Bengaluru",
    "location": "12 MG Road, Bengaluru",
    "reasonForVisit": "General checkup",
    "status": "scheduled"
  }
}
```

### Also accepted by current frontend (optional)

- `POST …/modify`, `POST …/update`
- `PUT /customers/me/bookings/:bookingId` with same body

---

## 4. Pet profile photo upload + read-back

> **Portal symptom:** Customer crops/selects a photo on Edit pet → Save → photo does not appear on Home, Pets list, Pet detail, or Book wizard. Frontend now retries several field/path variants and keeps a device-local cache so the UI is not blank, but **cross-device / durable photos require this API**.

### Preferred

```http
POST /api/v1/customers/me/pets/:petId/photo
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary image>   # also accept field names: photo | image | avatar | profilePhoto
```

### Behavior

- Verify the pet belongs to the authenticated customer.
- Accept common image MIME types (`image/jpeg`, `image/png`, `image/webp`, …), max **5 MB**.
- Store the file (object storage / CDN) and persist the URL (or file id) on the pet record.
- **Must** make the photo available on subsequent reads:
  - `GET /customers/me/pets`
  - `GET /customers/me/pets/:petId`
  - `GET /customers/me/home` (`pets[]` / `activePet`)
- Prefer returning a **public or long-lived signed HTTPS URL** in `photoUrl`.
- If only a file id is stored, also expose a resolvable URL (or document how the client should call `/files/:id/signed-url`).

### Success response

```json
{
  "success": true,
  "data": {
    "id": "fa2a3504-66b5-4b2c-9da8-787a70584161",
    "photoUrl": "https://cdn.example.com/pets/fa2a3504/avatar.jpg"
  }
}
```

Accepted alternate shapes (frontend already normalizes these):

- `data.photoURL` / `data.avatarUrl` / `data.profilePhotoUrl` / `data.url`
- `data.pet.photoUrl`
- Relative paths like `/files/...` or `files/...` (portal prefixes API origin)

### Also accepted by current frontend (optional aliases)

Multipart:

- `POST …/pets/:petId/avatar`
- `POST …/pets/:petId/image`
- `POST …/pets/:petId/profile-photo`
- `POST …/pets/:petId/upload-photo`
- `POST …/pets/:petId/photos`

JSON fallbacks (if multipart is unavailable):

```http
PATCH /api/v1/customers/me/pets/:petId
Authorization: Bearer <token>
Content-Type: application/json

{ "photoUrl": "data:image/jpeg;base64,..." }
```

Also tried: `photo`, `avatarUrl`, `profilePhoto`, `photoBase64`, `imageBase64`.

Implementing the preferred multipart `POST …/photo` that **persists** and returns `photoUrl` is enough.

### Read contract (required)

Every pet object returned by list/detail/home **must** include the photo when one exists:

```json
{
  "id": "fa2a3504-66b5-4b2c-9da8-787a70584161",
  "name": "Jimmy",
  "species": "Dog",
  "photoUrl": "https://cdn.example.com/pets/fa2a3504/avatar.jpg"
}
```

### Errors

| Status | When |
|--------|------|
| `401` | Missing / invalid token |
| `403` | Authenticated but not allowed |
| `404` | Pet not found for this customer |
| `400` / `415` | Invalid / unsupported file |
| `413` | File too large |

### Acceptance checks

```bash
# Upload (expect 200 + photoUrl)
curl -X POST "$API/customers/me/pets/$PET_ID/photo" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./pet.jpg"

# Read-back (expect photoUrl present)
curl "$API/customers/me/pets/$PET_ID" -H "Authorization: Bearer $TOKEN"
curl "$API/customers/me/pets" -H "Authorization: Bearer $TOKEN"
curl "$API/customers/me/home" -H "Authorization: Bearer $TOKEN"
```

Portal smoke:

1. Edit pet → crop photo → **Save changes**.
2. Open pet detail, Home, Pets list, Book step 1 — avatar shows the same photo after refresh.
3. Open on another browser/device — photo still present (proves server persistence, not only local cache).

---


## 5. Pet documents upload + categorized list

> **Portal symptom:** Documents page had no upload control and only a flat Photos list. Pet create/edit had no place for additional files. Frontend now groups by category (ID, Photos, Past reports, Vaccination, Prescriptions, Clinical, Other) and offers upload on Documents + optional "Additional documents" on pet create/edit.

### Preferred

```http
POST /api/v1/customers/me/pets/:petId/documents
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
category: id | photos | past_reports | vaccination | prescription | clinical | other
```

### Also accepted (frontend retries these)

- `POST /customers/me/pets/:petId/files`
- `POST /customers/me/pets/:petId/upload`
- `POST /customers/me/documents` with `petId` + `file` + `category`
- `POST /customers/me/files` with `petId` + `file` + `category`
- `POST /customers/me/documents/upload` with `petId` + `file` + `category`

Field name aliases tried: `file`, `document`, `files`, `attachment`, `upload`.

### Behavior

- Verify pet ownership.
- Accept PDF / images / common office docs, max **10 MB**.
- Persist `category` exactly as sent (or map aliases) so list UI can group files.
- Return document metadata including `id`, `fileName`, `category`, `createdAt`, `petId`.
- Include the new file on subsequent `GET /customers/me/documents?petId=`.

### Success response

```json
{
  "success": true,
  "data": {
    "id": "doc_123",
    "petId": "fa2a3504-66b5-4b2c-9da8-787a70584161",
    "fileName": "lab-report.pdf",
    "category": "past_reports",
    "createdAt": "2026-09-26T06:00:00.000Z"
  }
}
```

### List contract

```http
GET /api/v1/customers/me/documents?petId=:petId
Authorization: Bearer <token>
```

Each item should expose at least: `id`, `fileName` (or `name`), `category`, `createdAt`.

Open/download continues via existing:

```http
GET /api/v1/files/:fileId/signed-url
```

### Category vocabulary (portal)

| category | UI label |
|----------|----------|
| `id` | ID & registration |
| `photos` | Photos |
| `past_reports` | Past reports |
| `vaccination` | Vaccination records |
| `prescription` | Prescriptions |
| `clinical` | Clinical notes |
| `other` | Other |

### Acceptance checks

```bash
curl -X POST "$API/customers/me/pets/$PET_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./lab-report.pdf" \
  -F "category=past_reports"

curl "$API/customers/me/documents?petId=$PET_ID" -H "Authorization: Bearer $TOKEN"
```

Portal smoke:

1. Documents → choose category → upload → file appears under that section.
2. Add pet → Additional documents → Save → files show on that pet’s Documents page.
3. Open file → signed URL downloads/previews.


## Standard conventions (match existing API)

```http
GET  /health                 → liveness
GET  /api/v1/health          → health + dependency checks
GET  /api/v1/health/ready    → readiness
```

- Prefix all customer routes with `/api/v1/customers/me/...`
- Always return JSON with `success` boolean
- On unknown routes today: `{ "success": false, "message": "Route not found" }` — **stop returning this for the three flows above**
- Use `401` for auth failures (not `Route not found`)

---

## Acceptance checks (after deploy)

```bash
# Pet delete (expect 200, not 404)
curl -X DELETE "$API/customers/me/pets/$PET_ID" -H "Authorization: Bearer $TOKEN"

# Cancel (expect 200)
curl -X POST "$API/customers/me/bookings/$BOOKING_ID/cancel" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Cancelled by customer"}'

# Modify (expect 200)
curl -X PATCH "$API/customers/me/bookings/$BOOKING_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"preferredDate":"2026-09-26","preferredTime":"2:00 PM","address":"Test address","reasonForVisit":"Checkup"}'

# Pet photo (expect 200 + photoUrl on upload AND on GET)
curl -X POST "$API/customers/me/pets/$PET_ID/photo" \
  -H "Authorization: Bearer $TOKEN" -F "file=@./pet.jpg"
curl "$API/customers/me/pets/$PET_ID" -H "Authorization: Bearer $TOKEN"
```

Portal smoke:

1. **Remove pet** → pet disappears from `/pets` (not “request sent”).
2. **Cancel appointment** → booking status cancelled in list/detail (not support ticket only).
3. **Modify visit** → same booking id shows new date/time after refresh.
4. **Pet photo** → after Edit → Save, photo appears on Home / Pets / Detail / Book (and after hard refresh).
5. **Pet documents** → upload from Documents and from Add pet; files appear under the chosen category.
6. **Weight** → Add weight on trend page; point survives hard refresh on another device (not only localStorage).

---

## Out of scope / already working (do not rebuild)

These are already integrated and used successfully by the portal (non-exhaustive):

- Auth OTP + register (`/auth/otp/*`, `/auth/customer/register`, `/auth/me`) — see also MSG91 resend notes below
- `GET/PATCH /customers/me`, `GET …/home`
- Pets: `GET/POST` list & create, `GET/PATCH` by id (**photo upload is NOT reliable — see §4**)
- Bookings: `GET` list & detail, `POST` create, journey; **`POST …/files` may soft-fail** (visit still created; portal shows a warning)
- Health **reads** (summary, timeline, vaccinations, conditions, care plans, reminders), passport, caregivers
- Medications list/create/dose log (GET list unwraps envelopes)
- Addresses GET/POST
- Documents: `GET` list works; **upload is missing — see §5**
- Support tickets, notifications, emergencies, televet, diagnostics, intelligence/*
- Weight: `GET …/vitals/weight` may work; **POST is not reliable — see §6**

---

## 6. Record pet weight (vitals)

### Preferred

```http
POST /api/v1/customers/me/pets/:petId/vitals/weight
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": 12.4,
  "unit": "kg",
  "recordedAt": "2026-09-26T12:00:00",
  "note": "optional"
}
```

### Behavior

- Verify the pet belongs to the authenticated customer.
- Persist a weight vital so it appears on subsequent `GET /customers/me/pets/:petId/vitals/weight`.
- Prefer updating the pet’s current `weight` display field as well (or derive it from the latest vital).

### Success response

```json
{
  "success": true,
  "data": {
    "id": "vital-uuid",
    "value": 12.4,
    "unit": "kg",
    "recordedAt": "2026-09-26T12:00:00.000Z"
  }
}
```

### Current portal fallback (until implemented)

1. `PATCH /customers/me/pets/:petId` with `{ "weight": "12.4 kg" }`
2. Append to device-only `localStorage` key `vos.weight.{petId}` for the chart

This is **not** durable across devices/browsers.

---

## Soft / optional gaps (not blocking Priority 1–7)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/customers/me/bookings/:id/files` | Booking wizard photo attach; booking still succeeds if this 404s |
| `POST` | `/customers/me/notifications/read-all` | Nice-to-have; portal falls back to per-id `…/read` |
| `POST` | `/customers/me/bookings/:id/notes` (etc.) | Only probed when cancel/modify fail; prefer real cancel/PATCH |

Silent client degradations (empty UI, no hard error): `care-next`, `bookingMatch`, some empty health lists when API returns envelopes the client already unwraps.

---

## Auth OTP resend (MSG91 widget — client-side)

**No new backend route is required** for “Resend OTP” on the login screen.

The portal uses MSG91’s browser OTP widget (`otp-provider.js`) with `exposeMethods: true`:

| Step | Client method | Notes |
|------|---------------|--------|
| Send | `window.sendOtp(identifier)` | Identifier = `91` + 10-digit mobile |
| Verify | `window.verifyOtp(otp, …, reqId)` | Returns MSG91 access token → exchanged via existing `/auth/otp/*` |
| Resend | `window.retryOtp(channel, …, reqId)` | **Channel is mandatory** for custom widget configs |

### Channel codes (custom MSG91 widget)

| Channel | Value |
|---------|--------|
| SMS | `'11'` |
| Voice | `'4'` |
| Email | `'3'` |
| WhatsApp | `'12'` |

Portal config: `environment.msg91.retryChannel` (default `'11'` for SMS).  
Passing `null` only works when the MSG91 widget uses **default** configuration; our widget rejects null with `Channel not provided in retryOtp() method.`

### MSG91 panel checklist (ops)

1. Widget → enable **SMS** as a retry / delivery channel.
2. Keep **Client token** (`tokenAuth`) in sync with `environment.msg91`.
3. Do **not** put the MSG91 Authkey in the frontend — server-side OTP verify/exchange stays on `/auth/otp/*`.

### Optional backend (only if product wants server-driven resend)

Not used by the portal today. If you add it later:

```http
POST /api/v1/auth/otp/resend
Content-Type: application/json

{ "mobile": "9198XXXXXXXX", "channel": "sms" }
```

Until then, resend is entirely MSG91 client SDK + existing verify/exchange APIs.

---

## Suggested backend ticket titles

1. `[API] DELETE /customers/me/pets/:id — customer pet removal`
2. `[API] POST /customers/me/bookings/:id/cancel — customer cancel`
3. `[API] PATCH /customers/me/bookings/:id (or POST …/reschedule) — customer modify visit`
4. `[API] POST /customers/me/pets/:id/photo — persist profile photo + return photoUrl on GET pets/home`
5. `[API] POST /customers/me/pets/:id/documents — upload categorized pet documents + list on GET /documents`
6. `[API] POST /customers/me/pets/:id/vitals/weight — persist weight points for trend chart`
