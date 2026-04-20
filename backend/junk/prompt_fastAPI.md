I am planning on the moving to the next phase of the hackathon: linking the frontend to the backend. the algorithms now work perfectly well (they do, right?), so now it is ready to be used as backend. I am thinking of FastAPI, but choose any framework you deem worthy. create a PLAN-BACKEND.md to carry out this change. here are some directions:

* we need XLSX upload and download endpoints

- we will just use local storage/miniio, your call
- basically the fronted has 6 pages + main dashboard page: PPNA, SAP, PE, PB, IBNR, and Bilan, so each
  page should have its proper routes. (each should have an upload/download route exept bilan)
- the frontend is yet to be implemented, so we are free to make the frontend follow our endpoint
  structure
- after uploading the XLSX file, it should immediately create a txt and a csv versions, and they should be downloadable right away (mentor's request)
- app should have a proper login system, with 3 different account types: ADMIN: access to view, upload and modify everything, HR: manage accounts: create, set to ACTIVE/SUSPENDED status, etc, and VIEWER: only sees outputs/files previously uploaded
- app should have complete traceability and non repudiation features, apt securit level, etc
- app would basically have a DMS: document management system
- backend should use code that is already implemented and tested as much as possible





You are working in the existing hackathon repository at `/home/maab/Documents/openData`.

Task:
Create a backend implementation plan file named `PLAN-BACKEND.md` for the next hackathon phase: linking frontend to backend.

Important constraints:

- Do NOT invent facts.
- Base the plan only on repository contents and the requirements below.
- Reuse already implemented/tested code as much as possible.
- Keep `data/` read-only.
- This task is planning only (not full implementation), but the plan must be actionable and detailed.

Context:

- Frontend is not implemented yet, so backend endpoint structure can define the frontend contract.
- Functional domains/pages are: `PPNA`, `SAP`, `PE`, `PB`, `IBNR`, and `Bilan`, plus main dashboard.
- For each page except `Bilan`: provide upload/download routes.
- Need XLSX upload and download endpoints.
- After XLSX upload, backend must immediately generate `.txt` and `.csv` versions and make them downloadable right away.
- Storage can be local filesystem or MinIO (you choose and justify).
- Must include authentication and authorization with 3 account types:
  - `ADMIN`: view/upload/modify everything
  - `HR`: manage accounts (create accounts, set ACTIVE/SUSPENDED, etc.)
  - `VIEWER`: only view outputs/files already uploaded
- Must include complete traceability, non-repudiation features, and appropriate security level.
- Backend should function as a DMS (document management system).

Framework choice:

- FastAPI is preferred, but you may select another framework only if you justify it clearly against project constraints.

Output requirements for `PLAN-BACKEND.md`:

1. **Objective and scope** (what this backend phase covers and what it does not cover).
2. **Current-state check**:
   - Identify which existing modules/tests can be reused.
   - Add a validation gate to confirm algorithms are actually passing before API exposure.
3. **Proposed architecture**:
   - API layer, service layer, domain orchestration reuse, storage layer, auth layer, audit layer.
4. **Endpoint design**:
   - Route matrix per domain (`PPNA`, `SAP`, `PE`, `PB`, `IBNR`, `Bilan`, dashboard).
   - Explicit upload/download endpoints (except Bilan upload/download rule as specified).
   - Include immediate conversion flow (`xlsx -> txt/csv`) and download availability.
5. **Storage strategy**:
   - Compare local storage vs MinIO for this phase and choose one with rationale.
   - Include document metadata model needed for DMS behavior.
6. **AuthN/AuthZ model**:
   - Login/session/token strategy.
   - Role/permission matrix for ADMIN/HR/VIEWER.
   - Account lifecycle states (ACTIVE/SUSPENDED) and HR-only actions.
7. **Traceability & non-repudiation design**:
   - Audit logs, immutable event trail, who/when/what for each file/action.
   - File integrity controls (e.g., hash/versioning/signature strategy if applicable).
8. **Security baseline**:
   - Input validation, file-type controls, size limits, malware-scan placeholder, secrets handling, least privilege, rate limiting.
9. **Phased implementation roadmap**:
   - Milestones with dependencies and estimated effort bands.
   - Include MVP-first sequencing for hackathon constraints.
10. **Testing and quality gates**:

- Unit/integration/API tests, RBAC tests, upload-conversion-download tests, audit-log tests.

11. **Definition of Done**:

- Concrete acceptance criteria mapped to requirements.

12. **Risks, assumptions, and mentor questions**:

- Explicitly list assumptions.
- Flag any ambiguity as precise mentor questions (context, ambiguity, current assumption, question format).

Formatting constraints:

- Write in clear, professional markdown.
- Use tables where useful (endpoint matrix, role matrix, roadmap).
- Keep it implementation-oriented and specific.
- Do not claim anything is implemented unless it already exists in the repo.
