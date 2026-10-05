import React, { useState, useEffect } from 'react';
import { Database, Cpu, Zap, RefreshCw, Sparkles } from 'lucide-react';

export default function Header({ health, onSeed, seeding }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="glass-panel" style={{ padding: '14px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
        }}>
          <Sparkles size={20} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em', color: '#ffffff' }}>TigerDB</h1>
            <span className="pill pill-indigo" style={{ fontSize: '10px', padding: '2px 8px' }}>MIA Co-Pilot</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Desktop Memory Intelligence & WebMCP Action HUD</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <Database size={15} color="#10b981" />
          <span style={{ fontSize: '12px', fontWeight: '500', color: '#e2e8f0' }}>PostgreSQL 18 + TimescaleDB</span>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <Cpu size={15} color="#6366f1" />
          <span style={{ fontSize: '12px', fontWeight: '500', color: '#e2e8f0' }}>MIA Paradigms: <strong>{health?.database?.memory_units || 5}</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <Zap size={15} color="#06b6d4" />
          <span style={{ fontSize: '12px', fontWeight: '500', color: '#e2e8f0' }}>WebMCP: In-Situ</span>
        </div>

        <button 
          onClick={onSeed} 
          disabled={seeding}
          className="btn-action btn-subtle" 
          title="Refresh / Re-seed Desktop Memory in TigerDB"
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          <RefreshCw size={13} className={seeding ? "spin-animation" : ""} />
          <span>{seeding ? "Seeding..." : "Refresh DB"}</span>
        </button>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-subtle)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
          {time}
        </div>
      </div>
    </header>
  );
}
