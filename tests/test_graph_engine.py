"""
Tests for TigerDB Property Graph Engine (graph_nodes, graph_edges, recursive CTE traversal).
"""
import pytest
import uuid
from tiger_mia.db import TigerDBClient
from tiger_mia.graph_engine import TigerGraphEngine

@pytest.fixture
def graph_engine():
    return TigerGraphEngine()

def test_graph_node_and_edge_creation(graph_engine):
    gid = str(uuid.uuid4())
    n1 = graph_engine.create_node(
        graph_id=gid,
        node_type="question",
        label="What is the capital of France?",
        properties={"topic": "geography"}
    )
    n2 = graph_engine.create_node(
        graph_id=gid,
        node_type="subgoal",
        label="Lookup European capitals",
        properties={"step": 1}
    )
    edge_id = graph_engine.create_edge(
        graph_id=gid,
        source_node_id=n1,
        target_node_id=n2,
        edge_type="DECOMPOSES_TO"
    )
    assert n1 is not None
    assert n2 is not None
    assert edge_id is not None

def test_recursive_workflow_dag_traversal(graph_engine):
    gid = str(uuid.uuid4())
    dummy_trajectory = {
        "question": "Identify the director of Inception and their award history",
        "plan_steps": [
            "Find director of Inception",
            "Search awards won by the director"
        ],
        "tool_calls": [
            {"tool": "web_search", "args": {"query": "director of Inception"}, "observation": "Christopher Nolan"},
            {"tool": "entity_lookup", "args": {"entity": "Christopher Nolan"}, "observation": "Academy Award for Best Director"}
        ],
        "final_answer": "Christopher Nolan directed Inception and won an Academy Award."
    }

    graph_engine.serialize_trajectory_to_graph(dummy_trajectory, graph_id=gid)
    dag_steps = graph_engine.get_workflow_dag(gid)

    assert len(dag_steps) >= 5
    # First step should be the root question node
    assert dag_steps[0]["node_type"] == "question"
    # Ensure ordered progression
    types = [s["node_type"] for s in dag_steps]
    assert "subgoal" in types
    assert "tool_call" in types
    assert "observation" in types
    assert "answer" in types

    # Check markdown rendering
    md = graph_engine.render_workflow_markdown(gid)
    assert "Workflow Execution Graph" in md
    assert "QUESTION" in md
