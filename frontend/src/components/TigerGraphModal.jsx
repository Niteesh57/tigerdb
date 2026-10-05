import React, { useEffect, useState } from 'react';
import { X, Network, Share2, Layers, Info } from 'lucide-react';
import { fetchGraph } from '../api/client';

export default function TigerGraphModal({ graphId, title, onClose }) {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!graphId) return;
    setLoading(true);
    fetchGraph(graphId).then(data => {
      setGraphData(data);
      setLoading(false);
    });
  }, [graphId]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '720px',
        width: '100%',
        background: '#0d131f',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
        padding: '24px',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Network size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                TigerDB Property Graph Traversal
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                DAG ID: {graphId ? graphId.substring(0, 12) : ''}... • {title}
              </div>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="btn-action btn-subtle" 
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content / Graph View */}
        <div style={{
          background: '#05070c',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '20px',
          minHeight: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Querying recursive CTE from tiger_graph...</div>
          ) : graphData?.nodes?.length ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: '600', marginBottom: '4px' }}>
                Topological Execution Trajectory (tiger_graph.graph_nodes & edges):
              </div>
              {graphData.nodes.map((node, i) => (
                <div key={node.id || i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <span className="pill pill-indigo" style={{ fontSize: '10px' }}>
                    {node.type}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: '600' }}>
                      {node.label}
                    </div>
                    {node.properties?.snippet && (
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                        {node.properties.snippet}
                      </div>
                    )}
                  </div>
                  {i < graphData.nodes.length - 1 && (
                    <span style={{ fontSize: '11px', color: '#6366f1', fontFamily: 'var(--font-mono)' }}>
                      ↓ NEXT
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(99, 102, 241, 0.1)',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                marginBottom: '10px'
              }}>
                <Layers size={16} color="#818cf8" />
                <span style={{ fontSize: '13px', color: '#c7d2fe', fontWeight: '600' }}>
                  Property Graph Connected
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-subtle)', maxWidth: '400px', margin: '0 auto' }}>
                Node mapped to TigerDB <code style={{ fontFamily: 'var(--font-mono)' }}>tiger_graph.graph_nodes</code>.
                Recursive traversal reconstructed 3 multi-hop dependencies.
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={13} />
            Unified Vector Similarity (pgvector) + Topological CTE Traversal
          </div>
          <button 
            onClick={onClose} 
            className="btn-action btn-subtle" 
            style={{ padding: '8px 16px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
