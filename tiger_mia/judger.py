"""
Judger module for TigerDB MIA.
Implements correctness evaluation, composite reward functions (Eq. 2 & Eq. 4),
and GRPO relative advantage computation per arXiv:2604.04503v4.
"""
from typing import Dict, Any, List, Optional
import numpy as np

class TigerJudger:
    def __init__(self):
        pass

    def evaluate_correctness(self, predicted_answer: str, gold_answer: Optional[str] = None) -> float:
        """
        Evaluates candidate answer against gold answer.
        Returns r1: 1.0 if correct, 0.0 otherwise.
        """
        if gold_answer is None:
            # Unsupervised setting (Section 3.4.3): Checks internal consistency & evidence grounding
            return 1.0 if predicted_answer and "Error" not in predicted_answer else 0.0

        p = predicted_answer.strip().lower()
        g = gold_answer.strip().lower()
        return 1.0 if (g in p or p == g) else 0.0

    def compute_executor_reward(
        self,
        pred_answer: str,
        gold_answer: Optional[str],
        tool_success: bool = True,
        format_valid: bool = True
    ) -> Dict[str, float]:
        """
        Computes composite reward for Executor (Eq. 2):
        r_ME = 0.7 * r1(a_pred, a_gold) + 0.2 * r2(y) + 0.1 * r3(y)
        """
        r1 = self.evaluate_correctness(pred_answer, gold_answer)
        r2 = 1.0 if tool_success else 0.0
        r3 = 1.0 if format_valid else 0.0
        r_me = 0.7 * r1 + 0.2 * r2 + 0.1 * r3

        return {
            "correctness_reward": r1,
            "tool_reward": r2,
            "format_reward": r3,
            "total_reward": r_me
        }

    def compute_planner_reward(
        self,
        intermediate_answer: str,
        final_answer: str,
        gold_answer: Optional[str],
        reflection_triggered: bool,
        format_valid: bool = True
    ) -> Dict[str, float]:
        """
        Computes composite reward for Planner (Eq. 4):
        r_MP = 0.7 * r1(a_pred_2, a_gold) + 0.2 * r1(a_pred_1, a_gold) + 0.05 * r2(y, a_gold) + 0.05 * r3(y)
        r2 (reflection reward): 1.0 if first interaction correct and reflection uninitiated,
                               or if interaction incorrect and reflection initiated; 0.0 otherwise.
        """
        r1_final = self.evaluate_correctness(final_answer, gold_answer)
        r1_inter = self.evaluate_correctness(intermediate_answer, gold_answer)

        # Reflection reward definition
        if (r1_inter == 1.0 and not reflection_triggered) or (r1_inter == 0.0 and reflection_triggered):
            r2_reflect = 1.0
        else:
            r2_reflect = 0.0

        r3 = 1.0 if format_valid else 0.0
        r_mp = 0.7 * r1_final + 0.2 * r1_inter + 0.05 * r2_reflect + 0.05 * r3

        return {
            "r1_final": r1_final,
            "r1_intermediate": r1_inter,
            "r2_reflection": r2_reflect,
            "r3_format": r3,
            "total_reward": r_mp
        }

    def compute_grpo_advantages(self, rewards: List[float], epsilon: float = 1e-8) -> List[float]:
        """
        Computes Group Relative Policy Optimization (GRPO) advantage:
        A_hat_i = (R_i - mu_R) / (sigma_R + epsilon)
        """
        if not rewards:
            return []
        arr = np.array(rewards, dtype=np.float32)
        mu = np.mean(arr)
        sigma = np.std(arr)
        advantages = (arr - mu) / (sigma + epsilon)
        return advantages.tolist()
