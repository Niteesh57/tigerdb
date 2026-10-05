"""
Tests for TigerDB Vector Engine (pgvector with HNSW indexing).
"""
import pytest
from tiger_mia.db import TigerDBClient
from tiger_mia.memory_manager import Embedder

@pytest.fixture
def db_client():
    return TigerDBClient()

def test_vector_extension_active(db_client):
    rows = db_client.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';")
    assert len(rows) == 1
    assert rows[0]["extname"] == "vector"

def test_vector_cosine_distance(db_client):
    embedder = Embedder(dim=384)
    v1 = embedder.encode("quantum computing and quantum algorithms")
    v2 = embedder.encode("quantum computing algorithms and physics")
    v3 = embedder.encode("baking chocolate chip cookies in an oven")

    # Cosine distance between similar concepts should be smaller than between dissimilar
    query = """
        SELECT 
            (%s::vector <=> %s::vector) AS dist_similar,
            (%s::vector <=> %s::vector) AS dist_dissimilar;
    """
    row = db_client.execute_one(query, (v1, v2, v1, v3))
    assert row is not None
    assert row["dist_similar"] < row["dist_dissimilar"]
