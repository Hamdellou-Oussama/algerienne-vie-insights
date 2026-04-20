# Backend Implementation Plan

Date: 2026-04-18

## 1. Objective And Scope

### Objective

Build the first production-style backend layer for the hackathon system so the future frontend can securely:

- upload actuarial workbooks for `PPNA`, `SAP`, `PE`, `PB`, and `IBNR`
- download the original `.xlsx` plus immediate `.csv` and `.txt` derivatives
- trigger and read calculation results using the already implemented actuarial engines
- view consolidated `dashboard` and `bilan` outputs
- preserve full auditability, traceability, and role-based access

### In Scope

- HTTP API design and implementation plan
- storage strategy for uploaded and derived files
- authentication and authorization model
- document-management-system behavior
- audit trail and tamper-evident event design
- backend reuse strategy for existing preprocessing / provision / reporting code
- test and quality gates before exposing endpoints

### Out Of Scope For This Phase

- frontend implementation
- rewriting actuarial formulas already implemented in `src/provisions/`
- modifying raw sample files under `data/`
- full legal-grade PKI / external digital-signature integration
- cloud deployment / distributed infrastructure hardening beyond hackathon needs

## 2. Current-State Check

### What Already Exists And Can Be Reused

| Area                        | Reusable Assets In Repo                                                                                                                                                                                      | Current Status                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Preprocessing loaders       | `src/preprocessing/ppna_loader.py`, `sap_loader.py`, `pe_loader.py`, `ibnr_loader.py`, `pb_loader.py`, plus `base.py`, `schema_registry.py`, `cleaning_report.py`, `workbook_inventory.py` | Implemented; strongly reusable                                     |
| Provision engines           | `src/provisions/ppna.py`, `sap.py`, `pe.py`, `ibnr.py`, `pb.py`, plus `ibnr_mack.py`, `ibnr_bf.py`, `ibnr_benktander.py`, `ibnr_bootstrap.py`, `ibnr_comparison.py`                      | Implemented; reusable as service-layer core                        |
| Reporting / audit artifacts | `src/reporting/reconciliation.py`, `src/reporting/assumptions.py`                                                                                                                                        | Implemented; reusable for API result endpoints                     |
| Orchestration               | `src/orchestration/run_preprocessing.py`, `run_audit.py`, `run_validation_suite.py`                                                                                                                    | Implemented; useful as backend validation gates and batch services |
| Config                      | `src/config/legislative.yaml`, `src/config/preprocessing.yaml`                                                                                                                                           | Implemented; must remain source for configurable constants         |
| Tests                       | `tests/unit/*`, `tests/integration/*`                                                                                                                                                                    | Good existing foundation; no API/auth/storage tests yet            |

### Important Current Limitations

| Finding                                                                     | Evidence In Repo                                                                                                                      | Backend Implication                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| There is no API layer yet                                                   | `REPORT_DATA.md` explicitly says no FastAPI/Flask/Streamlit/Dash backend service exists in `src/`                                 | Backend must be added from scratch, but should stay thin over existing domain code            |
| Loaders are tied to registered workbook paths                               | `BaseDatasetLoader.load()` reads `self.contract.workbook_path`; current loaders instantiate contracts from `schema_registry.py` | First refactor is to make loaders accept an uploaded workbook path without touching `data/` |
| `run_audit.py` covers `PPNA`, `SAP`, `PE`, `IBNR`, but not `PB` | `src/orchestration/run_audit.py` imports/executes no PB path                                                                        | Dashboard/Bilan APIs cannot rely on current audit package alone until PB is integrated        |
| No backend auth/account system exists                                       | No auth models/routes/services found in repo                                                                                          | Must be introduced as new backend capability                                                  |
| No Bilan-specific backend module exists                                     | No `src/.../bilan*.py` module found; foundation doc defines `/bilan` as a derived view                                            | `Bilan` should be treated as derived, read-only domain for now                              |

### Validation Gate Before API Exposure

The backend must not expose actuarial endpoints just because modules “seem done”. API exposure must be gated by the repository validation suite.

Required gate:

```bash
/home/maab/Documents/openData/.venv/bin/python -m src.orchestration.run_validation_suite
```

Current observed status on 2026-04-18:

- Many actuarial tests pass, including workbook-backed coverage for `PPNA`, `SAP`, `PE`, `IBNR`, and `PB`.
- The full suite is **not fully green**.
- Observed failing test:
  `tests.integration.test_preprocessing_regression.PreprocessingRegressionTests.test_inventory_detects_known_workbooks`
- Failure reason:
  `ÉCHANTILLON DATA PB (1).xlsx` is now included in workbook inventory through the registry, but the test still expects only the older four-workbook set.

Conclusion:

- Actuarial code is reusable, but API rollout must be blocked until the validation suite is updated and fully passing again.
- `PB` also needs to be added into orchestration / reporting so the API does not expose it as a second-class path.

## 3. Proposed Architecture

### Framework Choice

Choose **FastAPI**.

Rationale:

- Best fit for thin API wrappers over existing Python functions and dataclasses
- Strong request/response validation via Pydantic
- Good OpenAPI generation, which will help define the frontend contract early
- Straightforward async-compatible file upload/download support
- Minimal overhead compared with Django for a hackathon codebase that already has domain logic but no web stack

### Target Backend Layers

| Layer           | Responsibility                                                                               | Reuse / New Work                                                       |
| --------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| API layer       | Routers, request validation, response schemas, auth dependencies                             | New                                                                    |
| Service layer   | Upload handling, conversion, calculation orchestration, metadata persistence, download logic | New                                                                    |
| Domain layer    | Provision calculations and preprocessing rules                                               | Reuse existing `src/preprocessing/` and `src/provisions/`          |
| Reporting layer | Cleaning reports, reconciliation, assumptions, summaries                                     | Reuse existing `src/reporting/` and extend for PB                    |
| Storage layer   | File persistence, artifact paths, metadata DB                                                | New                                                                    |
| Auth layer      | Login, token/session lifecycle, role enforcement, account states                             | New                                                                    |
| Audit layer     | Immutable event trail, structured logging, file hashes, run lineage                          | New, but should emit and reuse existing audit artifacts where possible |

### Recommended Internal Package Layout

```text
src/backend/
  api/
    app.py
    deps.py
    routers/
      auth.py
      users.py
      dashboard.py
      bilan.py
      ppna.py
      sap.py
      pe.py
      pb.py
      ibnr.py
      audit.py
  services/
    auth_service.py
    account_service.py
    document_service.py
    conversion_service.py
    calculation_service.py
    dashboard_service.py
    bilan_service.py
    audit_service.py
    validation_gate.py
  storage/
    models.py
    repositories.py
    filesystem.py
  schemas/
    auth.py
    users.py
    documents.py
    runs.py
    dashboard.py
    bilan.py
```

### Reuse Strategy For Existing Domain Code

1. Keep the existing actuarial engines as the calculation core.
2. Refactor loaders so they can read from an uploaded workbook path instead of the fixed sample path in the registry.
3. Keep `run_validation_suite.py` as the deployment gate.
4. Reuse `run_preprocessing.py`, `cleaning_report.py`, `reconciliation.py`, and `assumptions.py` to generate downloadable artifacts.
5. Extend audit/orchestration so `PB` is handled the same way as the other exposed domains.

## 4. Endpoint Design

### API Conventions

- Base prefix: `/api/v1`
- Each upload domain gets its own router prefix: `/ppna`, `/sap`, `/pe`, `/pb`, `/ibnr`
- `bilan` is derived and has no upload/download endpoints in this phase
- `dashboard` is read-only
- Upload returns download URLs for `.xlsx`, `.csv`, and `.txt` immediately after conversion succeeds

### Domain Route Matrix

| Domain        | Upload Endpoint                 | Download Endpoints                                                                                                                                                                   | Calculation / Read Endpoints                                                                                                                                                                                                                                  | Notes                                                                  |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `PPNA`      | `POST /api/v1/ppna/documents` | `GET /api/v1/ppna/documents/{document_id}/download/xlsx<br>``GET /api/v1/ppna/documents/{document_id}/download/csv<br>``GET /api/v1/ppna/documents/{document_id}/download/txt` | `GET /api/v1/ppna/documents<br>``GET /api/v1/ppna/documents/{document_id}<br>``POST /api/v1/ppna/runs<br>``GET /api/v1/ppna/runs/{run_id}<br>``GET /api/v1/ppna/runs/{run_id}/rows<br>``GET /api/v1/ppna/runs/{run_id}/artifacts/{artifact_name}` | Closing date remains user-supplied parameter per existing PPNA logic   |
| `SAP`       | `POST /api/v1/sap/documents`  | `GET /api/v1/sap/documents/{document_id}/download/xlsx<br>``GET /api/v1/sap/documents/{document_id}/download/csv<br>``GET /api/v1/sap/documents/{document_id}/download/txt`    | `GET /api/v1/sap/documents<br>``GET /api/v1/sap/documents/{document_id}<br>``POST /api/v1/sap/runs<br>``GET /api/v1/sap/runs/{run_id}<br>``GET /api/v1/sap/runs/{run_id}/rows<br>``GET /api/v1/sap/runs/{run_id}/artifacts/{artifact_name}`       | Closing date must remain user-controlled                               |
| `PE`        | `POST /api/v1/pe/documents`   | `GET /api/v1/pe/documents/{document_id}/download/xlsx<br>``GET /api/v1/pe/documents/{document_id}/download/csv<br>``GET /api/v1/pe/documents/{document_id}/download/txt`       | `GET /api/v1/pe/documents<br>``GET /api/v1/pe/documents/{document_id}<br>``POST /api/v1/pe/runs<br>``GET /api/v1/pe/runs/{run_id}<br>``GET /api/v1/pe/runs/{run_id}/rows<br>``GET /api/v1/pe/runs/{run_id}/artifacts/{artifact_name}`             | PE coefficients stay config-driven/admin-adjustable                    |
| `PB`        | `POST /api/v1/pb/documents`   | `GET /api/v1/pb/documents/{document_id}/download/xlsx<br>``GET /api/v1/pb/documents/{document_id}/download/csv<br>``GET /api/v1/pb/documents/{document_id}/download/txt`       | `GET /api/v1/pb/documents<br>``GET /api/v1/pb/documents/{document_id}<br>``POST /api/v1/pb/runs<br>``GET /api/v1/pb/runs/{run_id}<br>``GET /api/v1/pb/runs/{run_id}/rows<br>``GET /api/v1/pb/runs/{run_id}/artifacts/{artifact_name}`             | Must first be integrated into orchestration/reporting parity           |
| `IBNR`      | `POST /api/v1/ibnr/documents` | `GET /api/v1/ibnr/documents/{document_id}/download/xlsx<br>``GET /api/v1/ibnr/documents/{document_id}/download/csv<br>``GET /api/v1/ibnr/documents/{document_id}/download/txt` | `GET /api/v1/ibnr/documents<br>``GET /api/v1/ibnr/documents/{document_id}<br>``POST /api/v1/ibnr/runs<br>``GET /api/v1/ibnr/runs/{run_id}<br>``GET /api/v1/ibnr/runs/{run_id}/rows<br>``GET /api/v1/ibnr/runs/{run_id}/artifacts/{artifact_name}` | Support `segment_by_product` / method parameters via request payload |
| `Bilan`     | None                            | None                                                                                                                                                                                 | `GET /api/v1/bilan/current<br>``GET /api/v1/bilan/history<br>``POST /api/v1/bilan/snapshots`                                                                                                                                                            | Read-only derived view plus explicit snapshot/validation action        |
| `Dashboard` | None                            | None                                                                                                                                                                                 | `GET /api/v1/dashboard/summary<br>``GET /api/v1/dashboard/alerts<br>``GET /api/v1/dashboard/timeline<br>``GET /api/v1/dashboard/completion`                                                                                                           | Read-only aggregation over latest successful runs                      |

### Cross-Cutting Routes

| Area            | Routes                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Auth            | `POST /api/v1/auth/login<br>``POST /api/v1/auth/refresh<br>``POST /api/v1/auth/logout<br>``GET /api/v1/auth/me`               |
| User management | `GET /api/v1/users<br>``POST /api/v1/users<br>``PATCH /api/v1/users/{user_id}/status<br>``PATCH /api/v1/users/{user_id}/role` |
| Audit           | `GET /api/v1/audit/events<br>``GET /api/v1/audit/events/{event_id}`                                                               |
| DMS             | `GET /api/v1/documents/search<br>``GET /api/v1/documents/{document_id}/versions`                                                  |

### Immediate Conversion Flow

1. Authenticated user uploads `.xlsx` to the domain endpoint.
2. API validates extension, MIME, workbook openability, and size.
3. Backend stores the uploaded workbook outside `data/`.
4. Backend computes SHA-256 and persists document/version metadata.
5. Backend extracts the authoritative sheet content and immediately writes:
   - `.csv`
   - `.txt`
6. API returns `201 Created` with:
   - `document_id`
   - `version_id`
   - hashes
   - storage status
   - direct download URLs for `.xlsx`, `.csv`, and `.txt`
7. Calculation can then be executed explicitly via `/runs`, or automatically on upload in the MVP if that improves UX.

Recommended response shape after upload:

```json
{
  "document_id": "doc_...",
  "version_id": "ver_...",
  "domain": "ppna",
  "downloads": {
    "xlsx": "/api/v1/ppna/documents/doc_.../download/xlsx",
    "csv": "/api/v1/ppna/documents/doc_.../download/csv",
    "txt": "/api/v1/ppna/documents/doc_.../download/txt"
  },
  "sha256": "..."
}
```

## 5. Storage Strategy

### Local Storage vs MinIO

| Criterion              | Local Filesystem                       | MinIO                                    |
| ---------------------- | -------------------------------------- | ---------------------------------------- |
| Setup speed            | Very fast                              | Requires extra service and configuration |
| Hackathon fit          | Excellent                              | Good, but higher operational overhead    |
| Offline/local dev      | Simple                                 | More moving parts                        |
| Binary file support    | Good                                   | Good                                     |
| Object versioning      | Must be implemented in app conventions | Natural fit                              |
| Future scalability     | Limited                                | Better                                   |
| Current repo readiness | Better fit                             | No MinIO infrastructure present in repo  |

### Choice For This Phase

Choose **local filesystem storage** for binaries plus a small metadata database.

Rationale:

- fastest path to a working backend for the hackathon
- avoids introducing infrastructure that does not exist in the repository today
- easier to debug while frontend is still not implemented
- compatible with the DMS requirement if versioning, metadata, and hashes are enforced at the application layer

Important implementation rule:

- `data/` remains read-only and is never used for runtime uploads

Recommended storage root:

```text
storage/
  raw/{domain}/{document_id}/{version_id}/original.xlsx
  derived/{domain}/{document_id}/{version_id}/source.csv
  derived/{domain}/{document_id}/{version_id}/source.txt
  runs/{domain}/{run_id}/result.json
  runs/{domain}/{run_id}/cleaning_report.json
  runs/{domain}/{run_id}/reconciliation_report.json
  audit/
    app.log
    event_chain.jsonl
```

### Metadata Model Needed For DMS Behavior

Use a lightweight relational metadata store for auditability and RBAC-friendly queries. For the hackathon, SQLite is sufficient.

| Entity               | Core Fields                                                                                                                                                                             | Purpose                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `user_account`     | `user_id`, `username`, `password_hash`, `role`, `status`, `created_at`, `created_by`                                                                                      | Authentication and authorization |
| `user_session`     | `session_id`, `user_id`, `refresh_token_hash`, `issued_at`, `expires_at`, `revoked_at`                                                                                      | Session/refresh tracking         |
| `document`         | `document_id`, `domain`, `original_filename`, `created_at`, `created_by`, `current_version_id`, `status`                                                                  | Logical DMS record               |
| `document_version` | `version_id`, `document_id`, `sha256`, `mime_type`, `size_bytes`, `storage_path_xlsx`, `storage_path_csv`, `storage_path_txt`, `uploaded_at`, `uploaded_by`         | Immutable version tracking       |
| `calculation_run`  | `run_id`, `domain`, `document_version_id`, `parameters_json`, `status`, `started_at`, `finished_at`, `started_by`                                                       | Traceable computation execution  |
| `artifact`         | `artifact_id`, `run_id`, `artifact_type`, `format`, `storage_path`, `sha256`, `created_at`                                                                                | Downloadable reports/results     |
| `audit_event`      | `event_id`, `actor_user_id`, `action`, `target_type`, `target_id`, `occurred_at`, `ip_address`, `user_agent`, `payload_json`, `previous_event_hash`, `event_hash` | Tamper-evident event trail       |

## 6. AuthN / AuthZ Model

### Authentication Strategy

Use:

- short-lived access token for API calls
- refresh token persisted server-side as a hash
- login endpoint issuing tokens only for `ACTIVE` accounts

Recommended implementation:

- FastAPI + password hashing (`argon2` or `bcrypt`)
- bearer access token for API requests
- hashed refresh token stored in DB for revocation

### Account Lifecycle

Minimum states for this phase:

- `ACTIVE`
- `SUSPENDED`

Rules:

- suspended users cannot log in
- suspending a user revokes active refresh sessions
- all account-state changes are auditable

### Role / Permission Matrix

| Action                                                         | ADMIN | HR  | VIEWER                            |
| -------------------------------------------------------------- | ----- | --- | --------------------------------- |
| Log in if account is active                                    | Yes   | Yes | Yes                               |
| View dashboard and bilan                                       | Yes   | Yes | Yes                               |
| List documents and prior outputs                               | Yes   | Yes | Yes                               |
| Download already uploaded files / generated artifacts          | Yes   | Yes | Yes                               |
| Upload new workbook                                            | Yes   | No  | No                                |
| Launch / relaunch calculations                                 | Yes   | No  | No                                |
| Modify config-managed business parameters through admin UI/API | Yes   | No  | No                                |
| Create accounts                                                | Yes   | Yes | No                                |
| Change account role                                            | Yes   | Yes | No                                |
| Set account `ACTIVE` / `SUSPENDED`                         | Yes   | Yes | No                                |
| Delete or supersede document metadata                          | Yes   | No  | No                                |
| View audit trail                                               | Yes   | Yes | Read-only limited view acceptable |

Implementation note:

- Even `ADMIN` actions should be versioned and append-only; “modify” must never overwrite history invisibly.

## 7. Traceability And Non-Repudiation Design

### Required Audit Principles

Every important action must capture:

- who performed it
- when it happened
- what file or run it affected
- what parameters were used
- what outputs were produced
- what changed from the prior version

### Audit Design

1. **Immutable event model**

   - `audit_event` rows are append-only
   - no in-place update of historical payloads
2. **Tamper-evident hash chain**

   - each event stores `previous_event_hash`
   - each event stores `event_hash = sha256(canonical_event_payload + previous_event_hash)`
   - this is sufficient for hackathon-grade tamper evidence without claiming full legal PKI
3. **Per-file integrity**

   - every uploaded and derived artifact gets a SHA-256 hash
   - downloads can expose the hash in headers or metadata responses
4. **Versioned documents**

   - replacing a workbook creates a new `document_version`
   - original versions remain downloadable unless retention rules change
5. **Run lineage**

   - each `calculation_run` links to exactly one input document version
   - run parameters are stored explicitly
   - run output artifacts reference the run ID
6. **Operational metadata**

   - capture user ID, IP address, user agent, request ID, and timestamp

### Non-Repudiation Position For This Phase

Backend can provide a strong **system-level non-repudiation baseline** via:

- authenticated user identity
- append-only audit trail
- immutable file hashes
- versioned storage
- snapshotting of run parameters and outputs

If mentors require legal-grade certification, external signatures/certificates must be added later as a separate phase.

## 8. Security Baseline

### Input And File Controls

- Accept `.xlsx` only on upload endpoints
- Validate:
  - extension
  - MIME type
  - workbook can be opened by `openpyxl`
  - authoritative sheet exists for the target domain
- Reject oversized files with explicit limits
- Quarantine failed uploads; do not partially register them as valid documents

### Recommended Controls

| Control          | Baseline                                                                         |
| ---------------- | -------------------------------------------------------------------------------- |
| Max upload size  | Set explicit per-file cap before implementation; start conservative              |
| Malware scanning | Add a placeholder interface in the service layer; allow later ClamAV integration |
| Secrets handling | Environment variables only; no secrets committed in repo                         |
| Password storage | Strong one-way hash                                                              |
| Least privilege  | Role-based router dependencies and per-action permission checks                  |
| Rate limiting    | Apply to login and upload endpoints first                                        |
| Logging          | Structured logs with request ID; never log passwords or raw tokens               |
| CORS             | Restrict to frontend origin(s) once frontend exists                              |
| Error handling   | Return safe API errors; detailed cause goes to logs/audit trail                  |

### Data-Protection Rules

- Never write runtime uploads into `data/`
- Never mutate uploaded originals
- Derived `.csv` and `.txt` are generated as separate artifacts
- Treat document versions as immutable

## 9. Phased Implementation Roadmap

### MVP-First Sequencing

| Milestone                            | Scope                                                                                                               | Dependencies   | Effort Band   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------- | ------------- |
| `M0` Validation gate cleanup       | Fix failing inventory regression, confirm full suite green, decide exposed domains for API v1                       | None           | `0.5-1 day` |
| `M1` Loader path refactor          | Make loaders/contracts accept runtime workbook paths while preserving current sample tests                          | `M0`         | `1-2 days`  |
| `M2` Storage + metadata foundation | Create local storage structure, SQLite metadata tables, document versioning, hashing                                | `M1`         | `1-2 days`  |
| `M3` FastAPI skeleton + auth       | App bootstrap, auth routes, RBAC dependencies, account CRUD/status flows                                            | `M2`         | `1-2 days`  |
| `M4` Document upload/download      | Domain routers for `PPNA`, `SAP`, `PE`, `PB`, `IBNR`; immediate `.csv`/`.txt` conversion; DMS listing | `M2`, `M3` | `2-3 days`  |
| `M5` Calculation APIs              | `/runs` endpoints, result payloads, row-level audit endpoints, artifact downloads                                 | `M4`         | `2-3 days`  |
| `M6` Dashboard + Bilan read APIs   | Consolidated summary endpoints, derived bilan snapshot logic, audit feed endpoints                                  | `M5`         | `1-2 days`  |
| `M7` Hardening                     | rate limiting, better logging, audit hash-chain verification, API test coverage, packaging                          | `M3-M6`      | `1-2 days`  |

### MVP Definition

The MVP for the hackathon should stop after `M6` if time is tight.

MVP must include:

- FastAPI service
- auth with the three roles
- upload/download for `PPNA`, `SAP`, `PE`, `PB`, `IBNR`
- immediate `.xlsx` / `.csv` / `.txt` availability
- calculation result endpoints using existing engines
- dashboard summary endpoint
- bilan derived endpoint
- audit trail for uploads, runs, logins, account changes

### Recommended Order Of Domain Exposure

1. `PPNA`
2. `SAP`
3. `PE`
4. `IBNR`
5. `PB`
6. `Dashboard`
7. `Bilan`

Reason:

- `PPNA`, `SAP`, `PE`, and `IBNR` already participate in the current audit/reporting flow
- `PB` is implemented and tested, but not yet fully wired into orchestration parity
- `Bilan` depends on stable domain result contracts

## 10. Testing And Quality Gates

### Test Layers To Add

| Test Type         | Purpose                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Unit tests        | auth service, document service, conversion service, permission checks, hash generation      |
| Integration tests | upload -> store -> convert -> calculate -> download flow using temp directories and temp DB |
| API tests         | route contracts, status codes, response schemas, role enforcement                           |
| Regression tests  | preserve current actuarial outputs from existing modules                                    |
| Audit tests       | verify append-only events, hash-chain continuity, actor capture                             |

### Mandatory Quality Gates

1. Existing domain suite passes:
   - `python -m src.orchestration.run_validation_suite`
2. New API test suite passes.
3. RBAC tests pass for all role/domain combinations.
4. Upload-conversion-download tests pass for each of:
   - `PPNA`
   - `SAP`
   - `PE`
   - `PB`
   - `IBNR`
5. Audit-log tests confirm:
   - login recorded
   - upload recorded
   - conversion recorded
   - calculation recorded
   - account status change recorded
6. Bilan/dashboard endpoints only pass when upstream run dependencies exist and are valid.

### Specific New Test Cases

- upload valid workbook -> `.csv` and `.txt` become downloadable immediately
- upload invalid workbook -> rejection + audit event + no active document version
- `VIEWER` cannot upload or trigger calculations
- `HR` can create/suspend accounts but cannot upload actuarial workbooks
- `ADMIN` can upload and run all domains
- replacing a document creates a new version and preserves the old version
- hash reported in metadata matches stored binary
- `PB` is present in inventory/audit/reporting once backend exposure includes it

## 11. Definition Of Done

| Requirement                                | Done When                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Backend framework selected                 | FastAPI app exists and runs locally with versioned routes                                                 |
| XLSX upload/download endpoints             | `PPNA`, `SAP`, `PE`, `PB`, `IBNR` all support upload plus `.xlsx` download                    |
| Immediate `.txt` and `.csv` conversion | Upload response returns working download URLs for both derived formats immediately                        |
| Backend reuses tested code                 | Domain APIs call existing loaders/provision engines/services rather than reimplement formulas             |
| Validation gate                            | Full validation suite is green before API release; failure blocks rollout                                 |
| Login system with 3 roles                  | `ADMIN`, `HR`, `VIEWER` enforced by automated tests                                                 |
| Account lifecycle                          | `ACTIVE` / `SUSPENDED` enforced and auditable                                                         |
| Traceability                               | Every upload, login, calculation, download, and account change creates an audit event                     |
| Non-repudiation baseline                   | File hashes, versioned documents, append-only events, and actor metadata are in place                     |
| DMS behavior                               | Users can list documents, versions, metadata, and artifacts by domain                                     |
| Dashboard endpoints                        | Summary/alerts/timeline endpoints return latest successful run state                                      |
| Bilan endpoints                            | Derived bilan endpoint exists with no direct upload/download routes                                       |
| Security baseline                          | File validation, size limits, password hashing, secrets isolation, and least-privilege checks implemented |

## 12. Risks, Assumptions, And Mentor Questions

### Explicit Assumptions

| Assumption                                                                                                      | Why It Is Needed                                                                        |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| FastAPI is the default framework unless a new repo constraint appears                                           | Best fit for the current Python-only, function-first codebase                           |
| Local filesystem is sufficient for phase 1 storage                                                              | Faster and simpler than MinIO for the current hackathon stage                           |
| `Bilan` is a derived view, not an uploaded dataset, in this phase                                             | User requirements exclude Bilan upload/download and repo has no standalone Bilan engine |
| `.csv` / `.txt` derivatives will be generated from the authoritative sheet content validated by the backend | This aligns with existing loaders and workbook-specific contracts                       |
| `PB` must reach orchestration/reporting parity before being shown as a fully supported API domain             | Current code/tests show PB is implemented but not yet included in `run_audit.py`      |
| `VIEWER` may download previously uploaded files and generated outputs but may not upload or modify anything   | Closest interpretation of “only sees outputs/files previously uploaded”               |

### Risks

| Risk                                                         | Impact | Mitigation                                                                          |
| ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| Loader refactor breaks existing workbook regression behavior | High   | Refactor behind tests; preserve sample-path tests while adding runtime-path support |
| PB remains outside consolidated audit flow                   | Medium | Add PB to reporting/orchestration before public API exposure                        |
| Ambiguous `.txt` export format causes rework               | Medium | Confirm early with mentor and freeze contract before frontend work                  |
| Bilan semantics drift from mentor expectation                | Medium | Treat as derived read-only MVP and confirm required inputs                          |
| Security/auth work consumes hackathon time                   | Medium | Build a thin but disciplined baseline first; avoid over-engineering                 |

### Mentor Questions

> **Context:** designing the first backend API and DMS layer for workbook upload, conversion, calculation, and frontend integration.
> **Ambiguity:** for uploaded Excel files, the backend must immediately generate `.txt` and `.csv`, but the exact expected `.txt` format is not specified.
> **Your current assumption:** generate `.csv` and a UTF-8 `.txt` export from the authoritative sheet content used by the domain loader.
> **Question:** should the `.txt` derivative mirror the authoritative sheet as plain tabular text, or do you expect another specific mentor-defined format?
>
> ANSWER: No idea. just do whatever

> **Context:** exposing `/bilan` as a backend endpoint for the future frontend.
> **Ambiguity:** the repository defines `/bilan` conceptually in the foundation doc, but there is no standalone Bilan calculation module or extra uploaded Bilan dataset in `src/`.
> **Your current assumption:** `Bilan` is a derived aggregation over provision outputs already produced by `PPNA`, `SAP`, `PE`, `PB`, and `IBNR`, with no upload route in this phase.
> **Question:** is this assumption correct, or do you expect additional Bilan-specific input data and calculations in the backend phase?
>
> ANSWER: ignore /bilan for now, we will implement it later, same for anything in /dashboard

> **Context:** implementing role-based permissions for `ADMIN`, `HR`, and `VIEWER`.
> **Ambiguity:** `VIEWER` is described as only seeing outputs/files previously uploaded, but it is unclear whether this includes downloading original uploaded `.xlsx` files or only derived outputs/results.
> **Your current assumption:** `VIEWER` may read document metadata and download prior uploaded artifacts, but cannot upload, calculate, or change accounts.
> **Question:** should `VIEWER` be allowed to download original uploaded workbooks, or only generated outputs?
>
> ANSWER: ONLY GENERATED OUTPUTS

> **Context:** implementing the backend audit and non-repudiation layer.
> **Ambiguity:** “complete traceability and non repudiation” can mean either hackathon-grade tamper evidence or a stricter certificate/signature workflow.
> **Your current assumption:** append-only audit events, per-file SHA-256, actor/session capture, and versioned documents are sufficient for this phase.
> **Question:** do mentors require cryptographic certification/signature beyond hashes and immutable audit trails for the hackathon submission?
>
> ANSWER:  nope literally ANYTHING works, they often get inspectors from the ministry, and any proof works

> **Context:** backend exposure of the PB module.
> **Ambiguity:** the existing PB implementation uses per-contract threshold/rate values when present and falls back to config defaults; an earlier session already raised uncertainty about possible regulatory constraints on PB rates.
> **Your current assumption:** backend should expose PB as implemented now, while keeping defaults configurable and leaving mentor validation as a tracked assumption.
> **Question:** is there any regulatory floor/ceiling on `taux PB` or on the S/P threshold that must constrain the backend admin configuration?
> ANSWER: just keep it as is, we'll fix it later
