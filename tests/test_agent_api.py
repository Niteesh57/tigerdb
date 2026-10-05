"""
Automated unit and integration tests for TigerDB Desktop Memory Agent API.
"""
import pytest
from fastapi.testclient import TestClient
from tiger_agent.api import app

@pytest.fixture
def client():
    return TestClient(app)

def test_api_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["online", "database_degraded"]
    assert "database" in data
    assert data["database"]["engine"] == "PostgreSQL 18 + TimescaleDB HA + pgvector"
    assert data["database"]["memory_units"] > 0

def test_morning_briefing(client):
    response = client.get("/api/morning/briefing")
    assert response.status_code == 200
    data = response.json()
    assert "yesterday" in data
    assert "unfinished" in data["yesterday"]
    assert "failures" in data["yesterday"]
    assert len(data["yesterday"]["failures"]) >= 1
    # Check that failed deployment exists
    fail = data["yesterday"]["failures"][0]
    assert "Deployment" in fail["title"] or "5432" in fail["error_reason"]

def test_memory_search(client):
    # Query for client proposal
    response = client.post("/api/memory/query", json={"query": "where is that client proposal document?", "top_k": 3})
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) > 0
    top = data["results"][0]
    assert "client_proposal" in top["title"] or "proposal" in top["title"].lower()

def test_webmcp_actions(client):
    # 1. Test docker heal
    heal_res = client.post("/api/webmcp/execute", json={"action": "docker_heal", "params": {"container": "tiger-timescaledb"}})
    assert heal_res.status_code == 200
    heal_data = heal_res.json()
    assert heal_data["success"] is True

    # 2. Test email draft
    draft_res = client.post("/api/webmcp/execute", json={"action": "draft_email", "params": {"recipient": "Rahul"}})
    assert draft_res.status_code == 200
    draft_data = draft_res.json()
    assert draft_data["success"] is True
    assert draft_data["draft"]["recipient"] == "Rahul"
