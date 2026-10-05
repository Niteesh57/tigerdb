"""
Desktop Memory Engine for TigerDB: Personal Timeline & Activity Metadata.
Powers the 'Where Did I Leave It?' agent using Vector + Property Graph retrieval.
"""
from typing import List, Dict, Any, Optional
import uuid
import json
from datetime import datetime, timedelta
from tiger_mia.config import TigerDBConfig, DEFAULT_CONFIG
from tiger_mia.db import TigerDBClient
from tiger_mia.graph_engine import TigerGraphEngine
from tiger_mia.memory_manager import Embedder

FALLBACK_ACTIVITIES = [
    {
        "id": "mem-seed-1",
        "title": "client_proposal.docx",
        "activity_type": "file_edit",
        "path_or_url": "Projects/client_proposal.docx",
        "time": "Yesterday 4:20 PM",
        "snippet": "Drafted Section 4: Enterprise SLA & Pricing tiers. Finalized 85% of budget table.",
        "promise": "Send revised pricing proposal to Rahul by Friday 5 PM.",
        "similarity": 0.94,
        "graph_id": "graph-proposal-01",
        "status": "resolved"
    },
    {
        "id": "mem-seed-2",
        "title": "Email to Rahul: Project Proposal & Pricing Review",
        "activity_type": "browser_tab",
        "path_or_url": "https://mail.google.com/mail/u/0/#inbox/FMfcgzQxv",
        "time": "Yesterday 4:25 PM",
        "snippet": "Rahul asked for updated terms on the enterprise database rollout.",
        "promise": "Follow up with revised attachment.",
        "similarity": 0.88,
        "graph_id": "graph-email-02",
        "status": "active"
    },
    {
        "id": "mem-seed-3",
        "title": "Resume_2026.docx",
        "activity_type": "file_edit",
        "path_or_url": "Documents/Resume_2026.docx",
        "time": "Yesterday 2:15 PM",
        "snippet": "Updated AI Architecture & Deep Research Agent leadership section. 70% completed.",
        "promise": None,
        "similarity": 0.82,
        "graph_id": "graph-resume-03",
        "status": "active"
    },
    {
        "id": "mem-seed-4",
        "title": "Docker compose deployment: tiger-timescaledb",
        "activity_type": "terminal",
        "path_or_url": "c:/Users/venka/TigerDB/docker-compose.yml",
        "time": "Yesterday 6:42 PM",
        "snippet": "Error: Bind for 0.0.0.0:5432 failed: port is already allocated. Container exited code 1.",
        "promise": None,
        "similarity": 0.79,
        "graph_id": "graph-docker-04",
        "status": "error"
    },
    {
        "id": "mem-seed-5",
        "title": "TimescaleDB HA PG18 Docker Port Configuration",
        "activity_type": "browser_tab",
        "path_or_url": "https://docs.timescale.com/self-hosted/latest/install/installation-docker/",
        "time": "Yesterday 6:50 PM",
        "snippet": "Guide on handling port conflicts with existing PostgreSQL local services.",
        "promise": None,
        "similarity": 0.76,
        "graph_id": "graph-timescale-05",
        "status": "resolved"
    }
]

class DesktopMemoryManager:
    def __init__(
        self,
        config: Optional[TigerDBConfig] = None,
        db_client: Optional[TigerDBClient] = None,
        graph_engine: Optional[TigerGraphEngine] = None
    ):
        self.config = config or DEFAULT_CONFIG
        self.db = db_client or TigerDBClient(self.config)
        self.graph_engine = graph_engine or TigerGraphEngine(self.db)
        self.embedder = Embedder(
            model_name=self.config.embedding_model_name,
            dim=self.config.embedding_dim,
            use_model=self.config.use_transformer_model
        )
        self._in_memory_records: List[Dict[str, Any]] = []

    def record_activity(
        self,
        title: str,
        activity_type: str,  # 'file_edit', 'browser_tab', 'terminal', 'promise'
        path_or_url: str,
        snippet: str,
        promise_text: Optional[str] = None,
        timestamp_str: Optional[str] = None,
        judgment_label: str = "correct"
    ) -> Dict[str, Any]:
        """
        Records a desktop activity into both tiger_graph (DAG) and tiger_mia.memory_units (Vector).
        Also stores in-memory so features work seamlessly when DB is offline.
        """
        graph_id = str(uuid.uuid4())
        time_display = timestamp_str or datetime.now().strftime("%Y-%m-%d %I:%M %p")

        # 1. Create Graph Nodes in TigerDB / in-memory graph
        act_node_id = self.graph_engine.create_node(
            graph_id=graph_id,
            node_type="desktop_activity",
            label=f"[{activity_type.upper()}] {title}",
            properties={
                "type": activity_type,
                "path_or_url": path_or_url,
                "time": time_display,
                "snippet": snippet
            }
        )

        item_node_id = self.graph_engine.create_node(
            graph_id=graph_id,
            node_type="resource",
            label=path_or_url,
            properties={"path": path_or_url, "snippet": snippet}
        )

        self.graph_engine.create_edge(
            graph_id=graph_id,
            source_node_id=act_node_id,
            target_node_id=item_node_id,
            edge_type="ACCESSED_RESOURCE"
        )

        if promise_text:
            promise_node_id = self.graph_engine.create_node(
                graph_id=graph_id,
                node_type="promise",
                label=f"Commitment: {promise_text}",
                properties={"promise": promise_text, "status": "pending"}
            )
            self.graph_engine.create_edge(
                graph_id=graph_id,
                source_node_id=act_node_id,
                target_node_id=promise_node_id,
                edge_type="COMMITTED_TO"
            )

        # 2. Store in-memory record for offline mode
        record_id = str(uuid.uuid4())
        in_memory_entry = {
            "id": record_id,
            "title": title,
            "activity_type": activity_type,
            "path_or_url": path_or_url,
            "time": time_display,
            "snippet": snippet,
            "promise": promise_text,
            "graph_id": graph_id,
            "status": "error" if judgment_label == "incorrect" else "resolved",
            "judgment_label": judgment_label
        }
        self._in_memory_records.insert(0, in_memory_entry)

        # 3. Store in tiger_mia.memory_units with Vector Embedding if DB is connected
        q_embed = self.embedder.encode(f"{title} {activity_type} {path_or_url} {snippet} {promise_text or ''}")
        workflow_summary = {
            "title": title,
            "activity_type": activity_type,
            "path_or_url": path_or_url,
            "time": time_display,
            "snippet": snippet,
            "promise": promise_text
        }

        insert_sql = """
            INSERT INTO tiger_mia.memory_units (
                modality, category, question, caption,
                question_embedding, trajectory_graph_id,
                compressed_workflow, judgment_label,
                execution_length, usage_count, success_count
            ) VALUES (
                'desktop_activity', %s, %s, %s,
                %s::vector, %s,
                %s::jsonb, %s,
                1, 1, 1
            ) RETURNING id;
        """

        res = self.db.execute_one(
            insert_sql,
            (
                activity_type,
                title,
                snippet,
                q_embed,
                graph_id,
                json.dumps(workflow_summary),
                judgment_label
            )
        )

        return {
            "memory_id": str(res["id"]) if (res and "id" in res) else record_id,
            "graph_id": graph_id,
            "title": title,
            "time": time_display
        }

    def search_timeline(self, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        """
        Searches desktop activities using pgvector cosine similarity,
        returning timeline cards and TigerDB graph references.
        Falls back to in-memory embedding similarity if DB is offline.
        """
        q_embed = self.embedder.encode(query)

        search_sql = """
            SELECT 
                id,
                question AS title,
                caption AS snippet,
                category AS activity_type,
                compressed_workflow,
                trajectory_graph_id,
                judgment_label,
                (0.7 * GREATEST(similarity(question, %s), similarity(COALESCE(caption, ''), %s)) + 
                 0.3 * (1 - (question_embedding <=> %s::vector))) AS composite_score,
                (1 - (question_embedding <=> %s::vector)) AS similarity
            FROM tiger_mia.memory_units
            WHERE modality = 'desktop_activity'
            ORDER BY composite_score DESC
            LIMIT %s;
        """

        rows = self.db.execute(search_sql, (query, query, q_embed, q_embed, top_k))
        if rows:
            results = []
            for r in rows:
                wf = r.get("compressed_workflow") or {}
                results.append({
                    "id": str(r.get("id")),
                    "title": wf.get("title", r.get("title")),
                    "activity_type": wf.get("activity_type", r.get("activity_type")),
                    "path_or_url": wf.get("path_or_url", ""),
                    "time": wf.get("time", "Yesterday 4:20 PM"),
                    "snippet": wf.get("snippet", r.get("snippet")),
                    "promise": wf.get("promise"),
                    "similarity": float(r.get("similarity", 0.0)),
                    "graph_id": str(r.get("trajectory_graph_id")) if r.get("trajectory_graph_id") else None,
                    "status": "error" if r.get("judgment_label") == "incorrect" else "resolved"
                })
            return results

        # In-memory search when DB is offline or returned no rows
        all_candidates = self._in_memory_records + FALLBACK_ACTIVITIES
        import numpy as np
        scored_candidates = []
        q_vec = np.array(q_embed, dtype=np.float32)

        for item in all_candidates:
            text = f"{item.get('title', '')} {item.get('snippet', '')} {item.get('promise', '')}"
            cand_embed = np.array(self.embedder.encode(text), dtype=np.float32)
            denom = (np.linalg.norm(q_vec) * np.linalg.norm(cand_embed))
            sim = float(np.dot(q_vec, cand_embed) / denom) if denom > 0 else 0.5
            
            # Boost score if query terms explicitly match in title or snippet
            query_terms = query.lower().split()
            if any(term in text.lower() for term in query_terms):
                sim = max(sim, 0.85)

            scored = dict(item)
            scored["similarity"] = round(sim, 3)
            scored_candidates.append(scored)

        scored_candidates.sort(key=lambda x: x["similarity"], reverse=True)
        return scored_candidates[:top_k]

    def get_all_timeline_events(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieves chronological timeline of recent desktop events."""
        sql = """
            SELECT 
                id,
                category AS activity_type,
                compressed_workflow,
                trajectory_graph_id,
                judgment_label,
                created_at
            FROM tiger_mia.memory_units
            WHERE modality = 'desktop_activity'
            ORDER BY created_at DESC
            LIMIT %s;
        """
        rows = self.db.execute(sql, (limit,))
        if rows:
            events = []
            for r in rows:
                wf = r.get("compressed_workflow") or {}
                events.append({
                    "id": str(r.get("id")),
                    "title": wf.get("title", "Desktop Activity"),
                    "activity_type": wf.get("activity_type", r.get("activity_type")),
                    "path_or_url": wf.get("path_or_url", ""),
                    "time": wf.get("time", "Yesterday"),
                    "snippet": wf.get("snippet", ""),
                    "promise": wf.get("promise"),
                    "graph_id": str(r.get("trajectory_graph_id")) if r.get("trajectory_graph_id") else None,
                    "status": "error" if r.get("judgment_label") == "incorrect" else "active"
                })
            return events

        # Fallback to in-memory + default activities if DB offline
        combined = self._in_memory_records + FALLBACK_ACTIVITIES
        return combined[:limit]
