import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Target, ChevronRight, ChevronDown, Check, X, Plus, Trash2, Send,
  Lock, Star, Award, Eye, Edit3, Clock, CheckCircle2, XCircle, Save,
  Play, DollarSign, Calendar, Users, Heart, TrendingUp, Zap, Shield,
  FileText, RotateCcw, Settings, History, ClipboardList, Upload,
  RefreshCw, Activity, BarChart2, Info, User
} from 'lucide-react';
import {
  KPI_PILLARS, DEFAULT_PILLAR_TEMPLATES, AUTO_KPI_REGISTRY,
  APPROVAL_CHAIN, CORE_VALUES, computeOkrResults
} from '../constants';
import { validateScore, auditLog } from '../utils/security';

// ── localStorage helpers ──
const LS_KEY = 'wms_kpi_assessments';
const SEASON_KEY = 'wms_assessment_season';
const TEMPLATE_KEY = 'wms_kpi_templates';
const safeParse = (key, fb) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };

const getCurrentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
};

const SCORE_LABELS = { 1: 'Needs Improvement', 2: 'Below Expectations', 3: 'Meets Expectations', 4: 'Exceeds Expectations', 5: 'Outstanding' };
const SOURCE_BADGE = {
  auto: { label: 'Auto', bg: 'var(--odoo-success)', text: '#fff' },
  manual: { label: 'Manual', bg: 'var(--odoo-purple)', text: '#fff' },
  md: { label: 'MD', bg: 'var(--odoo-danger)', text: '#fff' },
  '360': { label: '360', bg: '#8b5cf6', text: '#fff' },
};

const STATUS_CFG = {
  draft: { label: 'Draft', color: 'var(--odoo-text-muted)', bg: 'var(--odoo-surface-high)', Icon: Edit3 },
  submitted: { label: 'Submitted', color: '#3b82f6', bg: '#eff6ff', Icon: Send },
  reviewing: { label: 'Reviewing', color: 'var(--odoo-warning)', bg: '#fffbeb', Icon: Eye },
  approved: { label: 'Approved', color: 'var(--odoo-success)', bg: '#f0fdf4', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'var(--odoo-danger)', bg: '#fef2f2', Icon: XCircle },
};

const PILLAR_ICONS = { Users, Heart, TrendingUp, Zap, DollarSign, Shield, Star, Award };
const getPillarIcon = (iconName) => PILLAR_ICONS[iconName] || Target;

const toScale5 = (score) => {
  if (score === null || score === undefined) return null;
  if (score >= 90) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
};

const genId = () => `kpi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Pillar border colors matching Stitch design
const PILLAR_BORDER_COLORS = {
  developPeople: 'var(--odoo-purple)',
  driveValue: '#3b82f6',
  makeRevenue: 'var(--odoo-success)',
  championProgress: 'var(--odoo-warning)',
  deliverFinancial: '#6366f1',
  manageRisk: 'var(--odoo-danger)',
  liveValues: '#8b5cf6',
  goAboveBeyond: '#0ea5e9',
};

// Pillar score colors for the score text display
const PILLAR_SCORE_COLORS = {
  developPeople: 'var(--odoo-purple)',
  driveValue: '#2563eb',
  makeRevenue: '#059669',
  championProgress: '#d97706',
  deliverFinancial: '#4f46e5',
  manageRisk: 'var(--odoo-danger)',
  liveValues: '#7c3aed',
  goAboveBeyond: '#0284c7',
};

// ── Score Buttons ──
const ScoreButtons = ({ value, onChange, disabled, color = 'var(--odoo-purple)' }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} onClick={() => !disabled && onChange(n)} title={SCORE_LABELS[n]} disabled={disabled}
        className="transition-all disabled:opacity-50"
        style={{
          width: 28, height: 28, fontSize: 12, fontWeight: 700,
          borderRadius: 'var(--odoo-radius)',
          ...(value === n
            ? { background: color, borderColor: color, color: '#fff', transform: 'scale(1.1)', boxShadow: `0 2px 6px ${typeof color === 'string' && color.startsWith('#') ? color + '66' : 'rgba(113,75,103,0.4)'}`, border: `2px solid ${color}` }
            : { background: 'transparent', color: 'var(--odoo-text-muted)', border: '2px solid var(--odoo-surface-high)' }),
        }}>
        {n}
      </button>
    ))}
  </div>
);

// ── StatusBadge ──
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
  const Icon = cfg.Icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 uppercase tracking-widest"
      style={{ background: cfg.bg, color: cfg.color, borderRadius: 'var(--odoo-radius)', fontSize: 10, fontWeight: 700 }}>
      <Icon style={{ width: 12, height: 12 }} />{cfg.label}
    </span>
  );
};

// ── Compute helpers ──
function computeFinalScore(kpi, season) {
  if (kpi.source === 'auto') return kpi.approverScore ?? kpi.autoScale5;
  if (kpi.source === 'md') return season?.ebitdaScore ?? null;
  if (kpi.source === '360') {
    if (kpi.feedback360Scores?.length) return Math.round(kpi.feedback360Scores.reduce((a, b) => a + b, 0) / kpi.feedback360Scores.length);
    return kpi.selfScore;
  }
  return kpi.approverScore ?? kpi.selfScore;
}

function calcPillarScore(pillar, season) {
  let sum = 0, totalW = 0;
  for (const kpi of pillar.kpis) {
    const fs = computeFinalScore(kpi, season);
    if (fs != null) { sum += fs * kpi.kpiWeight; totalW += kpi.kpiWeight; }
  }
  return totalW > 0 ? sum / totalW : 0;
}

function calcTotalScore(pillars, season) {
  if (!Array.isArray(pillars)) return 0;
  let sum = 0;
  for (const p of pillars) {
    if (p.weight > 0) sum += calcPillarScore(p, season) * p.weight / 100;
  }
  return sum;
}

function getTemplatesForRole(role) {
  const custom = safeParse(TEMPLATE_KEY, {});
  return custom[role] || DEFAULT_PILLAR_TEMPLATES[role] || DEFAULT_PILLAR_TEMPLATES.picker;
}

function getGrade(score) {
  if (score >= 4.5) return 'A';
  if (score >= 3.5) return 'B';
  if (score >= 2.5) return 'C';
  if (score >= 1.5) return 'D';
  return 'F';
}

function getGradeColor(grade) {
  if (grade === 'A') return 'var(--odoo-success)';
  if (grade === 'B') return '#3b82f6';
  if (grade === 'C') return 'var(--odoo-warning)';
  return 'var(--odoo-danger)';
}

// ── PillarCard (Stitch-style perspective card) ──
const PillarCard = React.memo(({ pillar, pillarDef, season, isApprover, assessmentStatus, onKpiChange, readOnly }) => {
  const [rubricOpen, setRubricOpen] = useState(null);
  const score = calcPillarScore(pillar, season);
  const borderColor = PILLAR_BORDER_COLORS[pillar.pillarKey] || pillarDef.color;
  const scoreColor = PILLAR_SCORE_COLORS[pillar.pillarKey] || borderColor;
  const isAuto = pillar.kpis.some(k => k.source === 'auto');
  const isManual = pillar.kpis.some(k => k.source === 'manual' || k.source === '360');
  const sourceLabel = isAuto && !isManual ? 'Auto' : isManual && !isAuto ? 'Manual' : 'Mixed';
  const sourceBg = isAuto && !isManual ? 'var(--odoo-success)' : 'var(--odoo-purple)';

  return (
    <div
      style={{
        background: 'var(--odoo-surface)',
        borderLeft: `4px solid ${borderColor}`,
        padding: 20,
        boxShadow: 'var(--odoo-shadow-sm)',
        borderRadius: 'var(--odoo-radius)',
        transition: 'var(--odoo-transition)',
      }}
      className="hover:shadow-md"
    >
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>{pillarDef.label}</h3>
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          padding: '2px 8px', borderRadius: 9999, color: '#fff',
          background: sourceBg, letterSpacing: '0.02em',
        }}>
          {sourceLabel}
        </span>
      </div>

      {/* KPI items list */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
        {pillar.kpis.map((kpi) => {
          const fs = computeFinalScore(kpi, season);
          return (
            <li key={kpi.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 11, fontWeight: 500, color: 'var(--odoo-text-secondary)',
              padding: '6px 0',
            }}>
              <span>{kpi.label}</span>
              <span style={{ fontWeight: 700, color: 'var(--odoo-text)' }}>
                {fs != null ? `${fs}/5` : (kpi.systemScore != null ? `${kpi.systemScore}%` : '---')}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Score slider area */}
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 10, fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          <span>Perspective Weight: {pillar.weight}%</span>
          <span style={{ color: scoreColor, fontWeight: 900 }}>Score: {score.toFixed(1)}</span>
        </div>
        <div style={{
          width: '100%', height: 4,
          background: 'var(--odoo-surface-high)',
          borderRadius: 2, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            width: `${(score / 5) * 100}%`, height: '100%',
            background: borderColor, borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Expandable scoring section for self/approver */}
      {pillar.kpis.map((kpi, ki) => {
        const isAutoKpi = kpi.source === 'auto';
        const isMd = kpi.source === 'md';
        const is360 = kpi.source === '360';
        const showScoring = (!readOnly && !isAutoKpi && !isMd) || isApprover || isAutoKpi || isMd || is360;
        if (!showScoring) return null;

        return (
          <div key={`score-${kpi.id}`} style={{
            marginTop: 12, paddingTop: 12,
            borderTop: '1px solid var(--odoo-border-ghost)',
          }}>
            <div className="flex flex-wrap items-center gap-3">
              {isAutoKpi && (
                <div className="flex items-center gap-2">
                  <Lock style={{ width: 12, height: 12, color: '#3b82f6' }} />
                  <span style={{ fontSize: 10, color: 'var(--odoo-text-muted)' }}>System: {kpi.systemScore ?? '---'}/100</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>= {kpi.autoScale5 ?? '---'}/5</span>
                </div>
              )}
              {isMd && (
                <div className="flex items-center gap-2">
                  <Lock style={{ width: 12, height: 12, color: 'var(--odoo-danger)' }} />
                  <span style={{ fontSize: 10, color: 'var(--odoo-text-muted)' }}>MD EBITDA:</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--odoo-danger)' }}>{season?.ebitdaScore ?? 'Not set'}</span>
                </div>
              )}
              {is360 && kpi.feedback360Scores?.length > 0 && (
                <div style={{ fontSize: 10, color: '#8b5cf6' }}>
                  360 avg: {(kpi.feedback360Scores.reduce((a, b) => a + b, 0) / kpi.feedback360Scores.length).toFixed(1)}
                </div>
              )}
              {!isAutoKpi && !isMd && !readOnly && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--odoo-text-muted)', marginBottom: 2 }}>Self Score</div>
                  <ScoreButtons value={kpi.selfScore} color={borderColor}
                    onChange={(v) => onKpiChange(pillar.pillarKey, ki, 'selfScore', v)} disabled={readOnly} />
                </div>
              )}
              {!isAutoKpi && !isMd && readOnly && kpi.selfScore && (
                <div style={{ fontSize: 10, color: 'var(--odoo-text-muted)' }}>Self: <b>{kpi.selfScore}/5</b></div>
              )}
              {isApprover && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--odoo-text-muted)', marginBottom: 2 }}>Approver Score</div>
                  <ScoreButtons value={kpi.approverScore} color={borderColor}
                    onChange={(v) => onKpiChange(pillar.pillarKey, ki, 'approverScore', v)}
                    disabled={!(assessmentStatus === 'submitted' || assessmentStatus === 'reviewing')} />
                </div>
              )}
            </div>

            {/* Rubric toggle */}
            {kpi.rubric && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setRubricOpen(rubricOpen === kpi.id ? null : kpi.id)}
                  style={{ fontSize: 10, color: 'var(--odoo-purple)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  {rubricOpen === kpi.id ? 'Hide rubric' : 'Show rubric'}
                </button>
                {rubricOpen === kpi.id && (
                  <div className="grid grid-cols-5 gap-1" style={{ marginTop: 4 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} style={{
                        padding: 6, borderRadius: 'var(--odoo-radius)', fontSize: 9,
                        background: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)',
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: 2, color: 'var(--odoo-text)' }}>{n}</div>
                        <div style={{ color: 'var(--odoo-text-muted)' }}>{kpi.rubric[n]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ── Weight Summary Bar ──
const WeightBar = ({ pillars }) => (
  <div className="flex overflow-hidden" style={{ borderRadius: 'var(--odoo-radius)', height: 24, background: 'var(--odoo-surface-high)' }}>
    {pillars.filter(p => p.weight > 0).map(p => {
      const def = KPI_PILLARS.find(d => d.key === p.pillarKey);
      const borderColor = PILLAR_BORDER_COLORS[p.pillarKey] || def?.color || '#6b7280';
      return (
        <div key={p.pillarKey} className="flex items-center justify-center truncate"
          style={{ width: `${p.weight}%`, background: borderColor, fontSize: 9, fontWeight: 700, color: '#fff' }}
          title={`${def?.label}: ${p.weight}%`}>
          {p.weight >= 8 ? `${def?.label?.split(' ')[0]} ${p.weight}%` : `${p.weight}%`}
        </div>
      );
    })}
  </div>
);

// ── Radar SVG component (Stitch-style) ──
const RadarChart = ({ pillars, season }) => {
  const scores = pillars.map(p => calcPillarScore(p, season));
  const n = scores.length;
  if (n === 0) return null;
  const cx = 100, cy = 100, maxR = 80;
  const getPoint = (idx, r) => {
    const angle = (Math.PI * 2 * idx) / n - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };
  const dataPoints = scores.map((s, i) => getPoint(i, (s / 5) * maxR));
  const polygon = dataPoints.map(p => p.join(',')).join(' ');
  const labels = pillars.map(p => {
    const def = KPI_PILLARS.find(d => d.key === p.pillarKey);
    return def?.label?.split(' ')[0]?.toUpperCase() || '';
  });

  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 280 }}>
      {[80, 60, 40, 20].map(r => (
        <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="var(--odoo-surface-high)" strokeWidth="1" />
      ))}
      {Array.from({ length: n }).map((_, i) => {
        const [x, y] = getPoint(i, maxR);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--odoo-surface-high)" strokeWidth="1" />;
      })}
      <polygon points={polygon} fill="rgba(113, 75, 103, 0.2)" stroke="var(--odoo-purple)" strokeWidth="2" />
      {labels.map((label, i) => {
        const [x, y] = getPoint(i, maxR + 15);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" fill="var(--odoo-text-muted)" fontSize="6" fontWeight="bold">
            {label}
          </text>
        );
      })}
    </svg>
  );
};

// ════════════════════════════════════════════════════════════════
// ── Main Component ──
// ════════════════════════════════════════════════════════════════
const KPIAssessment = ({ user, users = [], activityLogs = [], salesOrders = [], addToast, logActivity, workerOkrData = {} }) => {
  const [assessments, setAssessments] = useState(() => safeParse(LS_KEY, []));
  const [season, setSeason] = useState(() => safeParse(SEASON_KEY, null));
  const [tab, setTab] = useState('my');
  const [editingId, setEditingId] = useState(null);
  const [localEbitda, setLocalEbitda] = useState(3);
  const fileRef = useRef(null);

  const userRole = user?.role || 'picker';
  const isAdmin = userRole === 'admin';
  const period = getCurrentPeriod();

  const persist = useCallback((data) => {
    setAssessments(data);
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }, []);

  const persistSeason = useCallback((data) => {
    setSeason(data);
    localStorage.setItem(SEASON_KEY, JSON.stringify(data));
  }, []);

  // ── Create new assessment ──
  const createAssessment = useCallback(() => {
    const existing = assessments.find(a => a.username === user.username && a.period === period && a.status !== 'approved' && Array.isArray(a.pillars));
    if (existing) { setEditingId(existing.id); return; }

    const templates = getTemplatesForRole(userRole);
    const snapshot = season?.snapshots?.[user.username];

    const pillars = templates.map(t => ({
      pillarKey: t.pillarKey, weight: t.weight,
      kpis: t.kpis.map(k => {
        const raw = k.source === 'auto' && snapshot?.autoScores?.[k.autoKey] != null
          ? snapshot.autoScores[k.autoKey]
          : (k.source === 'auto' ? (AUTO_KPI_REGISTRY[k.autoKey]?.(
              (activityLogs || []).filter(l => l.username === user.username), salesOrders
            ) ?? null) : null);
        const systemScore = k.source === 'auto' ? (typeof raw === 'number' ? Math.min(Math.round(raw), 120) : null) : null;
        return {
          ...k, systemScore, autoScale5: toScale5(systemScore),
          selfScore: null, approverScore: null, feedback360Scores: null,
        };
      }),
    }));

    const assessment = {
      id: genId(), username: user.username, name: user.name || user.username,
      role: userRole, period, status: 'draft', currentLevel: 0,
      pillars, approvalHistory: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const next = [...assessments, assessment];
    persist(next);
    setEditingId(assessment.id);
    addToast?.('Assessment created', 'success');
    logActivity?.('kpi_create', `Created KPI assessment for ${period}`);
  }, [assessments, user, userRole, period, season, activityLogs, salesOrders, persist, addToast, logActivity]);

  // ── Update KPI score ──
  const handleKpiChange = useCallback((assessId, pillarKey, kpiIdx, field, value) => {
    if (field === 'selfScore' || field === 'approverScore') {
      const validated = validateScore(value);
      if (validated === null) return;
      value = validated;
    }
    const next = assessments.map(a => {
      if (a.id !== assessId) return a;
      const pillars = a.pillars.map(p => {
        if (p.pillarKey !== pillarKey) return p;
        const kpis = p.kpis.map((k, i) => i === kpiIdx ? { ...k, [field]: value } : k);
        return { ...p, kpis };
      });
      return { ...a, pillars, updatedAt: new Date().toISOString() };
    });
    persist(next);
  }, [assessments, persist]);

  // ── Submit assessment ──
  const submitAssessment = useCallback((assessId) => {
    const a = assessments.find(x => x.id === assessId);
    if (!a) return;
    for (const p of a.pillars) {
      for (const k of p.kpis) {
        if ((k.source === 'manual' || k.source === '360') && k.selfScore == null) {
          addToast?.(`Please score all manual/360 KPIs before submitting (missing: ${k.label})`, 'error');
          return;
        }
      }
    }
    const next = assessments.map(x => x.id !== assessId ? x : {
      ...x, status: 'submitted', currentLevel: 1,
      approvalHistory: [...x.approvalHistory, { level: 0, action: 'submit', by: user.username, at: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    });
    persist(next);
    setEditingId(null);
    addToast?.('Assessment submitted for review', 'success');
    logActivity?.('kpi_submit', `Submitted KPI assessment for ${period}`);
  }, [assessments, user, period, persist, addToast, logActivity]);

  // ── Approve / Reject ──
  const handleReview = useCallback((assessId, action) => {
    const targetAssessment = assessments.find(x => x.id === assessId);
    if (targetAssessment) {
      const currentStep = APPROVAL_CHAIN.find(c => c.level === targetAssessment.currentLevel);
      if (!currentStep) return;
      if (!isAdmin && user?.role !== currentStep.role) {
        addToast?.('You are not authorized to approve at this level', 'error');
        return;
      }
    }

    const next = assessments.map(a => {
      if (a.id !== assessId) return a;
      const newLevel = action === 'approve' ? Math.min(a.currentLevel + 1, 5) : 0;
      const newStatus = action === 'reject' ? 'rejected'
        : newLevel >= 5 ? 'approved' : 'reviewing';
      return {
        ...a, status: newStatus, currentLevel: action === 'reject' ? 0 : newLevel,
        approvalHistory: [...a.approvalHistory, { level: a.currentLevel, action, by: user.username, at: new Date().toISOString() }],
        updatedAt: new Date().toISOString(),
      };
    });
    persist(next);
    addToast?.(`Assessment ${action}d`, action === 'approve' ? 'success' : 'warning');
    logActivity?.(`kpi_${action}`, `${action}d KPI assessment`);
  }, [assessments, user, isAdmin, persist, addToast, logActivity]);

  // ── Season management ──
  const startSeason = useCallback(() => {
    const snapshots = {};
    (users || []).forEach(u => {
      const role = u.role || 'picker';
      const userLogs = (activityLogs || []).filter(l => l.username === u.username);
      const result = computeOkrResults?.(role, userLogs, salesOrders) || {};
      const autoScores = {};
      (result.results || []).forEach(r => { autoScores[r.key] = r.score; });
      snapshots[u.username] = { role, autoScores, snapshotDate: new Date().toISOString() };
    });
    const templates = {};
    Object.keys(DEFAULT_PILLAR_TEMPLATES).forEach(r => { templates[r] = getTemplatesForRole(r); });
    const s = {
      period, status: 'open', startedBy: user.username, startedAt: new Date().toISOString(),
      ebitdaScore: null, ebitdaSetBy: null, ebitdaSetAt: null, templates, snapshots,
    };
    persistSeason(s);
    addToast?.('Assessment season started', 'success');
    logActivity?.('season_start', `Started assessment season ${period}`);
  }, [users, activityLogs, salesOrders, period, user, persistSeason, addToast, logActivity]);

  const closeSeason = useCallback(() => {
    if (!season) return;
    persistSeason({ ...season, status: 'closed' });
    addToast?.('Season closed', 'success');
  }, [season, persistSeason, addToast]);

  // ── Refresh snapshots with latest data ──
  const refreshSnapshots = useCallback(() => {
    if (!season || season.status !== 'open') return;
    const snapshots = {};
    (users || []).forEach(u => {
      const role = u.role || 'picker';
      const okrData = workerOkrData[u.username];
      let autoScores = {};
      if (okrData?.okrAll?.results) {
        okrData.okrAll.results.forEach(r => { autoScores[r.key] = r.score; });
      } else {
        const userLogs = (activityLogs || []).filter(l => l.username === u.username);
        const result = computeOkrResults?.(role, userLogs, salesOrders) || {};
        (result.results || []).forEach(r => { autoScores[r.key] = r.score; });
      }
      snapshots[u.username] = { role, autoScores, snapshotDate: new Date().toISOString() };
    });
    persistSeason({ ...season, snapshots, lastRefresh: new Date().toISOString() });
    addToast?.('Snapshots refreshed with latest data', 'success');
    logActivity?.('snapshot_refresh', `Refreshed auto KPI snapshots for ${Object.keys(snapshots).length} users`);
  }, [season, users, workerOkrData, activityLogs, salesOrders, persistSeason, addToast, logActivity]);

  const setEbitda = useCallback(() => {
    if (!season) return;
    if (!isAdmin) {
      addToast?.('Only administrators can set the EBITDA score', 'error');
      return;
    }
    const validatedScore = validateScore(localEbitda);
    if (validatedScore === null) {
      addToast?.('Invalid EBITDA score. Must be 1-5.', 'error');
      return;
    }
    auditLog('ebitda_set', { score: validatedScore, period }, user?.username);
    persistSeason({ ...season, ebitdaScore: validatedScore, ebitdaSetBy: user.username, ebitdaSetAt: new Date().toISOString() });
    addToast?.(`EBITDA score set to ${localEbitda}`, 'success');
    logActivity?.('ebitda_set', `Set EBITDA score to ${localEbitda}`);
  }, [season, localEbitda, user, isAdmin, period, persistSeason, addToast, logActivity]);

  // ── Derived data ──
  const validAssessments = useMemo(() => assessments.filter(a => Array.isArray(a.pillars)), [assessments]);
  const myAssessment = useMemo(() => validAssessments.find(a => a.username === user?.username && a.period === period), [validAssessments, user, period]);
  const editingAssessment = useMemo(() => validAssessments.find(a => a.id === editingId), [validAssessments, editingId]);

  const pendingReviews = useMemo(() => {
    return validAssessments.filter(a =>
      (a.status === 'submitted' || a.status === 'reviewing') && a.username !== user?.username
    );
  }, [assessments, user]);

  const historyList = useMemo(() => validAssessments.filter(a => a.username === user?.username && a.status === 'approved'), [validAssessments, user]);

  const TABS = useMemo(() => {
    const t = [
      { key: 'my', label: 'My Assessment', Icon: ClipboardList },
      { key: 'reviews', label: 'Pending Reviews', Icon: Eye, count: pendingReviews.length },
      { key: 'history', label: 'History', Icon: History },
    ];
    if (isAdmin) {
      t.push({ key: 'season', label: 'Season', Icon: Calendar });
      t.push({ key: 'templates', label: 'Templates', Icon: Settings });
    }
    return t;
  }, [isAdmin, pendingReviews.length]);

  // ════════════════════════════════════════════════════════════
  // ── RENDER: Employee Header (Stitch-style) ──
  // ════════════════════════════════════════════════════════════
  const renderEmployeeHeader = (assessment) => {
    const total = calcTotalScore(assessment.pillars, season);
    const grade = getGrade(total);
    const gradeColor = getGradeColor(grade);

    return (
      <section style={{
        background: 'var(--odoo-surface)',
        padding: 24,
        borderRadius: 'var(--odoo-radius)',
        boxShadow: 'var(--odoo-shadow-sm)',
        marginBottom: 32,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          {/* Left: avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 8,
                background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 28, fontWeight: 800,
              }}>
                {(assessment.name || assessment.username || '?')[0].toUpperCase()}
              </div>
              <div style={{
                position: 'absolute', bottom: -8, right: -8,
                background: 'var(--odoo-success)', color: '#fff',
                borderRadius: '50%', width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '3px solid var(--odoo-surface)',
              }}>
                <CheckCircle2 style={{ width: 12, height: 12 }} />
              </div>
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--odoo-text)', margin: 0 }}>
                {assessment.name || assessment.username}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 'var(--odoo-radius)', fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  background: 'var(--odoo-surface-high)', color: 'var(--odoo-text-secondary)',
                }}>
                  {assessment.role}
                </span>
                <StatusBadge status={assessment.status} />
                <span style={{ color: 'var(--odoo-text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar style={{ width: 14, height: 14 }} />
                  Assessment Period: <span style={{ fontWeight: 700, color: 'var(--odoo-text)' }}>{assessment.period}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: score + grade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, borderLeft: '1px solid var(--odoo-surface-high)', paddingLeft: 32 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 4, margin: '0 0 4px 0' }}>
                Total Weighted Score
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'center' }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--odoo-purple)', letterSpacing: '-0.02em' }}>
                  {total.toFixed(1)}
                </span>
                <span style={{ color: 'var(--odoo-text-muted)', fontSize: 14, fontWeight: 600 }}>/ 5.0</span>
              </div>
            </div>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: `4px solid ${gradeColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 900,
              color: gradeColor,
              background: `${gradeColor}10`,
            }}>
              {grade}
            </div>
          </div>
        </div>
      </section>
    );
  };

  // ════════════════════════════════════════════════════════════
  // ── RENDER: Performance Radar (right sidebar) ──
  // ════════════════════════════════════════════════════════════
  const renderRadarPanel = (assessment) => (
    <div style={{
      background: 'var(--odoo-surface)',
      padding: 24, borderRadius: 'var(--odoo-radius)',
      boxShadow: 'var(--odoo-shadow-sm)',
    }}>
      <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--odoo-text-muted)', marginBottom: 24, margin: '0 0 24px 0' }}>
        Performance Radar
      </h2>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', aspectRatio: '1' }}>
        <RadarChart pillars={assessment.pillars} season={season} />
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // ── RENDER: 360 Peer Feedback / Pillar Scores panel ──
  // ════════════════════════════════════════════════════════════
  const renderFeedbackPanel = (assessment) => {
    const feedbackItems = [];
    for (const p of assessment.pillars) {
      for (const k of p.kpis) {
        if (k.source === '360' && k.feedback360Scores?.length > 0) {
          const avg = k.feedback360Scores.reduce((a, b) => a + b, 0) / k.feedback360Scores.length;
          feedbackItems.push({ label: k.label, score: avg, count: k.feedback360Scores.length });
        }
      }
    }
    const pillarBars = assessment.pillars.filter(p => p.weight > 0).map(p => {
      const def = KPI_PILLARS.find(d => d.key === p.pillarKey);
      return { label: def?.label?.split(' ').slice(0, 2).join(' ') || p.pillarKey, score: calcPillarScore(p, season) };
    });

    const bars = feedbackItems.length > 0 ? feedbackItems : pillarBars;
    const totalCount = feedbackItems.reduce((s, f) => s + f.count, 0) || bars.length;
    const title = feedbackItems.length > 0 ? '360 Peer Feedback' : 'Pillar Scores';
    const subtitle = feedbackItems.length > 0 ? `${totalCount} Responses` : `${bars.length} Pillars`;

    return (
      <div style={{
        background: 'var(--odoo-surface)',
        padding: 24, borderRadius: 'var(--odoo-radius)',
        boxShadow: 'var(--odoo-shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--odoo-text-muted)', margin: 0 }}>
            {title}
          </h2>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--odoo-success)' }}>
            {subtitle}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {bars.map((item, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                <span style={{ color: 'var(--odoo-text)' }}>{item.label}</span>
                <span style={{ color: 'var(--odoo-purple)' }}>{item.score.toFixed(1)}</span>
              </div>
              <div style={{ height: 8, width: '100%', background: 'var(--odoo-surface-high)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${(item.score / 5) * 100}%`,
                  background: 'var(--odoo-purple)', borderRadius: 9999,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // ── RENDER: Assessment History panel ──
  // ════════════════════════════════════════════════════════════
  const renderHistoryPanel = (assessment) => (
    <div style={{
      background: 'var(--odoo-surface-low)',
      padding: 16, borderRadius: 8,
    }}>
      <h2 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--odoo-text-muted)', marginBottom: 16, margin: '0 0 16px 0' }}>
        Assessment History
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {assessment.approvalHistory.length === 0 && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 4, background: 'var(--odoo-success)', borderRadius: 4, minHeight: 36 }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>Assessment Created</p>
              <p style={{ fontSize: 10, fontFamily: '"Source Code Pro", monospace', color: 'var(--odoo-text-muted)', margin: '2px 0 0' }}>
                {new Date(assessment.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}
        {assessment.approvalHistory.map((h, i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{
              width: 4, borderRadius: 4, minHeight: 36,
              background: h.action === 'approve' ? 'var(--odoo-success)' : h.action === 'reject' ? 'var(--odoo-danger)' : 'var(--odoo-purple)',
            }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>
                {h.action === 'submit' ? 'Submitted for Review' : h.action === 'approve' ? 'Approved' : 'Rejected'}
              </p>
              <p style={{ fontSize: 10, fontFamily: '"Source Code Pro", monospace', color: 'var(--odoo-text-muted)', margin: '2px 0 0' }}>
                By: {h.by} | {new Date(h.at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // ── RENDER: Floating Action Bar (Stitch-style sticky footer) ──
  // ════════════════════════════════════════════════════════════
  const renderActionBar = ({ onBack, onSubmit, onReject, onApprove, showSubmit, showReview }) => (
    <div style={{
      position: 'sticky', bottom: 0,
      background: 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid var(--odoo-surface-high)',
      padding: '12px 0',
      marginTop: 32,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      zIndex: 10,
    }}>
      <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--odoo-text-muted)' }}>
        <Info style={{ width: 14, height: 14 }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          Weight calculation: Final = Sum(Score x Weight)
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack}
          style={{
            padding: '8px 24px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.15em', border: '1px solid var(--odoo-purple)',
            color: 'var(--odoo-purple)', background: 'transparent', borderRadius: 'var(--odoo-radius)',
            cursor: 'pointer', transition: 'var(--odoo-transition)',
          }}>
          Back
        </button>
        {showReview && (
          <>
            <button onClick={onReject}
              style={{
                padding: '8px 24px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.15em', border: '1px solid var(--odoo-danger)',
                color: 'var(--odoo-danger)', background: 'transparent', borderRadius: 'var(--odoo-radius)',
                cursor: 'pointer', transition: 'var(--odoo-transition)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <XCircle style={{ width: 14, height: 14 }} />Reject
            </button>
            <button onClick={onApprove}
              style={{
                padding: '8px 40px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.15em', border: 'none', color: '#fff',
                background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
                borderRadius: 'var(--odoo-radius)', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(113, 75, 103, 0.3)',
                transition: 'var(--odoo-transition)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <CheckCircle2 style={{ width: 14, height: 14 }} />Approve
            </button>
          </>
        )}
        {showSubmit && (
          <button onClick={onSubmit}
            style={{
              padding: '8px 40px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.15em', border: 'none', color: '#fff',
              background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
              borderRadius: 'var(--odoo-radius)', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(113, 75, 103, 0.3)',
              transition: 'var(--odoo-transition)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <Send style={{ width: 14, height: 14 }} />Submit for Review
          </button>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // ── RENDER: Live Performance Card ──
  // ════════════════════════════════════════════════════════════
  const renderLivePerformance = (username, isApproverView = false) => {
    const okr = workerOkrData[username];
    const dataSource = isApproverView ? okr?.okrAll : okr?.okrToday;
    if (!dataSource?.results?.length) return null;
    const results = dataSource.results.filter(r => r.actual > 0);
    if (!results.length) return null;

    return (
      <div style={{
        border: '1px solid var(--odoo-border-ghost)',
        borderRadius: 'var(--odoo-radius)', padding: 12,
        background: isApproverView
          ? 'linear-gradient(135deg, rgba(1,126,132,0.04), rgba(16,185,129,0.04))'
          : 'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(99,102,241,0.04))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Activity style={{ width: 16, height: 16, color: isApproverView ? 'var(--odoo-success)' : '#3b82f6' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: isApproverView ? 'var(--odoo-success)' : '#1d4ed8' }}>
            {isApproverView ? 'System Performance Data' : 'Live Performance (Today)'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--odoo-text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <BarChart2 style={{ width: 12, height: 12 }} />
            {isApproverView ? 'auto-computed from activity logs' : 'from Team Performance'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {results.slice(0, 8).map(r => {
            const pctVal = r.target > 0 ? Math.round((r.actual / r.target) * 100) : 100;
            const color = pctVal >= 90 ? 'var(--odoo-success)' : pctVal >= 70 ? 'var(--odoo-warning)' : 'var(--odoo-danger)';
            return (
              <div key={r.key} style={{ background: 'var(--odoo-surface)', borderRadius: 'var(--odoo-radius)', padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--odoo-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>{r.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color }}>{typeof r.actual === 'number' ? (r.actual % 1 ? r.actual.toFixed(1) : r.actual) : r.actual}</div>
                <div style={{ fontSize: 9, color: 'var(--odoo-text-muted)' }}>
                  target: {r.target}{isApproverView ? ` | score: ${r.score}` : ` (${pctVal}%)`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // ── RENDER: Assessment Detail (shared between My + Review) ──
  // ════════════════════════════════════════════════════════════
  const renderAssessmentDetail = (assessment, { isApprover, onBack, onSubmit, onReject, onApprove, showSubmit, showReview }) => {
    const isOwner = assessment.username === user?.username;
    const readOnly = isApprover ? true : (assessment.status !== 'draft' && assessment.status !== 'rejected');

    return (
      <div>
        {/* Employee Header */}
        {renderEmployeeHeader(assessment)}

        {/* 3-column grid: perspectives + sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 32 }} className="xl:grid-cols-3">
          {/* Left: OKR Perspectives (2/3 width) */}
          <div className="xl:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Section header with legend */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--odoo-text-muted)', margin: 0 }}>
                OKR Perspectives
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--odoo-success)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--odoo-success)', display: 'inline-block' }} />
                  Auto Tracking
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--odoo-purple)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--odoo-purple)', display: 'inline-block' }} />
                  Manual Entry
                </span>
              </div>
            </div>

            {/* Live Performance Card */}
            {renderLivePerformance(assessment.username, isApprover)}

            {/* Perspective cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 16,
            }}>
              {assessment.pillars.map(p => {
                const def = KPI_PILLARS.find(d => d.key === p.pillarKey);
                if (!def) return null;
                return (
                  <PillarCard key={p.pillarKey} pillar={p} pillarDef={def} season={season}
                    isApprover={isApprover} assessmentStatus={assessment.status} readOnly={readOnly}
                    onKpiChange={(pk, ki, f, v) => handleKpiChange(assessment.id, pk, ki, f, v)} />
                );
              })}
            </div>
          </div>

          {/* Right sidebar (1/3 width) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {renderRadarPanel(assessment)}
            {renderFeedbackPanel(assessment)}
            {renderHistoryPanel(assessment)}
          </div>
        </div>

        {/* Bottom action bar */}
        {renderActionBar({ onBack, onSubmit, onReject, onApprove, showSubmit, showReview })}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // ── RENDER: My Assessment ──
  // ════════════════════════════════════════════════════════════
  const renderMyAssessment = () => {
    if (editingAssessment) {
      const a = editingAssessment;
      const isOwner = a.username === user?.username;
      return renderAssessmentDetail(a, {
        isApprover: false,
        onBack: () => setEditingId(null),
        onSubmit: () => submitAssessment(a.id),
        showSubmit: (a.status === 'draft' || a.status === 'rejected') && isOwner,
        showReview: false,
      });
    }

    // List view
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>My Assessment - {period}</h3>
          {(!myAssessment || myAssessment.status === 'approved') && season?.status === 'open' && (
            <button onClick={createAssessment}
              style={{
                padding: '8px 24px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', border: 'none', color: '#fff',
                background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
                borderRadius: 'var(--odoo-radius)', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(113, 75, 103, 0.3)',
                transition: 'var(--odoo-transition)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
              <Plus style={{ width: 16, height: 16 }} />New Assessment
            </button>
          )}
        </div>

        {!season?.status && (
          <div style={{
            padding: 16, borderRadius: 'var(--odoo-radius)',
            background: 'var(--odoo-warning-light)',
            border: '1px solid rgba(232,169,64,0.2)',
            fontSize: 13, color: 'var(--odoo-warning)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Clock style={{ width: 16, height: 16 }} />
            No active assessment season. Contact admin to start one.
          </div>
        )}

        {myAssessment && (
          <div onClick={() => setEditingId(myAssessment.id)}
            style={{
              background: 'var(--odoo-surface)',
              border: '1px solid var(--odoo-border-ghost)',
              borderRadius: 'var(--odoo-radius)', padding: 16, cursor: 'pointer',
              transition: 'var(--odoo-transition)',
            }}
            className="hover:shadow-md">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--odoo-text)' }}>{myAssessment.period}</div>
                <div style={{ fontSize: 12, color: 'var(--odoo-text-muted)', marginTop: 2 }}>
                  Updated {new Date(myAssessment.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusBadge status={myAssessment.status} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--odoo-purple)' }}>
                  {calcTotalScore(myAssessment.pillars, season).toFixed(2)}/5
                </div>
                <ChevronRight style={{ width: 16, height: 16, color: 'var(--odoo-text-muted)' }} />
              </div>
            </div>
          </div>
        )}

        {!myAssessment && season?.status === 'open' && (
          <div style={{ fontSize: 14, color: 'var(--odoo-text-muted)', padding: 16, textAlign: 'center' }}>
            No assessment yet this period. Click "New Assessment" to start.
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // ── RENDER: Pending Reviews ──
  // ════════════════════════════════════════════════════════════
  const [reviewingId, setReviewingId] = useState(null);
  const reviewAssessment = useMemo(() => validAssessments.find(a => a.id === reviewingId), [validAssessments, reviewingId]);

  const renderReviews = () => {
    if (reviewAssessment) {
      const a = reviewAssessment;
      return renderAssessmentDetail(a, {
        isApprover: true,
        onBack: () => setReviewingId(null),
        onReject: () => { handleReview(a.id, 'reject'); setReviewingId(null); },
        onApprove: () => { handleReview(a.id, 'approve'); setReviewingId(null); },
        showSubmit: false,
        showReview: true,
      });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>Pending Reviews</h3>
        {pendingReviews.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--odoo-text-muted)', padding: 16, textAlign: 'center' }}>No pending reviews.</div>
        )}
        {pendingReviews.map(a => (
          <div key={a.id} onClick={() => setReviewingId(a.id)}
            style={{
              background: 'var(--odoo-surface)',
              border: '1px solid var(--odoo-border-ghost)',
              borderRadius: 'var(--odoo-radius)', padding: 16, cursor: 'pointer',
              transition: 'var(--odoo-transition)',
            }}
            className="hover:shadow-md">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--odoo-text)' }}>{a.name}</div>
                <div style={{ fontSize: 12, color: 'var(--odoo-text-muted)' }}>{a.role} | {a.period} | Level {a.currentLevel}/5</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge status={a.status} />
                <ChevronRight style={{ width: 16, height: 16, color: 'var(--odoo-text-muted)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // ── RENDER: History ──
  // ════════════════════════════════════════════════════════════
  const renderHistoryTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>Assessment History</h3>
      {historyList.length === 0 && (
        <div style={{ fontSize: 14, color: 'var(--odoo-text-muted)', padding: 16, textAlign: 'center' }}>No completed assessments.</div>
      )}
      {historyList.map(a => {
        const total = calcTotalScore(a.pillars, season);
        return (
          <div key={a.id} onClick={() => setEditingId(a.id)}
            style={{
              background: 'var(--odoo-surface)',
              border: '1px solid var(--odoo-border-ghost)',
              borderRadius: 'var(--odoo-radius)', padding: 16, cursor: 'pointer',
              transition: 'var(--odoo-transition)',
            }}
            className="hover:shadow-md">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--odoo-text)' }}>{a.period}</div>
                <div style={{ fontSize: 12, color: 'var(--odoo-text-muted)' }}>Completed {new Date(a.updatedAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusBadge status={a.status} />
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--odoo-success)' }}>{total.toFixed(2)}/5</div>
                <ChevronRight style={{ width: 16, height: 16, color: 'var(--odoo-text-muted)' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // ── RENDER: Season (admin) ──
  // ════════════════════════════════════════════════════════════
  const renderSeason = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>Assessment Season</h3>

      {/* Season status */}
      <div style={{
        background: 'var(--odoo-surface)',
        border: '1px solid var(--odoo-border-ghost)',
        borderRadius: 'var(--odoo-radius)', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--odoo-text)' }}>Current Period: {period}</div>
            <div style={{ fontSize: 12, color: 'var(--odoo-text-muted)', marginTop: 2 }}>
              Status: <span style={{ color: season?.status === 'open' ? 'var(--odoo-success)' : 'var(--odoo-text-muted)', fontWeight: 700 }}>
                {season?.status || 'Not started'}
              </span>
            </div>
          </div>
          {!season?.status || season.status === 'closed' ? (
            <button onClick={startSeason}
              style={{
                padding: '8px 24px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                border: 'none', color: '#fff', background: 'var(--odoo-success)',
                borderRadius: 'var(--odoo-radius)', cursor: 'pointer',
                transition: 'var(--odoo-transition)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
              <Play style={{ width: 16, height: 16 }} />Start Season
            </button>
          ) : (
            <button onClick={closeSeason}
              style={{
                padding: '8px 24px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                border: 'none', color: '#fff', background: 'var(--odoo-danger)',
                borderRadius: 'var(--odoo-radius)', cursor: 'pointer',
                transition: 'var(--odoo-transition)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
              <Lock style={{ width: 16, height: 16 }} />Close Season
            </button>
          )}
        </div>
        {season?.startedBy && (
          <div style={{ fontSize: 12, color: 'var(--odoo-text-muted)' }}>
            Started by {season.startedBy} on {new Date(season.startedAt).toLocaleString()}
          </div>
        )}
        {season?.snapshots && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'var(--odoo-text-muted)' }}>
              Snapshots: {Object.keys(season.snapshots).length} users captured
              {season.lastRefresh && <> | Last refresh: {new Date(season.lastRefresh).toLocaleString()}</>}
            </div>
            {season.status === 'open' && (
              <button onClick={refreshSnapshots}
                style={{
                  padding: '6px 12px', fontSize: 11, fontWeight: 600,
                  border: 'none', color: '#3b82f6',
                  background: 'rgba(59,130,246,0.1)',
                  borderRadius: 'var(--odoo-radius)', cursor: 'pointer',
                  transition: 'var(--odoo-transition)', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                <RefreshCw style={{ width: 12, height: 12 }} />Refresh Snapshots
              </button>
            )}
          </div>
        )}
      </div>

      {/* EBITDA */}
      {season?.status === 'open' && (
        <div style={{
          background: 'var(--odoo-surface)',
          border: '1px solid var(--odoo-border-ghost)',
          borderRadius: 'var(--odoo-radius)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--odoo-text)' }}>
            <DollarSign style={{ width: 16, height: 16, color: 'var(--odoo-danger)' }} />EBITDA Score (MD)
          </div>
          {season.ebitdaScore != null && (
            <div style={{ fontSize: 12, color: 'var(--odoo-text-muted)' }}>
              Current: <b style={{ color: 'var(--odoo-danger)' }}>{season.ebitdaScore}/5</b> set by {season.ebitdaSetBy} on {new Date(season.ebitdaSetAt).toLocaleString()}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ScoreButtons value={localEbitda} onChange={setLocalEbitda} color="var(--odoo-danger)" />
            <button onClick={setEbitda}
              style={{
                padding: '6px 16px', fontSize: 12, fontWeight: 700,
                border: 'none', color: '#fff', background: 'var(--odoo-danger)',
                borderRadius: 'var(--odoo-radius)', cursor: 'pointer',
                transition: 'var(--odoo-transition)', display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <Save style={{ width: 12, height: 12 }} />Set EBITDA
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      {season?.status === 'open' && (
        <div style={{
          background: 'var(--odoo-surface)',
          border: '1px solid var(--odoo-border-ghost)',
          borderRadius: 'var(--odoo-radius)', padding: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--odoo-text)', marginBottom: 12 }}>Season Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {['draft', 'submitted', 'reviewing', 'approved'].map(s => {
              const count = assessments.filter(a => a.period === period && a.status === s).length;
              return (
                <div key={s} style={{
                  textAlign: 'center', padding: 12, borderRadius: 'var(--odoo-radius)',
                  background: 'var(--odoo-surface-low)',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--odoo-text)' }}>{count}</div>
                  <div style={{ fontSize: 10, color: 'var(--odoo-text-muted)' }}>{STATUS_CFG[s]?.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // ── RENDER: Templates (admin) ──
  // ════════════════════════════════════════════════════════════
  const [tplRole, setTplRole] = useState('picker');
  const [tplData, setTplData] = useState(() => JSON.parse(JSON.stringify(getTemplatesForRole('picker'))));

  const loadTpl = useCallback((role) => {
    setTplRole(role);
    setTplData(JSON.parse(JSON.stringify(getTemplatesForRole(role))));
  }, []);

  const updateTplPillarWeight = useCallback((idx, w) => {
    setTplData(prev => prev.map((p, i) => i === idx ? { ...p, weight: Math.max(0, Math.min(100, Number(w) || 0)) } : p));
  }, []);

  const updateTplKpi = useCallback((pIdx, kIdx, field, value) => {
    setTplData(prev => prev.map((p, pi) => pi !== pIdx ? p : {
      ...p, kpis: p.kpis.map((k, ki) => ki !== kIdx ? k : { ...k, [field]: value })
    }));
  }, []);

  const updateTplRubric = useCallback((pIdx, kIdx, level, text) => {
    setTplData(prev => prev.map((p, pi) => pi !== pIdx ? p : {
      ...p, kpis: p.kpis.map((k, ki) => ki !== kIdx ? k : { ...k, rubric: { ...k.rubric, [level]: text } })
    }));
  }, []);

  const addTplKpi = useCallback((pIdx) => {
    setTplData(prev => prev.map((p, pi) => pi !== pIdx ? p : {
      ...p, kpis: [...p.kpis, {
        id: genId(), label: 'New KPI', labelTh: '', source: 'manual', kpiWeight: 10,
        rubric: { 1: '', 2: '', 3: '', 4: '', 5: '' },
      }]
    }));
  }, []);

  const removeTplKpi = useCallback((pIdx, kIdx) => {
    setTplData(prev => prev.map((p, pi) => pi !== pIdx ? p : {
      ...p, kpis: p.kpis.filter((_, ki) => ki !== kIdx)
    }));
  }, []);

  const saveTpl = useCallback(() => {
    const totalW = tplData.reduce((s, p) => s + p.weight, 0);
    if (totalW !== 100) {
      addToast?.(`Pillar weights must sum to 100% (currently ${totalW}%)`, 'error');
      return;
    }
    for (const p of tplData) {
      if (p.kpis.length > 0) {
        const kpiW = p.kpis.reduce((s, k) => s + k.kpiWeight, 0);
        if (kpiW !== 100) {
          const def = KPI_PILLARS.find(d => d.key === p.pillarKey);
          addToast?.(`KPI weights in "${def?.label}" must sum to 100% (currently ${kpiW}%)`, 'error');
          return;
        }
      }
    }
    const all = safeParse(TEMPLATE_KEY, {});
    all[tplRole] = tplData;
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(all));
    addToast?.(`Template saved for ${tplRole}`, 'success');
  }, [tplData, tplRole, addToast]);

  const tplWeightTotal = useMemo(() => tplData.reduce((s, p) => s + p.weight, 0), [tplData]);

  const [tplExpanded, setTplExpanded] = useState({});

  const renderTemplates = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>Template Editor</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={tplRole} onChange={e => loadTpl(e.target.value)}
            style={{
              fontSize: 13, border: '1px solid var(--odoo-border-ghost)',
              borderRadius: 'var(--odoo-radius)', padding: '6px 12px',
              background: 'var(--odoo-surface)', color: 'var(--odoo-text)',
            }}>
            {Object.keys(DEFAULT_PILLAR_TEMPLATES).map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button onClick={saveTpl}
            style={{
              padding: '6px 16px', fontSize: 12, fontWeight: 700,
              border: 'none', color: '#fff',
              background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
              borderRadius: 'var(--odoo-radius)', cursor: 'pointer',
              transition: 'var(--odoo-transition)', display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <Save style={{ width: 14, height: 14 }} />Save
          </button>
        </div>
      </div>

      {/* Weight total indicator */}
      <div style={{
        fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 'var(--odoo-radius)',
        background: tplWeightTotal === 100 ? 'rgba(1,126,132,0.08)' : 'rgba(228,111,120,0.08)',
        color: tplWeightTotal === 100 ? 'var(--odoo-success)' : 'var(--odoo-danger)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        Total pillar weight: {tplWeightTotal}% {tplWeightTotal === 100 ? <Check style={{ width: 16, height: 16 }} /> : '(must be 100%)'}
      </div>

      {/* Pillar accordions */}
      {tplData.map((pillar, pIdx) => {
        const def = KPI_PILLARS.find(d => d.key === pillar.pillarKey);
        if (!def) return null;
        const Icon = getPillarIcon(def.icon);
        const isOpen = tplExpanded[pillar.pillarKey];
        const kpiWeightTotal = pillar.kpis.reduce((s, k) => s + k.kpiWeight, 0);

        return (
          <div key={pillar.pillarKey} style={{
            border: '1px solid var(--odoo-border-ghost)',
            borderLeft: `4px solid ${PILLAR_BORDER_COLORS[pillar.pillarKey] || def.color}`,
            borderRadius: 'var(--odoo-radius)', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--odoo-surface-low)' }}>
              <button onClick={() => setTplExpanded(p => ({ ...p, [pillar.pillarKey]: !p[pillar.pillarKey] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <Icon style={{ width: 16, height: 16, color: PILLAR_BORDER_COLORS[pillar.pillarKey] || def.color }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--odoo-text)' }}>{def.label}</span>
                {isOpen
                  ? <ChevronDown style={{ width: 16, height: 16, color: 'var(--odoo-text-muted)' }} />
                  : <ChevronRight style={{ width: 16, height: 16, color: 'var(--odoo-text-muted)' }} />
                }
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--odoo-text-muted)' }}>Weight:</label>
                <input type="number" min={0} max={100} value={pillar.weight}
                  onChange={e => updateTplPillarWeight(pIdx, e.target.value)}
                  style={{
                    width: 64, fontSize: 13, border: '1px solid var(--odoo-border-ghost)',
                    borderRadius: 'var(--odoo-radius)', padding: '4px 8px', textAlign: 'center',
                    background: 'var(--odoo-surface)', color: 'var(--odoo-text)',
                  }} />
                <span style={{ fontSize: 12, color: 'var(--odoo-text-muted)' }}>%</span>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pillar.kpis.length > 0 && (
                  <div style={{
                    fontSize: 12, padding: '4px 8px', borderRadius: 'var(--odoo-radius)',
                    background: kpiWeightTotal === 100 ? 'rgba(1,126,132,0.08)' : 'rgba(228,111,120,0.08)',
                    color: kpiWeightTotal === 100 ? 'var(--odoo-success)' : 'var(--odoo-danger)',
                  }}>
                    KPI weights: {kpiWeightTotal}% {kpiWeightTotal === 100 ? '' : '(must be 100%)'}
                  </div>
                )}

                {pillar.kpis.map((kpi, kIdx) => (
                  <div key={kpi.id || kIdx} style={{
                    border: '1px solid var(--odoo-border-ghost)',
                    borderRadius: 'var(--odoo-radius)', padding: 12,
                    background: 'var(--odoo-surface)',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input value={kpi.label} onChange={e => updateTplKpi(pIdx, kIdx, 'label', e.target.value)}
                            style={{
                              fontSize: 13, fontWeight: 500,
                              background: 'transparent', color: 'var(--odoo-text)',
                              outline: 'none', flex: 1, minWidth: 120, border: 'none',
                              borderBottom: '1px dashed var(--odoo-surface-high)',
                            }}
                            placeholder="KPI Label" />
                          <select value={kpi.source} onChange={e => updateTplKpi(pIdx, kIdx, 'source', e.target.value)}
                            style={{
                              fontSize: 12, border: '1px solid var(--odoo-border-ghost)',
                              borderRadius: 'var(--odoo-radius)', padding: '4px 8px',
                              background: 'var(--odoo-surface)', color: 'var(--odoo-text)',
                            }}>
                            <option value="manual">Manual</option>
                            <option value="auto">Auto</option>
                            <option value="md">MD</option>
                            <option value="360">360</option>
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <label style={{ fontSize: 10, color: 'var(--odoo-text-muted)' }}>W:</label>
                            <input type="number" min={0} max={100} value={kpi.kpiWeight}
                              onChange={e => updateTplKpi(pIdx, kIdx, 'kpiWeight', Number(e.target.value) || 0)}
                              style={{
                                width: 56, fontSize: 12, border: '1px solid var(--odoo-border-ghost)',
                                borderRadius: 'var(--odoo-radius)', padding: '2px 4px', textAlign: 'center',
                                background: 'var(--odoo-surface)', color: 'var(--odoo-text)',
                              }} />
                            <span style={{ fontSize: 10, color: 'var(--odoo-text-muted)' }}>%</span>
                          </div>
                        </div>
                        {kpi.source === 'auto' && (
                          <input value={kpi.autoKey || ''} onChange={e => updateTplKpi(pIdx, kIdx, 'autoKey', e.target.value)}
                            style={{
                              fontSize: 12, background: 'transparent', color: 'var(--odoo-text-muted)',
                              outline: 'none', width: '100%', border: 'none',
                              borderBottom: '1px dashed var(--odoo-surface-high)',
                            }}
                            placeholder="Auto Key (e.g., uph, accuracy)" />
                        )}
                        <input value={kpi.labelTh || ''} onChange={e => updateTplKpi(pIdx, kIdx, 'labelTh', e.target.value)}
                          style={{
                            fontSize: 11, background: 'transparent', color: 'var(--odoo-text-muted)',
                            outline: 'none', width: '100%', border: 'none',
                            borderBottom: '1px dashed var(--odoo-surface-high)',
                          }}
                          placeholder="Thai label (optional)" />
                        {/* Rubric */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <div key={n}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--odoo-text-muted)', marginBottom: 2 }}>{n}</div>
                              <input value={kpi.rubric?.[n] || ''} onChange={e => updateTplRubric(pIdx, kIdx, n, e.target.value)}
                                style={{
                                  width: '100%', fontSize: 10,
                                  border: '1px solid var(--odoo-border-ghost)',
                                  borderRadius: 'var(--odoo-radius)', padding: '2px 4px',
                                  background: 'var(--odoo-surface)', color: 'var(--odoo-text)',
                                }}
                                placeholder={`Level ${n}`} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => removeTplKpi(pIdx, kIdx)}
                        style={{
                          padding: 4, color: 'var(--odoo-danger)', background: 'none',
                          border: 'none', cursor: 'pointer', borderRadius: 'var(--odoo-radius)',
                        }}>
                        <Trash2 style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  </div>
                ))}

                <button onClick={() => addTplKpi(pIdx)}
                  style={{
                    width: '100%', padding: '8px 0', fontSize: 12,
                    color: 'var(--odoo-purple)', background: 'none',
                    border: '1px dashed var(--odoo-border-ghost)',
                    borderRadius: 'var(--odoo-radius)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    transition: 'var(--odoo-transition)',
                  }}>
                  <Plus style={{ width: 12, height: 12 }} />Add KPI
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // ── MAIN RENDER ──
  // ════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Target style={{ width: 20, height: 20, color: '#fff' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>KPI Assessment</h2>
          <p style={{ fontSize: 12, color: 'var(--odoo-text-muted)', margin: 0 }}>8-Pillar Performance Evaluation System</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, overflowX: 'auto',
        background: 'var(--odoo-surface-low)', borderRadius: 'var(--odoo-radius)', padding: 4, marginBottom: 24,
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setEditingId(null); setReviewingId(null); }}
            style={{
              padding: '8px 16px', borderRadius: 'var(--odoo-radius)', fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'var(--odoo-transition)',
              background: tab === t.key ? 'var(--odoo-surface)' : 'transparent',
              color: tab === t.key ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)',
              boxShadow: tab === t.key ? 'var(--odoo-shadow-sm)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <t.Icon style={{ width: 16, height: 16 }} />
            {t.label}
            {t.count > 0 && (
              <span style={{
                marginLeft: 4, padding: '1px 6px', borderRadius: 9999,
                fontSize: 10, fontWeight: 700,
                background: 'var(--odoo-danger)', color: '#fff',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        background: 'var(--odoo-surface)',
        border: '1px solid var(--odoo-border-ghost)',
        borderRadius: 'var(--odoo-radius)',
        padding: 24,
      }}>
        {tab === 'my' && renderMyAssessment()}
        {tab === 'reviews' && renderReviews()}
        {tab === 'history' && renderHistoryTab()}
        {tab === 'season' && isAdmin && renderSeason()}
        {tab === 'templates' && isAdmin && renderTemplates()}
      </div>
    </div>
  );
};

export default KPIAssessment;
