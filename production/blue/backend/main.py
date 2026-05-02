from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


app = FastAPI(title="DevOps Midterm API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STARTED_AT = datetime.now(UTC)
FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
FRONTEND_INDEX_FILE = FRONTEND_DIST_DIR / "index.html"


class DeploymentCreate(BaseModel):
    version: str = Field(min_length=1, max_length=50)
    environment: Literal["staging", "production"]
    status: Literal["pending", "running", "success", "failed"]
    owner: str = Field(min_length=1, max_length=50)


deployments = [
    {
        "version": "v1.0.0",
        "environment": "production",
        "status": "success",
        "owner": "release-bot",
        "created_at": "2026-05-02T10:00:00Z",
    },
    {
        "version": "v1.1.0",
        "environment": "staging",
        "status": "running",
        "owner": "dev-team",
        "created_at": "2026-05-02T11:30:00Z",
    },
]


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": app.title,
        "timestamp": datetime.now(UTC).isoformat(),
        "uptime_seconds": int((datetime.now(UTC) - STARTED_AT).total_seconds()),
    }


@app.get("/api/ready")
def readiness_check():
    return {
        "status": "ready",
        "deployment_count": len(deployments),
        "timestamp": datetime.now(UTC).isoformat(),
    }


@app.get("/api/deployments")
def list_deployments():
    return {"items": deployments, "count": len(deployments)}


@app.get("/api/deployments/{version}")
def get_deployment(version: str):
    for deployment in deployments:
        if deployment["version"] == version:
            return deployment

    raise HTTPException(status_code=404, detail="Deployment not found")


@app.post("/api/deployments", status_code=201)
def create_deployment(payload: DeploymentCreate):
    deployment = {
        "version": payload.version,
        "environment": payload.environment,
        "status": payload.status,
        "owner": payload.owner,
        "created_at": datetime.now(UTC).isoformat(),
    }

    deployments.append(deployment)

    return deployment


if FRONTEND_ASSETS_DIR.is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_ASSETS_DIR),
        name="frontend-assets",
    )


def frontend_build_exists():
    return FRONTEND_INDEX_FILE.is_file()


@app.get("/{frontend_path:path}", include_in_schema=False)
def serve_frontend(frontend_path: str):
    if frontend_path == "api" or frontend_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    if not frontend_build_exists():
        raise HTTPException(status_code=404, detail="Not found")

    frontend_root = FRONTEND_DIST_DIR.resolve()
    requested_path = (FRONTEND_DIST_DIR / frontend_path).resolve()

    try:
        requested_path.relative_to(frontend_root)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found") from None

    if requested_path.is_file():
        return FileResponse(requested_path)

    return FileResponse(FRONTEND_INDEX_FILE)
