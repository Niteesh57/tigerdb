import React, { useState, useEffect } from 'react';
import { Mic, Sparkles, Brain } from 'lucide-react';
import VoiceAssistantPopup from './components/VoiceAssistantPopup';
import PipPortal, { isPipSupported } from './components/PipPortal';
import MemoryInspectorModal from './components/MemoryInspectorModal';
import { fetchMemoryOverview } from './api/client';

export default function App() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isMemoryInspectorOpen, setIsMemoryInspectorOpen] = useState(false);
  const [memoryStats, setMemoryStats] = useState(null);

  useEffect(() => {
    fetchMemoryOverview()
      .then((data) => {
        if (data?.stats) setMemoryStats(data.stats);
      })
      .catch((e) => console.warn('Could not fetch stats for top chip:', e));
  }, [isMemoryInspectorOpen]);

  const handleActivate = () => {
    // If browser supports Document Picture-in-Picture, open as floating window
    if (isPipSupported()) {
      setIsPipActive(true);
    }
    setIsPopupOpen(true);
  };

  const handleClose = () => {
    setIsPopupOpen(false);
    setIsPipActive(false);
  };

  const handleTogglePip = () => {
    setIsPipActive((prev) => !prev);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Minimalist Top Bar with Memory View Chip */}
      <header className="top-header-bar">
        <div className="top-header-left">
          {/* Subtle connection badge */}
        </div>
        <div className="top-header-right">
          <button
            onClick={() => setIsMemoryInspectorOpen(true)}
            className="top-memory-chip"
            title="Click to view TigerDB Vector & Property Graph Memory Architecture"
          >
            <span className="chip-status-dot"></span>
            <Brain size={14} color="#4f46e5" />
            <span>View Memories</span>
            <span className="chip-badge">
              {memoryStats ? `${memoryStats.total_nodes} Nodes` : '468 Nodes'}
            </span>
          </button>
        </div>
      </header>

      {/* Subtle Animated Background Orbs */}
      <div className="ambient-bg">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
      </div>

      {/* Subtle Dot Grid */}
      <div className="dot-grid"></div>

      {/* Centered Minimalist Content */}
      <main className="center-container">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(79, 70, 229, 0.08)',
            border: '1px solid rgba(79, 70, 229, 0.18)',
            borderRadius: '9999px',
            padding: '5px 14px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#4f46e5',
            marginBottom: '16px'
          }}>
            <Sparkles size={13} color="#4f46e5" />
            <span>Desktop Memory AI</span>
          </div>

          <h1 style={{
            fontSize: '38px',
            fontWeight: '800',
            letterSpacing: '-0.03em',
            color: '#0f172a',
            marginBottom: '8px'
          }}>
            Desktop Memory Agent
          </h1>

          <p style={{
            fontSize: '15px',
            color: '#64748b',
            maxWidth: '380px',
            margin: '0 auto',
            lineHeight: '1.5'
          }}>
            Press activate to recall files, browser tabs, promises, and past PC activities.
          </p>
        </div>

        {/* Small Button: Activate */}
        <div style={{ position: 'relative' }}>
          <div className="pulse-ring"></div>
          <button
            onClick={handleActivate}
            className="activate-btn"
            title="Click to Activate Voice Memory Agent"
          >
            <Mic size={18} />
            <span>Activate</span>
          </button>
        </div>
      </main>

      {/* Floating Document PiP or In-Page Chrome Modal */}
      {isPipActive ? (
        <PipPortal isOpen={isPopupOpen} onClose={handleClose} width={500} height={580}>
          <VoiceAssistantPopup
            isOpen={isPopupOpen}
            onClose={handleClose}
            isPip={true}
            onTogglePip={handleTogglePip}
          />
        </PipPortal>
      ) : (
        <VoiceAssistantPopup
          isOpen={isPopupOpen}
          onClose={handleClose}
          isPip={false}
          onTogglePip={handleTogglePip}
        />
      )}

      {/* Memory Architecture & Live Inspector Modal */}
      <MemoryInspectorModal
        isOpen={isMemoryInspectorOpen}
        onClose={() => setIsMemoryInspectorOpen(false)}
      />
    </div>
  );
}
