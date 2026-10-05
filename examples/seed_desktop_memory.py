"""
Seed script: Populates TigerDB with realistic Desktop Memory activities & Negative Paradigms.
Covers both 'Where Did I Leave It?' and 'Open My Brain' scenarios.
"""
import sys
import os
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tiger_agent.desktop_memory import DesktopMemoryManager

def seed_data():
    print("🌱 Seeding Desktop Memory into TigerDB...")
    manager = DesktopMemoryManager()

    # 1. Client proposal document
    p1 = manager.record_activity(
        title="client_proposal.docx",
        activity_type="file_edit",
        path_or_url="Projects/client_proposal.docx",
        snippet="Drafted Section 4: Enterprise SLA & Pricing tiers. Finalized 85% of budget table.",
        promise_text="Send revised pricing proposal to Rahul by Friday 5 PM.",
        timestamp_str="Yesterday 4:20 PM",
        judgment_label="correct"
    )
    print(f"✓ Recorded: {p1['title']} (Graph ID: {p1['graph_id'][:8]})")

    # 2. Client email thread
    p2 = manager.record_activity(
        title="Email to Rahul: Project Proposal & Pricing Review",
        activity_type="browser_tab",
        path_or_url="https://mail.google.com/mail/u/0/#inbox/FMfcgzQxv",
        snippet="Rahul asked for updated terms on the enterprise database rollout.",
        promise_text="Follow up with revised attachment.",
        timestamp_str="Yesterday 4:25 PM",
        judgment_label="correct"
    )
    print(f"✓ Recorded: {p2['title']}")

    # 3. Resume update
    p3 = manager.record_activity(
        title="Resume_2026.docx",
        activity_type="file_edit",
        path_or_url="Documents/Resume_2026.docx",
        snippet="Updated AI Architecture & Deep Research Agent leadership section. 70% completed.",
        timestamp_str="Yesterday 2:15 PM",
        judgment_label="correct"
    )
    print(f"✓ Recorded: {p3['title']}")

    # 4. Failed Docker deployment (Negative Paradigm)
    p4 = manager.record_activity(
        title="Docker compose deployment: tiger-timescaledb",
        activity_type="terminal",
        path_or_url="c:/Users/venka/TigerDB/docker-compose.yml",
        snippet="Error: Bind for 0.0.0.0:5432 failed: port is already allocated. Container exited code 1.",
        timestamp_str="Yesterday 6:42 PM",
        judgment_label="incorrect"
    )
    print(f"✓ Recorded: {p4['title']} [Negative Paradigm]")

    # 5. TimescaleDB Documentation tab
    p5 = manager.record_activity(
        title="TimescaleDB HA PG18 Docker Port Configuration",
        activity_type="browser_tab",
        path_or_url="https://docs.timescale.com/self-hosted/latest/install/installation-docker/",
        snippet="Guide on handling port conflicts with existing PostgreSQL local services.",
        timestamp_str="Yesterday 6:50 PM",
        judgment_label="correct"
    )
    print(f"✓ Recorded: {p5['title']}")

    print("\n✅ Successfully seeded 5 desktop events into TigerDB Graph & Vector store!")

if __name__ == "__main__":
    seed_data()
