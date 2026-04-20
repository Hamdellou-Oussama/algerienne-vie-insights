import sys
import os
import time
import uuid
import sqlite3
import requests
import json

# Configuration
BASE_URL = "http://127.0.0.1:4173/api/v1"
WORKSPACE_ROOT = os.getcwd()
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")
FRONTEND_DIR = os.path.join(WORKSPACE_ROOT, "frontend")
sys.path.insert(0, BACKEND_DIR)

from src.backend.settings import BackendSettings
from src.backend.services import create_user

def find_db():
    search_paths = [
        os.path.join(BACKEND_DIR, "data", "app.db"),
        os.path.join(BACKEND_DIR, "app.db"),
        "app.db"
    ]
    for p in search_paths:
        if os.path.exists(p):
            # Check if it has 'users' table
            try:
                conn = sqlite3.connect(p)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
                if cursor.fetchone():
                    conn.close()
                    return p
                conn.close()
            except:
                pass
    return None

def get_actor_id(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE status = 'ACTIVE' AND role = 'ADMIN' LIMIT 1")
    res = cursor.fetchone()
    if not res:
        cursor.execute("SELECT id FROM users WHERE status = 'ACTIVE' LIMIT 1")
        res = cursor.fetchone()
    conn.close()
    return res[0] if res else None

def e2e_test():
    success = True
    results = []
    
    # 1. Health check
    try:
        r = requests.get(f"{BASE_URL}/health")
        print(f"Health check status: {r.status_code}")
    except Exception as e:
        print(f"Health check failed: {e}")
        sys.exit(1)

    # 2. Find DB and Create HR user
    db_path = find_db()
    if not db_path:
        print("Could not find database with 'users' table.")
        sys.exit(1)
    
    print(f"Using DB at: {db_path}")
    actor_id = get_actor_id(db_path)
    if not actor_id:
        print("No active user found in DB to act as creator.")
        sys.exit(1)
        
    username = f"ui_e2e_{int(time.time())}"
    password = "TestPass_12345!"
    
    settings = BackendSettings(
        storage_root=os.path.join(BACKEND_DIR, "storage"),
        db_path=db_path,
        upload_max_bytes=10*1024*1024,
        access_token_ttl_minutes=60,
        refresh_token_ttl_days=7,
        cors_origins=["*"]
    )

    try:
        create_user(username=username, password=password, role="HR", creator_id=actor_id, settings=settings)
        print(f"Created user: {username}")
    except Exception as e:
        print(f"Failed to create user: {e}")
        sys.exit(1)

    # 3. Login
    try:
        r = requests.post(f"{BASE_URL}/auth/login", data={"username": username, "password": password})
        r.raise_for_status()
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
    except Exception as e:
        print(f"Login failed: {e}")
        sys.exit(1)

    # 4. Domains test
    domains = [
        ("ppna", os.path.join(FRONTEND_DIR, "data", "level 01-level2-ÉCHANTILLON  DATA PPNA.xlsx")),
        ("sap", os.path.join(FRONTEND_DIR, "data", "level 01-DATA SAP groupe.xlsx")),
        ("pe", os.path.join(FRONTEND_DIR, "data", "level 01-ÉCHANTILLON  DATA PE.xlsx")),
        ("pb", os.path.join(BACKEND_DIR, "data", "ÉCHANTILLON DATA PB (1).xlsx"))
    ]

    for domain, file_path in domains:
        domain_res = {"domain": domain, "upload": "FAIL", "run_status": "N/A", "run_id": "N/A", "rows_count": 0, "rows_artifact": "FAIL", "result_artifact": "FAIL", "error": ""}
        try:
            if not os.path.exists(file_path):
                raise Exception(f"File not found: {file_path}")
            
            # a) Upload
            filename = os.path.basename(file_path)
            with open(file_path, "rb") as f:
                r = requests.post(f"{BASE_URL}/{domain}/documents?filename={filename}", data=f, headers={**headers, "Content-Type": "application/octet-stream"})
            r.raise_for_status()
            doc_id = r.json()["id"]
            domain_res["upload"] = "OK"

            # b) Run
            r = requests.post(f"{BASE_URL}/{domain}/runs", json={"document_id": doc_id, "parameters": {}}, headers=headers)
            r.raise_for_status()
            run_id = r.json()["id"]
            domain_res["run_id"] = run_id

            # c) Poll
            status = "running"
            for _ in range(40):
                r = requests.get(f"{BASE_URL}/{domain}/runs/{run_id}", headers=headers)
                r.raise_for_status()
                status = r.json()["status"]
                if status != "running":
                    break
                time.sleep(1.5)
            domain_res["run_status"] = status

            if status == "completed":
                # d) Rows
                r = requests.get(f"{BASE_URL}/{domain}/runs/{run_id}/rows", headers=headers)
                r.raise_for_status()
                domain_res["rows_count"] = len(r.json())

                # e) Artifacts
                r = requests.get(f"{BASE_URL}/{domain}/runs/{run_id}/artifacts/rows.json", headers=headers)
                if r.status_code == 200 and r.text: domain_res["rows_artifact"] = "OK"
                
                r = requests.get(f"{BASE_URL}/{domain}/runs/{run_id}/artifacts/result.json", headers=headers)
                if r.status_code == 200 and r.text: domain_res["result_artifact"] = "OK"
            else:
                success = False
                domain_res["error"] = f"Run status: {status}"
        except Exception as e:
            success = False
            domain_res["error"] = str(e)
        
        results.append(domain_res)

    # 5. Output
    fmt = "{:<8} | {:<6} | {:<10} | {:<36} | {:<10} | {:<13} | {:<15} | {:<}"
    print(fmt.format("DOMAIN", "upload", "run_status", "run_id", "rows_count", "rows_artifact", "result_artifact", "error"))
    for r in results:
        print(fmt.format(r["domain"], r["upload"], r["run_status"], r["run_id"], r["rows_count"], r["rows_artifact"], r["result_artifact"], r["error"]))

    if not success:
        sys.exit(1)

if __name__ == "__main__":
    e2e_test()
