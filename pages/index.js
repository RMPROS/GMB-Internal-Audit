import { useState, useEffect, useRef, useCallback } from 'react';

const G = {
  navy:   '#0A2342',
  navy2:  '#0d3566',
  orange: '#FF8C00',
  green:  '#16a34a',
  red:    '#dc2626',
  yellow: '#d97706',
  gray:   '#6b7280',
  gray2:  '#9ca3af',
  border: '#e5e7eb',
  bg:     '#f0f2f5',
  sidebar:'#1e293b',
};

const gradeColor  = { A: '#16a34a', B: '#FF8C00', C: '#d97706', F: '#dc2626' };
const statusColor = { good: '#16a34a', warning: '#d97706', critical: '#dc2626' };
const statusBg    = { good: '#f0fdf4', warning: '#fffbeb', critical: '#fef2f2' };
const statusTag   = { good: 'GOOD', warning: 'IMPROVE', critical: 'CRITICAL' };
const statusIcon  = { good: '✓', warning: '⚠', critical: '✕' };

function ScoreRing({ score, grade, size = 130 }) {
  const r     = (size / 2) - 10;
  const circ  = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  const color = gradeColor[grade] || G.orange;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={G.border} strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 - 6} textAnchor="middle" fill={G.navy}
        style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: size * 0.27, fontWeight: 700 }}>{score}</text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle" fill={color}
        style={{ fontSize: size * 0.11, fontWeight: 800, letterSpacing: 1 }}>{grade}-GRADE</text>
    </svg>
  );
}

function SectionCard({ sec }) {
  const sc = sec.score >= 75 ? G.green : sec.score >= 50 ? G.orange : G.red;
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${G.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#f8f9fb', borderBottom: `1px solid ${G.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{sec.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: G.navy }}>{sec.title}</div>
            <div style={{ fontSize: 11, color: G.gray2, marginTop: 1 }}>{sec.subtitle}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 14px', borderRadius: 100, background: sc + '20', color: sc }}>{sec.score}/100</div>
      </div>
      {sec.findings.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 18px', borderBottom: i < sec.findings.length - 1 ? `1px solid #f3f4f6` : 'none' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1, background: statusBg[f.status], color: statusColor[f.status] }}>
            {statusIcon[f.status]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: G.navy, marginBottom: 2 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: G.gray, lineHeight: 1.55 }}>{f.desc}</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, padding: '3px 9px', borderRadius: 100, flexShrink: 0, background: statusBg[f.status], color: statusColor[f.status] }}>
            {statusTag[f.status]}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InternalAuditTool() {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [ddOpen,      setDdOpen]      = useState(false);
  const [searching,   setSearching]   = useState(false);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [running,     setRunning]     = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [progMsg,     setProgMsg]     = useState('');
  const [auditResult, setAuditResult] = useState(null);
  const [auditBiz,    setAuditBiz]    = useState(null);
  const [error,       setError]       = useState('');
  const [savingPdf,   setSavingPdf]   = useState(false);
  const [history,     setHistory]     = useState([]);
  const [activeTab,   setActiveTab]   = useState('audit');
  const debounce  = useRef(null);
  const ddRef     = useRef(null);
  const reportRef = useRef(null);

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem('gmb_audit_history') || '[]');
      setHistory(h);
    } catch {}
  }, []);

  useEffect(() => {
    const h = e => { if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const searchPlaces = useCallback(async q => {
    if (q.length < 2) { setResults([]); setDdOpen(false); return; }
    setSearching(true);
    try {
      const res  = await fetch('/api/search?q=' + encodeURIComponent(q));
      const data = await res.json();
      setResults(data.results || []);
      setDdOpen((data.results || []).length > 0);
    } catch { setResults([]); } finally { setSearching(false); }
  }, []);

  const handleQueryChange = e => {
    const q = e.target.value;
    setQuery(q); setSelectedBiz(null);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => searchPlaces(q), 350);
  };

  const selectBiz = r => {
    setSelectedBiz({ name: r.name, address: r.formatted_address, placeId: r.place_id });
    setQuery(r.name); setDdOpen(false); setError('');
  };

  const runAudit = async () => {
    if (!selectedBiz) { setError('Please select a business first.'); return; }
    setError(''); setRunning(true); setAuditResult(null); setProgress(5); setProgMsg('Fetching Google Places data…');
    try {
      const tick = setInterval(() => {
        setProgress(p => {
          if (p < 30)  { setProgMsg('Fetching Google Places data…'); return p + 3; }
          if (p < 60)  { setProgMsg('Running Claude AI analysis…');  return p + 2; }
          if (p < 88)  { setProgMsg('Scoring your profile…');        return p + 1; }
          return p;
        });
      }, 600);
      const res  = await fetch('/api/audit-internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: selectedBiz.name, placeId: selectedBiz.placeId }),
      });
      clearInterval(tick);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Audit failed.');
      setProgress(100); setProgMsg('Complete!');
      await new Promise(r => setTimeout(r, 400));
      const entry = {
        id: Date.now(), bizName: selectedBiz.name, address: selectedBiz.address,
        score: data.audit.overallScore, grade: data.audit.grade,
        audit: data.audit, runAt: new Date().toISOString(),
      };
      const newHistory = [entry, ...history].slice(0, 50);
      setHistory(newHistory);
      try { localStorage.setItem('gmb_audit_history', JSON.stringify(newHistory)); } catch {}
      setAuditResult(data.audit);
      setAuditBiz(selectedBiz.name);
    } catch (err) {
      setError('⚠️ ' + (err.message || 'Something went wrong.'));
    } finally {
      setRunning(false);
    }
  };

  const savePdf = async () => {
    if (!reportRef.current || !auditResult) return;
    setSavingPdf(true);
    try {
      const { default: jsPDF }       = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pgW     = pdf.internal.pageSize.getWidth();
      const pgH     = pdf.internal.pageSize.getHeight();
      const imgW    = pgW;
      const imgH    = (canvas.height * imgW) / canvas.width;
      let yPos = 0, remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, -yPos, imgW, imgH);
        remaining -= pgH; yPos += pgH;
        if (remaining > 0) pdf.addPage();
      }
      const safe = (auditBiz || 'audit').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`gmb_audit_${safe}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      alert('PDF generation failed: ' + err.message);
    } finally {
      setSavingPdf(false);
    }
  };

  const loadHistoryEntry = entry => {
    setAuditResult(entry.audit);
    setAuditBiz(entry.bizName);
    setActiveTab('audit');
    setQuery(entry.bizName);
    setSelectedBiz({ name: entry.bizName, address: entry.address });
  };

  const clearHistory = () => {
    if (!confirm('Clear all audit history?')) return;
    setHistory([]);
    try { localStorage.removeItem('gmb_audit_history'); } catch {}
  };

  const inp = { border: `1.5px solid ${G.border}`, borderRadius: 10, padding: '11px 14px', fontFamily: 'inherit', fontSize: 14, color: G.navy, background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color .2s' };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Manrope', sans-serif; background: ${G.bg}; }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes rise  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        input:focus { border-color: ${G.orange} !important; }
        .layout { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
        .sidebar { background: ${G.sidebar}; display: flex; flex-direction: column; }
        .main { padding: 32px 36px; overflow-y: auto; }
        .nav-btn { display: flex; align-items: center; gap: 10px; padding: 12px 20px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; background: none; border: none; color: rgba(255,255,255,0.55); width: 100%; text-align: left; transition: all .15s; }
        .nav-btn:hover { background: rgba(255,255,255,.06); color: rgba(255,255,255,.9); }
        .nav-btn.active { background: rgba(255,140,0,.15); color: #fff; border-right: 3px solid ${G.orange}; }
        .card { background: #fff; border: 1.5px solid ${G.border}; border-radius: 16px; padding: 24px; }
        @media (max-width: 860px) {
          .layout { grid-template-columns: 1fr; }
          .main { padding: 20px 16px; }
        }
      `}</style>

      <div className="layout">

        {/* SIDEBAR */}
        <div className="sidebar">
          <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <img src="/logo.png" alt="Rental Marketing Pros" style={{ width: 160, height: 'auto', filter: 'brightness(0) invert(1)', display: 'block', marginBottom: 8 }} />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: G.orange }}>Internal GMB Tool</div>
          </div>
          <div style={{ padding: '12px 0', flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', padding: '8px 20px 4px' }}>Navigation</div>
            <button className={`nav-btn${activeTab === 'audit' ? ' active' : ''}`} onClick={() => setActiveTab('audit')}>
              <span>📊</span> Run Audit
            </button>
            <button className={`nav-btn${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>
              <span>🕐</span> Audit History
              {history.length > 0 && (
                <span style={{ marginLeft: 'auto', background: 'rgba(255,140,0,.3)', color: G.orange, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 100 }}>{history.length}</span>
              )}
            </button>
          </div>
          {history.length > 0 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Quick Stats</div>
              {[
                { label: 'Audits Run', value: history.length },
                { label: 'Avg Score',  value: Math.round(history.reduce((a, b) => a + b.score, 0) / history.length) },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>{s.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.07)', fontSize: 10, color: 'rgba(255,255,255,.18)', lineHeight: 1.6 }}>
            Internal use only · v2.0
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="main">

          {/* ── AUDIT TAB ── */}
          {activeTab === 'audit' && (
            <div style={{ maxWidth: 860, margin: '0 auto', animation: 'rise .3s ease both' }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, color: G.navy, letterSpacing: 0.5 }}>GMB Audit Tool</h1>
                <p style={{ fontSize: 13.5, color: G.gray, marginTop: 4 }}>Search any business, run an AI-powered audit, and save the report as a PDF.</p>
              </div>

              {/* Search */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: G.navy, marginBottom: 12 }}>🔍 Business Search</div>
                <div ref={ddRef} style={{ position: 'relative', marginBottom: 12 }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🏢</span>
                  <input value={query} onChange={handleQueryChange} onFocus={() => results.length && setDdOpen(true)}
                    placeholder="Search for a business name…" style={{ ...inp, paddingLeft: 42 }} />
                  {searching && <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, border: `2.5px solid ${G.border}`, borderTopColor: G.orange, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
                  {ddOpen && results.length > 0 && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', background: '#fff', border: `2px solid ${G.border}`, borderRadius: 12, boxShadow: '0 12px 36px rgba(0,0,0,.1)', zIndex: 200, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
                      {results.map((r, i) => (
                        <div key={r.place_id || i} onMouseDown={() => selectBiz(r)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderBottom: i < results.length - 1 ? `1px solid #f3f4f6` : 'none', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fffbf5'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ width: 30, height: 30, background: G.navy, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🏢</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: G.navy }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: G.gray2, marginTop: 1 }}>{r.formatted_address}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedBiz && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: `linear-gradient(135deg,${G.navy},${G.navy2})`, borderRadius: 11, padding: '12px 16px', marginBottom: 14 }}>
                    <span style={{ fontSize: 18 }}>🏢</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedBiz.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>{selectedBiz.address}</div>
                    </div>
                    <button onClick={() => { setSelectedBiz(null); setQuery(''); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,.2)', color: 'rgba(255,255,255,.5)', fontFamily: 'inherit', fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer' }}>Change</button>
                  </div>
                )}

                {error && <div style={{ background: '#fef2f2', border: `1.5px solid #fecaca`, borderRadius: 9, padding: '10px 14px', fontSize: 13, color: G.red, marginBottom: 12 }}>{error}</div>}

                <button onClick={runAudit} disabled={running || !selectedBiz}
                  style={{ width: '100%', padding: '13px 0', border: 'none', borderRadius: 11, fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: running || !selectedBiz ? 'not-allowed' : 'pointer', background: running || !selectedBiz ? G.border : G.orange, color: running || !selectedBiz ? G.gray2 : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .2s', boxShadow: !running && selectedBiz ? '0 4px 16px rgba(255,140,0,.3)' : 'none' }}>
                  {running
                    ? <><div style={{ width: 16, height: 16, border: `2.5px solid rgba(255,255,255,.4)`, borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> Running Audit…</>
                    : '▶  Run Audit'}
                </button>
              </div>

              {/* Progress */}
              {running && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: G.navy, animation: 'pulse 1.4s ease infinite' }}>{progMsg}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: G.orange }}>{progress}%</span>
                  </div>
                  <div style={{ height: 8, background: G.border, borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg,${G.orange},#ffb347)`, borderRadius: 100, transition: 'width .6s ease' }} />
                  </div>
                </div>
              )}

              {/* Results */}
              {auditResult && !running && (
                <div ref={reportRef}>
                  {/* Score header */}
                  <div className="card" style={{ background: `linear-gradient(135deg,${G.navy},${G.navy2})`, border: 'none', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                    <ScoreRing score={auditResult.overallScore} grade={auditResult.grade} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 8 }}>Audit Complete · {auditBiz}</div>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,.75)', lineHeight: 1.65, marginBottom: 16 }}>{auditResult.summary}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {auditResult.sections.map(s => {
                          const c = s.score >= 75 ? G.green : s.score >= 50 ? G.orange : G.red;
                          return (
                            <div key={s.id} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{s.score}</div>
                              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>{s.title.split(' ')[0]}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={savePdf} disabled={savingPdf}
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 11, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff', cursor: savingPdf ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all .2s' }}>
                      {savingPdf
                        ? <><div style={{ width: 14, height: 14, border: `2px solid rgba(255,255,255,.4)`, borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> Generating…</>
                        : <><span>📄</span> Save PDF</>}
                    </button>
                  </div>

                  {/* Top Priorities */}
                  <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: G.gray2, marginBottom: 14 }}>🎯 Top Priorities</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {auditResult.topPriorities.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: '#fffbf5', border: `1.5px solid rgba(255,140,0,.2)`, borderRadius: 10 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: G.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                          <span style={{ fontSize: 13, color: G.navy, fontWeight: 500 }}>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section cards */}
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: G.gray2, marginBottom: 12 }}>📋 Detailed Findings</div>
                  {auditResult.sections.map(sec => <SectionCard key={sec.id} sec={sec} />)}
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div style={{ maxWidth: 860, margin: '0 auto', animation: 'rise .3s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, color: G.navy, letterSpacing: 0.5 }}>Audit History</h1>
                  <p style={{ fontSize: 13.5, color: G.gray, marginTop: 4 }}>{history.length} audit{history.length !== 1 ? 's' : ''} saved in this browser.</p>
                </div>
                {history.length > 0 && (
                  <button onClick={clearHistory} style={{ background: 'none', border: `1.5px solid ${G.border}`, borderRadius: 9, padding: '8px 16px', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: G.gray, cursor: 'pointer' }}>Clear All</button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: G.navy, marginBottom: 6 }}>No audits yet</div>
                  <div style={{ fontSize: 13, color: G.gray2 }}>Run an audit and it will appear here.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {history.map(entry => {
                    const gc = gradeColor[entry.grade] || G.orange;
                    return (
                      <div key={entry.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'border-color .15s' }}
                        onClick={() => loadHistoryEntry(entry)}
                        onMouseEnter={e => e.currentTarget.style.borderColor = G.orange}
                        onMouseLeave={e => e.currentTarget.style.borderColor = G.border}>
                        <div style={{ width: 52, height: 52, borderRadius: 12, background: gc + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: gc }}>{entry.score}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: G.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.bizName}</div>
                          <div style={{ fontSize: 11, color: G.gray2, marginTop: 2 }}>{entry.address}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: gc + '18', color: gc, marginBottom: 4 }}>{entry.grade}-Grade</div>
                          <div style={{ fontSize: 10, color: G.gray2 }}>{new Date(entry.runAt).toLocaleDateString()}</div>
                        </div>
                        <span style={{ fontSize: 16, color: G.gray2, marginLeft: 8 }}>›</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
