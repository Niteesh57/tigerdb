"""
Planner module for TigerDB MIA.
Implements cognitive planning, in-context few-shot prompting with Positive & Negative Paradigms,
and the Reflect-Replan mechanism per arXiv:2604.04503v4.
"""
from typing import List, Dict, Any, Optional

class TigerPlanner:
    def __init__(self, max_reflection_turns: int = 1):
        self.max_reflection_turns = max_reflection_turns

    def generate_plan(
        self,
        question: str,
        caption: Optional[str] = None,
        retrieved_memory: Optional[Dict[str, List[Dict[str, Any]]]] = None
    ) -> Dict[str, Any]:
        """
        Generates an initial decomposed step-by-step plan (P_init)
        conditioned on retrieved Positive Paradigms (few-shot success workflows)
        and Negative Paradigms (pitfall constraints).
        """
        pos_paradigms = (retrieved_memory or {}).get("positive_paradigms", [])
        neg_paradigms = (retrieved_memory or {}).get("negative_paradigms", [])

        # Build in-context prompt structure
        context_sections = []
        if pos_paradigms:
            best_pos = pos_paradigms[0]
            context_sections.append(
                f"[POSITIVE PARADIGM (Successful Workflow)]\n"
                f"Question: {best_pos.get('question')}\n"
                f"Workflow: {best_pos.get('compressed_workflow')}\n"
                f"Guidance: Model your planning after this efficient decomposition."
            )

        if neg_paradigms:
            sample_neg = neg_paradigms[0]
            context_sections.append(
                f"[NEGATIVE PARADIGM (Failed Trajectory to Avoid)]\n"
                f"Question: {sample_neg.get('question')}\n"
                f"Failed Flow: {sample_neg.get('compressed_workflow')}\n"
                f"Constraint: Avoid this flawed line of inquiry."
            )

        # Decompose task into clear sub-goals
        steps = [
            f"Identify key entities and conditions in the query: '{question}'",
            "Retrieve external knowledge or database records for core entities",
            "Synthesize verified factual evidence into the target answer"
        ]

        # If caption exists, add visual grounding step
        if caption:
            steps.insert(0, f"Analyze visual caption context: '{caption}'")

        return {
            "question": question,
            "caption": caption,
            "context_used": "\n\n".join(context_sections),
            "plan_steps": steps,
            "reflection_count": 0
        }

    def reflect_and_replan(
        self,
        question: str,
        failed_trajectory: Dict[str, Any],
        error_feedback: str
    ) -> Optional[Dict[str, Any]]:
        """
        Triggers the Reflect-Replan mechanism conditioned on execution feedback.
        Enforces rule: Triggered at most once per query.
        """
        reflection_turns = failed_trajectory.get("reflection_count", 0)
        if reflection_turns >= self.max_reflection_turns:
            return None  # Replan triggered at most once

        reflection = (
            f"Encountered impasse or incorrect result: {error_feedback}. "
            f"The initial approach failed at tool evaluation. Revising strategy to target alternative evidence."
        )

        revised_steps = [
            "Re-examine query assumptions and identify alternative keywords",
            "Execute targeted fallback search ignoring initial dead ends",
            "Formulate corrected final answer using cross-verified observations"
        ]

        return {
            "reflection": reflection,
            "revised_plan": revised_steps,
            "reflection_count": reflection_turns + 1
        }
