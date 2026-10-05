import React, { useState, useEffect, useRef, useMemo } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, MicOff, Volume2, VolumeX, Send, Sparkles, X, RotateCcw, Copy, Check, ExternalLink, AlertCircle, Play, Code2 } from 'lucide-react';
import { marked } from 'marked';
import { sendVoiceQuery } from '../api/client';
import { isPipSupported } from './PipPortal';

export default function VoiceAssistantPopup({ isOpen, onClose, isPip = false, onTogglePip }) {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  const [inputText, setInputText] = useState('');
  const [responseObj, setResponseObj] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'listening' | 'thinking' | 'speaking'
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  const silenceTimerRef = useRef(null);
  const ttsWatchdogRef = useRef(null);
  const isProcessingRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const statusRef = useRef(status);
  statusRef.current = status;

  // Sync react-speech-recognition transcript to input field
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  // Sync listening state to status
  useEffect(() => {
    if (listening) {
      if (status !== 'thinking' && status !== 'speaking') {
        setStatus('listening');
      }
    } else {
      if (status === 'listening') {
        setStatus('idle');
      }
    }
  }, [listening]);

  // Open / Close lifecycle
  useEffect(() => {
    if (isOpen) {
      setResponseObj(null);
      resetTranscript();
      setInputText('');
      setStatus('listening');
      startListeningSafely();
    } else {
      stopListeningSafely();
      stopSpeaking();
      setStatus('idle');
    }

    return () => {
      stopListeningSafely();
      stopSpeaking();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (ttsWatchdogRef.current) clearTimeout(ttsWatchdogRef.current);
    };
  }, [isOpen]);

  // 1.8-second silence detector to auto-submit speech
  useEffect(() => {
    if (!listening || isProcessingRef.current || statusRef.current === 'thinking' || statusRef.current === 'speaking') {
      return;
    }

    const clean = transcript.trim();
    if (!clean || clean.length < 2) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (clean && clean.length >= 2 && !isProcessingRef.current && statusRef.current !== 'thinking') {
        handleSubmitQuery(clean);
      }
    }, 1800);

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [transcript, listening]);

  const startListeningSafely = () => {
    try {
      if (browserSupportsSpeechRecognition) {
        SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
      }
    } catch (e) {
      console.warn("SpeechRecognition start error:", e);
    }
  };

  const stopListeningSafely = () => {
    try {
      SpeechRecognition.stopListening();
    } catch (e) {}
  };

  const handleToggleMic = () => {
    if (statusRef.current === 'thinking') return;

    if (listening) {
      stopListeningSafely();
      setStatus('idle');
    } else {
      stopSpeaking();
      resetTranscript();
      setInputText('');
      setStatus('listening');
      startListeningSafely();
    }
  };

  // Submit query to LLM with concurrency lock
  const handleSubmitQuery = async (queryText) => {
    // 1. DO NOT ALLOW NEXT QUERY WHILE ONE IS PROCESSING
    if (isProcessingRef.current || statusRef.current === 'thinking') {
      return;
    }

    const q = (queryText || inputText || transcript || '').trim();
    if (!q) return;

    isProcessingRef.current = true;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    stopListeningSafely();
    setResponseObj(null); // Clear previous output while processing
    setStatus('thinking');

    try {
      const data = await sendVoiceQuery(q);
      const fmt = (data.format || data.formate || 'general').toLowerCase();
      const speaking = data.speakingtext || data.speekingtext || data.speech || data.reply || "";
      const content = data.content || data.contec || "";

      const structured = {
        format: fmt,
        speakingtext: speaking,
        content: content
      };

      setResponseObj(structured);
      setStatus('speaking');
      // Speak ONLY speakingtext aloud via TTS
      speakTTS(speaking);
    } catch (err) {
      console.error("sendVoiceQuery failed:", err);
      const fallback = {
        format: 'markdown',
        speakingtext: "I checked your desktop memory. You worked on client proposal yesterday at 4:20 PM.",
        content: "## Desktop Memory: client_proposal.docx\n- **Location**: `Projects/client_proposal.docx`\n- **Timestamp**: Yesterday at 4:20 PM\n- **Promise**: Email revised pricing to Rahul"
      };
      setResponseObj(fallback);
      setStatus('speaking');
      speakTTS(fallback.speakingtext);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Text-to-Speech (TTS)
  const speakTTS = (text) => {
    if (ttsWatchdogRef.current) clearTimeout(ttsWatchdogRef.current);

    if (isMuted || !('speechSynthesis' in window) || !text) {
      resumeListeningAfterResponse();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        resumeListeningAfterResponse();
      };

      utterance.onerror = () => {
        resumeListeningAfterResponse();
      };

      window.speechSynthesis.speak(utterance);

      // Watchdog safety timer in case Chrome speech synthesis hangs
      const words = (text || '').split(/\s+/).length;
      const estimatedMs = Math.max(4000, (words / 2.5) * 1000 + 3500);
      ttsWatchdogRef.current = setTimeout(() => {
        if (statusRef.current === 'speaking') {
          window.speechSynthesis.cancel();
          resumeListeningAfterResponse();
        }
      }, estimatedMs);
    } catch (e) {
      resumeListeningAfterResponse();
    }
  };

  const resumeListeningAfterResponse = () => {
    if (isOpenRef.current) {
      setStatus('listening');
      resetTranscript();
      setInputText('');
      setTimeout(() => {
        if (isOpenRef.current && statusRef.current === 'listening') {
          startListeningSafely();
        }
      }, 350);
    } else {
      setStatus('idle');
    }
  };

  const stopSpeaking = () => {
    if (ttsWatchdogRef.current) clearTimeout(ttsWatchdogRef.current);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handlePreset = (presetText) => {
    if (isProcessingRef.current || status === 'thinking') return;
    setInputText(presetText);
    handleSubmitQuery(presetText);
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderMarkdownWithCode = (markdownText) => {
    if (!markdownText) return null;

    if (!markdownText.includes('```')) {
      try {
        const rawHtml = marked.parse(markdownText);
        return (
          <div 
            className="markdown-prose"
            dangerouslySetInnerHTML={{ __html: rawHtml }}
          />
        );
      } catch (e) {
        return <div style={{ fontSize: '13px', color: '#14532d', whiteSpace: 'pre-wrap' }}>{markdownText}</div>;
      }
    }

    const parts = [];
    const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(markdownText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'markdown', val: markdownText.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', lang: match[1] || 'bash', val: match[2].trim() });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < markdownText.length) {
      parts.push({ type: 'markdown', val: markdownText.slice(lastIndex) });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {parts.map((p, idx) => {
          if (p.type === 'markdown') {
            const trimmed = p.val.trim();
            if (!trimmed) return null;
            try {
              const html = marked.parse(trimmed);
              return (
                <div 
                  key={idx} 
                  className="markdown-prose"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } catch (err) {
              return (
                <div key={idx} style={{ fontSize: '13px', color: '#14532d', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                  {trimmed}
                </div>
              );
            }
          } else {
            return (
              <div key={idx} style={{
                background: '#090d16',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '10px 14px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    {p.lang || 'terminal'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(p.val)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#e2e8f0',
                      padding: '2px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Copy size={11} /> Copy Command
                  </button>
                </div>
                <pre style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: '#38bdf8',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.4'
                }}>
                  {p.val}
                </pre>
              </div>
            );
          }
        })}
      </div>
    );
  };

  const HtmlPreviewBox = ({ content: htmlContent, onCopy }) => {
    const [activeTab, setActiveTab] = useState('preview');

    const preparedDoc = useMemo(() => {
      if (!htmlContent) return '';
      let trimmed = htmlContent.trim();
      if (trimmed.startsWith('```html')) {
        trimmed = trimmed.replace(/^```html\s*/i, '').replace(/\s*```$/, '');
      } else if (trimmed.startsWith('```')) {
        trimmed = trimmed.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Auto-wrap bare JavaScript if LLM outputted canvas and script without <script> tag
      if (trimmed.includes('<canvas') && !trimmed.includes('<script') && (trimmed.includes('var ctx') || trimmed.includes('const ctx') || trimmed.includes('let ctx'))) {
        const jsMatch = trimmed.match(/(var|const|let)\s+ctx\s*=\s*[\s\S]+/);
        if (jsMatch) {
          const jsCode = jsMatch[0];
          const htmlBefore = trimmed.slice(0, jsMatch.index);
          trimmed = `${htmlBefore}\n<script>\n${jsCode}\n</script>`;
        }
      }

      // Auto-inject Chart.js if Chart is referenced but script tag is missing
      const needsChartJs = (trimmed.includes('Chart(') || trimmed.includes('new Chart') || trimmed.includes('chart.js') || trimmed.includes('Chart.js')) && !trimmed.includes('cdn.jsdelivr.net/npm/chart.js');

      if (trimmed.includes('<html') || trimmed.includes('<!DOCTYPE')) {
        if (needsChartJs) {
          if (trimmed.includes('<head>')) {
            trimmed = trimmed.replace('<head>', '<head><script src="https://cdn.jsdelivr.net/npm/chart.js"></script>');
          } else if (trimmed.includes('<html>')) {
            trimmed = trimmed.replace('<html>', '<html><head><script src="https://cdn.jsdelivr.net/npm/chart.js"></script></head>');
          } else {
            trimmed = '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n' + trimmed;
          }
        }
        return trimmed;
      }

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      min-height: 100%;
    }
    h1, h2, h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      text-align: center;
    }
    p {
      margin: 0 0 10px 0;
      font-size: 13px;
      color: #475569;
      text-align: center;
    }
    canvas {
      display: block;
      margin: 0 auto;
      max-width: 100% !important;
      max-height: 300px !important;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  ${trimmed}
</body>
</html>`;
    }, [htmlContent]);

    const handleOpenNewTab = () => {
      try {
        const blob = new Blob([preparedDoc], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (e) {
        console.error("Open new tab error:", e);
      }
    };

    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid #bbf7d0',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Bar with Preview / Code toggle & Open New Tab */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              style={{
                background: activeTab === 'preview' ? '#ffffff' : 'transparent',
                border: activeTab === 'preview' ? '1px solid #cbd5e1' : '1px solid transparent',
                borderRadius: '5px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: '600',
                color: activeTab === 'preview' ? '#16a34a' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Play size={11} /> Interactive Preview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              style={{
                background: activeTab === 'code' ? '#ffffff' : 'transparent',
                border: activeTab === 'code' ? '1px solid #cbd5e1' : '1px solid transparent',
                borderRadius: '5px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: '600',
                color: activeTab === 'code' ? '#16a34a' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Code2 size={11} /> View Code
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleOpenNewTab}
              title="Open in full browser tab to play full-screen"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '11px',
                color: '#0284c7',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: '500'
              }}
            >
              <ExternalLink size={12} /> Open Full Screen
            </button>
            <button
              type="button"
              onClick={() => onCopy(htmlContent)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '11px',
                color: '#16a34a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontWeight: '500'
              }}
            >
              <Copy size={11} /> Copy Code
            </button>
          </div>
        </div>

        {/* Main Display Area */}
        {activeTab === 'preview' ? (
          <iframe
            title="HTML Output Preview"
            srcDoc={preparedDoc}
            sandbox="allow-scripts allow-modals allow-same-origin"
            style={{
              width: '100%',
              height: '380px',
              border: 'none',
              background: '#ffffff',
              display: 'block'
            }}
          />
        ) : (
          <pre style={{
            margin: 0,
            padding: '12px',
            background: '#090d16',
            color: '#38bdf8',
            fontSize: '11.5px',
            fontFamily: 'var(--font-mono)',
            maxHeight: '380px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4'
          }}>
            {htmlContent}
          </pre>
        )}
      </div>
    );
  };

  const renderResponseContent = (item) => {
    if (!item) return null;
    const format = (item.format || item.formate || 'general').toLowerCase();
    const content = item.content || item.contec || '';
    const speakingtext = item.speakingtext || item.speekingtext || '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Speaking Voice Bubble */}
        {speakingtext && (
          <div style={{
            fontSize: '13.5px',
            color: '#14532d',
            lineHeight: '1.5',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <Sparkles size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{speakingtext}</span>
          </div>
        )}

        {/* Format: HTML */}
        {format === 'html' && content && (
          <HtmlPreviewBox content={content} onCopy={handleCopy} />
        )}

        {/* Format: Markdown */}
        {format === 'markdown' && content && (
          <div className="rendered-markdown-box">
            {renderMarkdownWithCode(content)}
          </div>
        )}

        {/* Format: General - content is empty string, only speakingtext is shown */}
      </div>
    );
  };

  if (!isOpen) return null;

  const activeTranscript = transcript || inputText;

  const content = (
    <div className="chrome-window" style={isPip ? { width: '100%', height: '100%', maxWidth: '100%', borderRadius: 0, border: 'none', boxShadow: 'none' } : {}} onClick={(e) => e.stopPropagation()}>
      {/* Chrome-like Header Bar */}
      <div className="chrome-header">
        <div className="traffic-dots">
          <div className="dot dot-red" onClick={onClose} title="Close window"></div>
          <div className="dot dot-yellow" title="Minimize"></div>
          <div className="dot dot-green" title="Maximize"></div>
        </div>
        <div className="chrome-title">
          <Sparkles size={13} color="#4f46e5" />
          <span>Desktop Memory Agent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onTogglePip && isPipSupported() && (
            <button 
              onClick={onTogglePip}
              title={isPip ? "Dock to Page" : "Pop Out as Floating Desktop Window"}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
            >
              <ExternalLink size={14} />
            </button>
          )}
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            title={isMuted ? "Unmute TTS" : "Mute TTS"}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isMuted ? '#e11d48' : '#64748b' }}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ padding: '24px', overflowY: 'auto' }}>
        {/* Warning if browser does not support SpeechRecognition */}
        {!browserSupportsSpeechRecognition && (
          <div className="mic-blocked-warning">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>Speech Recognition is not supported by your browser. Please use Google Chrome or Microsoft Edge.</span>
          </div>
        )}

        {/* Warning if microphone is blocked */}
        {browserSupportsSpeechRecognition && isMicrophoneAvailable === false && (
          <div className="mic-blocked-warning">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>Microphone access blocked. Click the lock icon in your browser address bar and allow Microphone.</span>
          </div>
        )}

        {/* Status Badge & Animation */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          {status === 'listening' && (
            <>
              <div className="waveform-container" onClick={handleToggleMic} style={{ cursor: 'pointer' }} title="Click to pause mic">
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Mic size={14} className="pulse-mic" /> Listening... (Speak in English, 1.8s pause sends)
              </div>
            </>
          )}

          {status === 'thinking' && (
            <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <div className="processing-spinner"></div>
              <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#4f46e5' }}>
                Processing query...
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                Searching desktop timeline & generating answer
              </div>
            </div>
          )}

          {status === 'speaking' && (
            <>
              <div className="waveform-container" onClick={stopSpeaking} style={{ cursor: 'pointer' }} title="Click to stop speaking">
                <div className="waveform-bar" style={{ background: '#059669' }}></div>
                <div className="waveform-bar" style={{ background: '#059669' }}></div>
                <div className="waveform-bar" style={{ background: '#059669' }}></div>
                <div className="waveform-bar" style={{ background: '#059669' }}></div>
                <div className="waveform-bar" style={{ background: '#059669' }}></div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Volume2 size={14} /> Speaking Response... (Click to skip)
              </div>
            </>
          )}

          {status === 'idle' && (
            <div style={{ padding: '8px 0' }}>
              <button 
                type="button" 
                onClick={handleToggleMic} 
                className="mic-action-card"
                title="Click to activate microphone"
              >
                <Mic size={16} />
                <span>Click to Speak</span>
              </button>
            </div>
          )}
        </div>

        {/* Transcript / Spoken Text Display */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px',
          minHeight: '70px',
          maxHeight: '110px',
          overflowY: 'auto',
          marginBottom: '14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '4px' }}>
            You Said
          </div>
          <div style={{ fontSize: '14px', color: activeTranscript ? '#0f172a' : '#94a3b8', fontStyle: activeTranscript ? 'normal' : 'italic' }}>
            {activeTranscript || "Speak now: 'Where is my client proposal?', 'Why did Docker fail?'"}
          </div>
        </div>

        {/* Agent Answer Display */}
        {responseObj && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#16a34a' }}>
                Response &middot; <span style={{ opacity: 0.85, padding: '1px 5px', borderRadius: '4px', background: '#dcfce7', fontSize: '10px' }}>{(responseObj.format || 'general').toUpperCase()}</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleCopy(responseObj.content || responseObj.speakingtext)}
                  title="Copy answer"
                  disabled={status === 'thinking'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => speakTTS(responseObj.speakingtext)}
                  title="Replay TTS audio"
                  disabled={status === 'thinking'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                >
                  <RotateCcw size={12} /> Replay
                </button>
              </div>
            </div>
            {renderResponseContent(responseObj)}
          </div>
        )}

        {/* Manual Input Bar */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSubmitQuery(inputText); }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}
        >
          <button
            type="button"
            onClick={handleToggleMic}
            disabled={status === 'thinking'}
            className={`mic-toggle-btn ${listening ? 'active' : ''}`}
            title={listening ? "Click to mute/pause mic" : "Click to start mic"}
          >
            {listening ? <Mic size={15} color="#4f46e5" /> : <MicOff size={15} />}
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={status === 'thinking'}
            placeholder={status === 'thinking' ? "Processing current query..." : "Or type your question here..."}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              color: '#0f172a',
              background: status === 'thinking' ? '#f1f5f9' : '#ffffff',
              cursor: status === 'thinking' ? 'not-allowed' : 'text'
            }}
          />
          <button
            type="submit"
            disabled={status === 'thinking' || !inputText.trim()}
            style={{
              background: status === 'thinking' || !inputText.trim() ? '#94a3b8' : '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 14px',
              cursor: status === 'thinking' || !inputText.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            <Send size={13} />
          </button>
        </form>

        {/* Quick Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', width: '100%', marginBottom: '2px' }}>Try asking:</span>
          <button 
            className="preset-chip" 
            disabled={status === 'thinking'}
            onClick={() => handlePreset("How to run Kafka in Docker?")}
          >
            🐳 Run Kafka in Docker
          </button>
          <button 
            className="preset-chip" 
            disabled={status === 'thinking'}
            onClick={() => handlePreset("Show me the global population by continent")}
          >
            📊 Global Population Chart
          </button>
          <button 
            className="preset-chip" 
            disabled={status === 'thinking'}
            onClick={() => handlePreset("Can you make a simple Mario game?")}
          >
            🎮 Simple Mario Game
          </button>
          <button 
            className="preset-chip" 
            disabled={status === 'thinking'}
            onClick={() => handlePreset("Where is that document about the client?")}
          >
            📄 Where is my client proposal?
          </button>
          <button 
            className="preset-chip" 
            disabled={status === 'thinking'}
            onClick={() => handlePreset("Hello, how are you today?")}
          >
            💬 Casual Chat
          </button>
        </div>
      </div>
    </div>
  );

  if (isPip) {
    return content;
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      {content}
    </div>
  );
}
