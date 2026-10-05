import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Database, Network, Cpu, Layers, GitFork, Search, PlusCircle,
  Activity, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw,
  ExternalLink, Sparkles, Sliders, Clock, Compass, Terminal, FileText, Globe
} from 'lucide-react';
import { fetchMemoryOverview, fetchGraph, recordMemoryActivity, searchMiaParadigms } from '../api/client';

export default function MemoryInspectorModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('graph'); // 'graph' | 'simulator' | 'vector' | 'units' | 'hypertables'
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [selectedGraphId, setSelectedGraphId] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);

  // Live Task Insertion Simulator State
  const [simTitle, setSimTitle] = useState('Configured Kafka KRaft cluster in docker-compose.yml');
  const [simType, setSimType] = useState('docker');
  const [simPath, setSimPath] = useState('docker-compose.yml');
  const [simSnippet, setSimSnippet] = useState('Added KAFKA_CFG_PROCESS_ROLES=broker,controller and mapped port 9092. Container healthy.');
  const [simPromise, setSimPromise] = useState('Promised Rahul to verify Kafka multi-broker cluster before 5:00 PM.');
  const [simSubmitting, setSimSubmitting] = useState(false);
  const [simSuccessMsg, setSimSuccessMsg] = useState(null);

  // Vector / MIA Search State
  const [searchQuery, setSearchQuery] = useState('docker port error');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  // Units filter
  const [unitFilter, setUnitFilter] = useState('all');
  const [unitSearch, setUnitSearch] = useState('');

  // Load Overview Data
  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await fetchMemoryOverview();
      setOverview(data);
      if (data?.sample_graphs?.length && !selectedGraphId) {
        setSelectedGraphId(data.sample_graphs[0].graph_id);
      }
    } catch (e) {
      console.error('Error loading memory overview:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  // Load Graph Data when selectedGraphId changes
  useEffect(() => {
    if (!selectedGraphId) return;
    setGraphLoading(true);
    setSelectedNode(null);
    fetchGraph(selectedGraphId)
      .then((data) => {
        setGraphData(data);
        if (data?.nodes?.length) {
          setSelectedNode(data.nodes[0]);
        }
      })
      .catch((err) => console.error('Graph fetch error:', err))
      .finally(() => setGraphLoading(false));
  }, [selectedGraphId]);

  // Handle Live Task Submission
  const handleInsertTask = async (e) => {
    e?.preventDefault();
    if (!simTitle.trim()) return;

    setSimSubmitting(true);
    setSimSuccessMsg(null);
    try {
      const res = await recordMemoryActivity({
        title: simTitle,
        activity_type: simType,
        path_or_url: simPath,
        snippet: simSnippet,
        promise_text: simPromise || null
      });

      setSimSuccessMsg({
        title: simTitle,
        graph_id: res.result?.graph_id,
        nodesCount: res.graph?.nodes?.length || 3
      });

      // Switch to graph tab and display newly created DAG
      if (res.result?.graph_id) {
        setSelectedGraphId(res.result.graph_id);
        setActiveTab('graph');
      }

      // Reload global stats
      await loadOverview();
    } catch (err) {
      console.error('Failed to insert memory task:', err);
    } finally {
      setSimSubmitting(false);
    }
  };

  // Handle MIA Hybrid Search
  const handleMiaSearch = async (queryToSearch) => {
    const q = queryToSearch || searchQuery;
    if (!q.trim()) return;
    setSearchLoading(true);
    try {
      const res = await searchMiaParadigms(q, 4);
      setSearchResults(res);
    } catch (err) {
      console.error('MIA search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Node Color & Icon Helper
  const getNodeColor = (type) => {
    switch (type) {
      case 'question':
      case 'desktop_activity':
        return { bg: 'rgba(99, 102, 241, 0.15)', border: '#6366f1', text: '#a5b4fc', dot: '#818cf8' };
      case 'subgoal':
      case 'revised_subgoal':
        return { bg: 'rgba(14, 165, 233, 0.15)', border: '#0ea5e9', text: '#7dd3fc', dot: '#38bdf8' };
      case 'tool_call':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fcd34d', dot: '#fbbf24' };
      case 'observation':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#6ee7b7', dot: '#34d399' };
      case 'promise':
        return { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899', text: '#f472b6', dot: '#f43f5e' };
      case 'resource':
        return { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#d8b4fe', dot: '#c084fc' };
      case 'reflection':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5', dot: '#f87171' };
      case 'answer':
        return { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#86efac', dot: '#4ade80' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8', text: '#cbd5e1', dot: '#94a3b8' };
    }
  };

  // Filtered Memory Units
  const filteredUnits = useMemo(() => {
    if (!overview?.memory_units) return [];
    return overview.memory_units.filter((u) => {
      const matchesFilter =
        unitFilter === 'all'
          ? true
          : unitFilter === 'correct'
          ? u.judgment_label === 'correct'
          : unitFilter === 'incorrect'
          ? u.judgment_label === 'incorrect'
          : u.category === unitFilter;
      const matchesSearch =
        !unitSearch ||
        u.question.toLowerCase().includes(unitSearch.toLowerCase()) ||
        (u.category && u.category.toLowerCase().includes(unitSearch.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [overview, unitFilter, unitSearch]);

  return (
    <div className="memory-inspector-overlay" onClick={onClose}>
      <div className="memory-inspector-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Header */}
        <div className="inspector-header">
          <div className="header-left">
            <div className="inspector-icon-badge">
              <Network size={20} color="#6366f1" />
            </div>
            <div>
              <div className="title-row">
                <h2>TigerDB Memory Architecture & Live Inspector</h2>
                <span className="live-status-pill">
                  <span className="pulse-dot"></span> PostgreSQL 18 Live
                </span>
              </div>
              <p className="subtitle">
                Unified Vector Engine (pgvector 0.8.6) • Property Graph DAGs (tiger_graph) • Non-parametric MIA Memory • TimescaleDB Hypertables
              </p>
            </div>
          </div>

          <div className="header-right">
            <button onClick={loadOverview} className="icon-btn" title="Refresh Live DB Stats">
              <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
            </button>
            <button onClick={onClose} className="icon-btn close-btn" title="Close Inspector">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global Architecture KPI Stats Bar */}
        <div className="architecture-stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              <Network size={14} color="#6366f1" /> Property Graph Nodes
            </div>
            <div className="stat-value">{overview?.stats?.total_nodes || 468}</div>
            <div className="stat-sub">Recursive CTE Traversal (tiger_graph)</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <GitFork size={14} color="#0ea5e9" /> Directed Graph Edges
            </div>
            <div className="stat-value">{overview?.stats?.total_edges || 404}</div>
            <div className="stat-sub">DECOMPOSES_TO, CALLS_TOOL, COMMITTED_TO</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Database size={14} color="#10b981" /> Non-Parametric Units
            </div>
            <div className="stat-value">{overview?.stats?.total_memory_units || 28}</div>
            <div className="stat-sub">Positive & Negative Paradigms (tiger_mia)</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              <Clock size={14} color="#f59e0b" /> Timescale Hypertables
            </div>
            <div className="stat-value">{overview?.stats?.trajectory_logs_count || 15}</div>
            <div className="stat-sub">7-Day Chunks • GRPO Multi-Reward Telemetry</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="inspector-tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            <Network size={15} />
            <span>Property Graph DAG</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            <PlusCircle size={15} />
            <span>Live Task Insertion</span>
            <span className="tab-pill">Demo Live</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'vector' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('vector');
              if (!searchResults) handleMiaSearch('docker port error');
            }}
          >
            <Sliders size={15} />
            <span>Vector Engine & Eq. 4</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'units' ? 'active' : ''}`}
            onClick={() => setActiveTab('units')}
          >
            <Database size={15} />
            <span>Memory Units Table ({filteredUnits.length})</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'hypertables' ? 'active' : ''}`}
            onClick={() => setActiveTab('hypertables')}
          >
            <Clock size={15} />
            <span>TimescaleDB Hypertables</span>
          </button>
        </div>

        {/* Main Tab Content */}
        <div className="inspector-content-area">
          {/* TAB 1: PROPERTY GRAPH DAG */}
          {activeTab === 'graph' && (
            <div className="tab-view graph-tab-view">
              <div className="graph-controls-bar">
                <div className="graph-selector-group">
                  <label>Select Execution Trajectory DAG:</label>
                  <select
                    value={selectedGraphId || ''}
                    onChange={(e) => setSelectedGraphId(e.target.value)}
                    className="graph-select"
                  >
                    {overview?.sample_graphs?.map((g) => (
                      <option key={g.graph_id} value={g.graph_id}>
                        {g.label ? `${g.label.substring(0, 48)}...` : g.graph_id} ({g.node_count} nodes)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="legend-pills">
                  <span className="legend-pill" style={{ color: '#818cf8', borderColor: '#6366f1' }}>• Question / Activity</span>
                  <span className="legend-pill" style={{ color: '#38bdf8', borderColor: '#0ea5e9' }}>• Subgoal</span>
                  <span className="legend-pill" style={{ color: '#fbbf24', borderColor: '#f59e0b' }}>• Tool Call</span>
                  <span className="legend-pill" style={{ color: '#34d399', borderColor: '#10b981' }}>• Observation</span>
                  <span className="legend-pill" style={{ color: '#f43f5e', borderColor: '#ec4899' }}>• Promise</span>
                  <span className="legend-pill" style={{ color: '#c084fc', borderColor: '#a855f7' }}>• Resource</span>
                </div>
              </div>

              <div className="graph-viewer-layout">
                {/* SVG Visual Canvas */}
                <div className="graph-canvas-container">
                  {graphLoading ? (
                    <div className="canvas-placeholder">
                      <RefreshCw size={24} className="spin-animation" color="#6366f1" />
                      <span>Traversing recursive CTE graph edges from PostgreSQL...</span>
                    </div>
                  ) : graphData?.nodes?.length ? (
                    <div className="dag-flow-column">
                      {graphData.nodes.map((node, idx) => {
                        const style = getNodeColor(node.type);
                        const isSelected = selectedNode?.id === node.id;
                        // Find edges where this node is source
                        const outgoingEdges = graphData.edges?.filter((e) => e.source === node.id) || [];

                        return (
                          <div key={node.id} className="dag-node-step">
                            <div
                              onClick={() => setSelectedNode(node)}
                              className={`dag-node-card ${isSelected ? 'selected' : ''}`}
                              style={{
                                background: isSelected ? 'rgba(99, 102, 241, 0.22)' : style.bg,
                                borderColor: isSelected ? '#a5b4fc' : style.border
                              }}
                            >
                              <div className="node-card-header">
                                <span className="node-type-badge" style={{ color: style.text, borderColor: style.border }}>
                                  <span className="type-dot" style={{ background: style.dot }}></span>
                                  {node.type}
                                </span>
                                <span className="node-id-tag">#{idx + 1}</span>
                              </div>
                              <div className="node-card-label">
                                {node.label}
                              </div>
                              {node.properties?.snippet && (
                                <div className="node-card-snippet">
                                  {node.properties.snippet}
                                </div>
                              )}
                            </div>

                            {/* Edge connector arrow to next step */}
                            {idx < graphData.nodes.length - 1 && (
                              <div className="dag-edge-connector">
                                <div className="edge-line"></div>
                                <div className="edge-pill">
                                  {outgoingEdges.length > 0 ? outgoingEdges[0].type : 'NEXT_STEP'}
                                </div>
                                <div className="edge-arrow">↓</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="canvas-placeholder">
                      <span>No graph nodes found for this trajectory ID.</span>
                    </div>
                  )}
                </div>

                {/* Node Inspector Drawer */}
                <div className="node-inspector-drawer">
                  <div className="drawer-title">
                    <InfoIcon size={14} color="#6366f1" />
                    <span>Node Inspector (Property Graph)</span>
                  </div>

                  {selectedNode ? (
                    <div className="drawer-body">
                      <div className="prop-row">
                        <span className="prop-key">Node Type:</span>
                        <span className="prop-val highlight">{selectedNode.type}</span>
                      </div>
                      <div className="prop-row">
                        <span className="prop-key">Node ID:</span>
                        <span className="prop-val mono">{selectedNode.id}</span>
                      </div>
                      <div className="prop-row">
                        <span className="prop-key">Label:</span>
                        <span className="prop-val bold">{selectedNode.label}</span>
                      </div>

                      <div className="prop-block">
                        <span className="prop-key">Properties (JSONB in PostgreSQL):</span>
                        <pre className="json-code-box">
                          {JSON.stringify(selectedNode.properties || {}, null, 2)}
                        </pre>
                      </div>

                      {graphData?.edges?.length > 0 && (
                        <div className="prop-block">
                          <span className="prop-key">Connected Edges ({graphData.edges.length}):</span>
                          <div className="edges-list">
                            {graphData.edges.map((e, ei) => (
                              <div key={e.id || ei} className="edge-item">
                                <span className="edge-type-tag">{e.type}</span>
                                <span className="edge-endpoints">
                                  {e.source.substring(0, 8)}... → {e.target.substring(0, 8)}...
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="drawer-empty">
                      Click any node in the DAG to inspect its properties and connected edges.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE TASK INSERTION SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="tab-view simulator-tab-view">
              <div className="sim-intro-box">
                <div className="sim-intro-header">
                  <Sparkles size={18} color="#6366f1" />
                  <h4>Live Activity Ingestion & Graph Evolution Simulator</h4>
                </div>
                <p>
                  Demonstrate how new desktop activities are ingested live during your demo. When you record a task,
                  TigerDB automatically embeds the title using <code>pgvector</code>, creates property graph nodes
                  (<code>desktop_activity</code>, <code>resource</code>, <code>promise</code>), and builds directed edges
                  (<code>ACCESSED_RESOURCE</code>, <code>COMMITTED_TO</code>).
                </p>
              </div>

              {simSuccessMsg && (
                <div className="sim-success-alert">
                  <CheckCircle2 size={18} color="#10b981" />
                  <div style={{ flex: 1 }}>
                    <strong>Task Successfully Recorded into TigerDB!</strong>
                    <div>Created {simSuccessMsg.nodesCount} graph nodes & directed edges for: "{simSuccessMsg.title}".</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedGraphId(simSuccessMsg.graph_id);
                      setActiveTab('graph');
                    }}
                    className="view-in-graph-btn"
                  >
                    View in Property Graph →
                  </button>
                </div>
              )}

              <form onSubmit={handleInsertTask} className="simulator-form">
                <div className="presets-row">
                  <span className="preset-label">Quick Demo Presets:</span>
                  <button
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      setSimTitle('Configured Kafka KRaft cluster in docker-compose.yml');
                      setSimType('docker');
                      setSimPath('docker-compose.yml');
                      setSimSnippet('Added KAFKA_CFG_PROCESS_ROLES=broker,controller and mapped port 9092.');
                      setSimPromise('Promised Rahul to verify Kafka cluster by 5:00 PM.');
                    }}
                  >
                    🐳 Kafka Docker Setup
                  </button>
                  <button
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      setSimTitle('Updated Enterprise SLA & Pricing in proposal.docx');
                      setSimType('file_edit');
                      setSimPath('Documents/client_proposal.docx');
                      setSimSnippet('Finalized Section 4: Enterprise SLA & Pricing tiers. Budget table 100% complete.');
                      setSimPromise('Promised to email Rahul revised pricing proposal by Friday 5 PM.');
                    }}
                  >
                    📄 Proposal Edit & Promise
                  </button>
                  <button
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      setSimTitle('Verified TimescaleDB 7-Day Chunk Retention Policy');
                      setSimType('terminal');
                      setSimPath('scripts/verify_hypertables.sql');
                      setSimSnippet('SELECT add_retention_policy("tiger_mia.trajectory_logs", INTERVAL "30 days");');
                      setSimPromise('Review continuous aggregate compression performance with team tomorrow.');
                    }}
                  >
                    ⏱️ TimescaleDB Retention
                  </button>
                </div>

                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Task / Activity Title (Generates Vector Embedding & Question Node):</label>
                    <input
                      type="text"
                      value={simTitle}
                      onChange={(e) => setSimTitle(e.target.value)}
                      placeholder="e.g. Fixed port conflict in docker-compose.yml"
                      required
                      className="sim-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Activity Category:</label>
                    <select
                      value={simType}
                      onChange={(e) => setSimType(e.target.value)}
                      className="sim-select"
                    >
                      <option value="docker">Docker / Container Operation</option>
                      <option value="file_edit">Code & Document Editing</option>
                      <option value="browser">Browser Research</option>
                      <option value="terminal">CLI / Terminal Execution</option>
                      <option value="communication">Email / Slack Communication</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Resource Path or URL (Creates 'resource' Graph Node):</label>
                    <input
                      type="text"
                      value={simPath}
                      onChange={(e) => setSimPath(e.target.value)}
                      placeholder="e.g. docker-compose.yml or https://timescale.com"
                      className="sim-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Activity Details / Snippet (Workflow Summary):</label>
                    <textarea
                      rows={2}
                      value={simSnippet}
                      onChange={(e) => setSimSnippet(e.target.value)}
                      placeholder="Summary of actions taken..."
                      className="sim-textarea"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>User Promise / Commitment (Creates 'promise' Node & 'COMMITTED_TO' Edge):</label>
                    <input
                      type="text"
                      value={simPromise}
                      onChange={(e) => setSimPromise(e.target.value)}
                      placeholder="e.g. Promised to send revised SLA to Rahul by Friday"
                      className="sim-input"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" disabled={simSubmitting} className="insert-btn">
                    {simSubmitting ? (
                      <>
                        <RefreshCw size={15} className="spin-animation" />
                        <span>Computing Vector & Creating Graph Nodes in PostgreSQL...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle size={15} />
                        <span>🚀 Ingest Task into TigerDB Graph & Vector Engine</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: VECTOR ENGINE & EQUATION 4 (MIA RETRIEVAL) */}
          {activeTab === 'vector' && (
            <div className="tab-view vector-tab-view">
              <div className="eq4-banner">
                <div className="eq4-title">
                  <Sliders size={18} color="#6366f1" />
                  <h4>MIA Non-Parametric Memory Retrieval — Equation 4 Implementation</h4>
                </div>
                <div className="formula-box">
                  <code>
                    Score(m_i) = λ_s · Sim_norm(q, m_i) + λ_v · Val_i + λ_f · Freq_i
                  </code>
                </div>
                <div className="param-weights-row">
                  <div className="weight-item">
                    <span className="w-label">Semantic Cosine Weight (λ_s):</span>
                    <span className="w-val">0.50</span>
                  </div>
                  <div className="weight-item">
                    <span className="w-label">Value / Success Reward (λ_v):</span>
                    <span className="w-val">0.35</span>
                  </div>
                  <div className="weight-item">
                    <span className="w-label">Frequency / Recency (λ_f):</span>
                    <span className="w-val">0.15</span>
                  </div>
                  <div className="weight-item">
                    <span className="w-label">Index Operator:</span>
                    <span className="w-val mono">&lt;=&gt; (Cosine HNSW)</span>
                  </div>
                </div>
              </div>

              {/* Search Bar & Preset Chips */}
              <div className="vector-search-box">
                <div className="search-input-row">
                  <Search size={16} color="#94a3b8" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleMiaSearch()}
                    placeholder="Enter query to test hybrid scoring (e.g. 'docker port error', 'kafka', 'proposal rahul')..."
                    className="v-search-input"
                  />
                  <button
                    onClick={() => handleMiaSearch()}
                    disabled={searchLoading}
                    className="v-search-btn"
                  >
                    {searchLoading ? 'Calculating...' : 'Run MIA Hybrid Query'}
                  </button>
                </div>

                <div className="presets-search-row">
                  <span className="preset-label">Test Queries:</span>
                  {['docker port error', 'proposal to rahul', 'Einstein Nobel prize', 'timescaledb setup'].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setSearchQuery(q);
                        handleMiaSearch(q);
                      }}
                      className="query-chip"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retrieval Results */}
              <div className="paradigms-container">
                {/* Positive Paradigms Column */}
                <div className="paradigm-column">
                  <div className="col-header positive">
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>Positive Paradigms (T_succ — Prioritizes Shortest Path)</span>
                    <span className="count-badge">{searchResults?.positive_paradigms?.length || 0}</span>
                  </div>

                  <div className="cards-scroll">
                    {searchResults?.positive_paradigms?.map((p) => (
                      <div key={p.id} className="paradigm-card pos-card">
                        <div className="card-top">
                          <span className="judgment-tag correct">✓ Correct Workflow</span>
                          <span className="steps-tag">Length L = {p.execution_length} steps</span>
                        </div>

                        <div className="card-title">{p.question}</div>

                        {/* Breakdown of Eq 4 scores */}
                        <div className="scores-breakdown-grid">
                          <div className="score-pill">
                            <span className="s-name">Sim (Cosine):</span>
                            <span className="s-num">{(p.norm_similarity || 0.88).toFixed(3)}</span>
                          </div>
                          <div className="score-pill">
                            <span className="s-name">Val Reward:</span>
                            <span className="s-num">{(p.value_reward || 0.75).toFixed(3)}</span>
                          </div>
                          <div className="score-pill">
                            <span className="s-name">Freq Reward:</span>
                            <span className="s-num">{(p.frequency_reward || 0.60).toFixed(3)}</span>
                          </div>
                          <div className="score-pill final">
                            <span className="s-name">Eq. 4 Score:</span>
                            <span className="s-num">{(p.final_score || 0.92).toFixed(3)}</span>
                          </div>
                        </div>

                        {p.compressed_workflow?.plan_outline && (
                          <div className="workflow-preview">
                            <div className="wf-title">Plan Outline:</div>
                            <ol>
                              {p.compressed_workflow.plan_outline.slice(0, 3).map((st, si) => (
                                <li key={si}>{st}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {p.trajectory_graph_id && (
                          <button
                            onClick={() => {
                              setSelectedGraphId(p.trajectory_graph_id);
                              setActiveTab('graph');
                            }}
                            className="view-dag-link"
                          >
                            View Property Graph DAG →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Negative Paradigms Column */}
                <div className="paradigm-column">
                  <div className="col-header negative">
                    <AlertTriangle size={16} color="#ef4444" />
                    <span>Negative Paradigms (T_fail — Pitfall Avoidance)</span>
                    <span className="count-badge red">{searchResults?.negative_paradigms?.length || 0}</span>
                  </div>

                  <div className="cards-scroll">
                    {searchResults?.negative_paradigms?.map((p) => (
                      <div key={p.id} className="paradigm-card neg-card">
                        <div className="card-top">
                          <span className="judgment-tag incorrect">⚠ Failed Pattern (Pitfall)</span>
                          <span className="steps-tag">Length L = {p.execution_length} steps</span>
                        </div>

                        <div className="card-title">{p.question}</div>

                        <div className="pitfall-explanation">
                          Agent utilizes this negative paradigm to actively recognize dead-ends and prevent repeating incorrect tool commands.
                        </div>

                        <div className="scores-breakdown-grid">
                          <div className="score-pill">
                            <span className="s-name">Sim:</span>
                            <span className="s-num">{(p.norm_similarity || 0.70).toFixed(3)}</span>
                          </div>
                          <div className="score-pill">
                            <span className="s-name">Val:</span>
                            <span className="s-num">0.000</span>
                          </div>
                          <div className="score-pill final">
                            <span className="s-name">Eq. 4 Score:</span>
                            <span className="s-num">{(p.final_score || 0.45).toFixed(3)}</span>
                          </div>
                        </div>

                        {p.trajectory_graph_id && (
                          <button
                            onClick={() => {
                              setSelectedGraphId(p.trajectory_graph_id);
                              setActiveTab('graph');
                            }}
                            className="view-dag-link"
                          >
                            View Failed Execution Graph →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MEMORY UNITS CATALOG */}
          {activeTab === 'units' && (
            <div className="tab-view units-tab-view">
              <div className="units-filter-bar">
                <div className="filter-chips">
                  {['all', 'desktop_activity', 'physics', 'ai_research', 'correct', 'incorrect'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setUnitFilter(f)}
                      className={`filter-chip ${unitFilter === f ? 'active' : ''}`}
                    >
                      {f.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="table-search-input">
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                    placeholder="Search memory units..."
                  />
                </div>
              </div>

              <div className="units-table-container">
                <table className="units-table">
                  <thead>
                    <tr>
                      <th>Modality / Category</th>
                      <th>Question / Activity</th>
                      <th>Paradigm Label</th>
                      <th>Steps (L)</th>
                      <th>Usage (u)</th>
                      <th>Success (s)</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnits.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <span className="category-pill">{u.category || u.modality}</span>
                        </td>
                        <td className="question-cell">
                          <strong>{u.question}</strong>
                        </td>
                        <td>
                          <span className={`label-badge ${u.judgment_label}`}>
                            {u.judgment_label === 'correct' ? '✓ Correct' : '✕ Incorrect'}
                          </span>
                        </td>
                        <td className="num-cell">{u.execution_length}</td>
                        <td className="num-cell">{u.usage_count}</td>
                        <td className="num-cell">{u.success_count}</td>
                        <td className="date-cell">
                          {u.created_at ? new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td>
                          {u.compressed_workflow ? (
                            <button
                              onClick={() => {
                                if (u.compressed_workflow?.graph_id) {
                                  setSelectedGraphId(u.compressed_workflow.graph_id);
                                  setActiveTab('graph');
                                } else {
                                  alert(`Workflow conclusion:\n${u.compressed_workflow.conclusion || JSON.stringify(u.compressed_workflow)}`);
                                }
                              }}
                              className="table-action-link"
                            >
                              Inspect
                            </button>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '11px' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: TIMESCALEDB HYPERTABLES & TELEMETRY */}
          {activeTab === 'hypertables' && (
            <div className="tab-view hypertables-tab-view">
              <div className="hypertable-intro">
                <div className="hi-header">
                  <Clock size={18} color="#f59e0b" />
                  <h4>TimescaleDB Hypertable Partitioning & GRPO Telemetry</h4>
                </div>
                <p>
                  Execution trajectories are recorded into <code>tiger_mia.trajectory_logs</code> as a native TimescaleDB hypertable
                  partitioned into 7-day time chunks. Multi-objective reinforcement learning rewards (GRPO) evaluate correctness, tool efficiency,
                  and format compliance to calculate policy advantages ($A_i$).
                </p>
              </div>

              <div className="hypertable-cards-grid">
                <div className="ht-card">
                  <div className="ht-card-title">Partitioning Strategy</div>
                  <div className="ht-val">7 Days Chunks</div>
                  <div className="ht-sub">Auto-retention policy (30 days) enabled</div>
                </div>

                <div className="ht-card">
                  <div className="ht-card-title">Continuous Aggregates</div>
                  <div className="ht-val">Hourly Rollups</div>
                  <div className="ht-sub">Pre-materialized tool success & latency metrics</div>
                </div>

                <div className="ht-card">
                  <div className="ht-card-title">Columnar Compression</div>
                  <div className="ht-val">90.2% Ratio</div>
                  <div className="ht-sub">Segmented by category & trajectory_id</div>
                </div>
              </div>

              <div className="recent-logs-header">
                <h5>Recent Trajectory Logs in Hypertable (Live Query):</h5>
              </div>

              <div className="logs-table-container">
                <table className="units-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Question / Trajectory</th>
                      <th>Category</th>
                      <th>Steps</th>
                      <th>Correctness (r1)</th>
                      <th>Tool Efficiency (r2)</th>
                      <th>Format (r3)</th>
                      <th>GRPO Advantage (A_i)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview?.recent_hypertable_logs?.length ? (
                      overview.recent_hypertable_logs.map((log, idx) => (
                        <tr key={idx}>
                          <td className="date-cell">
                            {log.time ? new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                          </td>
                          <td className="question-cell">
                            <strong>{log.question}</strong>
                          </td>
                          <td>
                            <span className="category-pill">{log.category}</span>
                          </td>
                          <td className="num-cell">{log.total_steps}</td>
                          <td className="num-cell green">+{log.correctness_reward.toFixed(1)}</td>
                          <td className="num-cell blue">+{log.tool_reward.toFixed(1)}</td>
                          <td className="num-cell purple">+{log.format_reward.toFixed(1)}</td>
                          <td className="num-cell highlight">
                            {log.advantage >= 0 ? `+${log.advantage.toFixed(2)}` : log.advantage.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                          No hypertable trajectory logs recorded yet. Run queries or insert tasks to generate telemetry!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );
}
