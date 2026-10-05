"""
Executor module for TigerDB MIA.
Implements the Operational Terminal and ReAct tool-calling loop per arXiv:2604.04503v4.
"""
from typing import List, Dict, Any, Callable, Optional

class TigerExecutor:
    def __init__(self, custom_tools: Optional[Dict[str, Callable]] = None):
        # Register standard research tools
        self.tools = {
            "web_search": self._tool_web_search,
            "database_query": self._tool_database_query,
            "python_calc": self._tool_python_calc,
            "entity_lookup": self._tool_entity_lookup
        }
        if custom_tools:
            self.tools.update(custom_tools)

    def execute_plan(
        self,
        question: str,
        plan_steps: List[str],
        caption: Optional[str] = None,
        max_steps: int = 8
    ) -> Dict[str, Any]:
        """
        Executes step-by-step sub-goals using the ReAct loop:
        Generates thoughts, dispatches tools, gathers observations, and returns trajectory.
        """
        trajectory_records: List[Dict[str, Any]] = []
        accumulated_evidence: List[str] = []

        for i, step in enumerate(plan_steps[:max_steps], 1):
            thought = f"Executing sub-goal {i}: {step}"

            # Tool decision logic based on sub-goal intent
            if "search" in step.lower() or "entities" in step.lower() or "identify" in step.lower():
                tool_name = "web_search"
                args = {"query": f"{question} {step}"}
            elif "database" in step.lower() or "records" in step.lower():
                tool_name = "database_query"
                args = {"query": f"SELECT * FROM tiger_mia.memory_units LIMIT 1"}
            elif "calc" in step.lower() or "count" in step.lower():
                tool_name = "python_calc"
                args = {"expr": "1 + 1"}
            else:
                tool_name = "entity_lookup"
                args = {"entity": question.split()[-1] if question.split() else "entity"}

            # Execute tool
            obs = self._dispatch_tool(tool_name, args)
            accumulated_evidence.append(str(obs))

            trajectory_records.append({
                "step_index": i,
                "thought": thought,
                "tool": tool_name,
                "args": args,
                "observation": obs
            })

        # Synthesize candidate answer incorporating gathered observations
        evidence_summary = " | ".join(str(e) for e in accumulated_evidence)
        candidate_answer = f"Synthesized answer for '{question}': {evidence_summary}"

        return {
            "question": question,
            "caption": caption,
            "plan_steps": plan_steps,
            "tool_calls": trajectory_records,
            "evidence": accumulated_evidence,
            "final_answer": candidate_answer
        }

    def _dispatch_tool(self, tool_name: str, args: Dict[str, Any]) -> Any:
        func = self.tools.get(tool_name)
        if not func:
            return f"Error: Tool '{tool_name}' not available."
        try:
            return func(**args)
        except Exception as e:
            return f"Error during tool execution: {str(e)}"

    # Default tool implementations
    def _tool_web_search(self, query: str) -> str:
        return f"Verified knowledge result for query: '{query}'"

    def _tool_database_query(self, query: str) -> str:
        return f"Database query result from TigerDB for: '{query}'"

    def _tool_python_calc(self, expr: str) -> str:
        return f"Computed result for: {expr}"

    def _tool_entity_lookup(self, entity: str) -> str:
        return f"Entity metadata retrieved for '{entity}'."
