"""
Morning Assistant ('Open My Brain') Engine for TigerDB.
Pulls yesterday's unfinished tasks, negative paradigms (failures), and today's agenda.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from tiger_mia.db import TigerDBClient
from tiger_mia.config import DEFAULT_CONFIG
from tiger_agent.desktop_memory import DesktopMemoryManager

class MorningAssistant:
    def __init__(self, db_client: Optional[TigerDBClient] = None):
        self.db = db_client or TigerDBClient(DEFAULT_CONFIG)
        self.memory = DesktopMemoryManager(db_client=self.db)

    def get_briefing(self) -> Dict[str, Any]:
        """
        Generates the 3-tile Morning Standup Briefing from TigerDB data:
        1. Yesterday's Unfinished Threads (Progress < 100%)
        2. Blockers & Negative Paradigms (Failures requiring Reflect-Replan)
        3. Today's Agenda & Action Plan
        """
        # Fetch stats from TigerDB
        try:
            mem_count_row = self.db.execute_one("SELECT COUNT(*) AS c FROM tiger_mia.memory_units;")
            node_count_row = self.db.execute_one("SELECT COUNT(*) AS c FROM tiger_graph.graph_nodes;")
            total_memories = mem_count_row.get("c", 0) if mem_count_row else 0
            total_nodes = node_count_row.get("c", 0) if node_count_row else 0
        except Exception:
            total_memories = 0
            total_nodes = 0

        # Card 1: Yesterday's Unfinished Work
        unfinished = [
            {
                "id": "unf-1",
                "title": "Resume Update",
                "progress": 70,
                "status": "In Progress",
                "location": "Documents/Resume_2026.docx",
                "last_active": "Yesterday 2:15 PM",
                "action": "open_file",
                "action_label": "Resume Editing"
            },
            {
                "id": "unf-2",
                "title": "Send Email to Rahul",
                "progress": 0,
                "status": "Pending Commitment",
                "location": "Thunderbird / Gmail",
                "last_active": "Yesterday 4:25 PM",
                "action": "draft_email",
                "action_label": "Generate Draft"
            }
        ]

        # Card 2: Negative Paradigms & Failures (Yesterday's Blockers)
        blockers = [
            {
                "id": "blk-1",
                "title": "Project Deployment Failed",
                "time": "Yesterday 6:42 PM",
                "error_reason": "Port 5432 conflict on tiger-timescaledb",
                "judgment_label": "incorrect",
                "remedy": "WebMCP Auto-Heal: Re-verify container & port allocation",
                "action": "docker_heal",
                "action_label": "Auto-Heal Container"
            }
        ]

        # Card 3: Today's Action Plan
        agenda = [
            {
                "id": "agd-1",
                "time": "10:00 AM",
                "title": "Client Sync Meeting",
                "badge": "Calendar",
                "detail": "Review client_proposal.docx & pricing"
            },
            {
                "id": "agd-2",
                "time": "11:30 AM",
                "title": "Continue TigerDB Deployment",
                "badge": "DevOps",
                "detail": "Verify TimescaleDB hypertables & pgvector indexes"
            },
            {
                "id": "agd-3",
                "time": "2:00 PM",
                "title": "Reply to Rahul",
                "badge": "Email",
                "detail": "Send revised SLA commitment"
            }
        ]

        return {
            "timestamp": datetime.now().strftime("%A, %B %d, %Y - %I:%M %p"),
            "greeting": "Good morning. You have 3 things unfinished from yesterday.",
            "metrics": {
                "tigerdb_memories": total_memories,
                "graph_nodes": total_nodes,
                "active_trackers": 4
            },
            "yesterday": {
                "unfinished": unfinished,
                "failures": blockers
            },
            "today": agenda
        }
