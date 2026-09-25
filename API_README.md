# VetOnSpot Customer API — Missing Endpoints (Backend Implementation)

> Source: Pet Parent Portal (`vet-on-spot-app`) against production `https://api.vetonspot.com/api/v1`.  
> Generated from frontend client contracts and live “Route not found” / 404 failures.  
> Base path: `/api/v1`  
> Auth: Bearer Firebase ID token (same as other `/customers/me/*` routes)  
> Response envelope: `{ "success": true, "data": { ... } }` or `{ "success": false, "message": "..." }`

---

## Priority: must implement (confirmed missing on production)

These flows are wired in the app but **do not have working backend routes today**. The frontend currently falls back to support tickets.

| # | Method | Path | Used by | Current prod status |
|---|--------|------|---------|---------------------|
| 1 | `DELETE` | `/customers/me/pets/:petId` | Remove pet profile | **404 / Route not found** |
| 2 | `POST` | `/customers/me/bookings/:bookingId/cancel` | Cancel appointment | **404 / Route not found** |
| 3 | `PATCH` | `/customers/me/bookings/:bookingId` | Modify visit (date/time/address) | **Missing** (no customer PATCH) |
| 4 | `POST` | `/customers/me/bookings/:bookingId/reschedule` | Preferred alternate for modify | **Missing** |

Once these exist, cancel / modify / remove pet will complete as real API mutations (no support-ticket workaround required).

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
```

Portal smoke:

1. **Remove pet** → pet disappears from `/pets` (not “request sent”).
2. **Cancel appointment** → booking status cancelled in list/detail (not support ticket only).
3. **Modify visit** → same booking id shows new date/time after refresh.

---

## Out of scope / already working (do not rebuild)

These are already integrated and used successfully by the portal (non-exhaustive):

- Auth OTP + register (`/auth/otp/*`, `/auth/customer/register`, `/auth/me`)
- `GET/PATCH /customers/me`, `GET …/home`
- Pets: `GET/POST` list & create, `GET/PATCH` by id, photo upload
- Bookings: `GET` list & detail, `POST` create, journey, files
- Health, passport, caregivers, medications, documents, addresses
- Support tickets, notifications, emergencies, televet, diagnostics, intelligence/*

---

## Suggested backend ticket titles

1. `[API] DELETE /customers/me/pets/:id — customer pet removal`
2. `[API] POST /customers/me/bookings/:id/cancel — customer cancel`
3. `[API] PATCH /customers/me/bookings/:id (or POST …/reschedule) — customer modify visit`
