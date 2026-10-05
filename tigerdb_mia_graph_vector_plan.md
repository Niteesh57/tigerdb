# Implementation Plan: Implementing Memory Intelligence Agent (MIA) as a Graph & Vector DB in TigerDB

**Document Reference**: [arXiv:2604.04503v4 - Memory Intelligence Agent (MIA)](https://arxiv.org/abs/2604.04503)  
**Target Environment**: TigerDB (PostgreSQL 18 + TimescaleDB HA + pgvector 0.8.6 + pgAdmin 4)

---

## Goal Description

The objective is to implement the **Memory Intelligence Agent (MIA)** framework (arXiv:2604.04503v4) within **TigerDB**. TigerDB currently runs `timescale/timescaledb-ha:pg18` with PostgreSQL 18 and TimescaleDB. To fully support MIA, TigerDB will be converted into a **unified Graph and Vector Database engine** capable of powering Deep Research Agents (DRAs).

In MIA, deep research agents require:
1. **Vector Capabilities**: Semantic retrieval over multimodal questions and image captions using cosine similarity, normalized embeddings, and HNSW indexing.
2. **Graph Capabilities**: Execution trajectories and research plans are directed acyclic graphs (DAGs) of thoughts, sub-goals, tool calls, observations, reflections, and multi-hop entity relationships. The system must support graph storage, recursive traversal, shortest successful execution path calculation ($\tau_{succ}^* = \arg\min \text{length}(\tau)$), and subgraph extraction.
3. **Time-Series / Evolution Capabilities**: Tracking agent trajectory rollouts, reward advantages, and memory usage drift over time via TimescaleDB hypertables.
4. **MIA Three-Tier Architecture (Manager - Planner - Executor)**:
   - **Memory Manager (Non-parametric Memory)**: Hybrid scoring combining semantic similarity ($\widehat{Sim}_i$), value reward ($Val_i = \frac{s_i}{u_i+1}$), and frequency reward ($Freq_i = \frac{1}{u_i+1}$); dual positive/negative paradigm extraction; structured workflow compression; knowledge replacement.
   - **Planner (Cognitive Hub)**: Few-shot in-context planning conditioned on retrieved memory graphs; Reflect-Replan mechanism on tool failure.
   - **Executor (Operational Terminal)**: ReAct loop tool interactions guided by Planner sub-goals.

```mermaid
flowchart TB
    subgraph TigerDB["TigerDB (Unified Multi-Model Engine)"]
        direction TB
        subgraph VectorEngine["Vector Engine (pgvector 0.8.6)"]
            V1["HNSW Indexes"]
            V2["Question & Caption Embeddings"]
            V3["Cosine Similarity & Normalization"]
        end
        subgraph GraphEngine["Graph Engine (Property Graph Model)"]
            G1["graph_nodes (Questions, Sub-goals, Tool Calls, Observations)"]
            G2["graph_edges (DEPENDS_ON, CALLS_TOOL, REFLECTS_TO)"]
            G3["Recursive CTEs / Path Extraction"]
        end
        subgraph TimeSeriesEngine["Time-Series Engine (TimescaleDB)"]
            T1["Hypertables: agent_trajectories & telemetry"]
            T2["Continuous Aggregates for Success & Usage Drift"]
        end
        subgraph MemoryEngine["MIA Memory Manager (Core Storage)"]
            M1["memory_units: Positive & Negative Paradigms"]
            M2["Hybrid Scoring: Sim(0.7) + Val(0.3) + Freq(0.3)"]
            M3["Threshold Knowledge Replacement"]
        end
    end

    subgraph MIARuntime["MIA Agent Runtime (Manager-Planner-Executor)"]
        direction TB
        Planner["Planner (Cognitive Hub)\nFew-shot Planning + Reflect-Replan"]
        Executor["Executor (Operational Terminal)\nReAct Loop + Tool Invocations"]
        Judger["LLM Judger\nCorrectness, Rewards & Value Updates"]
    end

    UserQuery["User Query / Multimodal Input"] --> Planner
    Planner -->|Hybrid Retrieval| MemoryEngine
    MemoryEngine -->|Positive & Negative Paradigms| Planner
    Planner -->|Initial Plan P_init| Executor
    Executor -->|Tool Calls & Observations| GraphEngine
    Executor -->|Candidate Answer & Trajectory| Judger
    Judger -->|Failure Detected| Planner
    Planner -.->|Revised Plan P_supp (Reflect-Replan)| Executor
    Judger -->|Consolidate Experience| MemoryEngine
    Judger -->|Log Telemetry & Rewards| TimeSeriesEngine
```

---

## User Review Required

> [!IMPORTANT]
> **PostgreSQL 18 Native Property Graph vs. External C Extensions**:  
> In PostgreSQL 18, experimental extensions like Apache AGE are not compatible due to PG18 catalog and executor ABI shifts. Instead, TigerDB will implement a **high-performance Native Property Graph engine** directly inside PostgreSQL 18 using relational adjacency tables (`graph_nodes`, `graph_edges`), recursive CTEs (`WITH RECURSIVE`), and GIN/BTree indexes. This guarantees 100% stability, zero external compiler dependencies, native ACID transactions, and zero-copy joins between vector similarity search and graph traversal in a single SQL query.

> [!NOTE]
> **Vector Dimension & Embedding Model**:  
> Following the MIA paper (Section 10), embeddings are computed using sentence encoders (e.g., `sup-simcse-bert-base-uncased` with 768 dimensions, or modern lightweight encoders like `all-MiniLM-L6-v2` with 384 dimensions, or OpenAI/Google embeddings with 1536 dimensions). The schema will default to `vector(384)` or `vector(768)` (configurable via SQL parameter).

---

## Open Questions

> [!NOTE]
> 1. **Default Embedding Dimension**: Do you prefer 384-dim (lightweight, runs fast locally on CPU/GPU via sentence-transformers), 768-dim (as cited in the paper's SimCSE setup), or 1536-dim (OpenAI/Gemini vector standard)? *(We recommend 384 or 768 for local research)*.
> 2. **Embedding Generation**: Should the database use an external Python service for embedding generation, or would you like `pgai` / `timescale-vector` worker support enabled in Docker? *(We propose a clean Python service + SQL triggers/functions)*.

---

## Proposed Changes

The changes will be organized into 4 layers:
1. **Database Schema & DDL (`init-tigerdb.sql`)**: PostgreSQL 18 initialization with `pgvector`, Graph tables, Memory Units table, TimescaleDB hypertables, and stored procedures for MIA hybrid scoring.
2. **Docker Orchestration (`docker-compose.yml`)**: Mounting initialization scripts and configuring persistent volumes and healthchecks.
3. **MIA Python Engine (`tiger_mia/`)**: Complete client and agent library implementing the Manager-Planner-Executor architecture.
4. **Validation & Demonstration Suite (`tests/` & `examples/`)**: Automated verification of vector search, graph traversal, and an end-to-end deep research agent run.

---

### Component 1: Database Architecture & DDL (TigerDB)

#### [NEW] `init-tigerdb.sql`

```sql
-- 1. Enable Required PostgreSQL & TimescaleDB Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Schema Namespaces
CREATE SCHEMA IF NOT EXISTS tiger_graph;
CREATE SCHEMA IF NOT EXISTS tiger_mia;

-- =========================================================================
-- GRAPH ENGINE: Property Graph Schema for Execution DAGs & Knowledge Graphs
-- =========================================================================

CREATE TABLE tiger_graph.graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    graph_id UUID NOT NULL,                        -- Groups nodes by trajectory / graph instance
    node_type VARCHAR(50) NOT NULL,               -- 'question', 'plan_step', 'tool_call', 'observation', 'reflection', 'entity', 'answer'
    label TEXT NOT NULL,                          -- Human-readable step or entity name
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,-- Structured data (arguments, raw outputs, status)
    embedding vector(384),                        -- Vector embedding of step/entity content
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_graph_nodes_graph_id ON tiger_graph.graph_nodes(graph_id);
CREATE INDEX idx_graph_nodes_type ON tiger_graph.graph_nodes(node_type);
CREATE INDEX idx_graph_nodes_props ON tiger_graph.graph_nodes USING gin(properties);
CREATE INDEX idx_graph_nodes_embedding ON tiger_graph.graph_nodes 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE tiger_graph.graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    graph_id UUID NOT NULL,
    source_node_id UUID NOT NULL REFERENCES tiger_graph.graph_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES tiger_graph.graph_nodes(id) ON DELETE CASCADE,
    edge_type VARCHAR(50) NOT NULL,               -- 'DECOMPOSES_INTO', 'CALLS_TOOL', 'PRODUCES_OUTPUT', 'REFLECTS_ON', 'REVISES_TO', 'NEXT_STEP'
    weight FLOAT NOT NULL DEFAULT 1.0,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_graph_edges_graph_id ON tiger_graph.graph_edges(graph_id);
CREATE INDEX idx_graph_edges_source ON tiger_graph.graph_edges(source_node_id, edge_type);
CREATE INDEX idx_graph_edges_target ON tiger_graph.graph_edges(target_node_id, edge_type);
CREATE INDEX idx_graph_edges_props ON tiger_graph.graph_edges USING gin(properties);

-- =========================================================================
-- MIA MEMORY MANAGER: Non-parametric Memory Units
-- =========================================================================

CREATE TABLE tiger_mia.memory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modality VARCHAR(30) NOT NULL DEFAULT 'text', -- 'text', 'multimodal'
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    question TEXT NOT NULL,
    caption TEXT,                                 -- Image caption if multimodal
    question_embedding vector(384) NOT NULL,
    caption_embedding vector(384),
    trajectory_graph_id UUID,                     -- Reference to tiger_graph DAG
    compressed_workflow JSONB NOT NULL,          -- Compact sequential/DAG workflow summary
    judgment_label VARCHAR(20) NOT NULL,          -- 'correct' (Positive Paradigm), 'incorrect' (Negative Paradigm)
    execution_length INT NOT NULL DEFAULT 1,     -- Number of steps in trajectory (for shortest path selection)
    usage_count INT NOT NULL DEFAULT 0,          -- u_i
    success_count INT NOT NULL DEFAULT 0,        -- s_i
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memory_units_q_embed ON tiger_mia.memory_units 
    USING hnsw (question_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_memory_units_c_embed ON tiger_mia.memory_units 
    USING hnsw (caption_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_memory_units_label ON tiger_mia.memory_units(judgment_label);
CREATE INDEX idx_memory_units_category ON tiger_mia.memory_units(category, modality);

-- =========================================================================
-- TIMESCALEDB HYPERTABLE: Trajectory Logging & Test-Time Learning Evolution
-- =========================================================================

CREATE TABLE tiger_mia.trajectory_logs (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trajectory_id UUID NOT NULL,
    session_id UUID NOT NULL,
    question TEXT NOT NULL,
    is_multimodal BOOLEAN DEFAULT FALSE,
    plan TEXT NOT NULL,
    reflection_triggered BOOLEAN DEFAULT FALSE,
    revised_plan TEXT,
    total_steps INT NOT NULL,
    correctness_reward FLOAT NOT NULL,           -- r1
    tool_reward FLOAT NOT NULL,                  -- r2
    format_reward FLOAT NOT NULL,                -- r3
    total_reward FLOAT NOT NULL,                 -- Composite reward
    advantage FLOAT,                             -- GRPO advantage
    metadata JSONB DEFAULT '{}'::jsonb
);

SELECT create_hypertable('tiger_mia.trajectory_logs', 'time', if_not_exists => TRUE);
CREATE INDEX idx_trajectory_logs_session ON tiger_mia.trajectory_logs(session_id, time DESC);

-- =========================================================================
-- STORED PROCEDURES: MIA Hybrid Retrieval Scoring Function (Eq 4 & Section 10)
-- =========================================================================

CREATE OR REPLACE FUNCTION tiger_mia.hybrid_memory_retrieve(
    p_query_embed vector(384),
    p_caption_embed vector(384) DEFAULT NULL,
    p_alpha_q FLOAT DEFAULT 0.8,
    p_alpha_c FLOAT DEFAULT 0.2,
    p_lambda_s FLOAT DEFAULT 0.7,
    p_lambda_v FLOAT DEFAULT 0.3,
    p_lambda_f FLOAT DEFAULT 0.3,
    p_top_k INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    question TEXT,
    caption TEXT,
    judgment_label VARCHAR(20),
    compressed_workflow JSONB,
    trajectory_graph_id UUID,
    raw_similarity FLOAT,
    norm_similarity FLOAT,
    value_reward FLOAT,
    frequency_reward FLOAT,
    final_score FLOAT
) AS $$
DECLARE
    v_min_sim FLOAT;
    v_max_sim FLOAT;
BEGIN
    -- Temporary table for bucketed candidate scores
    CREATE TEMP TABLE tmp_candidates ON COMMIT DROP AS
    SELECT 
        m.id,
        m.question,
        m.caption,
        m.judgment_label,
        m.compressed_workflow,
        m.trajectory_graph_id,
        m.usage_count,
        m.success_count,
        CASE 
            WHEN p_caption_embed IS NOT NULL AND m.caption_embedding IS NOT NULL THEN
                (p_alpha_q * (1 - (m.question_embedding <=> p_query_embed))) +
                (p_alpha_c * (1 - (m.caption_embedding <=> p_caption_embed)))
            ELSE
                (1 - (m.question_embedding <=> p_query_embed))
        END AS sim_raw,
        -- Value Reward: Val_i = s_i / (u_i + 1)
        (m.success_count::FLOAT / (m.usage_count + 1)) AS val_reward,
        -- Frequency Reward: Freq_i = 1 / (u_i + 1)
        (1.0 / (m.usage_count + 1)) AS freq_reward
    FROM tiger_mia.memory_units m;

    -- Calculate min and max similarity for min-max normalization
    SELECT MIN(sim_raw), MAX(sim_raw) INTO v_min_sim, v_max_sim FROM tmp_candidates;

    RETURN QUERY
    SELECT 
        c.id,
        c.question,
        c.caption,
        c.judgment_label,
        c.compressed_workflow,
        c.trajectory_graph_id,
        c.sim_raw,
        -- Min-Max Normalization: (Sim - min) / (max - min + 1e-8)
        CASE 
            WHEN v_max_sim IS NULL OR v_max_sim = v_min_sim THEN 1.0
            ELSE (c.sim_raw - v_min_sim) / (v_max_sim - v_min_sim + 1e-8)
        END AS norm_sim,
        c.val_reward,
        c.freq_reward,
        -- Final Hybrid Score: lambda_s * Sim_norm + lambda_v * Val + lambda_f * Freq
        (p_lambda_s * (CASE WHEN v_max_sim = v_min_sim THEN 1.0 ELSE (c.sim_raw - v_min_sim) / (v_max_sim - v_min_sim + 1e-8) END) +
         p_lambda_v * c.val_reward +
         p_lambda_f * c.freq_reward) AS score
    FROM tmp_candidates c
    ORDER BY score DESC
    LIMIT p_top_k;
END;
$$ LANGUAGE plpgsql;

-- Recursive CTE Function to Traverse Execution Graph
CREATE OR REPLACE FUNCTION tiger_graph.get_workflow_dag(p_graph_id UUID)
RETURNS TABLE (
    step_order INT,
    node_id UUID,
    node_type VARCHAR(50),
    label TEXT,
    properties JSONB,
    parent_node_id UUID,
    edge_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE workflow_tree AS (
        -- Anchor member: root nodes (nodes without incoming edges in this graph)
        SELECT 
            1 AS step_lvl,
            n.id AS current_id,
            n.node_type,
            n.label,
            n.properties,
            NULL::UUID AS parent_id,
            'ROOT'::VARCHAR(50) AS rel_type,
            ARRAY[n.id] AS path
        FROM tiger_graph.graph_nodes n
        WHERE n.graph_id = p_graph_id
          AND NOT EXISTS (
              SELECT 1 FROM tiger_graph.graph_edges e 
              WHERE e.target_node_id = n.id AND e.graph_id = p_graph_id
          )
        
        UNION ALL
        
        -- Recursive member: traverse outgoing edges
        SELECT 
            wt.step_lvl + 1,
            next_node.id,
            next_node.node_type,
            next_node.label,
            next_node.properties,
            wt.current_id,
            e.edge_type,
            wt.path || next_node.id
        FROM workflow_tree wt
        JOIN tiger_graph.graph_edges e ON e.source_node_id = wt.current_id AND e.graph_id = p_graph_id
        JOIN tiger_graph.graph_nodes next_node ON next_node.id = e.target_node_id
        WHERE NOT (next_node.id = ANY(wt.path)) -- Cycle prevention
    )
    SELECT 
        wt.step_lvl,
        wt.current_id,
        wt.node_type,
        wt.label,
        wt.properties,
        wt.parent_id,
        wt.rel_type
    FROM workflow_tree wt
    ORDER BY wt.step_lvl ASC;
END;
$$ LANGUAGE plpgsql;
```

---

### Component 2: Docker Environment Configuration

#### [MODIFY] `docker-compose.yml`
Update `docker-compose.yml` to automatically mount `init-tigerdb.sql` into `/docker-entrypoint-initdb.d/init.sql` so that every time TigerDB spins up or resets, all extensions, schemas, graph tables, vector indexes, and stored procedures are initialized out of the box.

```yaml
version: '3.8'

services:
  timescaledb:
    image: timescale/timescaledb-ha:pg18
    container_name: tiger-timescaledb
    restart: always
    user: root
    ports:
      - "5432:5432"
    environment:
      - PGDATA=/pgdata/data
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=postgres
    volumes:
      - tiger_data:/pgdata
      - ./init-tigerdb.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: tiger-pgadmin
    restart: always
    ports:
      - "8080:80"
    environment:
      - PGADMIN_DEFAULT_EMAIL=admin@example.com
      - PGADMIN_DEFAULT_PASSWORD=password
    depends_on:
      timescaledb:
        condition: service_healthy

volumes:
  tiger_data:
```

---

### Component 3: MIA Python Engine (`tiger_mia/`)

Create an idiomatic, modular Python implementation of the Memory Intelligence Agent that directly connects to TigerDB:

```
tiger_mia/
├── __init__.py
├── config.py             # DB connection, weights (alpha_q=0.8, lambda_s=0.7, etc.), models
├── db.py                 # Async/Sync connection pool & pgvector serialization
├── graph_engine.py       # Graph DAG builder, trajectory-to-graph serializer, recursive explorer
├── memory_manager.py     # Non-parametric memory manager: hybrid retrieval, positive/negative extraction
├── planner.py            # Planner agent: task decomposition, in-context memory prompting, reflect-replan
├── executor.py           # Executor agent: tool calling, ReAct trajectory execution
├── judger.py             # Judger & reward evaluator (Eq 2 & Eq 4)
└── agent.py              # End-to-end MIA Agent Loop orchestrator
```

#### Key Capabilities in Python Engine:
1. **`tiger_mia/graph_engine.py`**:
   - Converts raw ReAct steps (Thought -> Tool Call -> Observation -> Reflection -> Answer) into node and edge records in `tiger_graph.graph_nodes` and `tiger_graph.graph_edges`.
   - Generates vector embeddings for each key reasoning pivot.
   - Extracts complete subgraphs for Planner context using `tiger_graph.get_workflow_dag()`.
2. **`tiger_mia/memory_manager.py`**:
   - Implements **Positive Paradigm Extraction**: When a set of rollouts succeed, selects $\tau_{succ}^* = \arg\min \text{length}(\tau)$ to enforce reasoning efficiency.
   - Implements **Negative Paradigm Extraction**: When rollouts fail, samples $\tau_{fail}^*$ to expose error patterns and pitfalls.
   - Calls `tiger_mia.hybrid_memory_retrieve` in TigerDB with cosine distance on query and caption.
   - Implements **Knowledge Replacement**: Computes similarity with existing memories; if $\cos(\mathbf{e}_q, \mathbf{e}_{existing}) > 0.92$, merges and updates counts instead of creating duplicates.
3. **`tiger_mia/planner.py` & `executor.py`**:
   - Planner accepts retrieved positive paradigms as few-shot demonstration and negative paradigms as constraints to avoid.
   - Generates structured sub-goal plan.
   - Executor executes tools (Web search, DB query, Python calculation, API tools).
   - If execution fails or judger returns incorrect, Planner triggers **Reflect-Replan** (once per query, per paper specifications) to provide a revised plan.

---

### Component 4: Verification & Test Suite

#### [NEW] `tests/test_vector_engine.py`
- Connects to TigerDB via PostgreSQL client.
- Confirms `vector` extension is active.
- Inserts test vectors and validates cosine distance operator `<=>` and HNSW index performance.

#### [NEW] `tests/test_graph_engine.py`
- Creates a 6-step reasoning trajectory graph (Question -> Plan -> Tool Call -> Observation -> Reflection -> Answer).
- Runs `get_workflow_dag(graph_id)` and verifies exact topological step reconstruction.

#### [NEW] `tests/test_mia_retrieval.py`
- Populates `memory_units` with positive and negative paradigms.
- Tests `hybrid_memory_retrieve` to ensure $\lambda_s \widehat{Sim}_i + \lambda_v Val_i + \lambda_f Freq_i$ matches the paper's expected ranking.

#### [NEW] `examples/run_mia_deep_research.py`
- End-to-end multi-hop research question (e.g. HotpotQA style).
- Demonstrates Planner -> Executor -> Reflection -> Memory Consolidation -> TigerDB storage.

---

## Verification Plan

### Automated Tests
1. **Database Schema Verification**:
   ```bash
   docker exec -i tiger-timescaledb psql -U postgres -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'timescaledb');"
   docker exec -i tiger-timescaledb psql -U postgres -c "\dt tiger_graph.*"
   docker exec -i tiger-timescaledb psql -U postgres -c "\dt tiger_mia.*"
   ```
2. **Pytest Suite**:
   ```bash
   pip install asyncpg psycopg[binary] pgvector sentence-transformers pytest
   pytest tests/ -v
   ```

### Manual Verification
1. Open pgAdmin 4 at `http://localhost:8080` (admin@example.com / password).
2. Connect to `tiger-timescaledb:5432` with user `postgres` and password `password`.
3. Visually inspect `tiger_graph.graph_nodes`, `tiger_graph.graph_edges`, and `tiger_mia.memory_units`.
4. Run `examples/run_mia_deep_research.py` and inspect newly added execution DAGs and trajectory logs in TimescaleDB.
