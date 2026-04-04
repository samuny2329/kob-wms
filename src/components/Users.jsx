import React, { useState, useMemo } from 'react';
import { Shield, UserPlus, CheckCircle2, Filter, ChevronLeft, ChevronRight, X, Eye, EyeOff, Edit3, ChevronDown, Users as UsersIcon } from 'lucide-react';

const ROLE_COLORS = {
    admin: { dot: 'var(--odoo-purple)', text: 'var(--odoo-purple)' },
    senior: { dot: 'var(--odoo-purple)', text: 'var(--odoo-purple)' },
    picker: { dot: '#3b82f6', text: '#2563eb' },
    packer: { dot: '#f97316', text: '#ea580c' },
    outbound: { dot: 'var(--odoo-success)', text: '#15803d' },
};

const ITEMS_PER_PAGE = 10;

const Users = ({ t, userRole, newUserName, setNewUserName, newUserUsername, setNewUserUsername, newUserRole, setNewUserRole, handleAddUser, rolesInfo, users, handleResetPassword, handleDeleteUser }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [editingUser, setEditingUser] = useState(null);
    const [editName, setEditName] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editRole, setEditRole] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Filter users
    const filteredUsers = useMemo(() => {
        let result = users;
        if (roleFilter !== 'all') {
            result = result.filter(u => u.role === roleFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(u =>
                u.name.toLowerCase().includes(q) ||
                u.username.toLowerCase().includes(q) ||
                (rolesInfo[u.role]?.label || u.role).toLowerCase().includes(q)
            );
        }
        return result;
    }, [users, roleFilter, searchQuery, rolesInfo]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Role counts
    const roleCounts = useMemo(() => {
        const counts = {};
        users.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });
        return counts;
    }, [users]);

    const openEditModal = (u) => {
        setEditingUser(u);
        setEditName(u.name);
        setEditUsername(u.username);
        setEditRole(u.role);
        setShowPassword(false);
    };

    const closeEditModal = () => {
        setEditingUser(null);
    };

    const openAddModal = () => {
        setShowAddModal(true);
        setNewUserName('');
        setNewUserUsername('');
        setNewUserRole(Object.keys(rolesInfo)[0]);
    };

    const closeAddModal = () => {
        setShowAddModal(false);
    };

    const handleAddAndClose = () => {
        handleAddUser();
        closeAddModal();
    };

    // Get initials for avatar
    const getInitials = (name) => {
        const parts = name.split(' ');
        return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
    };

    // Avatar background from name hash
    const getAvatarColor = (name) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        const colors = ['#714b67', '#5f3b56', '#3b82f6', '#f97316', '#10b981', '#6366f1', '#ec4899', '#8b5cf6'];
        return colors[Math.abs(hash) % colors.length];
    };

    const roleFilterButtons = [
        { key: 'all', label: 'All' },
        { key: 'admin', label: 'Admins' },
        { key: 'senior', label: 'Senior' },
        { key: 'picker', label: 'Pickers' },
        { key: 'packer', label: 'Packers' },
        { key: 'outbound', label: 'Outbound' },
    ];

    // Label style shared across form labels
    const labelStyle = {
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--odoo-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        display: 'block',
    };

    // Table header cell style
    const thStyle = {
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--odoo-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
    };

    return (
        <div className="animate-slide-up pb-12 w-full">
            {/* Header & Action Bar */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>
                        {t('userMgmt')}
                    </h1>
                    <nav className="flex items-center gap-2" style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        <span>Admin</span>
                        <ChevronRight className="w-3 h-3" />
                        <span>Access Control</span>
                        <ChevronRight className="w-3 h-3" />
                        <span style={{ color: 'var(--odoo-purple)', fontWeight: 700 }}>Users</span>
                    </nav>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #57344f 0%, #714b67 100%)', color: '#fff' }}
                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.filter = ''}
                    >
                        <UserPlus className="w-4 h-4" /> {t('addEmp')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Left Side: Table & Filters */}
                <div className="col-span-12 lg:col-span-9 space-y-6">
                    {/* Filters and Search */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                            {roleFilterButtons.map(btn => (
                                <button
                                    key={btn.key}
                                    onClick={() => { setRoleFilter(btn.key); setCurrentPage(1); }}
                                    className="px-4 py-1.5 rounded text-xs font-semibold transition-all"
                                    style={roleFilter === btn.key
                                        ? { backgroundColor: 'var(--odoo-surface)', color: 'var(--odoo-purple)', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                                        : { backgroundColor: 'transparent', color: 'var(--odoo-text-secondary)', cursor: 'pointer' }
                                    }
                                    onMouseEnter={e => { if (roleFilter !== btn.key) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'; }}
                                    onMouseLeave={e => { if (roleFilter !== btn.key) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                placeholder="Search by name, username or role..."
                                className="text-xs rounded py-2 pl-9 pr-4 w-64 focus:outline-none focus:ring-1"
                                style={{
                                    backgroundColor: 'var(--odoo-surface)',
                                    border: 'none',
                                    outline: '1px solid var(--odoo-border-ghost)',
                                    color: 'var(--odoo-text)',
                                }}
                            />
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', outline: '1px solid var(--odoo-border-ghost)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse" style={{ minWidth: '700px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                        <th className="px-6 py-4" style={thStyle}>{t('empTblCol')}</th>
                                        <th className="px-6 py-4" style={thStyle}>{t('username')}</th>
                                        <th className="px-6 py-4" style={thStyle}>{t('roleTblCol')}</th>
                                        <th className="px-6 py-4" style={thStyle}>{t('secTblCol')}</th>
                                        <th className="px-6 py-4 text-center" style={thStyle}>Last Login</th>
                                        <th className="px-6 py-4 text-right" style={thStyle}>{t('actTblCol')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers.map(u => {
                                        const rc = ROLE_COLORS[u.role] || { dot: 'var(--odoo-text-muted)', text: 'var(--odoo-text-secondary)' };
                                        const isInactive = u.isFirstLogin;
                                        return (
                                            <tr
                                                key={u.username}
                                                className="group transition-colors"
                                                style={{
                                                    borderBottom: '1px solid var(--odoo-border-ghost)',
                                                    opacity: isInactive ? 0.6 : 1,
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                                            >
                                                {/* User cell with avatar */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="h-10 w-10 rounded flex-shrink-0 flex items-center justify-center"
                                                            style={{
                                                                backgroundColor: getAvatarColor(u.name),
                                                                color: '#fff',
                                                                fontSize: '13px',
                                                                fontWeight: 700,
                                                                filter: isInactive ? 'grayscale(1)' : 'none',
                                                            }}
                                                        >
                                                            {getInitials(u.name)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold" style={{ color: 'var(--odoo-text)' }}>{u.name}</div>
                                                            <div style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>{u.username}@kob-wms.com</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Username */}
                                                <td className="px-6 py-4">
                                                    <span className="text-xs px-2 py-1 rounded" style={{ fontFamily: 'monospace', backgroundColor: 'var(--odoo-surface-high)', color: 'var(--odoo-text-secondary)' }}>
                                                        {u.username}
                                                    </span>
                                                </td>
                                                {/* Role */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: rc.dot }} />
                                                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: rc.text }}>
                                                            {rolesInfo[u.role]?.label || u.role}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* Status toggle */}
                                                <td className="px-6 py-4">
                                                    {u.isFirstLogin
                                                        ? <button
                                                            className="w-10 h-5 rounded-full relative flex items-center px-1"
                                                            style={{ backgroundColor: 'var(--odoo-surface-high)', cursor: 'default' }}
                                                          >
                                                            <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: 'var(--odoo-surface)' }} />
                                                          </button>
                                                        : <button
                                                            className="w-10 h-5 rounded-full relative flex items-center px-1 justify-end"
                                                            style={{ backgroundColor: '#4b5d33', cursor: 'default' }}
                                                          >
                                                            <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: '#fff' }} />
                                                          </button>
                                                    }
                                                </td>
                                                {/* Last Login */}
                                                <td className="px-6 py-4 text-center">
                                                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: isInactive ? 'var(--odoo-text-muted)' : 'var(--odoo-text-secondary)' }}>
                                                        {u.lastLogin || '--'}
                                                    </span>
                                                </td>
                                                {/* Actions */}
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => openEditModal(u)}
                                                        className="p-1.5 transition-colors rounded"
                                                        style={{ color: 'var(--odoo-text-muted)', backgroundColor: 'transparent' }}
                                                        title="Edit User"
                                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--odoo-purple)'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--odoo-text-muted)'}
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {paginatedUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center" style={{ color: 'var(--odoo-text-muted)', fontSize: '13px' }}>
                                                No users found matching your criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Showing {paginatedUsers.length} of {filteredUsers.length} Users
                            </span>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1 rounded transition-colors"
                                        style={{ color: 'var(--odoo-text-muted)', opacity: currentPage === 1 ? 0.3 : 1 }}
                                        onMouseEnter={e => { if (currentPage !== 1) e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'; }}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                                        Math.max(0, currentPage - 3),
                                        Math.min(totalPages, currentPage + 2)
                                    ).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className="w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-all"
                                            style={page === currentPage
                                                ? { background: 'linear-gradient(135deg, #57344f 0%, #714b67 100%)', color: '#fff' }
                                                : { color: 'var(--odoo-text-secondary)', backgroundColor: 'transparent' }
                                            }
                                            onMouseEnter={e => { if (page !== currentPage) e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'; }}
                                            onMouseLeave={e => { if (page !== currentPage) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-1 rounded transition-colors"
                                        style={{ color: 'var(--odoo-text-muted)', opacity: currentPage === totalPages ? 0.3 : 1 }}
                                        onMouseEnter={e => { if (currentPage !== totalPages) e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'; }}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Role Summary & Audit */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    {/* Role Quick View */}
                    <div className="p-6 rounded-lg space-y-4" style={{ backgroundColor: 'var(--odoo-surface)', outline: '1px solid var(--odoo-border-ghost)' }}>
                        <div className="flex items-center gap-2 pb-3" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                            <Shield className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text)' }}>Role Quick View</h3>
                        </div>
                        <div className="space-y-4">
                            {Object.entries(rolesInfo).map(([key, info]) => {
                                const rc = ROLE_COLORS[key] || { dot: 'var(--odoo-text-muted)', text: 'var(--odoo-text-secondary)' };
                                const count = roleCounts[key] || 0;
                                return (
                                    <div key={key} className="group">
                                        <div className="flex items-center justify-between mb-2">
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: rc.text, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                {info.label}
                                            </span>
                                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--odoo-text-muted)' }}>
                                                {count} Users
                                            </span>
                                        </div>
                                        <div
                                            className="p-3 rounded space-y-2 transition-colors"
                                            style={{ backgroundColor: 'var(--odoo-surface-low)' }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = key === 'packer' ? '#fff7ed' : key === 'picker' ? '#eff6ff' : key === 'outbound' ? '#f0fdf4' : 'rgba(113,75,103,0.05)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                        >
                                            {info.tabs.slice(0, 3).map(tab => (
                                                <div key={tab} className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: '#4b5d33' }} />
                                                    <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--odoo-text-secondary)' }}>
                                                        {tab.charAt(0).toUpperCase() + tab.slice(1).replace(/([A-Z])/g, ' $1')}
                                                    </span>
                                                </div>
                                            ))}
                                            {info.tabs.length > 3 && (
                                                <span style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', fontWeight: 600 }}>
                                                    +{info.tabs.length - 3} more permissions
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Access Audit Card */}
                    <div className="p-6 rounded-lg shadow-xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #57344f 0%, #714b67 100%)', color: '#fff' }}>
                        <UsersIcon className="absolute -right-4 -bottom-4 w-28 h-28 rotate-12" style={{ opacity: 0.1 }} />
                        <h4 className="text-sm font-bold uppercase tracking-widest mb-2 relative z-10">Access Audit</h4>
                        <p className="leading-relaxed mb-4 relative z-10" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                            Ensure your warehouse remains secure. Run an access audit every 30 days.
                        </p>
                        <button
                            className="w-full py-2 rounded text-xs font-bold uppercase tracking-widest relative z-10 transition-colors"
                            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                        >
                            Generate Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                    style={{ backgroundColor: 'rgba(26, 28, 28, 0.4)', backdropFilter: 'blur(4px)' }}
                    onClick={e => { if (e.target === e.currentTarget) closeAddModal(); }}
                >
                    <div className="w-full max-w-xl rounded-lg shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)' }}>
                        {/* Modal Header */}
                        <div className="px-8 py-6 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #57344f 0%, #714b67 100%)', color: '#fff' }}>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight">{t('addEmp')}</h2>
                                <p style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)' }}>
                                    Create New User Account
                                </p>
                            </div>
                            <button
                                onClick={closeAddModal}
                                className="p-2 rounded-full transition-colors"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Modal Content */}
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label style={labelStyle}>{t('fullName')}</label>
                                    <input
                                        type="text"
                                        value={newUserName}
                                        onChange={e => setNewUserName(e.target.value)}
                                        placeholder="e.g. Somchai P."
                                        className="w-full rounded p-3 text-sm font-semibold focus:outline-none focus:ring-2 transition-all"
                                        style={{ backgroundColor: 'var(--odoo-surface-low)', border: 'none', color: 'var(--odoo-text)' }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label style={labelStyle}>{t('username')}</label>
                                    <input
                                        type="text"
                                        value={newUserUsername}
                                        onChange={e => setNewUserUsername(e.target.value)}
                                        placeholder="login ID"
                                        className="w-full rounded p-3 text-sm font-semibold focus:outline-none focus:ring-2 transition-all"
                                        style={{ backgroundColor: 'var(--odoo-surface-low)', border: 'none', fontFamily: 'monospace', color: 'var(--odoo-text)' }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label style={labelStyle}>{t('assignRole')}</label>
                                <div className="relative">
                                    <select
                                        value={newUserRole}
                                        onChange={e => setNewUserRole(e.target.value)}
                                        className="w-full rounded p-3 text-sm font-semibold focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer"
                                        style={{ backgroundColor: 'var(--odoo-surface-low)', border: 'none', color: 'var(--odoo-text)' }}
                                    >
                                        {Object.entries(rolesInfo).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--odoo-text-muted)' }} />
                                </div>
                            </div>
                            <p className="flex items-start gap-2 text-xs rounded p-3" style={{ color: 'var(--odoo-text-secondary)', backgroundColor: 'var(--odoo-surface-low)', borderLeft: '3px solid var(--odoo-warning)' }}>
                                Default password is <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#856404', backgroundColor: 'var(--odoo-surface)', padding: '1px 6px', border: '1px solid var(--odoo-border-ghost)', borderRadius: '3px', margin: '0 4px' }}>123456</span> — system will force a change on first login.
                            </p>
                        </div>
                        {/* Modal Footer */}
                        <div className="px-8 py-6 flex items-center justify-end gap-3" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                            <button
                                onClick={closeAddModal}
                                className="text-xs font-bold uppercase tracking-widest px-4 py-2 rounded transition-colors"
                                style={{ color: 'var(--odoo-text-muted)', backgroundColor: 'transparent', border: 'none' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAndClose}
                                className="px-6 py-2 rounded text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95"
                                style={{ background: 'linear-gradient(135deg, #57344f 0%, #714b67 100%)', color: '#fff' }}
                            >
                                {t('createBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                    style={{ backgroundColor: 'rgba(26, 28, 28, 0.4)', backdropFilter: 'blur(4px)' }}
                    onClick={e => { if (e.target === e.currentTarget) closeEditModal(); }}
                >
                    <div className="w-full max-w-xl rounded-lg shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)' }}>
                        {/* Modal Header */}
                        <div className="px-8 py-6 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #57344f 0%, #714b67 100%)', color: '#fff' }}>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight">Edit User Profile</h2>
                                <p style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)' }}>
                                    User: {editingUser.username}
                                </p>
                            </div>
                            <button
                                onClick={closeEditModal}
                                className="p-2 rounded-full transition-colors"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label style={labelStyle}>{t('fullName')}</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="w-full rounded p-3 text-sm font-semibold focus:outline-none focus:ring-2 transition-all"
                                        style={{ backgroundColor: 'var(--odoo-surface-low)', border: 'none', color: 'var(--odoo-text)' }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label style={labelStyle}>{t('username')}</label>
                                    <input
                                        type="text"
                                        value={editUsername}
                                        onChange={e => setEditUsername(e.target.value)}
                                        className="w-full rounded p-3 text-sm font-semibold focus:outline-none focus:ring-2 transition-all"
                                        style={{ backgroundColor: 'var(--odoo-surface-low)', border: 'none', fontFamily: 'monospace', color: 'var(--odoo-text)' }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label style={labelStyle}>Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value="••••••••••••"
                                            readOnly
                                            className="w-full rounded p-3 text-sm font-semibold focus:outline-none focus:ring-2 transition-all"
                                            style={{ backgroundColor: 'var(--odoo-surface-low)', border: 'none', color: 'var(--odoo-text)' }}
                                        />
                                        <button
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                                            style={{ color: 'var(--odoo-text-muted)', backgroundColor: 'transparent', border: 'none' }}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label style={labelStyle}>{t('assignRole')}</label>
                                    <div className="relative">
                                        <select
                                            value={editRole}
                                            onChange={e => setEditRole(e.target.value)}
                                            className="w-full rounded p-3 text-sm font-semibold focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer"
                                            style={{ backgroundColor: 'var(--odoo-surface-low)', border: 'none', color: 'var(--odoo-text)' }}
                                        >
                                            {Object.entries(rolesInfo).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--odoo-text-muted)' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Account Status Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold" style={{ color: 'var(--odoo-text)' }}>Account Status</span>
                                    <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>Allow user to log in and perform actions</p>
                                </div>
                                <div className="w-12 h-6 rounded-full relative flex items-center px-1 cursor-pointer" style={{ backgroundColor: '#4b5d33' }}>
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff', marginLeft: '2px' }}>ON</span>
                                    <div className="w-4 h-4 rounded-full absolute right-1" style={{ backgroundColor: '#fff' }} />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-8 py-6 flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                            <button
                                onClick={() => { handleDeleteUser(editingUser.username); closeEditModal(); }}
                                disabled={editingUser.username === 'admin'}
                                className="text-xs font-bold uppercase tracking-widest px-4 py-2 rounded transition-colors"
                                style={{ color: 'var(--odoo-danger)', backgroundColor: 'transparent', border: 'none', cursor: editingUser.username === 'admin' ? 'not-allowed' : 'pointer', opacity: editingUser.username === 'admin' ? 0.3 : 1 }}
                                onMouseEnter={e => { if (editingUser.username !== 'admin') e.currentTarget.style.backgroundColor = 'rgba(220,53,69,0.05)'; }}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Delete User
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={closeEditModal}
                                    className="text-xs font-bold uppercase tracking-widest px-4 py-2 rounded transition-colors"
                                    style={{ color: 'var(--odoo-text-muted)', backgroundColor: 'transparent', border: 'none' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        handleResetPassword(editingUser.username);
                                        closeEditModal();
                                    }}
                                    className="px-6 py-2 rounded text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95"
                                    style={{ background: 'linear-gradient(135deg, #57344f 0%, #714b67 100%)', color: '#fff' }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
