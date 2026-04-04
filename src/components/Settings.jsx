import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Globe, Database, ToggleRight, ToggleLeft,
  ShoppingBag, Store, Link, Trash2, RotateCcw, Wifi, CheckCircle2,
  AlertCircle, RefreshCw, Monitor, Cloud, MapPin, Truck, Package,
  ExternalLink, Zap, Shield, Sparkles, Info, Clock, Activity, ChevronDown
} from 'lucide-react';
import { testConnection, resetOdooSession } from '../services/odooApi';
import platformApi, { MARKETPLACES, COURIERS } from '../services/platformApi';

// ── Shared Styles ──────────────────────────────────────────
const sectionStyle = {
  backgroundColor: 'var(--odoo-surface)',
  outline: '1px solid var(--odoo-border-ghost)',
  borderRadius: '4px',
};

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--odoo-text-muted)',
};

const editorialInputStyle = {
  backgroundColor: 'var(--odoo-surface-low)',
  color: 'var(--odoo-text)',
  border: 'none',
  borderBottom: '2px solid transparent',
  transition: 'border-bottom-color 0.2s ease',
  outline: 'none',
};

const handleFocus = (e) => { e.target.style.borderBottomColor = 'var(--odoo-purple)'; };
const handleBlur = (e) => { e.target.style.borderBottomColor = 'transparent'; };

// ── Platform API Configuration Definitions ──────────────
const PLATFORM_DEFS = [
  { key: 'shopee', name: 'Shopee', type: 'marketplace', color: '#EE4D2D', icon: <ShoppingBag className="w-4 h-4" />, docsUrl: 'https://open.shopee.com' },
  { key: 'lazada', name: 'Lazada', type: 'marketplace', color: '#0F146D', icon: <Store className="w-4 h-4" />, docsUrl: 'https://open.lazada.com' },
  { key: 'tiktok', name: 'TikTok Shop', type: 'marketplace', color: '#010101', icon: <Link className="w-4 h-4" />, docsUrl: 'https://partner.tiktokshop.com' },
  { key: 'flash', name: 'Flash Express', type: 'courier', color: '#FFCD00', textColor: '#333', icon: <Zap className="w-4 h-4" />, docsUrl: 'https://open-docs.flashfulfillment.co.th/en.html' },
  { key: 'kerry', name: 'Kerry Logistics', type: 'courier', color: '#FF6600', icon: <Truck className="w-4 h-4" />, docsUrl: 'https://exch.th.kerryexpress.com/ediwebapi' },
  { key: 'jt', name: 'J&T Express', type: 'courier', color: '#D32011', icon: <Package className="w-4 h-4" />, docsUrl: 'https://developer.jet.co.id' },
  { key: 'thaipost', name: 'Thailand Post', type: 'courier', color: '#ED1C24', icon: <Package className="w-4 h-4" />, docsUrl: 'https://track.thailandpost.co.th/developerGuide' },
];

// ── Platform API Configuration Sub-Component ──────────────
const PlatformApiSection = () => {
  const [expandedPlatform, setExpandedPlatform] = useState(null);
  const [platformConfigs, setPlatformConfigs] = useState({});
  const [testResults, setTestResults] = useState({});
  const [testingKey, setTestingKey] = useState(null);

  useEffect(() => {
    const configs = {};
    PLATFORM_DEFS.forEach(p => { configs[p.key] = platformApi.getConfig(p.key); });
    setPlatformConfigs(configs);
  }, []);

  const handleFieldChange = (platformKey, fieldKey, value) => {
    const updated = { ...platformConfigs, [platformKey]: { ...platformConfigs[platformKey], [fieldKey]: value } };
    setPlatformConfigs(updated);
    platformApi.configure(platformKey, updated[platformKey]);
  };

  const handleTest = async (platformKey) => {
    setTestingKey(platformKey);
    setTestResults(prev => ({ ...prev, [platformKey]: null }));
    try {
      const result = await platformApi.testConnection(platformKey);
      setTestResults(prev => ({ ...prev, [platformKey]: result }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [platformKey]: { success: false, error: err.message } }));
    } finally {
      setTestingKey(null);
    }
  };

  const handleTestAll = async () => {
    setTestingKey('all');
    const results = await platformApi.testAllConnections();
    setTestResults(results);
    setTestingKey(null);
  };

  const marketplaces = PLATFORM_DEFS.filter(p => p.type === 'marketplace');
  const couriers = PLATFORM_DEFS.filter(p => p.type === 'courier');

  return (
    <>
      {/* ── Marketplace Platform Integrations ── */}
      <section style={{ ...sectionStyle, gridColumn: '1 / -1' }} className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingBag className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
          <h3 className="text-lg font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>
            Marketplace Platform Integrations
          </h3>
          <div className="ml-auto">
            <button
              onClick={handleTestAll}
              disabled={testingKey === 'all'}
              className="text-xs font-semibold flex items-center gap-1.5 px-4 py-2 rounded transition-all active:scale-95"
              style={{ color: 'var(--odoo-purple)', border: '1px solid var(--odoo-border-ghost)' }}
            >
              {testingKey === 'all' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
              Test All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {marketplaces.map(p => {
            const isConfigured = platformApi.isConfigured(p.key);
            const config = platformConfigs[p.key] || {};
            return (
              <div key={p.key} className="p-4 rounded flex flex-col gap-4" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                {/* Platform header + toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${p.color}15`, color: p.color }}
                    >
                      {p.icon}
                    </div>
                    <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--odoo-text)' }}>
                      {p.name}
                    </span>
                  </div>
                  <label className="inline-flex items-center cursor-pointer relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isConfigured}
                      onChange={() => {
                        const fields = platformApi.getConfigFields(p.key);
                        if (isConfigured) {
                          fields.forEach(f => handleFieldChange(p.key, f.key, ''));
                        }
                      }}
                    />
                    <div
                      className="w-8 h-4 rounded-full transition-colors peer-checked:bg-green-800/60"
                      style={{ backgroundColor: isConfigured ? undefined : 'var(--odoo-surface-high)' }}
                    >
                      <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-3 w-3 transition-transform ${isConfigured ? 'translate-x-4' : ''}`} />
                    </div>
                  </label>
                </div>

                {/* API Key field */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>
                    API Key
                  </label>
                  <input
                    type="text"
                    placeholder="Enter API Key..."
                    value={config.apiKey || config.shopId || config.appKey || ''}
                    onChange={e => {
                      const fieldKey = p.key === 'shopee' ? 'shopId' : 'appKey';
                      handleFieldChange(p.key, fieldKey, e.target.value);
                    }}
                    className="w-full px-2 py-1.5 font-mono text-xs"
                    style={{ ...editorialInputStyle, backgroundColor: 'var(--odoo-surface)' }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>

                {/* Expanded fields */}
                {expandedPlatform === p.key && (
                  <div className="space-y-2 animate-slide-up">
                    {platformApi.getConfigFields(p.key).slice(1).map(field => (
                      <div key={field.key}>
                        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>
                          {field.label}
                        </label>
                        <input
                          type={field.type || 'text'}
                          placeholder={field.placeholder || field.label}
                          value={config[field.key] || ''}
                          onChange={e => handleFieldChange(p.key, field.key, e.target.value)}
                          className="w-full px-2 py-1.5 font-mono text-xs"
                          style={{ ...editorialInputStyle, backgroundColor: 'var(--odoo-surface)' }}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleTest(p.key)}
                        disabled={testingKey === p.key || !isConfigured}
                        className="text-[11px] font-bold px-3 py-1.5 rounded transition-all disabled:opacity-40 flex items-center gap-1"
                        style={{ backgroundColor: 'var(--odoo-purple)', color: '#fff' }}
                      >
                        {testingKey === p.key ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />} Test
                      </button>
                      {testResults[p.key] && (
                        <span className="text-[11px] font-medium" style={{ color: testResults[p.key].success ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>
                          {testResults[p.key].success ? 'Connected' : testResults[p.key].error || 'Failed'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* More/Less toggle */}
                <button
                  onClick={() => setExpandedPlatform(expandedPlatform === p.key ? null : p.key)}
                  className="text-[10px] font-semibold flex items-center gap-1 mt-auto"
                  style={{ color: 'var(--odoo-purple)' }}
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${expandedPlatform === p.key ? 'rotate-180' : ''}`} />
                  {expandedPlatform === p.key ? 'Less' : 'More'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Logistics & Courier Credentials ── */}
      <section style={{ ...sectionStyle, gridColumn: '1 / -1' }} className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <Truck className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
          <h3 className="text-lg font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>
            Logistics & Courier Credentials
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {couriers.map(p => {
            const config = platformConfigs[p.key] || {};
            const fields = platformApi.getConfigFields(p.key);
            return (
              <div key={p.key} className="space-y-3">
                <div
                  className="flex items-center gap-2 pb-2"
                  style={{ borderBottom: '1px solid var(--odoo-surface-high)' }}
                >
                  <div style={{ color: p.color }}>{p.icon}</div>
                  <span className="font-bold text-xs" style={{ color: 'var(--odoo-text)' }}>{p.name}</span>
                </div>
                <div className="space-y-2">
                  {fields.slice(0, 2).map(field => (
                    <input
                      key={field.key}
                      type={field.type || 'text'}
                      placeholder={field.placeholder || field.label}
                      value={config[field.key] || ''}
                      onChange={e => handleFieldChange(p.key, field.key, e.target.value)}
                      className="w-full py-1 px-2 font-mono border-none focus:outline-none focus:ring-0"
                      style={{
                        backgroundColor: 'var(--odoo-surface-low)',
                        color: 'var(--odoo-text)',
                        fontSize: '10px',
                        borderRadius: '2px',
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
};

// ── Security Audit Log Panel (admin only) ──────────────
const AUDIT_KEY = 'wms_audit_log';
const AUDIT_COLORS = {
  login_failed: { bg: '#fff5f5', color: 'var(--odoo-danger)', label: 'FAILED' },
  login_success: { bg: '#e8f5e9', color: 'var(--odoo-success)', label: 'LOGIN' },
  login_blocked: { bg: '#fff8e1', color: '#e67700', label: 'BLOCKED' },
};
const DEFAULT_AUDIT_STYLE = { bg: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)', label: 'ACTION' };

const SecurityAuditPanel = ({ triggerConfirm }) => {
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUDIT_KEY);
      if (raw) setLogs(JSON.parse(raw).slice(0, 50));
    } catch { /* ignore */ }
  }, []);

  const handleClear = () => {
    triggerConfirm(
      'Clear Audit Log',
      'Are you sure you want to clear the security audit log? This cannot be undone.',
      'danger',
      () => {
        localStorage.removeItem(AUDIT_KEY);
        setLogs([]);
      }
    );
  };

  const getStyle = (action) => AUDIT_COLORS[action] || DEFAULT_AUDIT_STYLE;

  return (
    <section style={{ ...sectionStyle, gridColumn: '1 / -1' }} className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
          <h3 className="text-lg font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>
            Security Audit Log
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold px-4 py-2 rounded transition-all active:scale-95"
            style={{ color: 'var(--odoo-purple)', border: '1px solid var(--odoo-border-ghost)' }}
          >
            {expanded ? 'Collapse' : `Show (${logs.length})`}
          </button>
          {logs.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs font-semibold px-4 py-2 rounded flex items-center gap-1.5 transition-all active:scale-95"
              style={{ color: 'var(--odoo-danger)', border: '1px solid var(--odoo-border-ghost)', backgroundColor: '#fff5f5' }}
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--odoo-border-ghost)' }}>
          {logs.length === 0 ? (
            <div className="p-4 text-center text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
              No audit log entries
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                    <th className="text-left px-3 py-2 font-semibold" style={{ ...labelStyle, fontSize: '11px' }}>Timestamp</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ ...labelStyle, fontSize: '11px' }}>Action</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ ...labelStyle, fontSize: '11px' }}>User</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ ...labelStyle, fontSize: '11px' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((entry, i) => {
                    const style = getStyle(entry.action);
                    const details = typeof entry.details === 'object'
                      ? Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(', ')
                      : String(entry.details || '');
                    return (
                      <tr key={entry.id || i} style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: 'var(--odoo-text-secondary)' }}>
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: style.bg, color: style.color }}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--odoo-text)' }}>{entry.username || '-'}</td>
                        <td className="px-3 py-1.5" style={{ color: 'var(--odoo-text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {details || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

// ── Main Settings Component ──────────────────────────────
const Settings = ({ t, language, setLanguage, userRole, apiConfigs, setApiConfigs, workDate, setWorkDate, triggerConfirm, updateAndSyncData, showAlert, syncStatus }) => {
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreatingSO, setIsCreatingSO] = useState(false);
  const [createSOResult, setCreateSOResult] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const odooUseMock = false; // Mock mode removed — always live

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(apiConfigs.odoo);
      if (result.status === 'error') {
        setTestResult({ success: false, message: result.message || 'Cannot connect to Odoo server' });
        return;
      }
      const msg = result.authenticated
        ? `Connected & Authenticated: ${result.version} (${result.database})`
        : result.authError
          ? `Server OK — ${result.authError}`
          : `Connected: ${result.version || 'Odoo'} (${result.database || 'unknown'})`;
      setTestResult({ success: true, message: msg });
    } catch (err) {
      setTestResult({ success: false, message: `Cannot reach ${apiConfigs.odoo?.url || 'server'}: ${err.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  // Mock mode removed — system always runs in live mode

  const handleSaveChanges = () => {
    setHasUnsavedChanges(false);
    showAlert?.('Settings saved successfully', 'success');
  };

  const handleDiscardChanges = () => {
    setHasUnsavedChanges(false);
  };

  const lastSyncTime = syncStatus?.lastSync
    ? new Date(syncStatus.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const apiHealthPct = syncStatus?.connected ? '99.8%' : '0%';

  return (
    <div className="max-w-6xl mx-auto animate-slide-up pb-10 w-full">
      <div className="space-y-8">

        {/* ════════════════════════════════════════════════════
            Page Header
        ════════════════════════════════════════════════════ */}
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: 'var(--odoo-text)' }}
            >
              Settings
            </h1>
            <p
              className="text-sm font-medium mt-1"
              style={{ color: 'var(--odoo-text-muted)' }}
            >
              Configure your warehouse ecosystem and API connections
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDiscardChanges}
              className="px-6 py-2 rounded font-semibold text-sm transition-all active:scale-95"
              style={{
                color: 'var(--odoo-purple)',
                border: '1px solid var(--odoo-border-ghost)',
              }}
            >
              Discard Changes
            </button>
            <button
              onClick={handleSaveChanges}
              className="px-8 py-2 rounded font-semibold text-sm text-white shadow-sm transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
              }}
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            2-Column Grid
        ════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ─────────────────────────────────────────────
              Odoo ERP Connection
          ───────────────────────────────────────────── */}
          <section style={sectionStyle} className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Cloud className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                <h3 className="text-lg font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>
                  Odoo ERP Connection
                </h3>
              </div>
              <label className="flex items-center cursor-pointer">
                <span
                  className="mr-3 text-xs font-bold uppercase tracking-tighter"
                  style={{ color: 'var(--odoo-text-muted)' }}
                >
                  Live Mode
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={true}
                    disabled={true}
                  />
                  <div
                    className="w-10 h-5 rounded-full transition-colors peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all"
                    style={{ backgroundColor: !odooUseMock ? '#4b5d33' : 'var(--odoo-surface-high)' }}
                  />
                </div>
              </label>
            </div>

            {/* Form fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-1">
                <label style={labelStyle}>URL</label>
                <input
                  type="text"
                  value={apiConfigs.odoo?.url || ''}
                  onChange={e => {
                    resetOdooSession();
                    setApiConfigs({ ...apiConfigs, odoo: { ...apiConfigs.odoo, url: e.target.value } });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="https://kob-logistics.odoo.com"
                  className="px-3 py-2 font-mono text-sm"
                  style={editorialInputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
              <div className="grid grid-cols-1 gap-1">
                <label style={labelStyle}>Database Name</label>
                <input
                  type="text"
                  value={apiConfigs.odoo?.db || ''}
                  onChange={e => {
                    resetOdooSession();
                    setApiConfigs({ ...apiConfigs, odoo: { ...apiConfigs.odoo, db: e.target.value } });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="kob_wms_pro_live"
                  className="px-3 py-2 font-mono text-sm"
                  style={editorialInputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-1 gap-1">
                  <label style={labelStyle}>Username</label>
                  <input
                    type="text"
                    value={apiConfigs.odoo?.username || ''}
                    onChange={e => {
                      resetOdooSession();
                      setApiConfigs({ ...apiConfigs, odoo: { ...apiConfigs.odoo, username: e.target.value } });
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="admin@kob.pro"
                    className="px-3 py-2 font-mono text-sm"
                    style={editorialInputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
                <div className="grid grid-cols-1 gap-1">
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password"
                    value={apiConfigs.odoo?.password || ''}
                    onChange={e => {
                      resetOdooSession();
                      setApiConfigs({ ...apiConfigs, odoo: { ...apiConfigs.odoo, password: e.target.value } });
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="••••••••••••"
                    className="px-3 py-2 font-mono text-sm"
                    style={editorialInputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-8 flex gap-3">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex-1 px-4 py-2 text-xs font-bold rounded transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ color: 'var(--odoo-purple)', border: '1px solid var(--odoo-purple)' }}
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                Test Connection
              </button>
              <button
                onClick={handleSaveChanges}
                className="flex-1 px-4 py-2 text-xs font-bold text-white rounded transition-all active:scale-95"
                style={{ backgroundColor: 'var(--odoo-purple)' }}
              >
                Save ERP Config
              </button>
            </div>

            {/* Test result feedback */}
            {testResult && (
              <div
                className="mt-3 flex items-center gap-1.5 text-xs font-medium"
                style={{ color: testResult.success ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}
              >
                {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {testResult.message}
              </div>
            )}

          </section>

          {/* ─────────────────────────────────────────────
              System Core
          ───────────────────────────────────────────── */}
          <section style={sectionStyle} className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <SettingsIcon className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
              <h3 className="text-lg font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>
                System Core
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
              {/* Language */}
              <div className="space-y-1">
                <label style={labelStyle}>Interface Language</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full py-2 px-3 text-sm font-medium border-none focus:ring-0 focus:outline-none"
                  style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text)', borderRadius: '2px' }}
                >
                  <option value="en">English (US)</option>
                  <option value="th">Thai (TH)</option>
                </select>
              </div>

              {/* Timezone */}
              <div className="space-y-1">
                <label style={labelStyle}>Default Timezone</label>
                <select
                  className="w-full py-2 px-3 text-sm font-medium border-none focus:ring-0 focus:outline-none"
                  style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text)', borderRadius: '2px' }}
                  defaultValue="asia_bangkok"
                >
                  <option value="asia_bangkok">(GMT+07:00) Bangkok</option>
                  <option value="utc">(GMT+00:00) UTC</option>
                </select>
              </div>

              {/* Sync interval */}
              <div className="space-y-1">
                <label style={labelStyle}>Auto-sync Interval (min)</label>
                <input
                  type="number"
                  defaultValue={15}
                  className="w-full py-2 px-3 text-sm font-mono border-none focus:ring-0 focus:outline-none"
                  style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text)', borderRadius: '2px' }}
                />
              </div>

              {/* Session timeout */}
              <div className="space-y-1">
                <label style={labelStyle}>Session Timeout (hrs)</label>
                <input
                  type="number"
                  defaultValue={8}
                  className="w-full py-2 px-3 text-sm font-mono border-none focus:ring-0 focus:outline-none"
                  style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text)', borderRadius: '2px' }}
                />
              </div>
            </div>

            {/* Info banner */}
            <div
              className="mt-6 p-4 rounded"
              style={{ backgroundColor: 'rgba(75, 93, 51, 0.05)', border: '1px solid rgba(75, 93, 51, 0.15)' }}
            >
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#4b5d33' }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--odoo-text)', opacity: 0.8 }}>
                  System performance is currently optimized for high-frequency scanning.
                  Sync intervals below 5 minutes may increase server load during peak operations.
                </p>
              </div>
            </div>

            {/* Work Date */}
            <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
              <div className="space-y-1">
                <label style={labelStyle}>{t('workDate')}</label>
                <input
                  type="date"
                  value={workDate}
                  onChange={e => setWorkDate(e.target.value)}
                  className="w-full py-2 px-3 text-sm font-mono border-none focus:ring-0 focus:outline-none"
                  style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text)', borderRadius: '2px' }}
                />
              </div>
            </div>

            {/* Danger Zone (admin only) */}
            {userRole === 'admin' && (
              <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--odoo-danger)' }}>
                  {t('dangerZone')}
                </h4>
                <p className="text-xs mb-3" style={{ color: 'var(--odoo-text-secondary)' }}>
                  {t('clearDataDesc')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => triggerConfirm(
                      'Clear System Data',
                      'Are you absolutely sure you want to delete all active orders? This action cannot be undone.',
                      'danger',
                      () => {
                        updateAndSyncData([]);
                        showAlert('Cleared', 'All order data has been permanently deleted.', 'success');
                      }
                    )}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded transition-all active:scale-95"
                    style={{ backgroundColor: '#fff5f5', color: 'var(--odoo-danger)', border: '1px solid #f5c6cb' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('purgeBtn')}
                  </button>
                  <button
                    onClick={() => triggerConfirm(
                      'Reset All Data',
                      'This will clear all saved data and reload with default product data. You will be logged out.',
                      'danger',
                      () => {
                        ['wms_orders', 'wms_sales_orders', 'wms_users', 'wms_history', 'wms_logs', 'wms_apis', 'wms_box_usage', 'currentUser', 'activeTab', 'userRole'].forEach(k => localStorage.removeItem(k));
                        window.location.reload();
                      }
                    )}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded transition-all active:scale-95"
                    style={{ backgroundColor: '#fff8e1', color: '#856404', border: '1px solid #ffc107' }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset All Data
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ─────────────────────────────────────────────
              Admin-only sections: Claude AI, Platforms, Audit
          ───────────────────────────────────────────── */}
          {userRole === 'admin' && (
            <>
              {/* Claude AI Assistant */}
              {(() => {
                const claudeConfig = apiConfigs.claude || {};
                return (
                  <section style={{ ...sectionStyle, gridColumn: '1 / -1' }} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                        <h3 className="text-lg font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>
                          Claude AI Assistant
                        </h3>
                      </div>
                      <label className="flex items-center cursor-pointer">
                        <span
                          className="mr-3 text-xs font-bold uppercase tracking-tighter"
                          style={{ color: 'var(--odoo-text-muted)' }}
                        >
                          {claudeConfig.enabled ? 'Active' : 'Inactive'}
                        </span>
                        <button onClick={() => setApiConfigs({ ...apiConfigs, claude: { ...claudeConfig, enabled: !claudeConfig.enabled } })}>
                          {claudeConfig.enabled
                            ? <ToggleRight className="w-7 h-7 transition-colors" style={{ color: 'var(--odoo-success)' }} />
                            : <ToggleLeft className="w-7 h-7 transition-colors" style={{ color: 'var(--odoo-text-muted)' }} />}
                        </button>
                      </label>
                    </div>
                    {claudeConfig.enabled && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-1">
                          <label style={labelStyle}>API Key</label>
                          <input
                            type="password"
                            placeholder="sk-ant-api03-..."
                            value={claudeConfig.apiKey || ''}
                            onChange={e => setApiConfigs({ ...apiConfigs, claude: { ...claudeConfig, apiKey: e.target.value } })}
                            className="w-full px-3 py-2 font-mono text-sm"
                            style={editorialInputStyle}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                          />
                        </div>
                        <button
                          onClick={async () => {
                            const { testConnection } = await import('../services/claudeApi');
                            const result = await testConnection(claudeConfig.apiKey);
                            if (result.success) {
                              showAlert?.('Claude AI connected successfully!', 'success');
                            } else {
                              showAlert?.(`Claude connection failed: ${result.error || 'Status ' + result.status}`, 'error');
                            }
                          }}
                          className="mt-5 text-xs font-bold text-white px-4 py-2 rounded flex items-center gap-1.5 transition-all active:scale-95"
                          style={{ backgroundColor: 'var(--odoo-purple)' }}
                        >
                          <Wifi className="w-3.5 h-3.5" /> Test
                        </button>
                      </div>
                    )}
                  </section>
                );
              })()}

              {/* Platform API Configuration */}
              <PlatformApiSection />

              {/* Security Audit Log */}
              <SecurityAuditPanel triggerConfirm={triggerConfirm} />
            </>
          )}

          {/* ─────────────────────────────────────────────
              API Health Footer Banner
          ───────────────────────────────────────────── */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div
              className="relative overflow-hidden rounded h-32 flex items-center px-8"
              style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}
            >
              {/* Decorative overlay */}
              <div
                className="absolute right-0 top-0 h-full w-1/2 opacity-10"
                style={{
                  backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%)',
                }}
              />
              <div className="z-10 flex gap-12">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                  >
                    API Health
                  </p>
                  <p className="text-2xl font-bold text-white">{apiHealthPct}</p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                  >
                    Last Sync
                  </p>
                  <p className="text-2xl font-bold text-white">{lastSyncTime}</p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                  >
                    Active Hooks
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {userRole === 'admin'
                      ? `${PLATFORM_DEFS.filter(p => platformApi.isConfigured(p.key)).length + (apiConfigs.odoo?.enabled ? 1 : 0) + (apiConfigs.claude?.enabled ? 1 : 0)}/${PLATFORM_DEFS.length + 2}`
                      : '0/0'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;
