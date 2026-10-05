import React from 'react';
import { FileText, Globe, Terminal, Pin, ExternalLink, Network, CheckCircle, Wrench, FolderOpen, Mail } from 'lucide-react';

export default function TimelineReel({ searchResult, onTriggerAction, onOpenGraph }) {
  if (!searchResult) return null;

  const { synthesis, results, query } = searchResult;

  const getActivityIcon = (type) => {
    switch (type) {
      case 'file_edit': return <FileText size={16} color="#6366f1" />;
      case 'browser_tab': return <Globe size={16} color="#06b6d4" />;
      case 'terminal': return <Terminal size={16} color="#f43f5e" />;
      default: return <Pin size={16} color="#f59e0b" />;
    }
  };

  return (
    <section style={{ marginBottom: '32px' }}>
      {/* Synthesis Answer Banner */}
      {synthesis && (
        <div className="glass-panel" style={{
          padding: '16px 20px',
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(6, 182, 212, 0.06) 100%)',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle size={16} color="#818cf8" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a5b4fc', marginBottom: '4px' }}>
              MIA Agent Answer ({query ? `"${query}"` : "Desktop Memory Recall"})
            </div>
            <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '500', lineHeight: '1.5' }}>
              {synthesis}
            </div>
          </div>
        </div>
      )}

      {/* Timeline Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        {results?.map((item) => (
          <div key={item.id} className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getActivityIcon(item.activity_type)}
                  <span className="pill pill-indigo" style={{ fontSize: '10px' }}>
                    {item.activity_type || 'ACTIVITY'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                    {item.time}
                  </span>
                  {item.similarity && (
                    <span className="pill pill-cyan" style={{ fontSize: '10px' }}>
                      {Math.round(item.similarity * 100)}% match
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Path */}
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginBottom: '6px' }}>
                {item.title}
              </h3>

              {item.path_or_url && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: '10px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  {item.path_or_url}
                </div>
              )}

              {/* Snippet */}
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '12px' }}>
                {item.snippet}
              </p>

              {/* Extracted Promise / Commitment */}
              {item.promise && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <Pin size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#fbbf24', textTransform: 'uppercase', display: 'block' }}>
                      Promised Commitment:
                    </span>
                    <span style={{ fontSize: '12px', color: '#fef3c7' }}>
                      "{item.promise}"
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* In-Situ Action Buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: '4px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {item.activity_type === 'file_edit' && (
                  <button 
                    onClick={() => onTriggerAction('open_file', { path: item.path_or_url })}
                    className="btn-action btn-subtle" 
                    style={{ padding: '5px 10px', fontSize: '11px' }}
                  >
                    <FolderOpen size={12} /> Open File
                  </button>
                )}

                {item.promise && (
                  <button 
                    onClick={() => onTriggerAction('draft_email', { recipient: 'Rahul', subject: item.title, body: item.promise })}
                    className="btn-action btn-primary" 
                    style={{ padding: '5px 10px', fontSize: '11px' }}
                  >
                    <Mail size={12} /> Draft Reply
                  </button>
                )}

                {item.activity_type === 'terminal' && (
                  <button 
                    onClick={() => onTriggerAction('docker_heal', { container: 'tiger-timescaledb' })}
                    className="btn-action btn-danger" 
                    style={{ padding: '5px 10px', fontSize: '11px' }}
                  >
                    <Wrench size={12} /> Auto-Heal
                  </button>
                )}
              </div>

              {item.graph_id && (
                <button
                  onClick={() => onOpenGraph(item.graph_id, item.title)}
                  className="btn-action btn-subtle"
                  style={{ padding: '5px 10px', fontSize: '11px', color: '#a5b4fc' }}
                  title="Inspect DAG trajectory in TigerDB Graph"
                >
                  <Network size={12} /> Graph Trail
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
