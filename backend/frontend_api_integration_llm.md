# Frontend Integration Contract (LLM-Optimized)

This document is the **frontend source of truth** for integrating with the backend in `src/backend/app.py` + `src/backend/services.py`.

- API base path: `/api/v1`
- Auth: Bearer token (`Authorization: Bearer <access_token>`)
- Transport: JSON for most endpoints; raw binary request body for workbook upload
- Storage behavior: backend persists files/runs/artifacts and exposes download links
- Canonical domains: `ppna`, `sap`, `pe`, `pb`, `ibnr`

---

## 1) Quick integration summary

### 1.1 Contract bullets

- **Bootstrap** once using `/auth/bootstrap`, then use `/auth/login` + `/auth/refresh`.
- **Only `ADMIN`** can upload documents, launch runs, and create bilan snapshots.
- **`ADMIN` + `HR`** can manage users and read audit events.
- **All authenticated roles** can read dashboard/bilan/documents/runs (where read endpoint exists).
- Upload endpoint accepts **raw XLSX bytes** in request body, not multipart.
- Run creation is synchronous from API perspective (response returns completed/failed run state).

### 1.2 Role matrix

| Capability | ADMIN | HR | VIEWER |
|---|---:|---:|---:|
| Login / refresh / me | ✅ | ✅ | ✅ |
| List/search/get documents | ✅ | ✅ | ✅ |
| Download documents | ✅ | ✅ | ✅ |
| Create users / edit role / edit status | ✅ | ✅ | ❌ |
| Read audit events | ✅ | ✅ | ❌ |
| Upload documents | ✅ | ❌ | ❌ |
| Create calculation runs | ✅ | ❌ | ❌ |
| Create bilan snapshots | ✅ | ❌ | ❌ |
| Read dashboard/bilan | ✅ | ✅ | ✅ |

---

## 2) Common request/response conventions

### 2.1 Headers

- JSON requests: `Content-Type: application/json`
- Workbook upload: `Content-Type: application/octet-stream` (or any binary-compatible content type)
- Auth: `Authorization: Bearer <token>`

### 2.2 Standard error payload

Errors are raised as FastAPI `HTTPException`.

```json
{
  "detail": "Human-readable error message"
}
```

### 2.3 Common HTTP statuses

- `200` success (read/auth operations)
- `201` created (user/document/run/bilan snapshot creation)
- `401` invalid/missing/expired access or refresh token
- `403` suspended account or insufficient permissions
- `404` unknown resource / unsupported domain / unsupported format
- `409` conflict (e.g., bootstrap after first account, username conflict, domain mismatch)
- `413` uploaded file too large
- `415` unsupported media extension for upload (non-`.xlsx`)
- `422` invalid payload/business constraints (e.g., missing params, invalid role)

---

## 3) Authentication + session endpoints

## 3.1 `POST /api/v1/auth/bootstrap`

Creates first admin only when user table is empty.

Request:

```json
{
  "username": "admin",
  "password": "secret123"
}
```

Response `200`:

```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer",
  "user": {
    "user_id": "usr_...",
    "username": "admin",
    "role": "ADMIN",
    "status": "ACTIVE"
  }
}
```

Errors: `409` if already bootstrapped, `422` missing username/password.

## 3.2 `POST /api/v1/auth/login`

Same request/response shape as bootstrap.

Errors: `401` bad credentials, `403` suspended account.

## 3.3 `POST /api/v1/auth/refresh`

Request:

```json
{
  "refresh_token": "string"
}
```

Response `200`: same token envelope as login/bootstrap.

Errors: `401` invalid/expired refresh token, `403` suspended account.

## 3.4 `POST /api/v1/auth/logout`

Auth required (Bearer). Revokes current session.

Response `200`:

```json
{
  "session_id": "ses_...",
  "status": "revoked"
}
```

## 3.5 `GET /api/v1/auth/me`

Response `200`:

```json
{
  "session_id": "ses_...",
  "user_id": "usr_...",
  "username": "admin",
  "role": "ADMIN|HR|VIEWER",
  "status": "ACTIVE"
}
```

---

## 4) User management endpoints

## 4.1 `GET /api/v1/users` (ADMIN, HR)

Response `200`:

```json
[
  {
    "user_id": "usr_...",
    "username": "viewer1",
    "role": "VIEWER",
    "status": "ACTIVE|SUSPENDED",
    "created_at": "ISO-8601",
    "created_by": "usr_...|bootstrap"
  }
]
```

## 4.2 `POST /api/v1/users` (ADMIN, HR)

Request:

```json
{
  "username": "hr1",
  "password": "secret123",
  "role": "ADMIN|HR|VIEWER",
  "status": "ACTIVE|SUSPENDED"
}
```

Response `201`:

```json
{
  "user_id": "usr_...",
  "username": "hr1",
  "role": "HR",
  "status": "ACTIVE"
}
```

Errors: `409` duplicate username, `422` unsupported role/status or missing username/password.

## 4.3 `PATCH /api/v1/users/{user_id}/role` (ADMIN, HR)

Request:

```json
{ "role": "ADMIN|HR|VIEWER" }
```

Response `200`:

```json
{ "user_id": "usr_...", "role": "VIEWER" }
```

## 4.4 `PATCH /api/v1/users/{user_id}/status` (ADMIN, HR)

Request:

```json
{ "status": "ACTIVE|SUSPENDED" }
```

Response `200`:

```json
{ "user_id": "usr_...", "status": "SUSPENDED" }
```

Note: suspending a user revokes all their active sessions.

---

## 5) Document ingestion + catalog

## 5.1 `POST /api/v1/{domain}/documents` (ADMIN)

- `domain`: one of `ppna|sap|pe|pb|ibnr`
- Query params:
  - `filename` (**required**): original file name, must end with `.xlsx`
  - `document_id` (optional): upload a new version of existing document
- Request body: raw workbook bytes

Response `201`:

```json
{
  "document_id": "doc_...",
  "version_id": "ver_...",
  "domain": "ppna",
  "original_filename": "level 01-level2-ÉCHANTILLON DATA PPNA.xlsx",
  "sha256": "hex",
  "downloads": {
    "xlsx": "/api/v1/ppna/documents/doc_.../download/xlsx",
    "csv": "/api/v1/ppna/documents/doc_.../download/csv",
    "txt": "/api/v1/ppna/documents/doc_.../download/txt"
  }
}
```

Validation/error specifics:

- `415`: filename extension is not `.xlsx`
- `422`: empty body / workbook unreadable / required sheet missing
- `413`: size exceeds `OPEN_DATA_UPLOAD_MAX_BYTES`
- `409`: provided `document_id` belongs to another domain

## 5.2 `GET /api/v1/{domain}/documents`

Response `200`:

```json
[
  {
    "document_id": "doc_...",
    "domain": "ppna",
    "original_filename": "...xlsx",
    "created_at": "ISO-8601",
    "created_by": "usr_...",
    "current_version_id": "ver_...",
    "status": "ACTIVE",
    "sha256": "hex",
    "uploaded_at": "ISO-8601",
    "uploaded_by": "usr_...",
    "downloads": {
      "xlsx": "...",
      "csv": "...",
      "txt": "..."
    }
  }
]
```

## 5.3 `GET /api/v1/{domain}/documents/{document_id}`

Same object shape as list item.

## 5.4 `GET /api/v1/documents/search?q=<text>&domain=<optional>`

Response `200`:

```json
[
  {
    "document_id": "doc_...",
    "domain": "ppna",
    "original_filename": "...",
    "created_at": "ISO-8601",
    "created_by": "usr_...",
    "current_version_id": "ver_...",
    "status": "ACTIVE"
  }
]
```

## 5.5 `GET /api/v1/documents/{document_id}/versions`

Response `200`:

```json
[
  {
    "version_id": "ver_...",
    "document_id": "doc_...",
    "sha256": "hex",
    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "size_bytes": 12345,
    "storage_path_xlsx": "/abs/path/...",
    "storage_path_csv": "/abs/path/...",
    "storage_path_txt": "/abs/path/...",
    "uploaded_at": "ISO-8601",
    "uploaded_by": "usr_..."
  }
]
```

⚠️ Frontend note: this endpoint currently exposes absolute storage paths. Treat as internal/debug metadata and avoid rendering publicly.

## 5.6 `GET /api/v1/{domain}/documents/{document_id}/download/{file_format}`

- `file_format`: `xlsx|csv|txt`
- Optional query: `version_id` to download a specific historical version

Response `200`: binary stream.

Response headers:

- `X-Content-SHA256`: file digest
- `Content-Disposition`: attachment filename

---

## 6) Calculation runs

## 6.1 `POST /api/v1/{domain}/runs` (ADMIN)

Request:

```json
{
  "document_id": "doc_...",
  "version_id": null,
  "parameters": {}
}
```

Rules:

- Provide **either** `document_id` or `version_id`.
- `parameters` is domain-specific (see section 6.4).

Response `201`:

```json
{
  "run_id": "run_...",
  "domain": "ppna",
  "document_version_id": "ver_...",
  "parameters": {
    "closing_date": "2024-12-31"
  },
  "status": "succeeded|failed|running",
  "started_at": "ISO-8601",
  "finished_at": "ISO-8601|null",
  "started_by": "usr_...",
  "error_message": null,
  "artifacts": {
    "result": "/api/v1/ppna/runs/run_.../artifacts/result.json",
    "rows": "/api/v1/ppna/runs/run_.../artifacts/rows.json",
    "cleaning_report": "/api/v1/ppna/runs/run_.../artifacts/cleaning_report.json"
  }
}
```

## 6.2 `GET /api/v1/{domain}/runs/{run_id}`

Returns same shape as create response.

## 6.3 `GET /api/v1/{domain}/runs/{run_id}/rows`

Response `200`: domain-dependent row-level payload.

- For `ppna|sap|pe|pb`: generally a list of row result objects.
- For `ibnr`: either one structure keyed by occurrence year or segmented map when segmentation used.

Possible `409`: rows unavailable (e.g., run not yet completed or failed).

## 6.4 Domain-specific run parameters

### PPNA

```json
{
  "closing_date": "YYYY-MM-DD"
}
```

### SAP

```json
{
  "closing_date": "YYYY-MM-DD"
}
```

### PE

```json
{
  "positive_result_coefficient": 0.72,
  "historical_average_coefficient": 0.50
}
```

Both fields optional. If omitted, module defaults/config are used.

### PB

```json
{
  "default_loss_ratio_threshold": 0.70,
  "default_pb_rate": 0.15
}
```

Both fields optional.

### IBNR

```json
{
  "closing_year": 2024,
  "occurrence_year_window": [2019, 2024],
  "segment_by": "product",
  "segment_by_product": true
}
```

Notes:

- `segment_by_product=true` is interpreted as `segment_by="product"` when `segment_by` absent.
- `occurrence_year_window` is converted into a tuple backend-side.

## 6.5 `GET /api/v1/{domain}/runs/{run_id}/artifacts/{artifact_name}`

Common artifact names:

- `result.json`
- `rows.json`
- `cleaning_report.json`
- `cleaning_report.md` (available even if not listed in `artifacts` field)

Returns binary payload with:

- `X-Content-SHA256`
- `Content-Disposition`

---

## 7) Dashboard and bilan endpoints

## 7.1 `GET /api/v1/dashboard/summary`

```json
{
  "domains": {
    "ppna": {
      "run_id": "run_...",
      "finished_at": "ISO-8601",
      "total": 1234.56
    }
  },
  "grand_total": 1234.56,
  "completed_domains": 1,
  "expected_domains": 5
}
```

## 7.2 `GET /api/v1/dashboard/alerts`

```json
{
  "alerts": [
    {
      "type": "missing_run",
      "domain": "pb",
      "message": "No successful run for pb."
    },
    {
      "type": "assumption_review",
      "count": 2,
      "message": "Some assumptions still require mentor review."
    }
  ]
}
```

## 7.3 `GET /api/v1/dashboard/timeline`

```json
{
  "events": [
    {
      "event_id": "evt_...",
      "actor_user_id": "usr_...",
      "action": "upload_document",
      "target_type": "document_version",
      "target_id": "ver_...",
      "occurred_at": "ISO-8601"
    }
  ]
}
```

## 7.4 `GET /api/v1/dashboard/completion`

```json
{
  "domains": {
    "ppna": { "completed": true },
    "sap": { "completed": false },
    "pe": { "completed": false },
    "pb": { "completed": false },
    "ibnr": { "completed": false }
  }
}
```

## 7.5 `GET /api/v1/bilan/current`

```json
{
  "generated_at": "ISO-8601",
  "totals": {
    "ppna": 1000.0,
    "sap": 500.0
  },
  "grand_total": 1500.0,
  "source_runs": {
    "ppna": "run_...",
    "sap": "run_..."
  }
}
```

## 7.6 `GET /api/v1/bilan/history`

```json
[
  {
    "snapshot_id": "bil_...",
    "created_at": "ISO-8601",
    "created_by": "usr_...",
    "totals": { "ppna": 1000.0 },
    "source_runs": { "ppna": "run_..." }
  }
]
```

## 7.7 `POST /api/v1/bilan/snapshots` (ADMIN)

Creates and persists a snapshot using latest successful runs.

Response `201` = current bilan payload + `snapshot_id`.

---

## 8) Audit endpoints

## 8.1 `GET /api/v1/audit/events?limit=<1..500>` (ADMIN, HR)

```json
[
  {
    "event_id": "evt_...",
    "actor_user_id": "usr_...",
    "action": "login",
    "target_type": "user_session",
    "target_id": "ses_...",
    "occurred_at": "ISO-8601",
    "ip_address": "127.0.0.1",
    "user_agent": "...",
    "payload_json": "{...}",
    "payload": {},
    "previous_event_hash": "hex|null",
    "event_hash": "hex"
  }
]
```

## 8.2 `GET /api/v1/audit/events/{event_id}` (ADMIN, HR)

Same object shape as list item.

---

## 9) Health endpoint

## 9.1 `GET /api/v1/health`

```json
{ "status": "ok" }
```

No auth required.

---

## 10) Frontend implementation playbooks

## 10.1 Auth state machine

1. Try token-based app init:
   - if access token present, call `/auth/me`.
2. If `401`, try `/auth/refresh` with refresh token.
3. If refresh fails (`401`/`403`), clear session and redirect to login.
4. On logout, call `/auth/logout`, then clear both tokens locally.

## 10.2 Upload + run flow (ADMIN)

1. Upload workbook via `POST /{domain}/documents?filename=...` (raw bytes).
2. Use returned `document_id` to call `POST /{domain}/runs`.
3. Read run status from create response (`succeeded` or `failed`).
4. Fetch:
   - `GET /{domain}/runs/{run_id}`
   - `GET /{domain}/runs/{run_id}/rows`
   - `GET /{domain}/runs/{run_id}/artifacts/cleaning_report.json`
5. Refresh dashboard cards (`/dashboard/summary`, `/dashboard/alerts`).

## 10.3 Error UX mapping

- `401`: show login page (session expired)
- `403`: show permission/suspension banner
- `404`: show missing resource domain/file/run message
- `409`: show conflict guidance (already bootstrapped, duplicate, etc.)
- `413`: suggest file size reduction
- `415`: enforce `.xlsx` file picker and pre-upload validation
- `422`: show backend `detail` directly + field hints

---

## 11) LLM-focused endpoint manifest (machine-readable)

```yaml
api_version: v1
base_path: /api/v1
auth_scheme: bearer
domains: [ppna, sap, pe, pb, ibnr]
roles: [ADMIN, HR, VIEWER]
endpoints:
  - method: GET
    path: /health
    auth: none
    response: {status: string}

  - method: POST
    path: /auth/bootstrap
    auth: none
    request: {username: string, password: string}
    response_ref: TokenEnvelope

  - method: POST
    path: /auth/login
    auth: none
    request: {username: string, password: string}
    response_ref: TokenEnvelope

  - method: POST
    path: /auth/refresh
    auth: none
    request: {refresh_token: string}
    response_ref: TokenEnvelope

  - method: POST
    path: /auth/logout
    auth: bearer
    response: {session_id: string, status: revoked}

  - method: GET
    path: /auth/me
    auth: bearer
    response_ref: SessionUser

  - method: GET
    path: /users
    auth: bearer
    roles_any: [ADMIN, HR]
    response_ref: UserAccount[]

  - method: POST
    path: /users
    auth: bearer
    roles_any: [ADMIN, HR]
    request: {username: string, password: string, role: enum(ADMIN|HR|VIEWER), status: enum(ACTIVE|SUSPENDED)}
    response: {user_id: string, username: string, role: string, status: string}

  - method: PATCH
    path: /users/{user_id}/role
    auth: bearer
    roles_any: [ADMIN, HR]
    request: {role: enum(ADMIN|HR|VIEWER)}
    response: {user_id: string, role: string}

  - method: PATCH
    path: /users/{user_id}/status
    auth: bearer
    roles_any: [ADMIN, HR]
    request: {status: enum(ACTIVE|SUSPENDED)}
    response: {user_id: string, status: string}

  - method: GET
    path: /documents/search
    auth: bearer
    query: {q: string?, domain: enum(ppna|sap|pe|pb|ibnr)?}

  - method: GET
    path: /documents/{document_id}/versions
    auth: bearer

  - method: POST
    path: /{domain}/documents
    auth: bearer
    roles_any: [ADMIN]
    query: {filename: string(.xlsx), document_id: string?}
    body: raw-bytes

  - method: GET
    path: /{domain}/documents
    auth: bearer

  - method: GET
    path: /{domain}/documents/{document_id}
    auth: bearer

  - method: GET
    path: /{domain}/documents/{document_id}/download/{file_format}
    auth: bearer
    path_params: {file_format: enum(xlsx|csv|txt)}
    query: {version_id: string?}

  - method: POST
    path: /{domain}/runs
    auth: bearer
    roles_any: [ADMIN]
    request: {document_id: string?, version_id: string?, parameters: object}

  - method: GET
    path: /{domain}/runs/{run_id}
    auth: bearer

  - method: GET
    path: /{domain}/runs/{run_id}/rows
    auth: bearer

  - method: GET
    path: /{domain}/runs/{run_id}/artifacts/{artifact_name}
    auth: bearer

  - method: GET
    path: /dashboard/summary
    auth: bearer

  - method: GET
    path: /dashboard/alerts
    auth: bearer

  - method: GET
    path: /dashboard/timeline
    auth: bearer

  - method: GET
    path: /dashboard/completion
    auth: bearer

  - method: GET
    path: /bilan/current
    auth: bearer

  - method: GET
    path: /bilan/history
    auth: bearer

  - method: POST
    path: /bilan/snapshots
    auth: bearer
    roles_any: [ADMIN]

  - method: GET
    path: /audit/events
    auth: bearer
    roles_any: [ADMIN, HR]
    query: {limit: int[1..500]}

  - method: GET
    path: /audit/events/{event_id}
    auth: bearer
    roles_any: [ADMIN, HR]

types:
  TokenEnvelope:
    access_token: string
    refresh_token: string
    token_type: bearer
    user:
      user_id: string
      username: string
      role: enum(ADMIN|HR|VIEWER)
      status: enum(ACTIVE|SUSPENDED)

  SessionUser:
    session_id: string
    user_id: string
    username: string
    role: enum(ADMIN|HR|VIEWER)
    status: enum(ACTIVE|SUSPENDED)

  UserAccount:
    user_id: string
    username: string
    role: enum(ADMIN|HR|VIEWER)
    status: enum(ACTIVE|SUSPENDED)
    created_at: iso-8601
    created_by: string
```

---

## 12) Known contract caveats (frontend-safe handling)

- Some fields are dynamic/domain-specific (`rows` payload shape, result internals).
- `list_document_versions` includes absolute storage paths; treat as sensitive/internal.
- `get_run().artifacts` currently lists JSON artifact links only; markdown cleaning report is still retrievable via artifact endpoint.
- Error details are plain strings; frontend should not parse them for logic, only for display.

---

## 13) Proven test-backed flow references

`tests/api/test_backend_api.py` validates:

- bootstrap → upload (`ppna`) → run → rows → downloads → artifact → dashboard → bilan → audit
- HR can manage users but cannot upload
- VIEWER can read and download but cannot upload

Use that as baseline for E2E frontend smoke tests.
