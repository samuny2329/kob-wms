import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Moon, Sun, Wifi, WifiOff, ChevronDown } from 'lucide-react';

const Sidebar = ({ t, user, userRole, activeTab, setActiveTab, tabInfo, rolesInfo,
    isDarkMode, setIsDarkMode, handleLogout, sidebarOpen, setSidebarOpen, syncStatus,
    activeCompanies, setActiveCompanies, currentSection }) => {

    const allowedTabs = rolesInfo[userRole]?.tabs || [];

    // Group all tabs by section — stable, never changes
    const sectionOrder = ['Operations', 'Inventory', 'Logistics', 'Accounting', 'Analytics', 'System'];
    const grouped = {};
    allowedTabs.forEach(key => {
        const info = tabInfo[key];
        if (!info) return;
        const sec = info.section || 'Other';
        if (!grouped[sec]) grouped[sec] = [];
        grouped[sec].push(key);
    });
    const sections = sectionOrder.filter(s => grouped[s]);

    // Odoo-style collapsible sections
    const [collapsedSections, setCollapsedSections] = useState({});
    const toggleSection = (sec) => {
        setCollapsedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
    };

    // Ref for active indicator animation
    const navRef = useRef(null);
    const activeRef = useRef(null);
    const [indicatorStyle, setIndicatorStyle] = useState({});

    useEffect(() => {
        if (activeRef.current && navRef.current) {
            const navRect = navRef.current.getBoundingClientRect();
            const activeRect = activeRef.current.getBoundingClientRect();
            setIndicatorStyle({
                top: activeRect.top - navRect.top + navRef.current.scrollTop,
                height: activeRect.height,
            });
        }
    }, [activeTab]);

    if (!sidebarOpen) return null;

    return (
        <aside className="w-[240px] h-full flex flex-col shrink-0"
            style={{ backgroundColor: 'var(--odoo-surface-low)' }}>

            {/* ── All tabs grouped by section ── */}
            <nav ref={navRef} className="flex-1 overflow-y-auto py-1 custom-scrollbar relative" style={{ scrollbarWidth: 'thin' }}>
                {/* Animated active indicator bar */}
                <div
                    className="absolute right-0 w-[3px] rounded-l transition-all duration-300 ease-in-out"
                    style={{
                        backgroundColor: 'var(--odoo-purple)',
                        top: indicatorStyle.top || 0,
                        height: indicatorStyle.height || 0,
                        opacity: indicatorStyle.height ? 1 : 0,
                    }}
                />

                {sections.map(section => {
                    const isCollapsed = collapsedSections[section];
                    return (
                        <div key={section} className="mb-0.5">
                            {/* Section header — clickable to collapse */}
                            <button
                                onClick={() => toggleSection(section)}
                                className="w-full flex items-center justify-between px-4 pt-3 pb-1 group"
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: 'var(--odoo-text-muted)', letterSpacing: '0.1em' }}>
                                    {t(`sec${section.replace(/\s+/g, '')}`) || section}
                                </span>
                                <ChevronDown
                                    className="w-3 h-3 transition-transform duration-200 opacity-0 group-hover:opacity-100"
                                    style={{
                                        color: 'var(--odoo-text-muted)',
                                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                    }}
                                />
                            </button>

                            {/* Tab items — animated collapse */}
                            <div
                                className="overflow-hidden transition-all duration-250 ease-in-out"
                                style={{
                                    maxHeight: isCollapsed ? '0px' : `${grouped[section].length * 36}px`,
                                    opacity: isCollapsed ? 0 : 1,
                                }}
                            >
                                {grouped[section].map(key => {
                                    const info = tabInfo[key];
                                    const isActive = activeTab === key;
                                    return (
                                        <button
                                            key={key}
                                            ref={isActive ? activeRef : null}
                                            onClick={() => setActiveTab(key)}
                                            className="w-full flex items-center px-4 py-[7px] gap-2.5 transition-all duration-150"
                                            style={{
                                                backgroundColor: isActive ? 'var(--odoo-surface)' : 'transparent',
                                                color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text-secondary)',
                                                fontWeight: isActive ? 600 : 400,
                                                fontSize: '13px',
                                                borderRadius: '4px',
                                                margin: '0 8px',
                                                width: 'calc(100% - 16px)',
                                                boxShadow: isActive ? 'var(--odoo-shadow-sm)' : 'none',
                                            }}
                                            onMouseEnter={e => {
                                                if (!isActive) {
                                                    e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)';
                                                    e.currentTarget.style.color = 'var(--odoo-text)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!isActive) {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = 'var(--odoo-text-secondary)';
                                                }
                                            }}
                                        >
                                            <span className="[&_svg]:w-[15px] [&_svg]:h-[15px] shrink-0 transition-colors duration-150"
                                                style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>
                                                {info.icon}
                                            </span>
                                            <span className="truncate">{t(`tab${key.charAt(0).toUpperCase() + key.slice(1)}`)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* ── Footer ── */}
            <div className="shrink-0 py-2" style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                {/* Company multi-select */}
                {setActiveCompanies && (
                    <div className="px-3 pb-2 mb-1" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                        {[
                            { key: 'kob', label: 'KOB', color: '#714B67' },
                            { key: 'btv', label: 'BTV', color: '#2563eb' },
                        ].map(co => {
                            const isChecked = (activeCompanies || []).includes(co.key);
                            return (
                                <button key={co.key}
                                    onClick={() => setActiveCompanies(prev => {
                                        const next = prev.includes(co.key) ? prev.filter(c => c !== co.key) : [...prev, co.key];
                                        return next.length === 0 ? [co.key] : next;
                                    })}
                                    className="flex items-center gap-2 py-1 w-full transition-colors duration-150"
                                    style={{ fontSize: '11px' }}>
                                    <span className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all duration-150"
                                        style={{ borderColor: co.color, backgroundColor: isChecked ? co.color : 'transparent' }}>
                                        {isChecked && <span className="text-white text-[8px] font-black">✓</span>}
                                    </span>
                                    <span style={{ color: isChecked ? co.color : '#adb5bd', fontWeight: isChecked ? 600 : 400 }}>{co.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Sync + controls */}
                <div className="px-3 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        {syncStatus?.isOnline
                            ? <Wifi className="w-3 h-3" style={{ color: 'var(--odoo-teal)' }} />
                            : <WifiOff className="w-3 h-3" style={{ color: 'var(--odoo-danger)' }} />}
                        {syncStatus?.lastSyncTime && (
                            <span className="text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>
                                {new Date(syncStatus.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setIsDarkMode(!isDarkMode)}
                            className="p-1 rounded transition-colors hover:bg-white"
                            style={{ color: 'var(--odoo-text-muted)' }} title="Dark Mode">
                            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={handleLogout}
                            className="p-1 rounded transition-colors hover:bg-red-50"
                            style={{ color: 'var(--odoo-text-muted)' }} title={t('signOut') || 'Sign Out'}>
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
