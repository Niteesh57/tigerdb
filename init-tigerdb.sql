-- =========================================================================
-- TigerDB: Unified Graph & Vector Database for Memory Intelligence Agent (MIA)
-- Based on arXiv:2604.04503v4
-- =========================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create Schema Namespaces
CREATE SCHEMA IF NOT EXISTS tiger_graph;
CREATE SCHEMA IF NOT EXISTS tiger_mia;

-- =========================================================================
-- GRAPH ENGINE: Property Graph Schema for Workflows & Trajectory DAGs
-- =========================================================================

CREATE TABLE IF NOT EXISTS tiger_graph.graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    graph_id UUID NOT NULL,                        -- Identifies trajectory / execution graph
    node_type VARCHAR(50) NOT NULL,               -- 'question', 'subgoal', 'tool_call', 'observation', 'reflection', 'entity', 'answer'
    label TEXT NOT NULL,                          -- Step description or entity title
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,-- Tool arguments, raw observation data, metrics
    embedding vector(384),                        -- Vector embedding of the step content
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON tiger_graph.graph_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON tiger_graph.graph_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_props ON tiger_graph.graph_nodes USING gin(properties);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_embedding ON tiger_graph.graph_nodes 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE IF NOT EXISTS tiger_graph.graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    graph_id UUID NOT NULL,
    source_node_id UUID NOT NULL REFERENCES tiger_graph.graph_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES tiger_graph.graph_nodes(id) ON DELETE CASCADE,
    edge_type VARCHAR(50) NOT NULL,               -- 'DECOMPOSES_TO', 'CALLS_TOOL', 'PRODUCES_OUTPUT', 'REFLECTS_ON', 'REVISES_TO', 'NEXT_STEP'
    weight FLOAT NOT NULL DEFAULT 1.0,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_graph_id ON tiger_graph.graph_edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON tiger_graph.graph_edges(source_node_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON tiger_graph.graph_edges(target_node_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_graph_edges_props ON tiger_graph.graph_edges USING gin(properties);

-- =========================================================================
-- MIA MEMORY MANAGER: Non-parametric Memory Units
-- =========================================================================

CREATE TABLE IF NOT EXISTS tiger_mia.memory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modality VARCHAR(30) NOT NULL DEFAULT 'text', -- 'text', 'multimodal'
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    question TEXT NOT NULL,
    caption TEXT,                                 -- Image caption for multimodal queries
    question_embedding vector(384) NOT NULL,
    caption_embedding vector(384),
    trajectory_graph_id UUID,                     -- Foreign link to tiger_graph DAG
    compressed_workflow JSONB NOT NULL,          -- Abstracted structured workflow summary
    judgment_label VARCHAR(20) NOT NULL,          -- 'correct' (Positive Paradigm), 'incorrect' (Negative Paradigm)
    execution_length INT NOT NULL DEFAULT 1,     -- Length of trajectory path (for shortest path selection)
    usage_count INT NOT NULL DEFAULT 0,          -- u_i
    success_count INT NOT NULL DEFAULT 0,        -- s_i
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_units_q_embed ON tiger_mia.memory_units 
    USING hnsw (question_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_memory_units_c_embed ON tiger_mia.memory_units 
    USING hnsw (caption_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_memory_units_label ON tiger_mia.memory_units(judgment_label);
CREATE INDEX IF NOT EXISTS idx_memory_units_category ON tiger_mia.memory_units(category, modality);

-- =========================================================================
-- TIMESCALEDB HYPERTABLE: Trajectory Logging & Test-Time Learning Evolution
-- =========================================================================

CREATE TABLE IF NOT EXISTS tiger_mia.trajectory_logs (
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
CREATE INDEX IF NOT EXISTS idx_trajectory_logs_session ON tiger_mia.trajectory_logs(session_id, time DESC);

-- =========================================================================
-- STORED PROCEDURES: MIA Hybrid Retrieval Scoring Function (Eq 4 & Section 10)
-- =========================================================================

CREATE OR REPLACE FUNCTION tiger_mia.hybrid_memory_retrieve(
    p_query_embed vector,
    p_caption_embed vector DEFAULT NULL,
    p_judgment_filter VARCHAR(20) DEFAULT NULL,
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
    execution_length INT,
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
    CREATE TEMP TABLE tmp_candidates ON COMMIT DROP AS
    SELECT 
        m.id,
        m.question,
        m.caption,
        m.judgment_label,
        m.compressed_workflow,
        m.trajectory_graph_id,
        m.execution_length,
        m.usage_count,
        m.success_count,
        CASE 
            WHEN p_caption_embed IS NOT NULL AND m.caption_embedding IS NOT NULL THEN
                (p_alpha_q * (1.0 - (m.question_embedding <=> p_query_embed))) +
                (p_alpha_c * (1.0 - (m.caption_embedding <=> p_caption_embed)))
            ELSE
                (1.0 - (m.question_embedding <=> p_query_embed))
        END AS sim_raw,
        -- Value Reward: Val_i = s_i / (u_i + 1)
        (m.success_count::FLOAT / (m.usage_count + 1)) AS val_reward,
        -- Frequency Reward: Freq_i = 1 / (u_i + 1)
        (1.0::FLOAT / (m.usage_count + 1)) AS freq_reward
    FROM tiger_mia.memory_units m
    WHERE (p_judgment_filter IS NULL OR m.judgment_label = p_judgment_filter);

    SELECT MIN(sim_raw), MAX(sim_raw) INTO v_min_sim, v_max_sim FROM tmp_candidates;

    RETURN QUERY
    SELECT 
        c.id,
        c.question,
        c.caption,
        c.judgment_label,
        c.compressed_workflow,
        c.trajectory_graph_id,
        c.execution_length,
        c.sim_raw::FLOAT,
        CASE 
            WHEN v_max_sim IS NULL OR v_max_sim = v_min_sim THEN 1.0::FLOAT
            ELSE ((c.sim_raw - v_min_sim)::FLOAT / (v_max_sim - v_min_sim + 1e-8))
        END::FLOAT AS norm_sim,
        c.val_reward::FLOAT,
        c.freq_reward::FLOAT,
        (p_lambda_s * (CASE WHEN v_max_sim IS NULL OR v_max_sim = v_min_sim THEN 1.0::FLOAT ELSE ((c.sim_raw - v_min_sim)::FLOAT / (v_max_sim - v_min_sim + 1e-8)) END) +
         p_lambda_v * c.val_reward +
         p_lambda_f * c.freq_reward)::FLOAT AS score
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
        -- Root nodes
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
        
        -- Children
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
        WHERE NOT (next_node.id = ANY(wt.path))
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

-- Knowledge Replacement and Upsert Function
CREATE OR REPLACE FUNCTION tiger_mia.upsert_memory_unit(
    p_modality VARCHAR(30),
    p_category VARCHAR(50),
    p_question TEXT,
    p_caption TEXT,
    p_q_embed vector,
    p_c_embed vector DEFAULT NULL,
    p_trajectory_graph_id UUID DEFAULT NULL,
    p_compressed_workflow JSONB DEFAULT '{}'::jsonb,
    p_judgment_label VARCHAR(20) DEFAULT 'correct',
    p_execution_length INT DEFAULT 1,
    p_sim_threshold FLOAT DEFAULT 0.92
)
RETURNS TABLE (
    action_taken TEXT,
    memory_id UUID
) AS $$
DECLARE
    v_existing_id UUID;
    v_existing_sim FLOAT;
    v_existing_len INT;
BEGIN
    -- Check if a highly similar memory already exists
    SELECT 
        m.id,
        (1.0 - (m.question_embedding <=> p_q_embed)),
        m.execution_length
    INTO v_existing_id, v_existing_sim, v_existing_len
    FROM tiger_mia.memory_units m
    WHERE m.judgment_label = p_judgment_label
      AND m.category = p_category
    ORDER BY (m.question_embedding <=> p_q_embed) ASC
    LIMIT 1;

    IF v_existing_id IS NOT NULL AND v_existing_sim >= p_sim_threshold THEN
        -- Existing unit found above threshold: Perform Knowledge Consolidation & Replacement
        UPDATE tiger_mia.memory_units
        SET usage_count = usage_count + 1,
            success_count = success_count + (CASE WHEN p_judgment_label = 'correct' THEN 1 ELSE 0 END),
            -- If new trajectory is shorter and correct, replace the workflow with the more efficient one
            compressed_workflow = CASE 
                WHEN p_judgment_label = 'correct' AND p_execution_length < v_existing_len THEN p_compressed_workflow
                ELSE compressed_workflow 
            END,
            execution_length = CASE 
                WHEN p_judgment_label = 'correct' AND p_execution_length < v_existing_len THEN p_execution_length
                ELSE execution_length 
            END,
            trajectory_graph_id = CASE 
                WHEN p_judgment_label = 'correct' AND p_execution_length < v_existing_len THEN p_trajectory_graph_id
                ELSE trajectory_graph_id 
            END,
            updated_at = NOW()
        WHERE id = v_existing_id;

        RETURN QUERY SELECT 'UPDATED'::TEXT, v_existing_id;
    ELSE
        -- Insert as new memory unit
        RETURN QUERY
        INSERT INTO tiger_mia.memory_units (
            modality,
            category,
            question,
            caption,
            question_embedding,
            caption_embedding,
            trajectory_graph_id,
            compressed_workflow,
            judgment_label,
            execution_length,
            usage_count,
            success_count
        ) VALUES (
            p_modality,
            p_category,
            p_question,
            p_caption,
            p_q_embed,
            p_c_embed,
            p_trajectory_graph_id,
            p_compressed_workflow,
            p_judgment_label,
            p_execution_length,
            1,
            CASE WHEN p_judgment_label = 'correct' THEN 1 ELSE 0 END
        ) RETURNING 'INSERTED'::TEXT, id;
    END IF;
END;
$$ LANGUAGE plpgsql;
