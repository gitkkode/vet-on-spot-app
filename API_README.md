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
| 5b | `DELETE` | `/customers/me/pets/:petId/photo` | Remove profile photo (Edit pet → Remove) | **Missing** — portal falls back to PATCH clear + device cache clear |
| 6 | `POST` | `/customers/me/pets/:petId/documents` | Pet document upload (ID, reports, photos…) | **Route exists and returns 422 for PDF, Word, Excel, and PowerPoint** — the same call accepts images. Validator must allow the MIME list in §5a. Until it returns 201, the portal keeps the file in this browser only |
| 6b | `PATCH` | `/customers/me/documents/:documentId` | Edit document (category) | **Missing** — Documents → Edit |
| 6c | `PUT` | `/customers/me/documents/:documentId` | Change / replace document file | **Missing** — Documents → Change |
| 6d | `DELETE` | `/customers/me/documents/:documentId` | Remove document | **Missing** — Documents → Remove |
| 7 | `POST` | `/customers/me/pets/:petId/vitals/weight` | Weight trend “Add weight” | **Soft broken** — falls back to pet PATCH + device `localStorage` |
| 8 | `POST` | `/customers/me/support/:ticketId/comments` | Need help → Send comment | **Missing** — portal creates a **new** ticket (`Re: …`) instead of a reply on the same request |
| 9 | `PATCH` | `/customers/me/medications/:medicationId` | Medications → Edit / Stop schedule | **Missing** — list + create + dose log exist; edit and stop do not |
| 10 | `GET` | `/public/passport-shares/:token` | Open a passport share link (no login) | **Missing on API** — portal route `/share/passport/:token` is live and calls this GET; until it exists, another device cannot load the record |
| 10b | `POST` | `/customers/me/passport-shares/:shareId/revoke` | Passport → Revoke access | **Must persist** — after revoke, `GET` the public link returns 410 **Access revoked or expired** |
| 11 | `POST` | `/customers/me/pets/:petId/caregivers` | Passport → Invite caregiver | **Saves the row (`status: invited`) but does not send email** — must deliver the message and return `emailSent: true` |
| 11b | `POST` | `/customers/me/pets/:petId/caregivers/:caregiverId/resend` | Passport → Send email on an existing invite | **Missing** — same delivery contract as §11 |

Once these exist, cancel / modify / remove pet / profile photos / documents (upload + edit/change/remove) / weight sync / support replies / medication edit and stop / passport share open and revoke / caregiver invite email will complete as real API mutations.

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

> **Portal symptom:** Customer crops/selects a photo on Edit pet → Save → photo does not appear on Home, Pets list, Pet detail, Book wizard, or any Pet Health section (the round avatar beside “{Name}'s Documents”, Overview, Passport, and the rest). Those screens read `photoUrl` from `GET /customers/me/pets` (and the device cache when GET omits it). Frontend retries several upload paths, but **cross-device / durable photos require this API**.

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

### Remove profile photo

```http
DELETE /api/v1/customers/me/pets/:petId/photo
Authorization: Bearer <token>
```

Aliases the portal also tries: `DELETE …/avatar`, `…/image`, `…/profile-photo`.

Fallback if DELETE is missing:

```http
PATCH /api/v1/customers/me/pets/:petId
Authorization: Bearer <token>
Content-Type: application/json

{ "photoUrl": null }
```

Also accepted clear payloads: `{ "photoUrl": "" }`, `{ "photo": null }`, `{ "avatarUrl": null }`, `{ "clearPhoto": true }`, `{ "removePhoto": true }`.

After remove, subsequent `GET` pets/home/detail must omit `photoUrl` (or return null/empty).

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
2. Open pet detail, Home, Pets list, Book step 1, and any Pet Health section (Overview, Documents, Passport, …) — the round avatar shows the same photo after refresh.
3. Open on another browser/device — photo still present (proves server persistence, not only local cache).

---


## 5. Pet documents — upload, list, edit, change, remove

> **Portal symptom:** Documents page uploads and lists by category. Uploaded (managed) files also need **Edit** (category), **Change** (replace file), and **Remove**. Visit-derived links stay read-only. Frontend is wired; preferred mutate routes are still missing on production.

### 5a. Upload

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
- `POST /customers/me/documents/upload` with `petId` + `file` + `category`
- `POST /customers/me/files` with `petId` + `file` + `category` *(may be photo-only — see note)*

Field name for binary: prefer **`file`**. Aliases tried: `document`, `attachment`, `upload`, `files`.

Category fields sent: `category`, `documentCategory`.  
MIME fields sent: `type`, `mimeType`, `contentType` — these are the file type (`application/pdf`, `application/msword`, …), **never** the category id.  
Sending `type=id` or `documentType=id` makes production answer `422 Only images, PDF, or common office documents are allowed` for a valid PDF, while images still upload.

Send the original file as multipart only. A base64 JSON body (`fileBase64` / `data`) is larger than the gateway limit and comes back as `413 Content Too Large` with no CORS header, which the browser shows as `Failed to fetch`.

### Known production symptom (confirmed 2026-09-30)

`POST /customers/me/pets/:petId/documents` **is implemented** and accepts images. The same request with a PDF, Word, Excel, or PowerPoint file returns:

`422 Unprocessable Content` — `Only images, PDF, or common office documents are allowed`

The portal sends the real file MIME on the file part (`Content-Type: application/pdf`, and `type` / `mimeType` / `contentType` set to that MIME). Category is only in `category`. The 422 still happens, so the server check is not using that MIME or the filename extension.

Until this returns `201`, the portal stores the file in the browser (IndexedDB) and lists it as **On this device**. Open, Edit, Change, and Remove work on that browser. Another device will not see the file until `GET /customers/me/documents?petId=` returns it.

### MIME the upload must accept

Decide from the file part’s `Content-Type`, and if that is empty or `application/octet-stream`, from the filename extension.

| Extension | MIME |
|-----------|------|
| `.pdf` | `application/pdf` |
| `.doc` | `application/msword` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.xls` | `application/vnd.ms-excel` |
| `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `.ppt` | `application/vnd.ms-powerpoint` |
| `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `.txt` | `text/plain` |
| `.csv` | `text/csv` |
| `.rtf` | `application/rtf` |
| `.jpg` `.jpeg` `.png` `.webp` `.gif` `.bmp` | matching `image/*` |

Reject only when both the MIME and the extension are outside this list. Do not reject `application/pdf` because another field contains the category id (`id`, `past_reports`, …).

Backend checklist:

1. Accept the table above on `POST /customers/me/pets/:petId/documents` (max 10 MB) and return the success body below.
2. Validate MIME from the file part or the extension, not from a category field.
3. Return the saved file on `GET /customers/me/documents?petId=`.
4. Implement **edit / replace / delete** (§5b–5d) so Documents → Edit / Change / Remove persist on the server.

### Upload behavior

- Verify pet ownership.
- Accept PDF / images / common office docs, max **10 MB**.
- Persist `category` exactly as sent (or map aliases) so list UI can group files.
- Return document metadata including `id`, `fileName`, `category`, `createdAt`, `petId`.
- Include the new file on subsequent `GET /customers/me/documents?petId=`.

### Upload success response

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

---

### 5b. Edit document (category)

> **Portal:** Documents → **Edit** on a managed upload → change category → Save.

```http
PATCH /api/v1/customers/me/documents/:documentId
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "vaccination",
  "petId": "fa2a3504-66b5-4b2c-9da8-787a70584161"
}
```

Also accepted: `PUT` on the same path; aliases `documentCategory` / `documentType` / `kind`; pet-scoped  
`PATCH /customers/me/pets/:petId/documents/:documentId`; `PATCH /customers/me/files/:documentId`.

### Behavior

- Verify the document belongs to the authenticated customer (and optional `petId` matches).
- Update category only (do not require a new file).
- Return updated metadata; list must reflect the new category on next `GET`.

### Success response

```json
{
  "success": true,
  "data": {
    "id": "doc_123",
    "petId": "fa2a3504-66b5-4b2c-9da8-787a70584161",
    "fileName": "lab-report.pdf",
    "category": "vaccination",
    "createdAt": "2026-09-26T06:00:00.000Z"
  }
}
```

---

### 5c. Change document (replace file)

> **Portal:** Documents → **Change** → pick a new PDF/image → replaces the binary (same document id preferred).

```http
PUT /api/v1/customers/me/documents/:documentId
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
category: past_reports   # optional; keep existing if omitted
petId: <petId>           # optional hint
```

Also accepted: `POST` / `PATCH` multipart on the same path;  
`PUT|POST /customers/me/documents/:documentId/replace`;  
`PUT /customers/me/files/:documentId`;  
`PUT /customers/me/pets/:petId/documents/:documentId`.

Same MIME / size rules as upload (§5a). Prefer keeping the same `id` so signed-url links stay stable; if a new id is issued, return it and ensure the old id is removed from `GET …/documents`.

### Success response

```json
{
  "success": true,
  "data": {
    "id": "doc_123",
    "petId": "fa2a3504-66b5-4b2c-9da8-787a70584161",
    "fileName": "updated-lab-report.pdf",
    "category": "past_reports",
    "createdAt": "2026-09-26T06:00:00.000Z"
  }
}
```

---

### 5d. Remove document

> **Portal:** Documents → **Remove** → confirm modal.

```http
DELETE /api/v1/customers/me/documents/:documentId
Authorization: Bearer <token>
```

Also accepted: `DELETE /customers/me/files/:documentId`;  
`DELETE /customers/me/pets/:petId/documents/:documentId`.

If hard DELETE is unavailable, soft-delete via:

```http
PATCH /api/v1/customers/me/documents/:documentId
Content-Type: application/json

{ "deleted": true, "archived": true, "status": "deleted" }
```

### Behavior

- Verify ownership; soft-delete preferred so admin recovery is possible.
- After remove, document must not appear on `GET /customers/me/documents?petId=`.
- Return `404` only when the document does not exist or is not owned by this customer.

### Success response

```json
{
  "success": true,
  "data": { "id": "doc_123", "deleted": true }
}
```

---

### Acceptance checks

```bash
# Upload
curl -X POST "$API/customers/me/pets/$PET_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./lab-report.pdf" \
  -F "category=past_reports"

# List
curl "$API/customers/me/documents?petId=$PET_ID" -H "Authorization: Bearer $TOKEN"

# Edit category
curl -X PATCH "$API/customers/me/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"category":"vaccination","petId":"'"$PET_ID"'"}'

# Change file
curl -X PUT "$API/customers/me/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./updated-lab-report.pdf" \
  -F "category=past_reports" \
  -F "petId=$PET_ID"

# Remove
curl -X DELETE "$API/customers/me/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Portal smoke:

1. Documents → choose category → upload → file appears under that section.
2. Add pet → Additional documents → Save → files show on that pet’s Documents page.
3. Open file → signed URL downloads/previews.
4. Documents → **Edit** → change category → Save → file moves to the new section after refresh.
5. Documents → **Change** → pick new file → Open shows the new file.
6. Documents → **Remove** → confirm → file disappears from the list (and from another device).


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
5. **Pet documents** → upload from Documents and from Add pet; files appear under the chosen category; **Edit** / **Change** / **Remove** work on managed uploads.
6. **Weight** → Add weight on trend page; point survives hard refresh on another device (not only localStorage).
7. **Need help** → Submit creates one ticket; **Send comment** appears under that same ticket (not as a new `Re:` request).
8. **Medications** → Add / edit a schedule with dose times; Stop marks it completed; Mark taken still logs a dose.
9. **Passport share** → Create link opens `/share/passport/:token` with the pet record (not the homepage). Revoke, then reload that URL: it shows **Access revoked or expired**. A past `expiresAt` shows the same message.

---

## Out of scope / already working (do not rebuild)

These are already integrated and used successfully by the portal (non-exhaustive):

- Auth OTP + register (`/auth/otp/*`, `/auth/customer/register`, `/auth/me`) — see also MSG91 resend notes below
- `GET/PATCH /customers/me`, `GET …/home`
- Pets: `GET/POST` list & create, `GET/PATCH` by id (**photo upload is NOT reliable — see §4**)
- Bookings: `GET` list & detail, `POST` create, journey; **`POST …/files` may soft-fail** (visit still created; portal shows a warning)
- Health **reads** (summary, timeline, vaccinations, conditions, care plans, reminders), passport page for the owner
- Caregivers: `GET` list, `POST` create, and `POST …/revoke` save the invite; **the invite email is not sent — see §11**
- Passport **share create** (`POST …/pets/:id/passport/shares`) returns a token; the **public read** and **revoke** must persist or the link opens the homepage / stays valid — see §10
- Medications: `GET/POST /customers/me/medications` and `POST …/medications/:id/doses` work; **edit/stop (`PATCH`) is missing — see §8**
- Addresses GET/POST
- Documents: `GET` list works; **upload + edit/change/remove are missing — see §5**
- Support: `GET/POST /customers/me/support` (list + new request) **works**; **comments on a ticket are missing — see §7**
- Notifications, emergencies, televet, diagnostics, intelligence/*
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

## 7. Need help — ticket comments

> **Portal:** `/support` — **New request** (left) and **Your requests** (right).  
> List + create already work. **Send comment** does not stay on the same ticket.

### Already working (do not rebuild)

```http
GET  /api/v1/customers/me/support
POST /api/v1/customers/me/support
Authorization: Bearer <token>
```

Create body the portal sends:

```json
{
  "category": "payment_issue",
  "subject": "Payment Pending",
  "body": "Payment is Pending",
  "bookingId": "optional",
  "petId": "optional"
}
```

Category values: `booking_issue` | `doctor_issue` | `payment_issue` | `prescription_issue` | `technical_issue` | `other`.

List items should include at least: `id`, `displayId` (e.g. `ST-1038`), `subject`, `status`, `category`, `body` (or `description` / `message`), `createdAt`.

### Missing — comment on an existing ticket

```http
POST /api/v1/customers/me/support/:ticketId/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "body": "Sharing more detail for the care team"
}
```

### Behavior

- Verify the ticket belongs to the authenticated customer.
- Append the comment to **that** ticket. Do not create a new ticket.
- Return the comment (and/or the updated ticket).
- Subsequent `GET /customers/me/support` must include the comment on the same ticket under one of: `responses`, `replies`, or `messages` (each item: `body` or `message` or `text`, optional `authorName`, `createdAt`).

### Success response

```json
{
  "success": true,
  "data": {
    "id": "cmt_1",
    "ticketId": "ticket-uuid",
    "body": "Sharing more detail for the care team",
    "authorName": "You",
    "createdAt": "2026-09-28T07:10:00.000Z"
  }
}
```

### Current portal behavior

The app calls `POST /customers/me/support/:ticketId/comments` first (also tries `…/replies` and `…/messages`). If that route is missing, it falls back to `POST /customers/me/support` with:

```json
{
  "category": "payment_issue",
  "subject": "Re: Payment Pending",
  "body": "the comment text",
  "parentTicketId": "<ticket id>",
  "ticketId": "<ticket id>"
}
```

That opens a **second** request (`Re: …`) in Your requests. The original ticket still shows “No in-app replies yet.”

### Acceptance

```bash
curl -X POST "$API/customers/me/support/$TICKET_ID/comments" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"body":"More detail for the care team"}'

curl "$API/customers/me/support" -H "Authorization: Bearer $TOKEN"
```

Portal smoke: Need help → open a request → Send comment → the note appears under **Team replies** / comments on that same card, and the request count does not increase by one.

---

## 8. Medications — edit schedule and stop

> **Portal:** `/medications` can list schedules, create one (or add from a visit prescription), and log taken / skip / snooze. **Edit** and **Stop schedule** need `PATCH`. Create must persist `times` so morning / afternoon / evening / night slots appear.

### Already working (do not rebuild)

```http
GET  /api/v1/customers/me/medications?petId=:petId
POST /api/v1/customers/me/medications
POST /api/v1/customers/me/medications/:medicationId/doses
```

Create body the portal sends:

```json
{
  "petId": "pet-uuid",
  "medicine": "Amoxicillin",
  "strength": "250 mg",
  "dose": "1 tablet",
  "frequency": "Twice a day",
  "instructions": "With food",
  "times": { "morning": true, "afternoon": false, "evening": true, "night": false },
  "active": true,
  "status": "ACTIVE",
  "prescriptionItemId": "optional"
}
```

List items should include `id`, `petId`, `petName`, `medicine`, `dose`, `frequency`, `instructions`, `status`, `active`, `times` (booleans for `morning` | `afternoon` | `evening` | `night`), and `today` (array of `{ "slot", "status" }` for the dose log).

Dose log body: `{ "slot": "morning", "status": "taken" | "skipped" | "snoozed" | "unable" }`.

### Missing — edit or stop

```http
PATCH /api/v1/customers/me/medications/:medicationId
Authorization: Bearer <token>
Content-Type: application/json
```

Edit sends the same fields as create (`medicine`, `dose`, `frequency`, `times`, …).

Stop sends:

```json
{ "status": "COMPLETED", "active": false }
```

`PUT` on the same path is also accepted.

### Behavior

- Verify the medication belongs to the authenticated customer.
- Persist `times` exactly. Slots with `true` are the only ones the tracker shows.
- After stop, `GET` must return `active: false` or `status` of `COMPLETED` / `STOPPED` so the portal hides dose buttons.
- Return the updated medication.

### Success response

```json
{
  "success": true,
  "data": {
    "id": "med_1",
    "petId": "pet-uuid",
    "medicine": "Amoxicillin",
    "status": "ACTIVE",
    "active": true,
    "times": { "morning": true, "afternoon": false, "evening": true, "night": false }
  }
}
```

---

## 10. Passport share link (public read + revoke)

Creating a share already works:

```http
POST /api/v1/customers/me/pets/:petId/passport/shares
Authorization: Bearer <token>
Content-Type: application/json

{ "expiresInHours": 1 }
```

The portal builds `https://<app-origin>/share/passport/<token>` from `data.token` (or `shareToken` / `code` / `id`) and opens that path with no Firebase session. Revoke must make that same URL show **Access revoked or expired**. Until `GET /public/passport-shares/:token` exists, the portal can only show a copy saved in the browser that created the link.

### 10a. Public read (no auth)

```http
GET /api/v1/public/passport-shares/:token
```

Do **not** require `Authorization`. The token is the secret.

### Active success

```json
{
  "success": true,
  "data": {
    "status": "active",
    "expiresAt": "2026-09-28T10:17:00.000Z",
    "passport": {
      "reference": "VOS-PP-57A64D7E",
      "pet": { "name": "Moti", "species": "Dog", "breed": "Indie", "sex": "Male" },
      "emergency": {
        "allergies": "None recorded",
        "ownerName": "Shreyas T P",
        "ownerMobile": "9193809998708"
      },
      "medications": [],
      "vaccinations": [],
      "conditions": []
    }
  }
}
```

`passport` should match `GET /customers/me/pets/:petId/passport/full` (pet, emergency, medications, vaccinations, conditions). Omit owner account secrets.

### Revoked, expired, or unknown token

Use **410 Gone** (404 is acceptable). Do not return the passport body.

```json
{
  "success": false,
  "code": "REVOKED",
  "message": "Access revoked or expired"
}
```

`code` is `REVOKED` or `EXPIRED`. The portal shows **Access revoked or expired** for 410, 403, this body, or an `expiresAt` already in the past.

Also accepted if the preferred path is missing:

- `GET /passport-shares/:token`
- `GET /share/passport/:token`

### 10b. Revoke

```http
POST /api/v1/customers/me/passport-shares/:shareId/revoke
Authorization: Bearer <token>
Content-Type: application/json

{}
```

- `:shareId` is the share row id. The portal also sends the public token if that is the only id it has.
- Verify the share belongs to the authenticated customer.
- Set status to `revoked` immediately. Later `GET /public/passport-shares/:token` must return 410, including links already copied.
- A second revoke of the same share may return 200 (`already revoked`).

### Success

```json
{
  "success": true,
  "data": {
    "id": "share-uuid",
    "token": "8bae0f4d…",
    "status": "revoked",
    "revokedAt": "2026-09-28T09:30:00.000Z"
  }
}
```

Also accepted:

- `POST /customers/me/pets/:petId/passport/shares/:shareId/revoke`
- `DELETE /customers/me/passport-shares/:shareId`

### Errors

| Status | When |
|--------|------|
| `401` | Revoke called without a valid customer token |
| `403` | Share belongs to another customer |
| `404` | Share id not found for this customer |
| `410` | Public `GET` after revoke, expiry, or unknown token |

---

## 11. Caregiver invite email

Passport → Caregivers saves the invite today (`family · invited`) and returns success, but the response has no `emailSent` and no message arrives in the invitee’s inbox.

The portal already creates a 7-day passport share and sends that URL as `inviteUrl`. Until the API confirms `emailSent: true`, the portal opens the owner’s email app with the recipient, subject, and link filled in so they can send the message themselves.

### Preferred

```http
POST /api/v1/customers/me/pets/:petId/caregivers
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "family@email.com",
  "inviteeEmail": "family@email.com",
  "role": "family",
  "sendEmail": true,
  "notify": true,
  "inviteUrl": "https://app.vetonspot.com/share/passport/<token>",
  "expiresAt": "2026-10-05T10:30:00.000Z"
}
```

### Behavior

- Verify the pet belongs to the authenticated customer.
- Create or update one invite per email (`status: invited`). A repeat invite for the same email must not create a second row.
- **Send an email** to `inviteeEmail` that includes `inviteUrl` (or a server-built accept link that opens the same read-only passport).
- Return `emailSent: true` only after the mail provider accepts the message. A saved row with `emailSent` omitted or `false` is not a sent email.
- The link in the email must keep working until `expiresAt`, and must show **Access revoked or expired** after revoke or expiry (§10).

### Response

```json
{
  "success": true,
  "data": {
    "id": "caregiver-uuid",
    "inviteeEmail": "family@email.com",
    "role": "family",
    "status": "invited",
    "emailSent": true,
    "inviteUrl": "https://app.vetonspot.com/share/passport/<token>"
  }
}
```

### Resend an existing invite

```http
POST /api/v1/customers/me/pets/:petId/caregivers/:caregiverId/resend
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "family@email.com",
  "inviteUrl": "https://app.vetonspot.com/share/passport/<token>",
  "sendEmail": true
}
```

Same response shape. `emailSent: true` only when a new message was accepted.

Also accepted for the first send: `POST /customers/me/pets/:petId/caregivers/invite` and `POST /customers/me/pets/:petId/caregivers/:caregiverId/send`.

### Errors

| Status | When |
|--------|------|
| `400` / `422` | Missing or invalid email |
| `401` | No valid customer token |
| `403` | Pet belongs to another customer |
| `404` | Pet or caregiver id not found |

---

## Soft / optional gaps (not blocking Priority 1–11)

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
4b. `[API] DELETE /customers/me/pets/:id/photo — remove profile photo (or PATCH photoUrl null)`
5. `[API] POST /customers/me/pets/:id/documents — upload categorized pet documents + list on GET /documents`
5b. `[API] PATCH /customers/me/documents/:id — edit document category`
5c. `[API] PUT /customers/me/documents/:id — replace document file (Change)`
5d. `[API] DELETE /customers/me/documents/:id — remove document`
6. `[API] POST /customers/me/pets/:id/vitals/weight — persist weight points for trend chart`
7. `[API] POST /customers/me/support/:ticketId/comments — reply on the same Need help ticket`
8. `[API] PATCH /customers/me/medications/:id — edit dose times and stop a schedule`
9. `[API] GET /public/passport-shares/:token — public read-only passport link`
9b. `[API] POST /customers/me/passport-shares/:id/revoke — expire a passport share link`
10. `[API] POST /customers/me/pets/:id/caregivers — send the caregiver invite email (emailSent: true)`
10b. `[API] POST /customers/me/pets/:id/caregivers/:id/resend — resend a caregiver invite email`
