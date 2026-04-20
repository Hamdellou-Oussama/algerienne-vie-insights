"""FastAPI application for the actuarial provisioning backend."""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from src.backend.database import initialize_database
from src.backend.services import (
    BackendError,
    bootstrap_admin,
    build_bilan_current,
    build_dashboard_alerts,
    build_dashboard_completion,
    build_dashboard_summary,
    build_dashboard_timeline,
    compute_level3_bilan,
    create_bilan_snapshot,
    create_run,
    create_user,
    get_audit_event,
    get_document,
    get_run,
    get_run_rows,
    get_session_user,
    list_audit_events,
    list_bilan_history,
    list_document_versions,
    list_documents,
    list_runs,
    list_users,
    login,
    logout,
    refresh_session,
    resolve_document_download,
    resolve_run_artifact,
    search_documents,
    update_user_role,
    update_user_status,
    upload_document,
)
from src.backend.settings import BackendSettings

LOGGER = logging.getLogger(__name__)
AUTH_SCHEME = HTTPBearer(auto_error=False)


class CredentialsRequest(BaseModel):
    """Request model for bootstrap and login endpoints."""

    username: str
    password: str


class RefreshRequest(BaseModel):
    """Request model for refresh endpoint."""

    refresh_token: str


class CreateUserRequest(BaseModel):
    """Request model for new user creation."""

    username: str
    password: str
    role: str
    status: str = "ACTIVE"


class UpdateRoleRequest(BaseModel):
    """Request model for role updates."""

    role: str


class UpdateStatusRequest(BaseModel):
    """Request model for status updates."""

    status: str


class RunCreateRequest(BaseModel):
    """Request model for calculation runs."""

    document_id: str | None = None
    version_id: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


def _request_meta(request: Request) -> dict[str, Any]:
    """Extract request metadata for audit logging."""

    return {
        "ip_address": None if request.client is None else request.client.host,
        "user_agent": request.headers.get("user-agent"),
    }


def _to_http_error(exc: BackendError) -> HTTPException:
    """Convert a backend error into a FastAPI HTTPException."""

    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _get_settings(request: Request) -> BackendSettings:
    """Read backend settings from app state."""

    return request.app.state.backend_settings


async def _current_session(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(AUTH_SCHEME),
) -> dict[str, Any]:
    """Resolve the current bearer token to a user session."""

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token is required.")
    try:
        return get_session_user(_get_settings(request), credentials.credentials)
    except BackendError as exc:
        raise _to_http_error(exc) from exc


def _require_roles(*roles: str):
    """Return a dependency that enforces one of the allowed roles."""

    async def dependency(session: dict[str, Any] = Depends(_current_session)) -> dict[str, Any]:
        if session["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")
        return session

    return dependency


def create_app(settings: BackendSettings | None = None) -> FastAPI:
    """Create and configure the backend FastAPI application."""

    backend_settings = settings or BackendSettings.from_env()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
        backend_settings.storage_root.mkdir(parents=True, exist_ok=True)
        initialize_database(backend_settings.db_path)
        yield

    app = FastAPI(title="Actuarial Provisioning Backend", version="1.0.0", lifespan=lifespan)
    app.state.backend_settings = backend_settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(backend_settings.cors_origins),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Content-SHA256", "Content-Disposition"],
    )

    @app.get("/api/v1/health")
    async def health() -> dict[str, str]:
        """Return a basic health payload."""

        return {"status": "ok"}

    @app.post("/api/v1/auth/bootstrap")
    async def auth_bootstrap(request: Request, payload: CredentialsRequest) -> dict[str, Any]:
        """Create the first admin and immediately issue tokens."""

        try:
            return bootstrap_admin(_get_settings(request), username=payload.username, password=payload.password, meta=_request_meta(request))
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.post("/api/v1/auth/login")
    async def auth_login(request: Request, payload: CredentialsRequest) -> dict[str, Any]:
        """Authenticate an existing user."""

        try:
            return login(_get_settings(request), username=payload.username, password=payload.password, meta=_request_meta(request))
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.post("/api/v1/auth/refresh")
    async def auth_refresh(request: Request, payload: RefreshRequest) -> dict[str, Any]:
        """Refresh access and refresh tokens."""

        try:
            return refresh_session(_get_settings(request), refresh_token=payload.refresh_token, meta=_request_meta(request))
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.post("/api/v1/auth/logout")
    async def auth_logout(
        request: Request,
        credentials: HTTPAuthorizationCredentials | None = Depends(AUTH_SCHEME),
        _: dict[str, Any] = Depends(_current_session),
    ) -> dict[str, Any]:
        """Revoke the current session."""

        try:
            assert credentials is not None
            return logout(_get_settings(request), access_token=credentials.credentials, meta=_request_meta(request))
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/auth/me")
    async def auth_me(session: dict[str, Any] = Depends(_current_session)) -> dict[str, Any]:
        """Return the current user/session identity."""

        return session

    @app.get("/api/v1/users")
    async def users_list(
        request: Request,
        _: dict[str, Any] = Depends(_require_roles("ADMIN", "HR")),
    ) -> list[dict[str, Any]]:
        """List user accounts."""

        return list_users(_get_settings(request))

    @app.post("/api/v1/users", status_code=status.HTTP_201_CREATED)
    async def users_create(
        request: Request,
        payload: CreateUserRequest,
        session: dict[str, Any] = Depends(_require_roles("ADMIN", "HR")),
    ) -> dict[str, Any]:
        """Create a user account."""

        try:
            return create_user(
                _get_settings(request),
                actor_user_id=session["user_id"],
                username=payload.username,
                password=payload.password,
                role=payload.role,
                status=payload.status,
                meta=_request_meta(request),
            )
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.patch("/api/v1/users/{user_id}/role")
    async def users_update_role(
        user_id: str,
        payload: UpdateRoleRequest,
        request: Request,
        session: dict[str, Any] = Depends(_require_roles("ADMIN", "HR")),
    ) -> dict[str, Any]:
        """Update a user's role."""

        try:
            return update_user_role(
                _get_settings(request),
                actor_user_id=session["user_id"],
                user_id=user_id,
                role=payload.role,
                meta=_request_meta(request),
            )
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.patch("/api/v1/users/{user_id}/status")
    async def users_update_status(
        user_id: str,
        payload: UpdateStatusRequest,
        request: Request,
        session: dict[str, Any] = Depends(_require_roles("ADMIN", "HR")),
    ) -> dict[str, Any]:
        """Update a user's status."""

        try:
            return update_user_status(
                _get_settings(request),
                actor_user_id=session["user_id"],
                user_id=user_id,
                status=payload.status,
                meta=_request_meta(request),
            )
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/documents/search")
    async def documents_search(
        request: Request,
        q: str | None = Query(default=None),
        domain: str | None = Query(default=None),
        _: dict[str, Any] = Depends(_current_session),
    ) -> list[dict[str, Any]]:
        """Search documents across domains."""

        try:
            return search_documents(_get_settings(request), query=q, domain=domain)
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/documents/{document_id}/versions")
    async def documents_versions(
        document_id: str,
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> list[dict[str, Any]]:
        """List versions for a document."""

        try:
            return list_document_versions(_get_settings(request), document_id)
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/audit/events")
    async def audit_list(
        request: Request,
        limit: int = Query(default=100, ge=1, le=500),
        _: dict[str, Any] = Depends(_require_roles("ADMIN", "HR")),
    ) -> list[dict[str, Any]]:
        """List audit events."""

        return list_audit_events(_get_settings(request), limit=limit)

    @app.get("/api/v1/audit/events/{event_id}")
    async def audit_get(
        event_id: str,
        request: Request,
        _: dict[str, Any] = Depends(_require_roles("ADMIN", "HR")),
    ) -> dict[str, Any]:
        """Return one audit event."""

        try:
            return get_audit_event(_get_settings(request), event_id)
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/dashboard/summary")
    async def dashboard_summary(
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> dict[str, Any]:
        """Return the current dashboard summary."""

        return build_dashboard_summary(_get_settings(request))

    @app.get("/api/v1/dashboard/alerts")
    async def dashboard_alerts(
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> dict[str, Any]:
        """Return dashboard alerts."""

        return build_dashboard_alerts(_get_settings(request))

    @app.get("/api/v1/dashboard/timeline")
    async def dashboard_timeline(
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> dict[str, Any]:
        """Return dashboard timeline events."""

        return build_dashboard_timeline(_get_settings(request))

    @app.get("/api/v1/dashboard/completion")
    async def dashboard_completion(
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> dict[str, Any]:
        """Return dashboard completion status."""

        return build_dashboard_completion(_get_settings(request))

    @app.get("/api/v1/bilan/current")
    async def bilan_current(
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> dict[str, Any]:
        """Return the current derived bilan."""

        return build_bilan_current(_get_settings(request))

    @app.get("/api/v1/bilan/history")
    async def bilan_history(
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> list[dict[str, Any]]:
        """Return historique des snapshots bilan."""

        return list_bilan_history(_get_settings(request))

    @app.get("/api/v1/bilan")
    async def bilan_level3(
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> dict[str, Any]:
        """Return the Level3 bilan computed from the Level3 Bilan sinistres workbook.

        This endpoint implements the fully audited AC-method (Method B) bilan computation
        validated by the external audit pipeline in ./bilan. It returns per-year rows with
        en_cours, declares, reglements, rejets, reevaluation, and reserves figures,
        along with a balance verification flag for each year.
        """

        try:
            return compute_level3_bilan(_get_settings(request))
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.post("/api/v1/bilan/snapshots", status_code=status.HTTP_201_CREATED)
    async def bilan_snapshot(
        request: Request,
        session: dict[str, Any] = Depends(_require_roles("ADMIN")),
    ) -> dict[str, Any]:
        """Create a bilan snapshot."""

        return create_bilan_snapshot(_get_settings(request), actor_user_id=session["user_id"], meta=_request_meta(request))

    @app.post("/api/v1/{domain}/documents", status_code=status.HTTP_201_CREATED)
    async def domain_upload_document(
        domain: str,
        request: Request,
        filename: str = Query(..., min_length=1),
        document_id: str | None = Query(default=None),
        session: dict[str, Any] = Depends(_require_roles("ADMIN", "HR")),
    ) -> dict[str, Any]:
        """Upload an XLSX workbook using the raw request body."""

        try:
            content = await request.body()
            return upload_document(
                _get_settings(request),
                domain=domain,
                filename=filename,
                content=content,
                actor_user_id=session["user_id"],
                meta=_request_meta(request),
                document_id=document_id,
            )
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/{domain}/documents")
    async def domain_list_documents(
        domain: str,
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> list[dict[str, Any]]:
        """List documents for a domain."""

        try:
            return list_documents(_get_settings(request), domain)
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/{domain}/documents/{document_id}")
    async def domain_get_document(
        domain: str,
        document_id: str,
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> dict[str, Any]:
        """Return one document."""

        try:
            return get_document(_get_settings(request), domain, document_id)
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/{domain}/documents/{document_id}/download/{file_format}")
    async def domain_download_document(
        domain: str,
        document_id: str,
        file_format: str,
        request: Request,
        version_id: str | None = Query(default=None),
        _: dict[str, Any] = Depends(_current_session),
    ) -> Response:
        """Download a stored document artifact."""

        try:
            artifact = resolve_document_download(
                _get_settings(request),
                domain=domain,
                document_id=document_id,
                file_format=file_format,
                version_id=version_id,
            )
        except BackendError as exc:
            raise _to_http_error(exc) from exc
        media_type = {
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "csv": "text/csv",
            "txt": "text/plain",
        }[file_format]
        payload = artifact["path"].read_bytes()
        return Response(
            content=payload,
            media_type=media_type,
            headers={
                "X-Content-SHA256": artifact["sha256"],
                "Content-Disposition": f'attachment; filename="{artifact["path"].name}"',
            },
        )

    @app.post("/api/v1/{domain}/runs", status_code=status.HTTP_201_CREATED)
    async def domain_create_run(
        domain: str,
        payload: RunCreateRequest,
        request: Request,
        session: dict[str, Any] = Depends(_require_roles("ADMIN", "HR")),
    ) -> dict[str, Any]:
        """Create a calculation run for a domain."""

        try:
            return create_run(
                _get_settings(request),
                domain=domain,
                actor_user_id=session["user_id"],
                document_id=payload.document_id,
                version_id=payload.version_id,
                parameters=payload.parameters,
                meta=_request_meta(request),
            )
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/{domain}/runs")
    async def domain_list_runs(
        domain: str,
        request: Request,
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        status: str | None = Query(default=None),
        _: dict[str, Any] = Depends(_current_session),
    ) -> list[dict[str, Any]]:
        """List calculation runs for a domain."""

        try:
            return list_runs(_get_settings(request), domain, limit=limit, offset=offset, status=status)
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/{domain}/runs/{run_id}")
    async def domain_get_run(
        domain: str,
        run_id: str,
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> dict[str, Any]:
        """Return one calculation run."""

        try:
            return get_run(_get_settings(request), domain, run_id)
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/{domain}/runs/{run_id}/rows")
    async def domain_get_run_rows(
        domain: str,
        run_id: str,
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> Any:
        """Return row-level results for a calculation run."""

        try:
            return get_run_rows(_get_settings(request), domain, run_id)
        except BackendError as exc:
            raise _to_http_error(exc) from exc

    @app.get("/api/v1/{domain}/runs/{run_id}/artifacts/{artifact_name}")
    async def domain_get_run_artifact(
        domain: str,
        run_id: str,
        artifact_name: str,
        request: Request,
        _: dict[str, Any] = Depends(_current_session),
    ) -> Response:
        """Download a calculation artifact."""

        try:
            artifact = resolve_run_artifact(_get_settings(request), domain, run_id, artifact_name)
        except BackendError as exc:
            raise _to_http_error(exc) from exc
        media_type = "application/json" if artifact_name.endswith(".json") else "text/plain"
        payload = artifact["path"].read_bytes()
        return Response(
            content=payload,
            media_type=media_type,
            headers={
                "X-Content-SHA256": artifact["sha256"],
                "Content-Disposition": f'attachment; filename="{Path(artifact["path"]).name}"',
            },
        )

    return app
