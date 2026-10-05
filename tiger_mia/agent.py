"""
MIA Agent Orchestrator for TigerDB.
Implements the full Manager-Planner-Executor lifelong learning loop per arXiv:2604.04503v4.
"""
from typing import Dict, Any, Optional
import uuid
from tiger_mia.config import TigerDBConfig, DEFAULT_CONFIG
from tiger_mia.db import TigerDBClient
from tiger_mia.graph_engine import TigerGraphEngine
from tiger_mia.memory_manager import TigerMemoryManager
from tiger_mia.planner import TigerPlanner
from tiger_mia.executor import TigerExecutor
from tiger_mia.judger import TigerJudger

class MIAAgent:
    def __init__(
        self,
        config: Optional[TigerDBConfig] = None,
        db_client: Optional[TigerDBClient] = None
    ):
        self.config = config or DEFAULT_CONFIG
        self.db = db_client or TigerDBClient(self.config)
        self.graph_engine = TigerGraphEngine(self.db)
        self.memory_manager = TigerMemoryManager(self.config, self.db, self.graph_engine)
        self.planner = TigerPlanner(self.config.max_reflection_turns)
        self.executor = TigerExecutor()
        self.judger = TigerJudger()

    def research(
        self,
        question: str,
        caption: Optional[str] = None,
        gold_answer: Optional[str] = None,
        session_id: Optional[str] = None,
        category: str = "general"
    ) -> Dict[str, Any]:
        """
        Executes the full MIA Research Loop:
        1. Non-parametric Memory Retrieval (Hybrid Score: Sim + Val + Freq)
        2. In-context Planning with Positive & Negative Paradigms
        3. ReAct Tool Execution & Observation Gathering
        4. Reflection & Replanning (if impasse/failure occurs, at most once)
        5. Graph DAG Serialization (tiger_graph)
        6. Experience Consolidation & Knowledge Replacement (tiger_mia)
        7. Telemetry & Advantage Logging (TimescaleDB hypertable)
        """
        sid = session_id or str(uuid.uuid4())
        tid = str(uuid.uuid4())

        # Step 1: Memory Retrieval
        retrieved_memory = self.memory_manager.retrieve_hybrid(
            question=question,
            caption=caption,
            category=category,
            top_k=self.config.top_k_retrieval
        )

        # Step 2: Collaborative Planning
        initial_plan = self.planner.generate_plan(
            question=question,
            caption=caption,
            retrieved_memory=retrieved_memory
        )

        # Step 3: Execution Rollout 1
        exec_result = self.executor.execute_plan(
            question=question,
            plan_steps=initial_plan["plan_steps"],
            caption=caption,
            max_steps=self.config.max_executor_steps
        )
        intermediate_answer = exec_result["final_answer"]

        # Step 4: Reflection Check
        r1_inter = self.judger.evaluate_correctness(intermediate_answer, gold_answer)
        reflection_data = None
        final_answer = intermediate_answer
        reflection_triggered = False

        if r1_inter == 0.0 and gold_answer is not None:
            # Trigger Reflect-Replan
            reflection_data = self.planner.reflect_and_replan(
                question=question,
                failed_trajectory=exec_result,
                error_feedback="Intermediate answer did not match expected ground truth."
            )
            if reflection_data:
                reflection_triggered = True
                revised_exec = self.executor.execute_plan(
                    question=question,
                    plan_steps=reflection_data["revised_plan"],
                    caption=caption,
                    max_steps=self.config.max_executor_steps
                )
                exec_result["reflection"] = reflection_data["reflection"]
                exec_result["revised_plan"] = reflection_data["revised_plan"]
                exec_result["tool_calls"].extend(revised_exec["tool_calls"])
                final_answer = revised_exec["final_answer"]
                exec_result["final_answer"] = final_answer

        # Evaluate Final Correctness
        r1_final = self.judger.evaluate_correctness(final_answer, gold_answer)
        judgment_label = "correct" if r1_final == 1.0 else "incorrect"

        # Compute Rewards (Eq. 2 & Eq. 4)
        exec_rewards = self.judger.compute_executor_reward(final_answer, gold_answer)
        planner_rewards = self.judger.compute_planner_reward(
            intermediate_answer=intermediate_answer,
            final_answer=final_answer,
            gold_answer=gold_answer,
            reflection_triggered=reflection_triggered
        )

        # Step 5 & 6: Experience Consolidation in TigerDB
        consolidation = self.memory_manager.consolidate_experience(
            question=question,
            caption=caption,
            trajectory=exec_result,
            judgment_label=judgment_label,
            category=category
        )

        # Step 7: Telemetry Logging to TimescaleDB Hypertable
        total_steps = len(exec_result["tool_calls"])
        self.memory_manager.log_trajectory_telemetry(
            session_id=sid,
            trajectory_id=tid,
            question=question,
            plan=" -> ".join(initial_plan["plan_steps"]),
            total_steps=total_steps,
            correctness_reward=exec_rewards["correctness_reward"],
            tool_reward=exec_rewards["tool_reward"],
            format_reward=exec_rewards["format_reward"],
            total_reward=planner_rewards["total_reward"],
            advantage=0.0,
            reflection_triggered=reflection_triggered,
            revised_plan=" -> ".join(reflection_data["revised_plan"]) if reflection_data else None,
            metadata={
                "category": category,
                "memory_id": consolidation["memory_id"],
                "graph_id": consolidation["graph_id"]
            }
        )

        return {
            "session_id": sid,
            "trajectory_id": tid,
            "question": question,
            "final_answer": final_answer,
            "judgment_label": judgment_label,
            "reflection_triggered": reflection_triggered,
            "total_steps": total_steps,
            "retrieved_memory": retrieved_memory,
            "consolidation": consolidation,
            "planner_rewards": planner_rewards,
            "graph_id": consolidation["graph_id"]
        }
