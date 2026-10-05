"""
Tests for TigerDB MIA Hybrid Retrieval and Knowledge Replacement.
Tests Eq. 4 & Section 10 hybrid score calculation and threshold upserts.
"""
import pytest
import uuid
from tiger_mia.db import TigerDBClient
from tiger_mia.memory_manager import TigerMemoryManager

@pytest.fixture
def memory_manager():
    return TigerMemoryManager()

def test_hybrid_retrieval_and_knowledge_replacement(memory_manager):
    db = memory_manager.db

    # Insert test positive memory
    q1 = f"Test Query on Artificial Intelligence {uuid.uuid4().hex[:6]}"
    traj1 = {
        "question": q1,
        "plan_steps": ["Plan step 1"],
        "tool_calls": [{"tool": "web_search", "observation": "AI info"}],
        "final_answer": "AI is intelligence demonstrated by machines."
    }
    res1 = memory_manager.consolidate_experience(
        question=q1,
        caption=None,
        trajectory=traj1,
        judgment_label="correct",
        category="ai_research"
    )
    assert res1["action_taken"] in ["INSERTED", "UPDATED"]

    # Insert test negative memory
    q2 = f"Flawed query leading to false assumption {uuid.uuid4().hex[:6]}"
    traj2 = {
        "question": q2,
        "plan_steps": ["Flawed step"],
        "tool_calls": [{"tool": "web_search", "observation": "Incorrect data"}],
        "final_answer": "Incorrect conclusion."
    }
    res2 = memory_manager.consolidate_experience(
        question=q2,
        caption=None,
        trajectory=traj2,
        judgment_label="incorrect",
        category="ai_research"
    )
    assert res2["action_taken"] in ["INSERTED", "UPDATED"]

    # Retrieve paradigms using hybrid retrieval
    retrieved = memory_manager.retrieve_hybrid(question=q1, category="ai_research", top_k=2)
    pos = retrieved["positive_paradigms"]
    neg = retrieved["negative_paradigms"]

    assert len(pos) >= 1
    assert pos[0]["judgment_label"] == "correct"
    assert "final_score" in pos[0]
    assert pos[0]["final_score"] > 0

    if len(neg) > 0:
        assert neg[0]["judgment_label"] == "incorrect"

def test_knowledge_replacement_threshold(memory_manager):
    # Consolidating identical query twice should trigger UPDATED instead of duplicating
    q_dup = f"Identical query for replacement testing {uuid.uuid4().hex[:6]}"
    traj_a = {
        "question": q_dup,
        "plan_steps": ["Step 1", "Step 2"],
        "tool_calls": [{"tool": "web_search", "observation": "Result A"}],
        "final_answer": "Answer A"
    }
    res_a = memory_manager.consolidate_experience(
        question=q_dup,
        caption=None,
        trajectory=traj_a,
        judgment_label="correct",
        category="test_replacement"
    )
    assert res_a["action_taken"] == "INSERTED"

    # Repeat with same question: should UPDATE
    res_b = memory_manager.consolidate_experience(
        question=q_dup,
        caption=None,
        trajectory=traj_a,
        judgment_label="correct",
        category="test_replacement"
    )
    assert res_b["action_taken"] == "UPDATED"
    assert res_b["memory_id"] == res_a["memory_id"]
