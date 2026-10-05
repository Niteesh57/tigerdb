"""
Graph Engine for TigerDB: Property Graph storage, Trajectory DAG construction, and Recursive Traversal.
Based on the workflow execution model in arXiv:2604.04503v4.
"""
from typing import List, Dict, Any, Optional
import uuid
import json
import numpy as np
from tiger_mia.db import TigerDBClient

class TigerGraphEngine:
    def __init__(self, db_client: Optional[TigerDBClient] = None):
        self.db = db_client or TigerDBClient()
        self._in_memory_nodes: Dict[str, List[Dict[str, Any]]] = {}
        self._in_memory_edges: Dict[str, List[Dict[str, Any]]] = {}

    def create_node(
        self,
        graph_id: str,
        node_type: str,
        label: str,
        properties: Optional[Dict[str, Any]] = None,
        embedding: Optional[List[float]] = None
    ) -> str:
        """Inserts a single node into tiger_graph.graph_nodes or stores in-memory if DB offline."""
        node_id = str(uuid.uuid4())
        props_json = json.dumps(properties or {})
        query = """
            INSERT INTO tiger_graph.graph_nodes (id, graph_id, node_type, label, properties, embedding)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
        """
        row = self.db.execute_one(
            query,
            (node_id, graph_id, node_type, label, props_json, embedding)
        )
        if graph_id not in self._in_memory_nodes:
            self._in_memory_nodes[graph_id] = []
        self._in_memory_nodes[graph_id].append({
            "id": node_id,
            "type": node_type,
            "label": label,
            "properties": properties or {}
        })
        if row and "id" in row:
            return str(row["id"])
        return node_id

    def create_edge(
        self,
        graph_id: str,
        source_node_id: str,
        target_node_id: str,
        edge_type: str,
        weight: float = 1.0,
        properties: Optional[Dict[str, Any]] = None
    ) -> str:
        """Inserts a directed edge into tiger_graph.graph_edges or stores in-memory if DB offline."""
        edge_id = str(uuid.uuid4())
        props_json = json.dumps(properties or {})
        query = """
            INSERT INTO tiger_graph.graph_edges (id, graph_id, source_node_id, target_node_id, edge_type, weight, properties)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
        """
        row = self.db.execute_one(
            query,
            (edge_id, graph_id, source_node_id, target_node_id, edge_type, weight, props_json)
        )
        if graph_id not in self._in_memory_edges:
            self._in_memory_edges[graph_id] = []
        self._in_memory_edges[graph_id].append({
            "id": edge_id,
            "source": source_node_id,
            "target": target_node_id,
            "type": edge_type,
            "weight": weight
        })
        if row and "id" in row:
            return str(row["id"])
        return edge_id

    def get_workflow_dag(self, graph_id: str) -> List[Dict[str, Any]]:
        """Traverses the trajectory DAG in topological order using recursive CTE or in-memory cache."""
        query = "SELECT * FROM tiger_graph.get_workflow_dag(%s);"
        rows = self.db.execute(query, (graph_id,))
        if rows:
            return rows
        nodes = self._in_memory_nodes.get(graph_id, [])
        return [
            {"node_id": n["id"], "parent_node_id": None, "node_type": n["type"], "label": n["label"], "depth": 0, "path": [n["id"]]}
            for n in nodes
        ]

    def serialize_trajectory_to_graph(
        self,
        trajectory: Dict[str, Any],
        graph_id: Optional[str] = None
    ) -> str:
        """
        Converts an agent's ReAct rollout into a Property Graph DAG in TigerDB.
        Trajectory format:
        {
            "question": "...",
            "plan_steps": ["step 1", "step 2"],
            "tool_calls": [{"tool": "...", "args": {...}, "observation": "..."}],
            "reflection": "..." (optional),
            "revised_plan": [...] (optional),
            "final_answer": "..."
        }
        """
        gid = graph_id or str(uuid.uuid4())

        # 1. Create Question Node (Root)
        q_id = self.create_node(
            graph_id=gid,
            node_type="question",
            label=f"Query: {trajectory.get('question', '')[:100]}",
            properties={"full_question": trajectory.get("question", "")}
        )

        previous_node_id = q_id

        # 2. Initial Plan Subgoals
        plan_steps = trajectory.get("plan_steps", [])
        for i, step in enumerate(plan_steps, 1):
            subgoal_id = self.create_node(
                graph_id=gid,
                node_type="subgoal",
                label=f"Subgoal {i}: {step}",
                properties={"step_index": i, "description": step}
            )
            self.create_edge(
                graph_id=gid,
                source_node_id=previous_node_id,
                target_node_id=subgoal_id,
                edge_type="DECOMPOSES_TO" if previous_node_id == q_id else "NEXT_STEP"
            )
            previous_node_id = subgoal_id

        # 3. Tool Calls & Observations
        for i, step in enumerate(trajectory.get("tool_calls", []), 1):
            tool_id = self.create_node(
                graph_id=gid,
                node_type="tool_call",
                label=f"Action {i}: {step.get('tool')}",
                properties={"tool": step.get("tool"), "arguments": step.get("args")}
            )
            self.create_edge(
                graph_id=gid,
                source_node_id=previous_node_id,
                target_node_id=tool_id,
                edge_type="CALLS_TOOL"
            )

            obs_id = self.create_node(
                graph_id=gid,
                node_type="observation",
                label=f"Obs {i}: {str(step.get('observation', ''))[:80]}",
                properties={"raw_observation": str(step.get("observation", ""))}
            )
            self.create_edge(
                graph_id=gid,
                source_node_id=tool_id,
                target_node_id=obs_id,
                edge_type="PRODUCES_OUTPUT"
            )
            previous_node_id = obs_id

        # 4. Reflection & Revised Plan (if triggered)
        if trajectory.get("reflection"):
            refl_id = self.create_node(
                graph_id=gid,
                node_type="reflection",
                label=f"Reflection: {trajectory.get('reflection', '')[:80]}",
                properties={"reflection_text": trajectory.get("reflection", "")}
            )
            self.create_edge(
                graph_id=gid,
                source_node_id=previous_node_id,
                target_node_id=refl_id,
                edge_type="REFLECTS_ON"
            )
            previous_node_id = refl_id

            for j, r_step in enumerate(trajectory.get("revised_plan", []), 1):
                r_subgoal_id = self.create_node(
                    graph_id=gid,
                    node_type="revised_subgoal",
                    label=f"Revised Subgoal {j}: {r_step}",
                    properties={"step_index": j, "description": r_step}
                )
                self.create_edge(
                    graph_id=gid,
                    source_node_id=previous_node_id,
                    target_node_id=r_subgoal_id,
                    edge_type="REVISES_TO"
                )
                previous_node_id = r_subgoal_id

        # 5. Final Answer Node
        if trajectory.get("final_answer"):
            ans_id = self.create_node(
                graph_id=gid,
                node_type="answer",
                label=f"Answer: {trajectory.get('final_answer', '')[:80]}",
                properties={"answer_text": trajectory.get("final_answer", "")}
            )
            self.create_edge(
                graph_id=gid,
                source_node_id=previous_node_id,
                target_node_id=ans_id,
                edge_type="CONCLUDES"
            )

        return gid

    def render_workflow_markdown(self, graph_id: str) -> str:
        """Renders a workflow DAG into markdown for LLM in-context demonstration."""
        dag_steps = self.get_workflow_dag(graph_id)
        if not dag_steps:
            return "No workflow graph found."

        lines = [f"### Workflow Execution Graph (ID: {graph_id[:8]})"]
        for step in dag_steps:
            lvl = step.get("step_order", 1)
            indent = "  " * (lvl - 1)
            ntype = step.get("node_type", "step").upper()
            label = step.get("label", "")
            rel = step.get("edge_type", "")
            if rel and rel != "ROOT":
                lines.append(f"{indent}|-- [{rel}] --> [{ntype}] {label}")
            else:
                lines.append(f"{indent}* [{ntype}] {label}")

        return "\n".join(lines)
