import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Shield, Search, Trash2, ChevronDown, ChevronUp, Bell, CheckCircle2, AlertTriangle, Clock, Package, Truck, Scan, ClipboardCheck } from 'lucide-react';
import txRing from '../services/transactionRing';

/**
 * TxDebugPanel — Transaction Ring Live Viewer
 *
 * Shows real-time TX events, audit trail, chain verification.
 * For testing/debugging — accessible from Settings or Dashboard.
 */

const ACTION_ICONS = {
  pick: Package,
  pack: Package,
  scan: Scan,
  dispatch: Truck,
  confirmRTS: CheckCircle2,
  adjust: ClipboardCheck,
  cycleCount: ClipboardCheck,
  transfer: Truck,
  login: Shield,
  logout: Shield,
};

const ACTION_COLORS = {
  pick: '#28a745',
  pack: '#007bff',
  scan: '#fd7e14',
  dispatch: '#6f42c1',
  confirmRTS: '#20c997',
  adjust: '#ffc107',
  login: '#6c757d',
  logout: '#6c757d',
};

const formatTime = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDate = (ts) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const TxDebugPanel = ({ notifications = [], unreadCount = 0, onVerifyChain }) => {
  const [txList, setTxList] = useState([]);
  const [stats, setStats] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [filterOrder, setFilterOrder] = useState('');
  const [expandedTx, setExpandedTx] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load TXs
  const loadTxs = useCallback(async () => {
    const filters = {};
    if (filterAction) filters.action = filterAction;
    if (filterOrder) filters.orderId = Number(filterOrder) || undefined;
    filters.limit = 100;
    const results = await txRing.query(filters);
    setTxList(results);
    const s = await txRing.getStats();
    setStats(s);
  }, [filterAction, filterOrder]);

  useEffect(() => {
    loadTxs();
  }, [loadTxs]);

  // Auto-refresh every 3s
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(loadTxs, 3000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadTxs]);

  // Verify chain
  const handleVerify = async () => {
    setIsVerifying(true);
    const result = await txRing.verifyChain();
    setVerifyResult(result);
    setIsVerifying(false);
    if (onVerifyChain) onVerifyChain(result);
  };

  // Clear all TXs
  const handleClear = async () => {
    if (!window.confirm('Clear all transactions? This cannot be undone.')) return;
    await txRing.clear();
    await loadTxs();
    setVerifyResult(null);
  };

  const panelStyle = {
    background: '#ffffff',
    border: '1px solid #dee2e6',
    borderRadius: '12px',
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const headerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
  };

  const badgeStyle = (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
    background: color + '20', color: color,
  });

  const btnStyle = (variant = 'default') => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500',
    border: '1px solid #dee2e6', cursor: 'pointer',
    background: variant === 'primary' ? '#714B67' : variant === 'danger' ? '#dc3545' : '#fff',
    color: variant === 'primary' || variant === 'danger' ? '#fff' : '#495057',
  });

  const inputStyle = {
    padding: '6px 12px', borderRadius: '8px', border: '1px solid #dee2e6',
    fontSize: '13px', width: '160px',
  };

  const txRowStyle = (action) => ({
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
    borderLeft: `4px solid ${ACTION_COLORS[action] || '#6c757d'}`,
    background: '#f8f9fa', marginBottom: '6px',
    transition: 'background 0.15s',
  });

  const hashStyle = {
    fontFamily: 'monospace', fontSize: '11px', color: '#868e96',
    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px',
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={22} color="#714B67" />
          <h3 style={{ margin: 0, fontSize: '18px', color: '#212529' }}>Transaction Ring</h3>
          {stats && (
            <span style={badgeStyle('#714B67')}>
              {stats.count} / {stats.maxSize} TXs
            </span>
          )}
          {unreadCount > 0 && (
            <span style={badgeStyle('#dc3545')}>
              <Bell size={12} /> {unreadCount} new
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={btnStyle('primary')} onClick={handleVerify} disabled={isVerifying}>
            <Shield size={14} /> {isVerifying ? 'Verifying...' : 'Verify Chain'}
          </button>
          <button style={btnStyle()} onClick={loadTxs}>
            <Clock size={14} /> Refresh
          </button>
          <button style={btnStyle()} onClick={() => setShowNotifications(!showNotifications)}>
            <Bell size={14} /> Notifications ({notifications.length})
          </button>
          <button style={btnStyle('danger')} onClick={handleClear}>
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Verify Result */}
      {verifyResult && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: verifyResult.valid ? '#d4edda' : '#f8d7da',
          color: verifyResult.valid ? '#155724' : '#721c24',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {verifyResult.valid
            ? <><CheckCircle2 size={18} /> Chain integrity verified — {verifyResult.checked} TXs checked, no tampering detected</>
            : <><AlertTriangle size={18} /> INTEGRITY VIOLATION — {verifyResult.violations.length} issue(s) found in {verifyResult.checked} TXs</>
          }
        </div>
      )}

      {/* Notifications Panel */}
      {showNotifications && notifications.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '12px', background: '#fff3cd', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '13px' }}>Recent Notifications</div>
          {notifications.slice(0, 20).map((n, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #ffeaa7', fontSize: '13px', opacity: n.read ? 0.6 : 1 }}>
              <span style={{ color: '#856404' }}>{formatTime(n.timestamp)}</span>{' '}
              <span>{n.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Search size={16} color="#868e96" />
        <select
          style={inputStyle}
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="">All Actions</option>
          <option value="pick">Pick</option>
          <option value="pack">Pack</option>
          <option value="scan">Scan</option>
          <option value="dispatch">Dispatch</option>
          <option value="confirmRTS">Confirm RTS</option>
          <option value="adjust">Adjust</option>
          <option value="login">Login</option>
        </select>
        <input
          style={inputStyle}
          placeholder="Order ID"
          value={filterOrder}
          onChange={(e) => setFilterOrder(e.target.value)}
        />
        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-refresh
        </label>
        <span style={{ fontSize: '12px', color: '#868e96' }}>
          {stats?.newest ? `Last TX: ${formatDate(stats.newest)}` : 'No transactions yet'}
        </span>
      </div>

      {/* TX List */}
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {txList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#868e96' }}>
            <Activity size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <div>No transactions yet</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Start picking/packing to see events here</div>
          </div>
        ) : (
          txList.map((tx) => {
            const Icon = ACTION_ICONS[tx.action] || Activity;
            const isExpanded = expandedTx === tx.seq;
            return (
              <div key={tx.seq}>
                <div
                  style={txRowStyle(tx.action)}
                  onClick={() => setExpandedTx(isExpanded ? null : tx.seq)}
                >
                  <Icon size={18} color={ACTION_COLORS[tx.action] || '#6c757d'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', textTransform: 'uppercase' }}>{tx.action}</span>
                      <span style={{ fontSize: '13px', color: '#495057' }}>by {tx.actor}</span>
                      {tx.target?.orderRef && (
                        <span style={badgeStyle('#007bff')}>{tx.target.orderRef}</span>
                      )}
                      {tx.target?.sku && (
                        <span style={badgeStyle('#28a745')}>{tx.target.sku}</span>
                      )}
                      {tx.target?.awb && (
                        <span style={badgeStyle('#20c997')}>AWB: {tx.target.awb}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                      <span style={{ fontSize: '12px', color: '#868e96' }}>{formatTime(tx.timestamp)}</span>
                      <span style={hashStyle} title={tx.hash}>#{tx.seq} {tx.hash?.substring(0, 12)}...</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} color="#868e96" /> : <ChevronDown size={16} color="#868e96" />}
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div style={{
                    margin: '0 0 8px 20px', padding: '12px 16px',
                    background: '#fff', border: '1px solid #e9ecef', borderRadius: '8px',
                    fontSize: '13px',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr><td style={{ padding: '4px 12px 4px 0', fontWeight: '600', color: '#495057', whiteSpace: 'nowrap' }}>Sequence</td><td>#{tx.seq}</td></tr>
                        <tr><td style={{ padding: '4px 12px 4px 0', fontWeight: '600', color: '#495057' }}>Hash</td><td style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>{tx.hash}</td></tr>
                        <tr><td style={{ padding: '4px 12px 4px 0', fontWeight: '600', color: '#495057' }}>Prev Hash</td><td style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>{tx.prevHash}</td></tr>
                        <tr><td style={{ padding: '4px 12px 4px 0', fontWeight: '600', color: '#495057' }}>Action</td><td>{tx.action}</td></tr>
                        <tr><td style={{ padding: '4px 12px 4px 0', fontWeight: '600', color: '#495057' }}>Actor</td><td>{tx.actor}</td></tr>
                        <tr><td style={{ padding: '4px 12px 4px 0', fontWeight: '600', color: '#495057' }}>Timestamp</td><td>{new Date(tx.timestamp).toLocaleString('th-TH')}</td></tr>
                        <tr><td style={{ padding: '4px 12px 4px 0', fontWeight: '600', color: '#495057' }}>Affects</td><td>{(tx.affects || []).join(', ') || '-'}</td></tr>
                        <tr><td style={{ padding: '4px 12px 4px 0', fontWeight: '600', color: '#495057' }}>Target</td><td><pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>{JSON.stringify(tx.target, null, 2)}</pre></td></tr>
                        {tx.meta && Object.keys(tx.meta).length > 0 && (
                          <tr><td style={{ padding: '4px 12px 4px 0', fontWeight: '600', color: '#495057' }}>Meta</td><td><pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>{JSON.stringify(tx.meta, null, 2)}</pre></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Stats */}
      {stats && stats.count > 0 && (
        <div style={{ marginTop: '16px', padding: '10px 14px', background: '#f8f9fa', borderRadius: '8px', fontSize: '12px', color: '#868e96', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <span>Total: {stats.count} TXs</span>
          <span>Ring: {stats.count}/{stats.maxSize}</span>
          <span>Oldest: {formatDate(stats.oldest)}</span>
          <span>Newest: {formatDate(stats.newest)}</span>
          <span style={{ fontFamily: 'monospace' }}>Last Hash: {stats.lastHash?.substring(0, 16)}...</span>
        </div>
      )}
    </div>
  );
};

export default TxDebugPanel;
