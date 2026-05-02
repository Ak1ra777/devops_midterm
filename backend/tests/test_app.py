from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_health_check_returns_ok():
    response = client.get("/api/health")

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "ok"
    assert data["service"] == "DevOps Midterm API"
    assert "timestamp" in data
    assert "uptime_seconds" in data


def test_ready_check_returns_ready():
    response = client.get("/api/ready")

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "ready"
    assert "deployment_count" in data
    assert "timestamp" in data


def test_list_deployments_returns_items():
    response = client.get("/api/deployments")

    assert response.status_code == 200

    data = response.json()

    assert "items" in data
    assert "count" in data
    assert isinstance(data["items"], list)
    assert data["count"] == len(data["items"])


def test_get_deployment_by_version():
    response = client.get("/api/deployments/v1.0.0")

    assert response.status_code == 200

    data = response.json()

    assert data["version"] == "v1.0.0"
    assert data["environment"] == "production"
    assert data["status"] == "success"


def test_get_missing_deployment_returns_404():
    response = client.get("/api/deployments/unknown-version")

    assert response.status_code == 404

    data = response.json()

    assert data["detail"] == "Deployment not found"


def test_create_deployment():
    payload = {
        "version": "v2.0.0",
        "environment": "staging",
        "status": "pending",
        "owner": "akira",
    }

    response = client.post("/api/deployments", json=payload)

    assert response.status_code == 201

    data = response.json()

    assert data["version"] == "v2.0.0"
    assert data["environment"] == "staging"
    assert data["status"] == "pending"
    assert data["owner"] == "akira"
    assert "created_at" in data
