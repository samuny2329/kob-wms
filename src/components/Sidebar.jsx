import React from 'react';
import { LogOut, Moon, Sun, Monitor, ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCw } from 'lucide-react';

// Odoo 18 avatar palette (same as Pick.jsx)
const ODOO_AVATAR_COLORS = [
    '#a2a2a2','#ee2d2d','#dc8534','#e8bb1d','#5794dd',
    '#9f628f','#db8865','#41a9a2','#304be0','#ee2f8a','#61c36e','#9872e6',
];
const avatarColor = (name = '') => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    return ODOO_AVATAR_COLORS[Math.abs(h) % ODOO_AVATAR_COLORS.length];
};

const Sidebar = ({ t, user, userRole, activeTab, setActiveTab, tabInfo, rolesInfo,
    isDarkMode, setIsDarkMode, handleLogout, sidebarOpen, setSidebarOpen, syncStatus }) => {

    const allowedTabs = rolesInfo[userRole]?.tabs || [];

    const sectionOrder = ['Operations', 'Inventory', 'Accounting', 'Analytics', 'Logistics', 'System', 'Help & Support'];
    const grouped = allowedTabs.reduce((acc, key) => {
        const info = tabInfo[key];
        if (!info) return acc;
        const section = info.section || 'Other';
        if (!acc[section]) acc[section] = [];
        acc[section].push(key);
        return acc;
    }, {});
    const sections = sectionOrder.filter(s => grouped[s]);

    const userInitial = (user?.name || 'A')[0].toUpperCase();
    const userAvatar = avatarColor(user?.name || 'Admin');

    return (
        <aside
            className={`${sidebarOpen ? 'w-56' : 'w-12'} h-screen flex flex-col transition-all duration-200 ease-in-out relative z-50 shrink-0`}
            style={{ backgroundColor: '#ffffff', borderRight: '1px solid #dee2e6' }}
        >
            {/* ── Brand / Logo ── */}
            <div
                className="flex items-center shrink-0 px-3 gap-2.5"
                style={{ height: '46px', borderBottom: '1px solid #dee2e6' }}
            >
                <div
                    className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#714B67' }}
                >
                    <Monitor className="w-4 h-4 text-white" />
                </div>
                {sidebarOpen && (
                    <div className="overflow-hidden whitespace-nowrap">
                        <span className="text-sm font-bold" style={{ color: '#714B67' }}>WMS</span>
                        <span className="text-sm font-medium ml-1" style={{ color: '#adb5bd' }}>Pro</span>
                    </div>
                )}
            </div>

            {/* ── Navigation ── */}
            <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
                {sections.map(section => (
                    <div key={section}>
                        {/* Section header */}
                        {sidebarOpen ? (
                            <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: '#adb5bd', letterSpacing: '0.12em' }}>
                                {t(`sec${section.replace(/\s+/g, '')}`) || section}
                            </p>
                        ) : (
                            <div className="mx-2 my-2 h-px" style={{ backgroundColor: '#dee2e6' }} />
                        )}

                        {/* Nav items */}
                        {grouped[section].map(key => {
                            const info = tabInfo[key];
                            const isActive = activeTab === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key)}
                                    title={!sidebarOpen ? t(`tab${key.charAt(0).toUpperCase() + key.slice(1)}`) : undefined}
                                    className={`w-full flex items-center transition-all duration-100 relative ${sidebarOpen ? 'px-3 py-1.5 gap-2.5' : 'justify-center py-2'}`}
                                    style={{
                                        backgroundColor: isActive ? '#f5f0f4' : 'transparent',
                                        color: isActive ? '#714B67' : '#495057',
                                        fontWeight: isActive ? 600 : 400,
                                        fontSize: '13px',
                                        borderLeft: isActive ? '3px solid #714B67' : '3px solid transparent',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isActive) {
                                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                                            e.currentTarget.style.color = '#212529';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isActive) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = '#495057';
                                        }
                                    }}
                                >
                                    <span className="[&_svg]:w-4 [&_svg]:h-4 shrink-0" style={{ color: isActive ? '#714B67' : '#6c757d' }}>
                                        {info.icon}
                                    </span>
                                    {sidebarOpen && (
                                        <span className="truncate">
                                            {t(`tab${key.charAt(0).toUpperCase() + key.slice(1)}`)}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* ── Footer ── */}
            <div className="shrink-0" style={{ borderTop: '1px solid #dee2e6' }}>

                {/* Sync status */}
                {sidebarOpen && syncStatus && (
                    <div className="px-3 py-2 flex items-center gap-1.5">
                        {syncStatus.isSyncing
                            ? <RefreshCw className="w-3 h-3 animate-spin" style={{ color: '#ffac00' }} />
                            : syncStatus.isOnline
                                ? <Wifi className="w-3 h-3" style={{ color: '#28a745' }} />
                                : <WifiOff className="w-3 h-3" style={{ color: '#dc3545' }} />}
                        <span className="text-[11px]" style={{ color: '#6c757d' }}>
                            {syncStatus.isSyncing ? 'Syncing…' : syncStatus.isOnline ? 'Connected' : 'Offline'}
                        </span>
                        {syncStatus.lastSyncTime && (
                            <span className="text-[10px] ml-auto" style={{ color: '#adb5bd' }}>
                                {new Date(syncStatus.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                )}

                {/* User avatar + name */}
                <div className={`flex items-center py-2.5 gap-2.5 ${sidebarOpen ? 'px-3' : 'px-0 justify-center'}`}>
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: userAvatar }}
                    >
                        {userInitial}
                    </div>
                    {sidebarOpen && (
                        <div className="overflow-hidden flex-1">
                            <p className="text-xs font-semibold truncate" style={{ color: '#212529' }}>{user?.name || 'Admin'}</p>
                            <p className="text-[10px] truncate" style={{ color: '#6c757d' }}>{rolesInfo[userRole]?.label || userRole}</p>
                        </div>
                    )}
                </div>

                {/* Dark mode */}
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`flex items-center gap-2 py-2 w-full transition-colors ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
                    style={{ color: '#6c757d', fontSize: '12px' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8f9fa'; e.currentTarget.style.color = '#212529'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6c757d'; }}
                >
                    {isDarkMode ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
                    {sidebarOpen && <span>Dark Mode</span>}
                </button>

                {/* Sign out */}
                <button
                    onClick={handleLogout}
                    className={`flex items-center gap-2 py-2 mb-1 w-full transition-colors ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
                    style={{ color: '#6c757d', fontSize: '12px' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#dc3545'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6c757d'; }}
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {sidebarOpen && <span>{t('signOut') || 'Sign Out'}</span>}
                </button>
            </div>

            {/* ── Collapse toggle ── */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="absolute -right-3 top-[22px] w-6 h-6 flex items-center justify-center rounded-full z-[60] transition-all hover:scale-110"
                style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', color: '#6c757d', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#714B67'; e.currentTarget.style.color = '#714B67'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.color = '#6c757d'; }}
            >
                {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
        </aside>
    );
};

export default Sidebar;
