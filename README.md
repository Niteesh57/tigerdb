# TigerDB: Unified Graph & Vector Database for Memory Intelligence Agent (MIA)

Implementation of the **Memory Intelligence Agent (MIA)** framework ([arXiv:2604.04503v4](https://arxiv.org/abs/2604.04503)) on **TigerDB** (PostgreSQL 18 + TimescaleDB HA + `pgvector` + Property Graph Model).

---

## 🌟 Overview

MIA is an architecture designed for Deep Research Agents (DRAs) that enables lifelong memory evolution through a **Manager-Planner-Executor** architecture:

1. **Vector Engine (`pgvector`)**:
   - Multimodal embeddings for questions and image captions.
   - HNSW indexing (`vector_cosine_ops`) for sub-millisecond similarity search.
   - Hybrid retrieval scoring:
     $$\text{Score}(m_i) = \lambda_s \widehat{\text{Sim}}_i + \lambda_v \frac{s_i}{u_i+1} + \lambda_f \frac{1}{u_i+1}$$
2. **Graph Engine (`tiger_graph`)**:
   - Property Graph Schema (`graph_nodes` & `graph_edges`) modeling trajectory DAGs.
   - Topological workflow extraction using recursive CTEs (`tiger_graph.get_workflow_dag`).
   - Prioritizes shortest successful execution paths ($\tau_{succ}^* = \arg\min \text{length}(\tau)$).
3. **Time-Series Engine (`timescaledb`)**:
   - Partitioned hypertable (`tiger_mia.trajectory_logs`) tracking test-time learning evolution, rewards, and advantage drift over time.
4. **Three-Tier Agent Runtime (`tiger_mia`)**:
   - **Memory Manager**: Non-parametric memory store, hybrid retrieval, knowledge replacement threshold ($\theta=0.92$), and workflow compression.
   - **Planner**: Few-shot in-context learning with Positive & Negative Paradigms, plus single-trigger **Reflect-Replan** mechanism.
   - **Executor**: ReAct loop tool interactions logging execution graphs into TigerDB.
   - **Judger**: Evaluates correctness, computes composite rewards (Eq. 2 & Eq. 4), and GRPO relative advantages.

---

## 🏗️ Architecture

```
                    User Query / Multimodal Input
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │   TigerPlanner          │
                     │   (Cognitive Hub)       │
                     └────────────┬────────────┘
                                  │
          Hybrid Retrieval        │   Positive / Negative Paradigms
          (Sim + Val + Freq)      │   (Shortest paths & pitfalls)
                                  ▼
      ┌────────────────────────────────────────────────────────┐
      │               TigerDB (Unified Storage)                │
      │                                                        │
      │  ┌──────────────────┐  ┌────────────────────────────┐  │
      │  │  pgvector (HNSW) │  │  Property Graph Engine     │  │
      │  │  Vector Search   │  │  Nodes, Edges, Trajectory  │  │
      │  └──────────────────┘  └────────────────────────────┘  │
      │  ┌──────────────────┐  ┌────────────────────────────┐  │
      │  │  Memory Units    │  │  TimescaleDB Hypertable    │  │
      │  │  Upsert & Prune  │  │  Trajectory Telemetry Logs │  │
      │  └──────────────────┘  └────────────────────────────┘  │
      └───────────────────────────┬────────────────────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │   TigerExecutor         │
                     │   (Operational Terminal)│
                     └────────────┬────────────┘
                                  │
                           Tool Execution
                      (Search, DB, Calc, Entity)
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │   TigerJudger           │
                     │   (Rewards & Feedback)  │
                     └────────────┬────────────┘
                                  │ (If failure: Reflect-Replan)
                                  ▼
                     ┌─────────────────────────┐
                     │   Consolidate Experience│
                     │   (Knowledge Replace)   │
                     └─────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Launch TigerDB

```bash
docker compose up -d
```

This automatically initializes:

- `pgvector`
- `tiger_graph` (Property graph schema)
- `tiger_mia` (Memory units & TimescaleDB hypertable)
- Stored procedures: `tiger_mia.hybrid_memory_retrieve`, `tiger_graph.get_workflow_dag`, `tiger_mia.upsert_memory_unit`

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Tests

```bash
pytest tests/ -v
```

### 4. Run Demonstration

```bash
python examples/run_mia_deep_research.py
```

---

## 📊 Database Schema Details

- **`tiger_graph.graph_nodes`**: `id (UUID)`, `graph_id (UUID)`, `node_type`, `label`, `properties (JSONB)`, `embedding (vector(384))`.
- **`tiger_graph.graph_edges`**: `id (UUID)`, `graph_id (UUID)`, `source_node_id`, `target_node_id`, `edge_type`, `weight`, `properties (JSONB)`.
- **`tiger_mia.memory_units`**: `id (UUID)`, `question`, `caption`, `question_embedding (vector(384))`, `caption_embedding (vector(384))`, `compressed_workflow (JSONB)`, `judgment_label ('correct'/'incorrect')`, `execution_length (INT)`, `usage_count (INT)`, `success_count (INT)`.
- **`tiger_mia.trajectory_logs`**: TimescaleDB hypertable partitioned by `time (TIMESTAMPTZ)` storing trajectory telemetry, rewards, and advantages.
