import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Globe, Database, ToggleRight, ToggleLeft, ShoppingBag, Store, Link, Trash2, RotateCcw, Wifi, CheckCircle2, AlertCircle, RefreshCw, Monitor, Cloud, MapPin, Truck, Package, ExternalLink, Zap, Shield } from 'lucide-react';
import { testConnection, resetOdooSession, ensurePickfaceLocation, createTestSalesOrders } from '../services/odooApi';
import platformApi, { MARKETPLACES, COURIERS } from '../services/platformApi';

// ── Platform API Configuration Sub-Component ──────────────
const PLATFORM_DEFS = [
    // Marketplaces
    { key: 'shopee', name: 'Shopee Open Platform', type: 'marketplace', color: '#EE4D2D', icon: <ShoppingBag className="w-4 h-4" />, docsUrl: 'https://open.shopee.com' },
    { key: 'lazada', name: 'Lazada Open Platform', type: 'marketplace', color: '#0F146D', icon: <Store className="w-4 h-4" />, docsUrl: 'https://open.lazada.com' },
    { key: 'tiktok', name: 'TikTok Shop API', type: 'marketplace', color: '#010101', icon: <Link className="w-4 h-4" />, docsUrl: 'https://partner.tiktokshop.com' },
    // Couriers
    { key: 'flash', name: 'Flash Express', type: 'courier', color: '#FFCD00', textColor: '#333', icon: <Zap className="w-4 h-4" />, docsUrl: 'https://open-docs.flashfulfillment.co.th/en.html' },
    { key: 'kerry', name: 'Kerry Express', type: 'courier', color: '#FF6600', icon: <Truck className="w-4 h-4" />, docsUrl: 'https://exch.th.kerryexpress.com/ediwebapi' },
    { key: 'jt', name: 'J&T Express', type: 'courier', color: '#D32011', icon: <Package className="w-4 h-4" />, docsUrl: 'https://developer.jet.co.id' },
    { key: 'thaipost', name: 'Thai Post / EMS', type: 'courier', color: '#ED1C24', icon: <Package className="w-4 h-4" />, docsUrl: 'https://track.thailandpost.co.th/developerGuide' },
];

const PlatformApiSection = () => {
    const [expandedPlatform, setExpandedPlatform] = useState(null);
    const [platformConfigs, setPlatformConfigs] = useState({});
    const [testResults, setTestResults] = useState({});
    const [testingKey, setTestingKey] = useState(null);

    useEffect(() => {
        // Load saved configs
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

    return (
        <section>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#6c757d' }}>
                    Platform & Courier APIs
                </h3>
                <button onClick={handleTestAll} disabled={testingKey === 'all'} className="odoo-btn text-[10px] flex items-center gap-1 px-2 py-1" style={{ color: '#714B67', borderColor: '#714B67' }}>
                    {testingKey === 'all' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                    Test All
                </button>
            </div>

            {/* Marketplace APIs */}
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 mt-2" style={{ color: '#adb5bd' }}>Marketplaces</p>
            <div className="space-y-1.5 mb-4">
                {PLATFORM_DEFS.filter(p => p.type === 'marketplace').map(p => (
                    <PlatformCard key={p.key} def={p} config={platformConfigs[p.key] || {}} testResult={testResults[p.key]}
                        isTesting={testingKey === p.key} isExpanded={expandedPlatform === p.key}
                        onToggle={() => setExpandedPlatform(expandedPlatform === p.key ? null : p.key)}
                        onFieldChange={(fk, v) => handleFieldChange(p.key, fk, v)}
                        onTest={() => handleTest(p.key)}
                        fields={platformApi.getConfigFields(p.key)} />
                ))}
            </div>

            {/* Courier APIs */}
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#adb5bd' }}>Couriers / Logistics</p>
            <div className="space-y-1.5">
                {PLATFORM_DEFS.filter(p => p.type === 'courier').map(p => (
                    <PlatformCard key={p.key} def={p} config={platformConfigs[p.key] || {}} testResult={testResults[p.key]}
                        isTesting={testingKey === p.key} isExpanded={expandedPlatform === p.key}
                        onToggle={() => setExpandedPlatform(expandedPlatform === p.key ? null : p.key)}
                        onFieldChange={(fk, v) => handleFieldChange(p.key, fk, v)}
                        onTest={() => handleTest(p.key)}
                        fields={platformApi.getConfigFields(p.key)} />
                ))}
            </div>
        </section>
    );
};

const PlatformCard = ({ def, config, testResult, isTesting, isExpanded, onToggle, onFieldChange, onTest, fields }) => {
    const isConfigured = platformApi.isConfigured(def.key);
    return (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
            <div className="px-3 py-2.5 flex items-center justify-between cursor-pointer" onClick={onToggle}
                style={{ backgroundColor: isExpanded ? '#f8f9fa' : '#fff', borderBottom: isExpanded ? '1px solid #dee2e6' : 'none' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: def.color, color: def.textColor || '#fff' }}>
                        {def.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-semibold" style={{ color: '#212529' }}>{def.name}</h4>
                            {isConfigured && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#28a745' }} />}
                        </div>
                        <p className="text-[10px]" style={{ color: '#6c757d' }}>
                            {isConfigured ? 'Configured' : 'Not configured'} · {def.type === 'marketplace' ? 'Orders + Fulfillment' : 'Shipping + Tracking'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {testResult && (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: testResult.success ? '#28a745' : '#dc3545' }} />
                    )}
                    <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: '#6c757d' }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
            {isExpanded && (
                <div className="p-3 space-y-2.5 animate-slide-up">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {fields.map(field => (
                            <div key={field.key}>
                                <label className="text-[10px] font-medium mb-0.5 block" style={{ color: '#6c757d' }}>{field.label}</label>
                                {field.type === 'select' ? (
                                    <select value={config[field.key] || field.default || ''} onChange={e => onFieldChange(field.key, e.target.value)} className="odoo-input w-full text-xs">
                                        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                ) : (
                                    <input type={field.type || 'text'} placeholder={field.placeholder || field.label}
                                        value={config[field.key] || ''} onChange={e => onFieldChange(field.key, e.target.value)}
                                        className="odoo-input w-full text-xs" />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid #f0f0f0' }}>
                        <button onClick={e => { e.stopPropagation(); onTest(); }} disabled={isTesting || !isConfigured}
                            className="odoo-btn odoo-btn-primary disabled:opacity-40 flex items-center gap-1 text-[11px] px-2.5 py-1.5">
                            {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                            Test
                        </button>
                        {def.docsUrl && (
                            <a href={def.docsUrl} target="_blank" rel="noopener noreferrer"
                                className="odoo-btn flex items-center gap-1 text-[11px] px-2.5 py-1.5" style={{ color: '#6c757d' }}>
                                <ExternalLink className="w-3 h-3" /> Docs
                            </a>
                        )}
                        {testResult && (
                            <span className="text-[11px] font-medium ml-1" style={{ color: testResult.success ? '#28a745' : '#dc3545' }}>
                                {testResult.success ? '✓ Connected' : `✗ ${testResult.error || 'Failed'}`}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Security Audit Log Panel (admin only) ──────────────
const AUDIT_KEY = 'wms_audit_log';
const AUDIT_COLORS = {
    login_failed: { bg: '#fff5f5', color: '#dc3545', label: 'FAILED' },
    login_success: { bg: '#e8f5e9', color: '#28a745', label: 'LOGIN' },
    login_blocked: { bg: '#fff8e1', color: '#e67700', label: 'BLOCKED' },
};
const DEFAULT_AUDIT_STYLE = { bg: '#f8f9fa', color: '#6c757d', label: 'ACTION' };

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
        <section>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#6c757d' }}>
                    <Shield className="w-3.5 h-3.5" /> Security Audit Log
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => setExpanded(!expanded)} className="odoo-btn text-[10px] px-2 py-1" style={{ color: '#714B67', borderColor: '#714B67' }}>
                        {expanded ? 'Collapse' : `Show (${logs.length})`}
                    </button>
                    {logs.length > 0 && (
                        <button onClick={handleClear} className="odoo-btn text-[10px] px-2 py-1 flex items-center gap-1" style={{ color: '#dc3545', borderColor: '#f5c6cb', backgroundColor: '#fff5f5' }}>
                            <Trash2 className="w-3 h-3" /> Clear
                        </button>
                    )}
                </div>
            </div>
            {expanded && (
                <div className="rounded overflow-hidden" style={{ border: '1px solid #dee2e6' }}>
                    {logs.length === 0 ? (
                        <div className="p-4 text-center text-xs" style={{ color: '#6c757d' }}>No audit log entries</div>
                    ) : (
                        <div className="overflow-x-auto" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                        <th className="text-left px-3 py-2 font-semibold" style={{ color: '#495057' }}>Timestamp</th>
                                        <th className="text-left px-3 py-2 font-semibold" style={{ color: '#495057' }}>Action</th>
                                        <th className="text-left px-3 py-2 font-semibold" style={{ color: '#495057' }}>User</th>
                                        <th className="text-left px-3 py-2 font-semibold" style={{ color: '#495057' }}>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((entry, i) => {
                                        const style = getStyle(entry.action);
                                        const details = typeof entry.details === 'object'
                                            ? Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(', ')
                                            : String(entry.details || '');
                                        return (
                                            <tr key={entry.id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#6c757d' }}>
                                                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-'}
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: style.bg, color: style.color }}>
                                                        {style.label}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 font-medium" style={{ color: '#212529' }}>{entry.username || '-'}</td>
                                                <td className="px-3 py-1.5" style={{ color: '#6c757d', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

const Settings = ({ t, language, setLanguage, userRole, apiConfigs, setApiConfigs, workDate, setWorkDate, triggerConfirm, updateAndSyncData, showAlert, syncStatus }) => {
    const [testResult, setTestResult] = useState(null);
    const [isTesting, setIsTesting] = useState(false);
    const [pickfaceResult, setPickfaceResult] = useState(null);
    const [isPickfaceSetup, setIsPickfaceSetup] = useState(false);
    const [isCreatingSO, setIsCreatingSO] = useState(false);
    const [createSOResult, setCreateSOResult] = useState(null);
    const [soCount, setSoCount] = useState(5);

    const odooUseMock = apiConfigs.odoo?.useMock !== false; // default true

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

    const handleToggleMock = () => {
        const newUseMock = !odooUseMock;
        resetOdooSession();
        setApiConfigs({
            ...apiConfigs,
            odoo: { ...apiConfigs.odoo, useMock: newUseMock ? undefined : false }
        });
        setTestResult(null);
    };

    return (
        <div className="max-w-2xl mx-auto animate-slide-up pb-10 w-full">
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                        <SettingsIcon className="w-4 h-4" style={{ color: '#6c757d' }} /> {t('sysSettings')}
                    </h2>
                </div>
                <div className="p-5 space-y-6">
                    {/* Preferences */}
                    <section>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#6c757d' }}>{t('pref')}</h3>
                        <div className="p-4 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                            <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#495057' }}>
                                <Globe className="w-3.5 h-3.5" /> {t('sysLang')}
                            </label>
                            <select
                                value={language}
                                onChange={e => setLanguage(e.target.value)}
                                className="odoo-input w-full md:w-1/2"
                            >
                                <option value="en">English (US)</option>
                                <option value="th">Thai (TH)</option>
                            </select>
                            <p className="text-xs mt-1.5" style={{ color: '#6c757d' }}>{t('langDesc')}</p>
                        </div>
                    </section>

                    {/* API Integrations */}
                    {userRole === 'admin' && (
                        <section>
                            <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#6c757d' }}>{t('apiInt')}</h3>
                            <div className="space-y-2">
                                {[
                                    { id: 'odoo', name: 'Odoo ERP', desc: 'Connect to core inventory & sales', icon: <Database className="w-4 h-4" />, fields: [{ key: 'url', label: 'Server URL', placeholder: 'http://localhost:8070' }, { key: 'db', label: 'Database Name', placeholder: 'odoo18' }, { key: 'username', label: 'Username', placeholder: 'admin' }, { key: 'password', label: 'Password', type: 'password' }] },
                                    { id: 'shopee', name: 'Shopee Open API', desc: 'Sync Shopee orders & waybills', icon: <ShoppingBag className="w-4 h-4" />, fields: [{ key: 'shopId', label: 'Shop ID' }, { key: 'partnerId', label: 'Partner ID' }, { key: 'partnerKey', label: 'Partner Key', type: 'password' }] },
                                    { id: 'lazada', name: 'Lazada Open Platform', desc: 'Sync Lazada orders & waybills', icon: <Store className="w-4 h-4" />, fields: [{ key: 'appKey', label: 'App Key' }, { key: 'appSecret', label: 'App Secret', type: 'password' }, { key: 'accessToken', label: 'Access Token' }] },
                                    { id: 'tiktok', name: 'TikTok Shop API', desc: 'Sync TikTok orders & waybills', icon: <Link className="w-4 h-4" />, fields: [{ key: 'appKey', label: 'App Key' }, { key: 'appSecret', label: 'App Secret', type: 'password' }, { key: 'accessToken', label: 'Access Token' }] }
                                ].map(api => (
                                    <div key={api.id} style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#f8f9fa', borderBottom: apiConfigs[api.id].enabled ? '1px solid #dee2e6' : 'none' }}>
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 rounded shrink-0" style={{ backgroundColor: '#f0e8ed', color: '#714B67' }}>{api.icon}</div>
                                                <div>
                                                    <h4 className="text-sm font-semibold" style={{ color: '#212529' }}>{api.name}</h4>
                                                    <p className="text-xs" style={{ color: '#6c757d' }}>{api.desc}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setApiConfigs({ ...apiConfigs, [api.id]: { ...apiConfigs[api.id], enabled: !apiConfigs[api.id].enabled } })}>
                                                {apiConfigs[api.id].enabled
                                                    ? <ToggleRight className="w-7 h-7 transition-colors" style={{ color: '#28a745' }} />
                                                    : <ToggleLeft className="w-7 h-7 transition-colors" style={{ color: '#adb5bd' }} />}
                                            </button>
                                        </div>
                                        {apiConfigs[api.id].enabled && (
                                            <div className="p-4 space-y-3 animate-slide-up">
                                                {api.id === 'odoo' && (
                                                    <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid #dee2e6' }}>
                                                        <button
                                                            onClick={handleToggleMock}
                                                            className="odoo-btn text-xs flex items-center gap-1.5"
                                                            style={{
                                                                backgroundColor: odooUseMock ? '#fff8e1' : '#e8f5e9',
                                                                color: odooUseMock ? '#856404' : '#2e7d32',
                                                                borderColor: odooUseMock ? '#ffc107' : '#28a745',
                                                            }}
                                                        >
                                                            {odooUseMock ? <Monitor className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                                                            {odooUseMock ? 'Mock Mode (Offline)' : 'Live Mode (Odoo)'}
                                                        </button>
                                                        <span className="text-[11px]" style={{ color: '#6c757d' }}>
                                                            {odooUseMock ? 'Using local demo data' : 'Connected to real Odoo server'}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {api.fields.map(field => (
                                                        <input
                                                            key={field.key}
                                                            type={field.type || 'text'}
                                                            placeholder={field.placeholder || field.label}
                                                            value={apiConfigs[api.id][field.key] || ''}
                                                            onChange={e => {
                                                                if (api.id === 'odoo') resetOdooSession();
                                                                setApiConfigs({ ...apiConfigs, [api.id]: { ...apiConfigs[api.id], [field.key]: e.target.value } });
                                                            }}
                                                            className="odoo-input w-full"
                                                        />
                                                    ))}
                                                </div>
                                                {api.id === 'odoo' && (
                                                    <div className="space-y-2 pt-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <button onClick={handleTestConnection} disabled={isTesting} className="odoo-btn odoo-btn-primary disabled:opacity-50 flex items-center gap-1.5 text-xs">
                                                                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                                                                Test Connection
                                                            </button>
                                                            {testResult && (
                                                                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: testResult.success ? '#28a745' : '#dc3545' }}>
                                                                    {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                                                    {testResult.message}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 pt-1" style={{ borderTop: '1px solid #dee2e6' }}>
                                                            <button
                                                                onClick={async () => {
                                                                    setIsPickfaceSetup(true); setPickfaceResult(null);
                                                                    try {
                                                                        const loc = await ensurePickfaceLocation(apiConfigs.odoo);
                                                                        setPickfaceResult({ success: true, message: `PICKFACE ready: ${loc.complete_name} (ID: ${loc.id})` });
                                                                    } catch (err) {
                                                                        setPickfaceResult({ success: false, message: err.message });
                                                                    } finally { setIsPickfaceSetup(false); }
                                                                }}
                                                                disabled={isPickfaceSetup}
                                                                className="odoo-btn disabled:opacity-50 flex items-center gap-1.5 text-xs"
                                                                style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', borderColor: '#28a745' }}
                                                            >
                                                                {isPickfaceSetup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                                                                Setup PICKFACE Location
                                                            </button>
                                                            {pickfaceResult && (
                                                                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: pickfaceResult.success ? '#28a745' : '#dc3545' }}>
                                                                    {pickfaceResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                                                    {pickfaceResult.message}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Create Test SO */}
                                                        <div className="pt-2" style={{ borderTop: '1px solid #dee2e6' }}>
                                                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#6c757d' }}>Create Test Sales Orders (SKINOXY)</p>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                                                                    <span className="text-xs" style={{ color: '#6c757d' }}>SO Count:</span>
                                                                    <input
                                                                        type="number" min="1" max="20" value={soCount}
                                                                        onChange={e => setSoCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                                                                        className="w-10 text-center text-xs font-bold bg-transparent outline-none"
                                                                        style={{ color: '#212529' }}
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={async () => {
                                                                        setIsCreatingSO(true); setCreateSOResult(null);
                                                                        try {
                                                                            const result = await createTestSalesOrders(apiConfigs.odoo, soCount);
                                                                            setCreateSOResult({ success: true, message: `Created ${result.created} SOs → WH/OUT ready for Pick` });
                                                                        } catch (err) {
                                                                            setCreateSOResult({ success: false, message: err.message });
                                                                        } finally { setIsCreatingSO(false); }
                                                                    }}
                                                                    disabled={isCreatingSO}
                                                                    className="odoo-btn odoo-btn-primary disabled:opacity-50 flex items-center gap-1.5 text-xs"
                                                                >
                                                                    {isCreatingSO ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Store className="w-3.5 h-3.5" />}
                                                                    {isCreatingSO ? 'Creating...' : 'Create Test SOs'}
                                                                </button>
                                                                {createSOResult && (
                                                                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: createSOResult.success ? '#28a745' : '#dc3545' }}>
                                                                        {createSOResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                                                        {createSOResult.message}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] mt-1" style={{ color: '#adb5bd' }}>Products: STDH080-REFILL, STBG080, SWB700, SWH700 — random qty 1-3</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Platform API Configuration */}
                    {userRole === 'admin' && (
                        <PlatformApiSection />
                    )}

                    {/* Data Management */}
                    <section>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#6c757d' }}>{t('dataMgmt')}</h3>
                        <div className="p-4 rounded space-y-4" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                            <div>
                                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#495057' }}>{t('workDate')}</label>
                                <input type="date" value={workDate} onChange={e => setWorkDate(e.target.value)} className="odoo-input w-full md:w-1/2" />
                            </div>
                            {userRole === 'admin' && (
                                <div className="pt-4" style={{ borderTop: '1px solid #dee2e6' }}>
                                    <h4 className="text-sm font-semibold mb-0.5" style={{ color: '#dc3545' }}>{t('dangerZone')}</h4>
                                    <p className="text-xs mb-3" style={{ color: '#6c757d' }}>{t('clearDataDesc')}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => triggerConfirm('Clear System Data', 'Are you absolutely sure you want to delete all active orders? This action cannot be undone.', 'danger', () => { updateAndSyncData([]); showAlert('Cleared', 'All order data has been permanently deleted.', 'success'); })}
                                            className="odoo-btn flex items-center gap-1.5 text-xs"
                                            style={{ backgroundColor: '#fff5f5', color: '#dc3545', borderColor: '#f5c6cb' }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> {t('purgeBtn')}
                                        </button>
                                        <button
                                            onClick={() => triggerConfirm('Reset All Data', 'This will clear all saved data and reload with default product data. You will be logged out.', 'danger', () => { ['wms_orders','wms_sales_orders','wms_users','wms_history','wms_logs','wms_apis','wms_box_usage','currentUser','activeTab','userRole'].forEach(k => localStorage.removeItem(k)); window.location.reload(); })}
                                            className="odoo-btn flex items-center gap-1.5 text-xs"
                                            style={{ backgroundColor: '#fff8e1', color: '#856404', borderColor: '#ffc107' }}
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" /> Reset All Data
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Security Audit Log (admin only) */}
                    {userRole === 'admin' && (
                        <SecurityAuditPanel triggerConfirm={triggerConfirm} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
