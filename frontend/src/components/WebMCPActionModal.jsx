import React from 'react';
import { X, CheckCircle, Terminal, Copy, ArrowRight, Zap } from 'lucide-react';

export default function WebMCPActionModal({ actionResult, onClose }) {
  if (!actionResult) return null;

  const { action, success, message, output, draft, items } = actionResult;

  const handleCopy = () => {
    navigator.clipboard.writeText(output || message || '');
  };

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
        maxWidth: '560px',
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
              background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Zap size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                WebMCP In-Situ Execution
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                Action: {action}
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

        {/* Status Badge */}
        <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={success ? "pill pill-emerald" : "pill pill-rose"}>
            {success ? "Success" : "Failed"}
          </span>
          <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '500' }}>
            {message}
          </span>
        </div>

        {/* Live Terminal Output Box */}
        {output && (
          <div style={{
            background: '#05070c',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: '#a5f3fc',
            lineHeight: '1.6',
            maxHeight: '200px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            marginBottom: '16px'
          }}>
            {output}
          </div>
        )}

        {/* Email Draft Preview */}
        {draft && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <strong>To:</strong> {draft.recipient}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <strong>Subject:</strong> {draft.subject}
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#f8fafc',
              whiteSpace: 'pre-wrap'
            }}>
              {draft.body}
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button 
            onClick={handleCopy} 
            className="btn-action btn-subtle" 
            style={{ padding: '8px 14px' }}
          >
            <Copy size={13} /> Copy Output
          </button>
          <button 
            onClick={onClose} 
            className="btn-action btn-primary" 
            style={{ padding: '8px 18px' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
