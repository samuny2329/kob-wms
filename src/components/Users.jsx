import React from 'react';
import { Shield, UserPlus, Clock, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';

const Users = ({ t, userRole, newUserName, setNewUserName, newUserUsername, setNewUserUsername, newUserRole, setNewUserRole, handleAddUser, rolesInfo, users, handleResetPassword, handleDeleteUser }) => {
    return (
        <div className="max-w-5xl mx-auto animate-slide-up pb-12 w-full">
            <div style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                {/* Header */}
                <div className="px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                    <div>
                        <h2 className="flex items-center gap-2" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                            <Shield className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} /> {t('userMgmt')}
                        </h2>
                        <p style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)', marginTop: '2px' }}>Manage system access, roles, and security credentials</p>
                    </div>
                </div>

                {/* Add Employee Form */}
                <div className="p-6" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface)' }}>
                    <h4 className="flex items-center gap-2 mb-4" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                        <UserPlus className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> {t('addEmp')}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--odoo-text-secondary)', display: 'block', marginBottom: '4px' }}>{t('fullName')}</label>
                            <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="e.g. Somchai P." className="odoo-input" style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--odoo-text-secondary)', display: 'block', marginBottom: '4px' }}>{t('username')}</label>
                            <input type="text" value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)} placeholder="login ID" className="odoo-input" style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--odoo-text-secondary)', display: 'block', marginBottom: '4px' }}>{t('assignRole')}</label>
                            <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="odoo-input" style={{ width: '100%', boxSizing: 'border-box' }}>
                                {Object.entries(rolesInfo).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <button onClick={handleAddUser} className="odoo-btn flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--odoo-purple)', color: 'var(--odoo-surface)', borderColor: 'var(--odoo-purple)', width: '100%', height: '34px' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-purple-dark)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--odoo-purple)'}
                        >
                            <UserPlus className="w-4 h-4" /> {t('createBtn')}
                        </button>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)', marginTop: '12px', borderLeft: '2px solid #ffac00', paddingLeft: '8px', backgroundColor: '#fffbf0', paddingTop: '4px', paddingBottom: '4px' }}>
                        * Default password for new staff is <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#856404', backgroundColor: 'var(--odoo-surface)', padding: '1px 6px', border: '1px solid var(--odoo-border-ghost)', borderRadius: '3px', margin: '0 4px' }}>123456</span> System will force a password change on first login.
                    </p>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="odoo-table w-full" style={{ minWidth: '600px' }}>
                        <thead>
                            <tr>
                                <th>{t('empTblCol')}</th>
                                <th>{t('username')}</th>
                                <th>{t('roleTblCol')}</th>
                                <th style={{ textAlign: 'center' }}>{t('secTblCol')}</th>
                                <th style={{ textAlign: 'right' }}>{t('actTblCol')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.username} className="group"
                                    onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = 'var(--odoo-surface-low)'); }}
                                    onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = ''); }}
                                >
                                    <td style={{ fontWeight: 700, color: 'var(--odoo-text)' }}>{u.name}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--odoo-text-secondary)' }}>{u.username}</td>
                                    <td>
                                        <span className="odoo-badge" style={u.role === 'admin'
                                            ? { backgroundColor: '#e8e8f5', color: '#3730a3', border: '1px solid #c7d2fe', textTransform: 'uppercase', letterSpacing: '0.05em' }
                                            : { backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text)', border: '1px solid var(--odoo-border-ghost)', textTransform: 'uppercase', letterSpacing: '0.05em' }
                                        }>
                                            {rolesInfo[u.role]?.label || u.role}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {u.isFirstLogin
                                            ? <span className="odoo-badge" style={{ backgroundColor: '#fff8e1', color: '#856404', border: '1px solid var(--odoo-warning)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock className="w-3 h-3" /> Pending Change
                                              </span>
                                            : <span className="odoo-badge" style={{ backgroundColor: '#d4edda', color: '#155724', border: '1px solid #c3e6cb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <CheckCircle2 className="w-3 h-3" /> Secured
                                              </span>
                                        }
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleResetPassword(u.username)}
                                                style={{ padding: '5px', borderRadius: '4px', border: '1px solid transparent', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--odoo-text-muted)' }}
                                                title="Reset Password to 123456"
                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--odoo-warning)'; e.currentTarget.style.backgroundColor = '#fff8e1'; e.currentTarget.style.borderColor = 'var(--odoo-warning)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--odoo-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeleteUser(u.username)} disabled={u.username === 'admin'}
                                                style={{ padding: '5px', borderRadius: '4px', border: '1px solid transparent', cursor: u.username === 'admin' ? 'not-allowed' : 'pointer', backgroundColor: 'transparent', color: 'var(--odoo-text-muted)', opacity: u.username === 'admin' ? 0.3 : 1 }}
                                                title="Delete User"
                                                onMouseEnter={e => { if (u.username !== 'admin') { e.currentTarget.style.color = 'var(--odoo-danger)'; e.currentTarget.style.backgroundColor = '#fff5f5'; e.currentTarget.style.borderColor = '#f5c6cb'; } }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--odoo-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Users;
