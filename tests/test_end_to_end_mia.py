"""
End-to-End Test for TigerDB MIA Agent.
Verifies the complete Manager-Planner-Executor lifelong learning cycle.
"""
import pytest
from tiger_mia.agent import MIAAgent
from tiger_mia.db import TigerDBClient

@pytest.fixture
def agent():
    return MIAAgent()

@pytest.fixture
def db_client():
    return TigerDBClient()

def test_full_mia_agent_research_flow(agent, db_client):
    question = "Who received the Nobel Prize in Physics in 1921 and what was the theoretical explanation for the award?"
    gold_answer = "Albert Einstein for his explanation of the photoelectric effect"

    # Configure tool to return factual evidence
    agent.executor.tools["web_search"] = lambda query: "Albert Einstein for his explanation of the photoelectric effect in 1921."

    result = agent.research(
        question=question,
        caption="Photo of Albert Einstein receiving honors",
        gold_answer=gold_answer,
        category="physics"
    )

    # Validate output structure
    assert result["question"] == question
    assert result["final_answer"] is not None
    assert result["total_steps"] > 0
    assert result["consolidation"]["action_taken"] in ["INSERTED", "UPDATED"]

    # Validate graph in TigerDB
    gid = result["graph_id"]
    nodes = db_client.execute("SELECT * FROM tiger_graph.graph_nodes WHERE graph_id = %s;", (gid,))
    edges = db_client.execute("SELECT * FROM tiger_graph.graph_edges WHERE graph_id = %s;", (gid,))
    assert len(nodes) >= 4
    assert len(edges) >= 3

    # Validate TimescaleDB trajectory telemetry log
    sid = result["session_id"]
    logs = db_client.execute("SELECT * FROM tiger_mia.trajectory_logs WHERE session_id = %s;", (sid,))
    assert len(logs) >= 1
    assert logs[0]["question"] == question
    assert logs[0]["total_steps"] == result["total_steps"]

    # Run second research task with similar question and verify hybrid retrieval retrieves previous experience
    follow_up = "What discovery won Albert Einstein the Nobel Prize?"
    res2 = agent.research(
        question=follow_up,
        category="physics"
    )
    pos_retrieved = res2["retrieved_memory"]["positive_paradigms"]
    assert len(pos_retrieved) >= 1
    # Check that previous query was retrieved as positive paradigm
    assert any("Albert Einstein" in p["question"] for p in pos_retrieved)
