import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import json
from tiger_mia.agent import MIAAgent

def main():
    print("=" * 80)
    print("  TIGERDB: MEMORY INTELLIGENCE AGENT (MIA) DEMONSTRATION")
    print("  Graph + Vector Database Engine (arXiv:2604.04503v4)")
    print("=" * 80)

    agent = MIAAgent()

    # Step 1: Initial research query (Cold start - no memories yet)
    q1 = "Which film directed by Christopher Nolan won the Academy Award for Best Picture in 2024?"
    print(f"\n[QUERY 1] {q1}")
    res1 = agent.research(
        question=q1,
        caption="Movie poster of Oppenheimer",
        gold_answer="Oppenheimer won the Academy Award for Best Picture in 2024",
        category="film_studies"
    )

    print(f"  -> Final Answer: {res1['final_answer']}")
    print(f"  -> Judgment: {res1['judgment_label']}")
    print(f"  -> Consolidated Memory ID: {res1['consolidation']['memory_id']} ({res1['consolidation']['action_taken']})")
    print(f"  -> Trajectory Graph ID: {res1['graph_id']}")

    # Render Workflow DAG from TigerDB Graph Engine
    dag_md = agent.graph_engine.render_workflow_markdown(res1['graph_id'])
    print("\n--- TigerDB Trajectory Graph DAG ---")
    print(dag_md)

    # Step 2: Second research query (Warm state - retrieves positive paradigm from Query 1)
    q2 = "Who directed the 2024 Best Picture winner and what was the movie about?"
    print("\n" + "=" * 80)
    print(f"[QUERY 2 (Lifelong Evolution)] {q2}")
    res2 = agent.research(
        question=q2,
        caption="Christopher Nolan at the Oscars",
        category="film_studies"
    )

    retrieved_pos = res2["retrieved_memory"]["positive_paradigms"]
    print(f"  -> Retrieved {len(retrieved_pos)} Positive Paradigm(s) from TigerDB Memory Units:")
    for idx, p in enumerate(retrieved_pos, 1):
        print(f"     [{idx}] Question: {p['question'][:60]}... | Score: {p['final_score']:.4f} (Sim: {p['raw_similarity']:.4f}, Val: {p['value_reward']:.2f}, Freq: {p['frequency_reward']:.2f})")

    print(f"  -> Final Answer: {res2['final_answer']}")
    print(f"  -> Consolidation: {res2['consolidation']['action_taken']} into TigerDB")

    # Step 3: Inspect TimescaleDB Trajectory Logs
    print("\n" + "=" * 80)
    print("--- TimescaleDB Telemetry Logs (Recent Trajectories) ---")
    logs = agent.db.execute("SELECT time, question, total_steps, total_reward FROM tiger_mia.trajectory_logs ORDER BY time DESC LIMIT 3;")
    for log in logs:
        print(f"  [{log['time']}] Steps: {log['total_steps']} | Reward: {log['total_reward']} | Query: {log['question'][:60]}")

    print("\n" + "=" * 80)
    print("MIA Framework successfully running on TigerDB (Graph & Vector Engine)!")
    print("=" * 80)

if __name__ == "__main__":
    main()
