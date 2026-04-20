"""API integration tests for the FastAPI backend."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile
import unittest

import httpx
from openpyxl import load_workbook

from src.backend.app import create_app
from src.backend.database import initialize_database
from src.backend.settings import BackendSettings
from src.config import ROOT


PPNA_SAMPLE = ROOT / "data" / "level 01-level2-ÉCHANTILLON DATA PPNA.xlsx"
SAP_SAMPLE = ROOT / "data" / "level 01-DATA SAP groupe.xlsx"
PE_SAMPLE = ROOT / "data" / "level 01-ÉCHANTILLON DATA PE.xlsx"
PB_SAMPLE = ROOT / "data" / "ÉCHANTILLON DATA PB (1).xlsx"
IBNR_SAMPLE = ROOT / "data" / "level 02-ÉCHANTILLON DATA IBNR.xlsx"

DOMAIN_SAMPLES = {
    "ppna": PPNA_SAMPLE,
    "sap": SAP_SAMPLE,
    "pe": PE_SAMPLE,
    "pb": PB_SAMPLE,
    "ibnr": IBNR_SAMPLE,
}


def _ppna_closing_date() -> str:
    """Read the PPNA sample closing date from the workbook."""

    workbook = load_workbook(PPNA_SAMPLE, data_only=True, read_only=True)
    value = workbook[" PRODUCTION"]["P1"].value
    if not isinstance(value, datetime):
        raise AssertionError("PPNA sample closing date is missing.")
    return value.date().isoformat()


class BackendApiTests(unittest.IsolatedAsyncioTestCase):
    """End-to-end tests for the first backend slice."""

    async def asyncSetUp(self) -> None:
        """Create an isolated backend app and client."""

        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        settings = BackendSettings(
            storage_root=root / "storage",
            db_path=root / "backend.sqlite3",
            upload_max_bytes=20 * 1024 * 1024,
            access_token_ttl_minutes=30,
            refresh_token_ttl_days=7,
            cors_origins=("http://testserver",),
        )
        settings.storage_root.mkdir(parents=True, exist_ok=True)
        initialize_database(settings.db_path)
        self.app = create_app(settings)
        self.transport = httpx.ASGITransport(app=self.app)
        self.client = httpx.AsyncClient(transport=self.transport, base_url="http://testserver")

    async def asyncTearDown(self) -> None:
        """Close the temporary directory."""

        await self.client.aclose()
        await self.transport.aclose()
        self.temp_dir.cleanup()

    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        """Send one request through an in-process ASGI client."""

        return await self.client.request(method, url, **kwargs)

    async def _bootstrap_admin(self) -> dict[str, str]:
        """Create the first admin and return bearer headers."""

        response = await self._request("POST", "/api/v1/auth/bootstrap", json={"username": "admin", "password": "secret123"})
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        return {"Authorization": f"Bearer {payload['access_token']}"}

    async def _login(self, username: str, password: str) -> dict[str, str]:
        """Log in and return bearer headers."""

        response = await self._request("POST", "/api/v1/auth/login", json={"username": username, "password": password})
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        return {"Authorization": f"Bearer {payload['access_token']}"}

    async def _upload_run_and_validate_artifacts(
        self,
        *,
        headers: dict[str, str],
        domain: str,
        workbook_path: Path,
        parameters: dict[str, object],
        document_id: str | None = None,
    ) -> tuple[dict[str, object], dict[str, object]]:
        """Upload one workbook, run one calculation, and validate all core artifacts."""

        upload_params: dict[str, str] = {"filename": workbook_path.name}
        if document_id is not None:
            upload_params["document_id"] = document_id

        upload_response = await self._request(
            "POST",
            f"/api/v1/{domain}/documents",
            params=upload_params,
            content=workbook_path.read_bytes(),
            headers=headers,
        )
        self.assertEqual(upload_response.status_code, 201, upload_response.text)
        upload_payload = upload_response.json()

        for file_format in ("xlsx", "csv", "txt"):
            download_response = await self._request(
                "GET",
                f"/api/v1/{domain}/documents/{upload_payload['document_id']}/download/{file_format}",
                headers=headers,
            )
            self.assertEqual(download_response.status_code, 200, download_response.text)
            self.assertIn("X-Content-SHA256", download_response.headers)
            self.assertGreater(len(download_response.content), 0)

        run_response = await self._request(
            "POST",
            f"/api/v1/{domain}/runs",
            json={
                "document_id": upload_payload["document_id"],
                "parameters": parameters,
            },
            headers=headers,
        )
        self.assertEqual(run_response.status_code, 201, run_response.text)
        run_payload = run_response.json()
        self.assertEqual(run_payload["status"], "succeeded")

        rows_response = await self._request(
            "GET",
            f"/api/v1/{domain}/runs/{run_payload['run_id']}/rows",
            headers=headers,
        )
        self.assertEqual(rows_response.status_code, 200, rows_response.text)

        artifact_names = [
            "result.json",
            "rows.json",
            "cleaning_report.json",
            "cleaning_report.md",
        ]
        if domain == "pb":
            artifact_names.append("pb_audit.json")

        for artifact_name in artifact_names:
            artifact_response = await self._request(
                "GET",
                f"/api/v1/{domain}/runs/{run_payload['run_id']}/artifacts/{artifact_name}",
                headers=headers,
            )
            self.assertEqual(artifact_response.status_code, 200, artifact_response.text)
            self.assertGreater(len(artifact_response.content), 0)

        return upload_payload, run_payload

    async def test_admin_upload_run_and_dashboard_flow(self) -> None:
        """Admin can upload a workbook, run a calculation, and read outputs."""

        headers = await self._bootstrap_admin()
        workbook_bytes = PPNA_SAMPLE.read_bytes()

        upload_response = await self._request(
            "POST",
            "/api/v1/ppna/documents",
            params={"filename": PPNA_SAMPLE.name},
            content=workbook_bytes,
            headers=headers,
        )
        self.assertEqual(upload_response.status_code, 201, upload_response.text)
        upload_payload = upload_response.json()
        self.assertEqual(upload_payload["domain"], "ppna")

        run_response = await self._request(
            "POST",
            "/api/v1/ppna/runs",
            json={
                "document_id": upload_payload["document_id"],
                "parameters": {"closing_date": _ppna_closing_date()},
            },
            headers=headers,
        )
        self.assertEqual(run_response.status_code, 201, run_response.text)
        run_payload = run_response.json()
        self.assertEqual(run_payload["status"], "succeeded")

        list_runs_response = await self._request("GET", "/api/v1/ppna/runs", headers=headers)
        self.assertEqual(list_runs_response.status_code, 200, list_runs_response.text)
        listed_runs = list_runs_response.json()
        self.assertGreaterEqual(len(listed_runs), 1)
        self.assertEqual(listed_runs[0]["run_id"], run_payload["run_id"])

        list_succeeded_response = await self._request(
            "GET",
            "/api/v1/ppna/runs",
            params={"status": "succeeded"},
            headers=headers,
        )
        self.assertEqual(list_succeeded_response.status_code, 200, list_succeeded_response.text)
        self.assertGreaterEqual(len(list_succeeded_response.json()), 1)

        list_offset_response = await self._request(
            "GET",
            "/api/v1/ppna/runs",
            params={"limit": 1, "offset": 1},
            headers=headers,
        )
        self.assertEqual(list_offset_response.status_code, 200, list_offset_response.text)
        self.assertIsInstance(list_offset_response.json(), list)

        rows_response = await self._request("GET", f"/api/v1/ppna/runs/{run_payload['run_id']}/rows", headers=headers)
        self.assertEqual(rows_response.status_code, 200, rows_response.text)
        self.assertGreater(len(rows_response.json()), 0)

        download_response = await self._request(
            "GET",
            f"/api/v1/ppna/documents/{upload_payload['document_id']}/download/csv",
            headers=headers,
        )
        self.assertEqual(download_response.status_code, 200, download_response.text)
        self.assertIn("X-Content-SHA256", download_response.headers)
        self.assertGreater(len(download_response.content), 0)

        artifact_response = await self._request(
            "GET",
            f"/api/v1/ppna/runs/{run_payload['run_id']}/artifacts/result.json",
            headers=headers,
        )
        self.assertEqual(artifact_response.status_code, 200, artifact_response.text)
        self.assertIn("total_amount", artifact_response.json())

        summary_response = await self._request("GET", "/api/v1/dashboard/summary", headers=headers)
        self.assertEqual(summary_response.status_code, 200, summary_response.text)
        self.assertIn("ppna", summary_response.json()["domains"])

        bilan_response = await self._request("GET", "/api/v1/bilan/current", headers=headers)
        self.assertEqual(bilan_response.status_code, 200, bilan_response.text)
        self.assertIn("ppna", bilan_response.json()["totals"])

        audit_response = await self._request("GET", "/api/v1/audit/events", headers=headers)
        self.assertEqual(audit_response.status_code, 200, audit_response.text)
        self.assertGreaterEqual(len(audit_response.json()), 3)

    async def test_hr_can_create_accounts_and_upload(self) -> None:
        """HR inherits user management rights and can upload/run domain calculations."""

        admin_headers = await self._bootstrap_admin()
        hr_create = await self._request(
            "POST",
            "/api/v1/users",
            json={"username": "hr1", "password": "secret123", "role": "HR"},
            headers=admin_headers,
        )
        self.assertEqual(hr_create.status_code, 201, hr_create.text)

        hr_headers = await self._login("hr1", "secret123")
        viewer_create = await self._request(
            "POST",
            "/api/v1/users",
            json={"username": "viewer1", "password": "secret123", "role": "VIEWER"},
            headers=hr_headers,
        )
        self.assertEqual(viewer_create.status_code, 201, viewer_create.text)

        upload_attempt = await self._request(
            "POST",
            "/api/v1/ppna/documents",
            params={"filename": PPNA_SAMPLE.name},
            content=PPNA_SAMPLE.read_bytes(),
            headers=hr_headers,
        )
        self.assertEqual(upload_attempt.status_code, 201, upload_attempt.text)

        upload_payload = upload_attempt.json()
        run_attempt = await self._request(
            "POST",
            "/api/v1/ppna/runs",
            json={
                "document_id": upload_payload["document_id"],
                "parameters": {"closing_date": _ppna_closing_date()},
            },
            headers=hr_headers,
        )
        self.assertEqual(run_attempt.status_code, 201, run_attempt.text)
        self.assertEqual(run_attempt.json()["status"], "succeeded")

    async def test_viewer_can_read_but_cannot_write(self) -> None:
        """Viewer can inspect documents after upload but cannot create them."""

        admin_headers = await self._bootstrap_admin()
        create_viewer = await self._request(
            "POST",
            "/api/v1/users",
            json={"username": "viewer2", "password": "secret123", "role": "VIEWER"},
            headers=admin_headers,
        )
        self.assertEqual(create_viewer.status_code, 201, create_viewer.text)
        viewer_headers = await self._login("viewer2", "secret123")

        forbidden_upload = await self._request(
            "POST",
            "/api/v1/ppna/documents",
            params={"filename": PPNA_SAMPLE.name},
            content=PPNA_SAMPLE.read_bytes(),
            headers=viewer_headers,
        )
        self.assertEqual(forbidden_upload.status_code, 403, forbidden_upload.text)

        admin_upload = await self._request(
            "POST",
            "/api/v1/ppna/documents",
            params={"filename": PPNA_SAMPLE.name},
            content=PPNA_SAMPLE.read_bytes(),
            headers=admin_headers,
        )
        self.assertEqual(admin_upload.status_code, 201, admin_upload.text)
        payload = admin_upload.json()

        viewer_list = await self._request("GET", "/api/v1/ppna/documents", headers=viewer_headers)
        self.assertEqual(viewer_list.status_code, 200, viewer_list.text)
        self.assertEqual(len(viewer_list.json()), 1)

        viewer_download = await self._request(
            "GET",
            f"/api/v1/ppna/documents/{payload['document_id']}/download/xlsx",
            headers=viewer_headers,
        )
        self.assertEqual(viewer_download.status_code, 200, viewer_download.text)
        self.assertGreater(len(viewer_download.content), 0)

    async def test_upload_run_cycle_and_artifact_matrix_all_domains(self) -> None:
        """Uploads/runs are repeatable and emit the full artifact matrix for all domains."""

        headers = await self._bootstrap_admin()

        for domain, workbook_path in DOMAIN_SAMPLES.items():
            with self.subTest(domain=domain):
                run_parameters: dict[str, object] = {}
                if domain == "pb":
                    run_parameters = {
                        "allow_row_level_override": False,
                        "default_pb_rate": 0.0,
                    }

                first_upload, first_run = await self._upload_run_and_validate_artifacts(
                    headers=headers,
                    domain=domain,
                    workbook_path=workbook_path,
                    parameters=run_parameters,
                )
                second_upload, second_run = await self._upload_run_and_validate_artifacts(
                    headers=headers,
                    domain=domain,
                    workbook_path=workbook_path,
                    parameters=run_parameters,
                    document_id=str(first_upload["document_id"]),
                )

                self.assertEqual(first_upload["document_id"], second_upload["document_id"])
                self.assertNotEqual(first_upload["version_id"], second_upload["version_id"])
                self.assertNotEqual(first_run["run_id"], second_run["run_id"])


if __name__ == "__main__":
    unittest.main()
