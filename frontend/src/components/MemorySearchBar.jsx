import React, { useState } from 'react';
import { Search, Mic, MicOff, Compass, ArrowRight } from 'lucide-react';

export default function MemorySearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);

  const presets = [
    { label: "📄 Client Proposal doc", q: "Where is that client proposal document?" },
    { label: "🐳 Docker Deployment failure", q: "Why did my Docker deployment fail yesterday?" },
    { label: "📝 Resume Update", q: "Where did I save my resume update?" },
    { label: "✉️ Rahul Email Promise", q: "What did I promise Rahul in the client email?" }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handlePresetClick = (q) => {
    setQuery(q);
    onSearch(q);
  };

  const toggleMic = () => {
    if (!listening) {
      setListening(true);
      // Simulate voice capture
      setTimeout(() => {
        const spoken = "Where is that document about the client?";
        setQuery(spoken);
        setListening(false);
        onSearch(spoken);
      }, 1800);
    } else {
      setListening(false);
    }
  };

  return (
    <section style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4' }}></div>
          <h2 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            🖥️ Where Did I Leave It? — Desktop Memory Recall
          </h2>
        </div>
        <span className="pill pill-cyan">TigerDB Vector + Graph</span>
      </div>

      <form onSubmit={handleSubmit} style={{ position: 'relative', marginBottom: '14px' }}>
        <div className="glass-panel" style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px 8px 18px',
          borderColor: listening ? '#06b6d4' : 'var(--border-subtle)',
          boxShadow: listening ? '0 0 20px rgba(6, 182, 212, 0.3)' : 'none'
        }}>
          <Search size={18} color="var(--text-muted)" style={{ marginRight: '12px' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything: 'Where did I save the proposal?', 'Which tab had Docker config?', 'What did I promise?'"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '15px',
              fontFamily: 'var(--font-sans)',
              fontWeight: '500'
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={toggleMic}
              title={listening ? "Listening... (Click to cancel)" : "Activate Voice Recall"}
              className="btn-action"
              style={{
                background: listening ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                color: listening ? '#fb7185' : 'var(--text-muted)',
                borderColor: listening ? '#f43f5e' : 'var(--border-subtle)',
                padding: '8px 12px',
                borderRadius: '8px'
              }}
            >
              {listening ? <Mic size={16} className="pulse-mic" /> : <Mic size={16} />}
              <span style={{ fontSize: '12px' }}>{listening ? "Listening..." : "Voice"}</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn-action btn-primary"
              style={{ padding: '8px 16px', borderRadius: '8px' }}
            >
              <span>{loading ? "Searching..." : "Recall"}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </form>

      {/* Quick Filter Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-subtle)', marginRight: '4px' }}>Quick Queries:</span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handlePresetClick(p.q)}
            className="btn-action btn-subtle"
            style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}
