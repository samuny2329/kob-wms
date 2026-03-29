import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Target, ChevronRight, ChevronDown, Check, X, Plus, Trash2, Send,
  Lock, Star, Award, Eye, Edit3, Clock, CheckCircle2, XCircle, Save,
  Play, DollarSign, Calendar, Users, Heart, TrendingUp, Zap, Shield,
  FileText, RotateCcw, Settings, History, ClipboardList, Upload,
  RefreshCw, Activity, BarChart2
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
  auto: { label: 'Auto', bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300' },
  manual: { label: 'Manual', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' },
  md: { label: 'MD', bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300' },
  '360': { label: '360', bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300' },
};

const STATUS_CFG = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', Icon: Edit3 },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', Icon: Send },
  reviewing: { label: 'Reviewing', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', Icon: Eye },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', Icon: XCircle },
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

// ── Score Buttons ──
const ScoreButtons = ({ value, onChange, disabled, color = '#3b82f6' }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} onClick={() => !disabled && onChange(n)} title={SCORE_LABELS[n]} disabled={disabled}
        className="w-7 h-7 rounded text-xs font-bold border-2 transition-all disabled:opacity-50"
        style={value === n
          ? { background: color, borderColor: color, color: '#fff', transform: 'scale(1.1)', boxShadow: `0 2px 6px ${color}66` }
          : { background: 'transparent', borderColor: '#d1d5db', color: '#6b7280' }}>
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />{cfg.label}
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

// ── Get templates for a role ──
function getTemplatesForRole(role) {
  const custom = safeParse(TEMPLATE_KEY, {});
  return custom[role] || DEFAULT_PILLAR_TEMPLATES[role] || DEFAULT_PILLAR_TEMPLATES.picker;
}

// ── PillarCard ──
const PillarCard = React.memo(({ pillar, pillarDef, season, isApprover, assessmentStatus, onKpiChange, readOnly }) => {
  const [expanded, setExpanded] = useState(true);
  const [rubricOpen, setRubricOpen] = useState(null);
  const Icon = getPillarIcon(pillarDef.icon);
  const score = calcPillarScore(pillar, season);

  return (
    <div className="border rounded-lg overflow-hidden dark:border-gray-700 mb-3" style={{ borderLeftWidth: 4, borderLeftColor: pillarDef.color }}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: pillarDef.color }} />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{pillarDef.label}</span>
          <span className="text-xs text-gray-500">({pillar.weight}%)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: pillarDef.color }}>{score.toFixed(2)}/5</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t dark:border-gray-700 divide-y dark:divide-gray-700">
          {pillar.kpis.length === 0 && (
            <div className="p-3 text-xs text-gray-400 italic">No KPIs in this pillar (weight 0%)</div>
          )}
          {pillar.kpis.map((kpi, ki) => {
            const badge = SOURCE_BADGE[kpi.source] || SOURCE_BADGE.manual;
            const isAuto = kpi.source === 'auto';
            const isMd = kpi.source === 'md';
            const is360 = kpi.source === '360';
            const fs = computeFinalScore(kpi, season);

            return (
              <div key={kpi.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{kpi.label}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                      <span className="text-[10px] text-gray-400">W:{kpi.kpiWeight}%</span>
                    </div>
                    {kpi.labelTh && <div className="text-[10px] text-gray-400">{kpi.labelTh}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    {fs != null && <div className="text-xs font-bold" style={{ color: pillarDef.color }}>{fs}/5</div>}
                    <div className="text-[9px] text-gray-400">{fs != null ? SCORE_LABELS[fs] : 'Not scored'}</div>
                  </div>
                </div>

                {/* Rubric toggle */}
                {kpi.rubric && (
                  <div>
                    <button onClick={() => setRubricOpen(rubricOpen === kpi.id ? null : kpi.id)}
                      className="text-[10px] text-blue-500 hover:underline">
                      {rubricOpen === kpi.id ? 'Hide rubric' : 'Show rubric'}
                    </button>
                    {rubricOpen === kpi.id && (
                      <div className="mt-1 grid grid-cols-5 gap-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div key={n} className="p-1.5 rounded text-[9px] bg-gray-50 dark:bg-gray-800 border dark:border-gray-700">
                            <div className="font-bold mb-0.5">{n}</div>
                            <div className="text-gray-500 dark:text-gray-400">{kpi.rubric[n]}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Score inputs */}
                <div className="flex flex-wrap items-center gap-3">
                  {isAuto && (
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] text-gray-500">System: {kpi.systemScore ?? '—'}/100</span>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">= {kpi.autoScale5 ?? '—'}/5</span>
                    </div>
                  )}
                  {isMd && (
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-red-400" />
                      <span className="text-[10px] text-gray-500">MD EBITDA:</span>
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400">{season?.ebitdaScore ?? 'Not set'}</span>
                    </div>
                  )}
                  {is360 && kpi.feedback360Scores?.length > 0 && (
                    <div className="text-[10px] text-purple-600 dark:text-purple-400">
                      360 avg: {(kpi.feedback360Scores.reduce((a, b) => a + b, 0) / kpi.feedback360Scores.length).toFixed(1)}
                    </div>
                  )}
                  {/* Self score */}
                  {!isAuto && !isMd && !readOnly && (
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Self Score</div>
                      <ScoreButtons value={kpi.selfScore} color={pillarDef.color}
                        onChange={(v) => onKpiChange(pillar.pillarKey, ki, 'selfScore', v)} disabled={readOnly} />
                    </div>
                  )}
                  {!isAuto && !isMd && readOnly && kpi.selfScore && (
                    <div className="text-[10px] text-gray-500">Self: <b>{kpi.selfScore}/5</b></div>
                  )}
                  {/* Approver score */}
                  {isApprover && (
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Approver Score</div>
                      <ScoreButtons value={kpi.approverScore} color={pillarDef.color}
                        onChange={(v) => onKpiChange(pillar.pillarKey, ki, 'approverScore', v)}
                        disabled={!(assessmentStatus === 'submitted' || assessmentStatus === 'reviewing')} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ── Weight Summary Bar ──
const WeightBar = ({ pillars }) => (
  <div className="flex rounded-lg overflow-hidden h-6 bg-gray-100 dark:bg-gray-800">
    {pillars.filter(p => p.weight > 0).map(p => {
      const def = KPI_PILLARS.find(d => d.key === p.pillarKey);
      return (
        <div key={p.pillarKey} className="flex items-center justify-center text-[9px] font-bold text-white truncate"
          style={{ width: `${p.weight}%`, background: def?.color || '#6b7280' }}
          title={`${def?.label}: ${p.weight}%`}>
          {p.weight >= 8 ? `${def?.label?.split(' ')[0]} ${p.weight}%` : `${p.weight}%`}
        </div>
      );
    })}
  </div>
);

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
    // Validate score fields before saving
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
    // Validate: all manual/360 KPIs must have selfScore
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
    // Validate approver authorization
    const targetAssessment = assessments.find(x => x.id === assessId);
    if (targetAssessment) {
      const currentStep = APPROVAL_CHAIN.find(c => c.level === targetAssessment.currentLevel);
      if (!currentStep) return;
      // For now, admin can approve any level. In production, check actual role hierarchy.
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
      // Use shared workerOkrData if available, else compute fresh
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
    // Only admin with explicit authorization can set EBITDA
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

  // ── Derived data (filter out old-format assessments without pillars) ──
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
  // ── RENDER: My Assessment ──
  // ════════════════════════════════════════════════════════════
  const renderMyAssessment = () => {
    if (editingAssessment) {
      const a = editingAssessment;
      const isOwner = a.username === user?.username;
      const readOnly = a.status !== 'draft' && a.status !== 'rejected';
      const total = calcTotalScore(a.pillars, season);
      const pct = (total / 5) * 100;

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{a.name} - {a.period}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={a.status} />
                <span className="text-xs text-gray-500">Level {a.currentLevel}/5</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }}>
                {total.toFixed(2)}/5
              </div>
              <div className="text-xs text-gray-500">{pct.toFixed(1)}%</div>
            </div>
          </div>

          {/* Weight bar */}
          <WeightBar pillars={a.pillars} />

          {/* Live Performance Card — real-time data from Team Performance */}
          {(() => {
            const okr = workerOkrData[a.username];
            if (!okr?.okrToday?.results?.length) return null;
            const todayResults = okr.okrToday.results.filter(r => r.actual > 0);
            if (!todayResults.length) return null;
            return (
              <div className="border dark:border-gray-700 rounded-lg p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Live Performance (Today)</span>
                  <BarChart2 className="w-3 h-3 text-blue-400 ml-auto" />
                  <span className="text-[10px] text-blue-400">from Team Performance</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {todayResults.slice(0, 8).map(r => {
                    const pctVal = r.target > 0 ? Math.round((r.actual / r.target) * 100) : 100;
                    const color = pctVal >= 90 ? '#10b981' : pctVal >= 70 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={r.key} className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-gray-500 truncate" title={r.label}>{r.label}</div>
                        <div className="text-sm font-bold" style={{ color }}>{typeof r.actual === 'number' ? (r.actual % 1 ? r.actual.toFixed(1) : r.actual) : r.actual}</div>
                        <div className="text-[9px] text-gray-400">target: {r.target} ({pctVal}%)</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Pillar cards */}
          {a.pillars.map(p => {
            const def = KPI_PILLARS.find(d => d.key === p.pillarKey);
            if (!def) return null;
            return (
              <PillarCard key={p.pillarKey} pillar={p} pillarDef={def} season={season}
                isApprover={false} assessmentStatus={a.status} readOnly={readOnly}
                onKpiChange={(pk, ki, f, v) => handleKpiChange(a.id, pk, ki, f, v)} />
            );
          })}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setEditingId(null)}
              className="px-4 py-2 text-sm border rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Back
            </button>
            {(a.status === 'draft' || a.status === 'rejected') && isOwner && (
              <button onClick={() => submitAssessment(a.id)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                <Send className="w-4 h-4" />Submit
              </button>
            )}
          </div>
        </div>
      );
    }

    // List view
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">My Assessment - {period}</h3>
          {(!myAssessment || myAssessment.status === 'approved') && season?.status === 'open' && (
            <button onClick={createAssessment}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
              <Plus className="w-4 h-4" />New Assessment
            </button>
          )}
        </div>
        {!season?.status && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
            <Clock className="w-4 h-4 inline mr-1" />No active assessment season. Contact admin to start one.
          </div>
        )}
        {myAssessment && (
          <div className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            onClick={() => setEditingId(myAssessment.id)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{myAssessment.period}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Updated {new Date(myAssessment.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={myAssessment.status} />
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {calcTotalScore(myAssessment.pillars, season).toFixed(2)}/5
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        )}
        {!myAssessment && season?.status === 'open' && (
          <div className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">
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
      const total = calcTotalScore(a.pillars, season);
      const pct = (total / 5) * 100;

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Review: {a.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={a.status} />
                <span className="text-xs text-gray-500">Role: {a.role} | Level {a.currentLevel}/5</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }}>
                {total.toFixed(2)}/5
              </div>
            </div>
          </div>

          <WeightBar pillars={a.pillars} />

          {/* Live Performance — helps approver compare */}
          {(() => {
            const okr = workerOkrData[a.username];
            if (!okr?.okrAll?.results?.length) return null;
            const results = okr.okrAll.results.filter(r => r.actual > 0);
            if (!results.length) return null;
            return (
              <div className="border dark:border-gray-700 rounded-lg p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400">System Performance Data</span>
                  <span className="text-[10px] text-green-400 ml-auto">auto-computed from activity logs</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {results.slice(0, 8).map(r => {
                    const pctVal = r.target > 0 ? Math.round((r.actual / r.target) * 100) : 100;
                    const color = pctVal >= 90 ? '#10b981' : pctVal >= 70 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={r.key} className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-gray-500 truncate">{r.label}</div>
                        <div className="text-sm font-bold" style={{ color }}>{typeof r.actual === 'number' ? (r.actual % 1 ? r.actual.toFixed(1) : r.actual) : r.actual}</div>
                        <div className="text-[9px] text-gray-400">target: {r.target} | score: {r.score}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {a.pillars.map(p => {
            const def = KPI_PILLARS.find(d => d.key === p.pillarKey);
            if (!def) return null;
            return (
              <PillarCard key={p.pillarKey} pillar={p} pillarDef={def} season={season}
                isApprover={true} assessmentStatus={a.status} readOnly={true}
                onKpiChange={(pk, ki, f, v) => handleKpiChange(a.id, pk, ki, f, v)} />
            );
          })}

          {/* Approval history */}
          {a.approvalHistory.length > 0 && (
            <div className="border dark:border-gray-700 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Approval History</div>
              {a.approvalHistory.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-500 py-1">
                  <span className={h.action === 'approve' ? 'text-green-600' : h.action === 'reject' ? 'text-red-600' : 'text-blue-600'}>
                    {h.action}
                  </span>
                  <span>by {h.by}</span>
                  <span className="text-gray-400">{new Date(h.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={() => setReviewingId(null)}
              className="px-4 py-2 text-sm border rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Back
            </button>
            <button onClick={() => { handleReview(a.id, 'approve'); setReviewingId(null); }}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />Approve
            </button>
            <button onClick={() => { handleReview(a.id, 'reject'); setReviewingId(null); }}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1">
              <XCircle className="w-4 h-4" />Reject
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Pending Reviews</h3>
        {pendingReviews.length === 0 && (
          <div className="text-sm text-gray-500 p-4 text-center">No pending reviews.</div>
        )}
        {pendingReviews.map(a => (
          <div key={a.id} className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            onClick={() => setReviewingId(a.id)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{a.name}</div>
                <div className="text-xs text-gray-500">{a.role} | {a.period} | Level {a.currentLevel}/5</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                <ChevronRight className="w-4 h-4 text-gray-400" />
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
  const renderHistory = () => (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Assessment History</h3>
      {historyList.length === 0 && (
        <div className="text-sm text-gray-500 p-4 text-center">No completed assessments.</div>
      )}
      {historyList.map(a => {
        const total = calcTotalScore(a.pillars, season);
        return (
          <div key={a.id} className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            onClick={() => setEditingId(a.id)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{a.period}</div>
                <div className="text-xs text-gray-500">Completed {new Date(a.updatedAt).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={a.status} />
                <div className="text-lg font-bold text-green-600">{total.toFixed(2)}/5</div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
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
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Assessment Season</h3>

      {/* Season status */}
      <div className="border dark:border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Period: {period}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Status: <span className={season?.status === 'open' ? 'text-green-600 font-bold' : 'text-gray-400'}>
                {season?.status || 'Not started'}
              </span>
            </div>
          </div>
          {!season?.status || season.status === 'closed' ? (
            <button onClick={startSeason}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1">
              <Play className="w-4 h-4" />Start Season
            </button>
          ) : (
            <button onClick={closeSeason}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1">
              <Lock className="w-4 h-4" />Close Season
            </button>
          )}
        </div>
        {season?.startedBy && (
          <div className="text-xs text-gray-500">
            Started by {season.startedBy} on {new Date(season.startedAt).toLocaleString()}
          </div>
        )}
        {season?.snapshots && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Snapshots: {Object.keys(season.snapshots).length} users captured
              {season.lastRefresh && <> | Last refresh: {new Date(season.lastRefresh).toLocaleString()}</>}
            </div>
            {season.status === 'open' && (
              <button onClick={refreshSnapshots}
                className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />Refresh Snapshots
              </button>
            )}
          </div>
        )}
      </div>

      {/* EBITDA */}
      {season?.status === 'open' && (
        <div className="border dark:border-gray-700 rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-red-500" />EBITDA Score (MD)
          </div>
          {season.ebitdaScore != null && (
            <div className="text-xs text-gray-500">
              Current: <b className="text-red-600">{season.ebitdaScore}/5</b> set by {season.ebitdaSetBy} on {new Date(season.ebitdaSetAt).toLocaleString()}
            </div>
          )}
          <div className="flex items-center gap-3">
            <ScoreButtons value={localEbitda} onChange={setLocalEbitda} color="#ef4444" />
            <button onClick={setEbitda}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1">
              <Save className="w-3 h-3" />Set EBITDA
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      {season?.status === 'open' && (
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Season Summary</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['draft', 'submitted', 'reviewing', 'approved'].map(s => {
              const count = assessments.filter(a => a.period === period && a.status === s).length;
              return (
                <div key={s} className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{count}</div>
                  <div className="text-[10px] text-gray-500">{STATUS_CFG[s]?.label}</div>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Template Editor</h3>
        <div className="flex items-center gap-2">
          <select value={tplRole} onChange={e => loadTpl(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
            {Object.keys(DEFAULT_PILLAR_TEMPLATES).map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button onClick={saveTpl}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
            <Save className="w-4 h-4" />Save
          </button>
        </div>
      </div>

      {/* Weight total indicator */}
      <div className={`text-sm font-medium px-3 py-2 rounded-lg ${tplWeightTotal === 100
        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
        Total pillar weight: {tplWeightTotal}% {tplWeightTotal === 100 ? <Check className="w-4 h-4 inline" /> : '(must be 100%)'}
      </div>

      {/* Pillar accordions */}
      {tplData.map((pillar, pIdx) => {
        const def = KPI_PILLARS.find(d => d.key === pillar.pillarKey);
        if (!def) return null;
        const Icon = getPillarIcon(def.icon);
        const isOpen = tplExpanded[pillar.pillarKey];
        const kpiWeightTotal = pillar.kpis.reduce((s, k) => s + k.kpiWeight, 0);

        return (
          <div key={pillar.pillarKey} className="border dark:border-gray-700 rounded-lg overflow-hidden"
            style={{ borderLeftWidth: 4, borderLeftColor: def.color }}>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
              <button onClick={() => setTplExpanded(p => ({ ...p, [pillar.pillarKey]: !p[pillar.pillarKey] }))}
                className="flex items-center gap-2 flex-1">
                <Icon className="w-4 h-4" style={{ color: def.color }} />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{def.label}</span>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Weight:</label>
                <input type="number" min={0} max={100} value={pillar.weight}
                  onChange={e => updateTplPillarWeight(pIdx, e.target.value)}
                  className="w-16 text-sm border rounded px-2 py-1 text-center dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>

            {isOpen && (
              <div className="p-3 space-y-3">
                {pillar.kpis.length > 0 && (
                  <div className={`text-xs px-2 py-1 rounded ${kpiWeightTotal === 100
                    ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                    KPI weights: {kpiWeightTotal}% {kpiWeightTotal === 100 ? '' : '(must be 100%)'}
                  </div>
                )}

                {pillar.kpis.map((kpi, kIdx) => (
                  <div key={kpi.id || kIdx} className="border dark:border-gray-700 rounded-lg p-3 space-y-2 bg-white dark:bg-gray-900">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2 flex-wrap items-center">
                          <input value={kpi.label} onChange={e => updateTplKpi(pIdx, kIdx, 'label', e.target.value)}
                            className="text-sm font-medium border-b border-dashed dark:bg-transparent dark:text-gray-200 flex-1 min-w-[120px] outline-none"
                            placeholder="KPI Label" />
                          <select value={kpi.source} onChange={e => updateTplKpi(pIdx, kIdx, 'source', e.target.value)}
                            className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                            <option value="manual">Manual</option>
                            <option value="auto">Auto</option>
                            <option value="md">MD</option>
                            <option value="360">360</option>
                          </select>
                          <div className="flex items-center gap-1">
                            <label className="text-[10px] text-gray-400">W:</label>
                            <input type="number" min={0} max={100} value={kpi.kpiWeight}
                              onChange={e => updateTplKpi(pIdx, kIdx, 'kpiWeight', Number(e.target.value) || 0)}
                              className="w-14 text-xs border rounded px-1 py-0.5 text-center dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200" />
                            <span className="text-[10px] text-gray-400">%</span>
                          </div>
                        </div>
                        {kpi.source === 'auto' && (
                          <input value={kpi.autoKey || ''} onChange={e => updateTplKpi(pIdx, kIdx, 'autoKey', e.target.value)}
                            className="text-xs border-b border-dashed dark:bg-transparent dark:text-gray-300 outline-none w-full"
                            placeholder="Auto Key (e.g., uph, accuracy)" />
                        )}
                        <input value={kpi.labelTh || ''} onChange={e => updateTplKpi(pIdx, kIdx, 'labelTh', e.target.value)}
                          className="text-[11px] border-b border-dashed dark:bg-transparent text-gray-400 outline-none w-full"
                          placeholder="Thai label (optional)" />
                        {/* Rubric */}
                        <div className="grid grid-cols-5 gap-1">
                          {[1, 2, 3, 4, 5].map(n => (
                            <div key={n}>
                              <div className="text-[9px] font-bold text-gray-400 mb-0.5">{n}</div>
                              <input value={kpi.rubric?.[n] || ''} onChange={e => updateTplRubric(pIdx, kIdx, n, e.target.value)}
                                className="w-full text-[10px] border rounded px-1 py-0.5 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                                placeholder={`Level ${n}`} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => removeTplKpi(pIdx, kIdx)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button onClick={() => addTplKpi(pIdx)}
                  className="w-full py-2 text-xs text-blue-600 dark:text-blue-400 border border-dashed dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-1">
                  <Plus className="w-3 h-3" />Add KPI
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Target className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">KPI Assessment</h2>
          <p className="text-xs text-gray-500">8-Pillar Performance Evaluation System</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setEditingId(null); setReviewingId(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}>
            <t.Icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-4 sm:p-6">
        {tab === 'my' && renderMyAssessment()}
        {tab === 'reviews' && renderReviews()}
        {tab === 'history' && renderHistory()}
        {tab === 'season' && isAdmin && renderSeason()}
        {tab === 'templates' && isAdmin && renderTemplates()}
      </div>
    </div>
  );
};

export default KPIAssessment;
