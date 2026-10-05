# 🧠 TigerDB Memory Inspector — Study & Demo Guide

> **How to study TigerDB's Vector + Graph + Non-parametric Memory + TimescaleDB system, and how to use every tab in the Live Inspector.**

---

## 📌 Quick Access

| Step | Action |
|:-----|:-------|
| 1 | Open `http://localhost:5173` |
| 2 | Click the **"View Memories"** pill in the top-right corner |
| 3 | The **Memory Architecture & Live Inspector** modal opens |
| 4 | Use the 5 tabs to explore and demo each layer |

---

## 🏗️ The 4-Layer Architecture (What You Are Studying)

```
┌────────────────────────────────────────────────────────────────┐
│                    TigerDB MIA Engine                          │
│                                                                │
│  Layer 1: pgvector 0.8.6 (Vector Engine)                       │
│    - 384-dim embeddings from all-MiniLM-L6-v2                  │
│    - HNSW index with cosine distance <=>                       │
│    - Query time: ~3ms for 28 memory units                      │
│                                                                │
│  Layer 2: tiger_graph (Property Graph)                         │
│    - Node types: question, subgoal, tool_call,                 │
│      observation, promise, resource, reflection, answer        │
│    - Edge types: DECOMPOSES_TO, CALLS_TOOL,                    │
│      PRODUCES_OUTPUT, COMMITTED_TO, ACCESSED_RESOURCE          │
│    - Queried via recursive CTE traversal                       │
│                                                                │
│  Layer 3: tiger_mia.memory_units (Non-parametric Memory)       │
│    - 28 units: correct & incorrect paradigms                   │
│    - Hybrid score: λ_s·Sim + λ_v·Val + λ_f·Freq               │
│    - Sorted by shortest execution length L                     │
│                                                                │
│  Layer 4: tiger_mia.trajectory_logs (TimescaleDB)              │
│    - GRPO rewards: r1 + r2 + r3 → Advantage A_i               │
│    - 7-Day partitioned hypertable chunks                       │
│    - 90.2% columnar compression                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ The 5 Inspector Tabs — How to Use Each One

---

### Tab 1 — 🕸️ Property Graph DAG

**What it shows:** A live execution trajectory pulled from PostgreSQL using recursive CTE traversal of `tiger_graph.graph_nodes` and `tiger_graph.graph_edges`.

**How to use:**
1. **Select a trajectory** from the dropdown.
2. Each colored box is a **graph node** with a type and a label.
3. Arrows show **directed edges** (e.g. `DECOMPOSES_TO`, `NEXT_STEP`).
4. **Click any node** → the right panel (Node Inspector) shows its type, ID, JSONB properties, and all connected edges.

**Node colors to remember:**

| Color | Node Type | Meaning |
|:------|:----------|:--------|
| 🟣 Indigo | `question` / `desktop_activity` | The user's question or desktop task |
| 🔵 Blue | `subgoal` / `revised_subgoal` | Plan steps decomposed by the Planner |
| 🟡 Amber | `tool_call` | A tool invocation (search, read_file, etc.) |
| 🟢 Green | `observation` | Output/result from a tool |
| 🩷 Pink | `promise` | A user commitment ("Promised Rahul by Friday") |
| 🟣 Purple | `resource` | A file path or URL accessed |
| 🔴 Red | `reflection` | Self-critique triggered during execution |

**Edge types to remember:**

| Edge | Meaning |
|:-----|:--------|
| `DECOMPOSES_TO` | Question → Subgoals |
| `CALLS_TOOL` | Subgoal → Tool Call |
| `PRODUCES_OUTPUT` | Tool Call → Observation |
| `NEXT_STEP` | Sequential step flow |
| `COMMITTED_TO` | Activity → Promise |
| `ACCESSED_RESOURCE` | Activity → File/URL |
| `REFLECTS_ON` | Subgoal → Reflection |

---

### Tab 2 — ⚡ Live Task Insertion Simulator *(Demo Live)*

**What it shows:** Real-time ingestion of a new desktop activity into TigerDB. Best for **live demos**.

**How to use:**
1. Click a **Quick Demo Preset** (e.g. "🐳 Kafka Docker Setup").
2. Or type your own task title, category, resource path, and optional promise.
3. Click **"🚀 Ingest Task into TigerDB Graph & Vector Engine"**.
4. The backend will:
   - Encode the title into a **384-dim vector** using the embedding model
   - Create 3 graph nodes: `desktop_activity`, `resource`, `promise`
   - Attach directed edges: `ACCESSED_RESOURCE`, `COMMITTED_TO`
   - The KPI bar updates with the new node count
5. Click **"View in Property Graph →"** to see the new DAG live.

**Demo script (30 seconds):**
> *"Right now I'll type a task I just did — 'Configured Kafka in Docker'. The system encodes this into a 384-dimensional vector, writes it to PostgreSQL, creates 3 graph nodes and 2 directed edges — all live. Click View in Property Graph and you see it immediately."*

---

### Tab 3 — 📐 Vector Engine & Equation 4 (MIA Retrieval)

**What it shows:** The **hybrid scoring algorithm** that retrieves memories for the agent before it answers.

**The Formula:**
```
Score(m_i) = λ_s · Sim_norm(q, m_i) + λ_v · Val_i + λ_f · Freq_i
```

| Variable | Meaning | Weight |
|:---------|:--------|:-------|
| `λ_s · Sim_norm` | Cosine similarity using pgvector `<=>` operator (HNSW index) | 0.50 |
| `λ_v · Val_i` | Value reward = success_count / (usage_count + 1) | 0.35 |
| `λ_f · Freq_i` | Frequency/recency reward | 0.15 |

**How to use:**
1. Type a query (e.g. `docker port error`) or click a **test query chip**.
2. Click **"Run MIA Hybrid Query"**.
3. **Left column** = Positive Paradigms `T_succ` — correct past workflows sorted by shortest execution length `L`.
4. **Right column** = Negative Paradigms `T_fail` — failed patterns the agent avoids.
5. Each card shows: `Sim`, `Val`, `Freq`, and the final **Eq. 4 Score**.
6. Click **"View Property Graph DAG →"** on any card to see its full execution trajectory.

**Demo script:**
> *"When a user asks about Docker, the system doesn't just do keyword search. It uses cosine similarity in pgvector — with HNSW indexing — combined with a value reward based on past success rate and a frequency score. The result is a ranked list of correct workflows to follow, and failed workflows to avoid."*

---

### Tab 4 — 💾 Memory Units Table

**What it shows:** All 28 non-parametric memory units stored in `tiger_mia.memory_units`.

**How to use:**
1. Use the **filter chips** to filter by category (`desktop_activity`, `physics`, `ai_research`) or by label (`correct` / `incorrect`).
2. Use the **search box** to find specific memories by keyword.
3. The table columns:
   - **Modality / Category** — type of knowledge
   - **Question / Activity** — the stored task label
   - **Paradigm Label** — `✓ Correct` or `✕ Incorrect`
   - **Steps (L)** — execution length (shorter = better positive paradigm)
   - **Usage (u)** — how many times it was retrieved
   - **Success (s)** — how many times retrieval led to success
4. Click **"Inspect"** to jump to the DAG or see the workflow summary.

---

### Tab 5 — ⏱️ TimescaleDB Hypertables

**What it shows:** GRPO reinforcement learning telemetry stored in `tiger_mia.trajectory_logs`.

**Column meanings:**

| Column | Meaning |
|:-------|:--------|
| `Timestamp` | When the trajectory was executed |
| `Question / Trajectory` | What task was run |
| `Category` | `physics`, `ai_research`, `desktop_activity`, etc. |
| `Steps` | How many tool/reasoning steps the agent took |
| `Correctness r1` | +1.0 if answer was correct, 0 otherwise |
| `Tool Efficiency r2` | +1.0 if tools were used optimally |
| `Format r3` | +1.0 if output format was correct |
| `GRPO Advantage A_i` | `total_reward - baseline` (used for policy gradient) |

**Key facts to say in demo:**
- **7-day partitioned hypertable** (auto-creates new chunks each week)
- **90.2% columnar compression** via TimescaleDB native compression
- **Continuous aggregates** = pre-computed hourly rollups (no full table scan)
- The GRPO Advantage `A_i` tells the LLM policy which trajectory was relatively better

---

## 🧪 Running the Backend & Verifying APIs

```bash
# 1. Start the database (TimescaleDB + pgvector)
docker compose up -d

# 2. Start the FastAPI backend
python -m uvicorn tiger_agent.api:app --host 0.0.0.0 --port 8000

# 3. Start the React frontend
cd frontend && npm run dev
```

**Test APIs directly:**
```bash
# Check all stats (nodes, edges, memory units, hypertable count)
curl http://localhost:8000/api/memory/overview

# Run Equation 4 hybrid retrieval
curl -X POST http://localhost:8000/api/memory/mia-search \
  -H "Content-Type: application/json" \
  -d '{"query": "docker port error", "top_k": 3}'

# Get a specific graph trajectory DAG
curl http://localhost:8000/api/graph/<graph_id_here>

# Run all tests
python -m pytest tests/ -v
```

---

## 🔑 Key Numbers to Remember for Demo

| Metric | Value |
|:-------|:------|
| Property Graph Nodes | **468+** (grows with each task) |
| Directed Graph Edges | **404+** |
| Non-Parametric Memory Units | **28** (correct + incorrect paradigms) |
| Trajectory Log Entries | **15** |
| Vector Embedding Dimensions | **384-dim** (all-MiniLM-L6-v2) |
| pgvector Index Type | **HNSW** (cosine distance `<=>`) |
| TimescaleDB Chunk Size | **7 days** |
| Columnar Compression Ratio | **90.2%** |
| Test Suite | **11/11 passing** |

---

## 📖 Plain-Language Concept Cards

### What is a Non-Parametric Memory?
Unlike LLM weights (parametric), non-parametric memory stores **actual task records in a database**. The agent retrieves them at query time, **without retraining the model**. You can add/remove memories instantly.

### What is GRPO?
Group Relative Policy Optimization. The agent generates **multiple trajectories** for the same question, compares their rewards, and updates its policy toward better ones. The advantage `A_i = reward - baseline` tells the agent which trajectory was relatively better.

### Why use both Vector + Graph?
- **Vector search** finds *semantically similar* past tasks quickly using cosine distance.
- **Property graph** stores *how* the task was executed — step by step, with tools, observations, and promises.
- Together: the agent knows "what worked before" AND "how to do it again".

### What is a TimescaleDB Hypertable?
A PostgreSQL table that **automatically partitions data by time**. Old partitions are compressed and can be archived. Continuous aggregates pre-compute analytics so dashboards don't need to scan all rows every time.

### What is Equation 4 doing exactly?
It ranks all stored memories for a given query using 3 signals:
1. **Semantic match** — how similar is the past task to the current question?
2. **Value / success rate** — how often did this memory lead to a correct answer?
3. **Frequency** — how often has this memory been useful?

Then it returns the top-K **positive paradigms** (workflows to follow) and top-K **negative paradigms** (failure modes to avoid).
