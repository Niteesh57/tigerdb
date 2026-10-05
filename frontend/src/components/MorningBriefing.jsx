import React from 'react';
import { Clock, AlertTriangle, CheckCircle2, Play, Wrench, Mail, Calendar, FileText, ArrowUpRight } from 'lucide-react';

export default function MorningBriefing({ briefing, onTriggerAction }) {
  if (!briefing) return null;

  const { yesterday, today } = briefing;

  return (
    <section style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></div>
          <h2 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            🧠 Open My Brain — Morning Briefing
          </h2>
        </div>
        <span className="pill pill-indigo">3 Items Pending From Yesterday</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
        {/* Card 1: Yesterday's In-Progress Work */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid #f59e0b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#f59e0b" />
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>Unfinished Work</span>
              </div>
              <span className="pill pill-amber">Yesterday</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Item 1 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>Resume_2026.docx</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b' }}>70%</span>
                </div>
                {/* Progress Bar */}
                <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ width: '70%', height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '3px' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Documents/ • Last active 2:15 PM</span>
                  <button 
                    onClick={() => onTriggerAction('open_file', { path: 'Documents/Resume_2026.docx' })}
                    className="btn-action btn-subtle" 
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                  >
                    <Play size={11} /> Resume
                  </button>
                </div>
              </div>

              {/* Item 2 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>Email to Rahul</span>
                  <span className="pill pill-rose" style={{ fontSize: '10px', padding: '2px 6px' }}>Not Done</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginBottom: '8px' }}>Promised revised pricing proposal SLA</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Sent at 4:25 PM</span>
                  <button 
                    onClick={() => onTriggerAction('draft_email', { recipient: 'Rahul' })}
                    className="btn-action btn-subtle" 
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                  >
                    <Mail size={11} /> Draft Reply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Negative Paradigm / Blocker with 1-Click WebMCP Fix */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid #f43f5e', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} color="#f43f5e" />
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>Yesterday's Blocker</span>
              </div>
              <span className="pill pill-rose">MIA Negative Paradigm</span>
            </div>

            <div style={{ background: 'rgba(244, 63, 94, 0.06)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(244, 63, 94, 0.2)', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fecdd3', marginBottom: '4px' }}>
                Docker Deployment Failed (6:42 PM)
              </div>
              <p style={{ fontSize: '12px', color: '#fda4af', lineHeight: '1.4', marginBottom: '8px' }}>
                Port 5432 conflict detected on container <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>tiger-timescaledb</code>.
              </p>
              <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                Recorded in TigerDB <code style={{ fontFamily: 'var(--font-mono)' }}>trajectory_logs</code> as error.
              </div>
            </div>
          </div>

          <div>
            <button 
              onClick={() => onTriggerAction('docker_heal', { container: 'tiger-timescaledb' })}
              className="btn-action btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
            >
              <Wrench size={14} />
              <span>WebMCP: Auto-Heal & Verify Container</span>
            </button>
            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-subtle)', marginTop: '6px' }}>
              Direct execution without copying commands
            </div>
          </div>
        </div>

        {/* Card 3: Today's Action Plan */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '3px solid #10b981', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="#10b981" />
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>Today's Action Plan</span>
              </div>
              <span className="pill pill-emerald">Scheduled</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {today?.map((item, idx) => (
                <div key={item.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(255, 255, 255, 0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    {item.time}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <button 
              onClick={() => onTriggerAction('resume_session', {})}
              className="btn-action btn-subtle" 
              style={{ width: '100%', justifyContent: 'center', padding: '9px 14px' }}
            >
              <ArrowUpRight size={14} />
              <span>Resume Yesterday's 3 Tabs & Files</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
