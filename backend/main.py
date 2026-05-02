from datetime import UTC, datetime
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
