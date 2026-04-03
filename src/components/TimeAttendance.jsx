import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Clock, LogIn, LogOut, Calendar, Users, UserCheck, UserX, AlertTriangle, ChevronLeft, ChevronRight, Edit3, Check, X, Sun, Moon, Coffee, Briefcase, TrendingUp, BarChart3, Settings, Save } from 'lucide-react';

// ── Shift Templates ──
const SHIFT_TEMPLATES = [
    { id: 'morning', label: 'Morning', start: '08:00', end: '17:00', color: '#f59e0b', icon: 'sun' },
    { id: 'afternoon', label: 'Afternoon', start: '13:00', end: '22:00', color: '#8b5cf6', icon: 'moon' },
    { id: 'full', label: 'Full Day', start: '08:00', end: '20:00', color: '#3b82f6', icon: 'briefcase' },
];

const LEAVE_TYPES = [
    { id: 'annual', label: 'Annual Leave', color: '#10b981' },
    { id: 'sick', label: 'Sick Leave', color: '#ef4444' },
    { id: 'personal', label: 'Personal Leave', color: '#f59e0b' },
    { id: 'holiday', label: 'Public Holiday', color: '#8b5cf6' },
];

const STATUS_CONFIG = {
    present: { label: 'Present', color: '#10b981', bg: '#d1fae5' },
    late: { label: 'Late', color: '#f59e0b', bg: '#fef3c7' },
    absent: { label: 'Absent', color: '#ef4444', bg: '#fee2e2' },
    leave: { label: 'On Leave', color: '#8b5cf6', bg: '#ede9fe' },
    holiday: { label: 'Holiday', color: '#6366f1', bg: '#e0e7ff' },
    dayoff: { label: 'Day Off', color: '#6b7280', bg: '#f3f4f6' },
};

// ── localStorage helpers ──
const LS_ATTENDANCE = 'wms_attendance';
const LS_SHIFTS = 'wms_shifts';
const LS_LEAVES = 'wms_leaves';
const LS_CLOCK = 'wms_clock_status';

const safeParse = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
};

// ── Export helpers for other components ──
export const getClockStatus = (username) => {
    const records = safeParse(LS_CLOCK, {});
    return records[username] || null;
};

export const isClockedIn = (username) => {
    const status = getClockStatus(username);
    return status?.clockedIn === true;
};

// Auto clock-in: call on first login of the day
export const autoClockIn = (username, name) => {
    if (!username) return;
    const today = _localToday();
    const status = getClockStatus(username);
    if (status?.clockedIn && status?.date === today) return; // already clocked in today
    const time = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    // Update clock status
    const allStatus = safeParse(LS_CLOCK, {});
    allStatus[username] = { clockedIn: true, date: today, clockInTime: time, clockInStr: timeStr };
    localStorage.setItem(LS_CLOCK, JSON.stringify(allStatus));
    // Save attendance record
    const attendance = safeParse(LS_ATTENDANCE, []);
    const filtered = attendance.filter(a => !(a.username === username && a.date === today));
    const [sh, sm] = '08:00'.split(':').map(Number);
    const shiftStart = new Date(); shiftStart.setHours(sh, sm, 0, 0);
    const isLate = new Date() > shiftStart;
    const lateMinutes = isLate ? Math.round((Date.now() - shiftStart.getTime()) / 60000) : 0;
    filtered.unshift({ username, name: name || username, date: today, clockIn: time, clockInStr: timeStr, clockOut: null, status: isLate ? 'late' : 'present', lateMinutes, hoursWorked: 0, shift: 'morning' });
    localStorage.setItem(LS_ATTENDANCE, JSON.stringify(filtered));
};

// Auto clock-out: call on end-of-day actions
export const autoClockOut = (username) => {
    if (!username) return;
    const today = _localToday();
    const status = getClockStatus(username);
    if (!status?.clockedIn || status?.date !== today) return; // not clocked in
    const time = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    // Update clock status
    const allStatus = safeParse(LS_CLOCK, {});
    allStatus[username] = { ...allStatus[username], clockedIn: false, clockOutTime: time, clockOutStr: timeStr };
    localStorage.setItem(LS_CLOCK, JSON.stringify(allStatus));
    // Update attendance record
    const attendance = safeParse(LS_ATTENDANCE, []);
    const updated = attendance.map(a => {
        if (a.username === username && a.date === today && !a.clockOut) {
            const clockIn = new Date(a.clockIn);
            const hoursWorked = Math.round((Date.now() - clockIn.getTime()) / 3600000 * 10) / 10;
            return { ...a, clockOut: time, clockOutStr: timeStr, hoursWorked };
        }
        return a;
    });
    localStorage.setItem(LS_ATTENDANCE, JSON.stringify(updated));
};

const _localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const getTodayAttendance = () => {
    const today = _localToday();
    const attendance = safeParse(LS_ATTENDANCE, []);
    return attendance.filter(a => a.date === today);
};

export const getActivePickers = (users) => {
    const today = _localToday();
    const leaves = safeParse(LS_LEAVES, []);
    const clockStatus = safeParse(LS_CLOCK, {});
    const pickers = users.filter(u => u.role === 'picker');

    return pickers.filter(p => {
        // Check if on leave or holiday
        const hasLeave = leaves.find(l => l.username === p.username && l.date === today);
        if (hasLeave) return false;
        // Check if clocked in (if clock data exists)
        const clock = clockStatus[p.username];
        if (clock && clock.clockedIn === false && clock.date === today) return false;
        return true;
    });
};

const TimeAttendance = ({ users = [], user, userRole: userRoleProp, addToast }) => {
    const userRole = userRoleProp || user?.role || 'picker';
    // ── State ──
    const [tab, setTab] = useState('attendance'); // attendance | schedule | stats
    const [viewDate, setViewDate] = useState(() => _localToday());
    const [viewMonth, setViewMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const calendarScrollRef = useRef(null);
    const [editingShift, setEditingShift] = useState(null);
    const [editingLeave, setEditingLeave] = useState(null);
    const [customShift, setCustomShift] = useState({ label: '', start: '08:00', end: '17:00' });
    const [customTemplates, setCustomTemplates] = useState(() => safeParse('wms_shift_templates', []));
    const [editingTemplate, setEditingTemplate] = useState(null); // null | 'new' | index

    const [attendance, setAttendance] = useState(() => safeParse(LS_ATTENDANCE, []));
    const [shifts, setShifts] = useState(() => safeParse(LS_SHIFTS, {}));
    const [leaves, setLeaves] = useState(() => safeParse(LS_LEAVES, []));
    const [clockStatus, setClockStatus] = useState(() => safeParse(LS_CLOCK, {}));

    const isAdmin = userRole === 'admin';
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Persist
    useEffect(() => { localStorage.setItem(LS_ATTENDANCE, JSON.stringify(attendance)); }, [attendance]);
    useEffect(() => { localStorage.setItem(LS_SHIFTS, JSON.stringify(shifts)); }, [shifts]);
    useEffect(() => { localStorage.setItem(LS_LEAVES, JSON.stringify(leaves)); }, [leaves]);
    useEffect(() => { localStorage.setItem(LS_CLOCK, JSON.stringify(clockStatus)); }, [clockStatus]);
    useEffect(() => { localStorage.setItem('wms_shift_templates', JSON.stringify(customTemplates)); }, [customTemplates]);

    // Auto-scroll calendar to today column
    useEffect(() => {
        if (tab === 'attendance' && calendarScrollRef.current) {
            const todayTh = calendarScrollRef.current.querySelector('[data-today="true"]');
            if (todayTh) {
                todayTh.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [tab, viewMonth]);

    // Merge built-in + custom templates
    const allShiftTemplates = useMemo(() => [...SHIFT_TEMPLATES, ...customTemplates], [customTemplates]);

    // ── Clock In/Out ──
    const myClockStatus = clockStatus[user?.username];
    const amIClockedIn = myClockStatus?.clockedIn === true && myClockStatus?.date === today;

    const handleClockIn = useCallback(() => {
        const time = new Date().toISOString();
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        setClockStatus(prev => ({
            ...prev,
            [user.username]: { clockedIn: true, date: today, clockInTime: time, clockInStr: timeStr }
        }));

        // Check if late (default shift starts at 08:00)
        const myShift = shifts[user.username] || SHIFT_TEMPLATES[0];
        const [sh, sm] = (myShift.start || '08:00').split(':').map(Number);
        const shiftStart = new Date(); shiftStart.setHours(sh, sm, 0, 0);
        const isLate = now > shiftStart;
        const lateMinutes = isLate ? Math.round((now - shiftStart) / 60000) : 0;

        // Save attendance record
        setAttendance(prev => {
            const filtered = prev.filter(a => !(a.username === user.username && a.date === today));
            return [{
                username: user.username,
                name: user.name,
                date: today,
                clockIn: time,
                clockInStr: timeStr,
                clockOut: null,
                status: isLate ? 'late' : 'present',
                lateMinutes,
                hoursWorked: 0,
                shift: myShift.id || 'morning',
            }, ...filtered];
        });

        addToast?.(`Clocked In at ${timeStr}${isLate ? ` (${lateMinutes}m late)` : ''}`, isLate ? 'error' : 'success');
    }, [user, today, shifts, now, addToast]);

    const handleClockOut = useCallback(() => {
        const time = new Date().toISOString();
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        setClockStatus(prev => ({
            ...prev,
            [user.username]: { ...prev[user.username], clockedIn: false, clockOutTime: time, clockOutStr: timeStr }
        }));

        setAttendance(prev => prev.map(a => {
            if (a.username === user.username && a.date === today && !a.clockOut) {
                const clockIn = new Date(a.clockIn);
                const hoursWorked = Math.round(((new Date(time)) - clockIn) / 3600000 * 10) / 10;
                return { ...a, clockOut: time, clockOutStr: timeStr, hoursWorked };
            }
            return a;
        }));

        addToast?.(`Clocked Out at ${timeStr}`, 'success');
    }, [user, today, addToast]);

    // ── Assign shift ──
    const assignShift = (username, shiftId) => {
        const template = allShiftTemplates.find(s => s.id === shiftId) || SHIFT_TEMPLATES[0];
        setShifts(prev => ({ ...prev, [username]: { ...template } }));
        setEditingShift(null);
        addToast?.(`Shift updated: ${username} → ${template.label}`);
    };

    // ── Add/Remove leave ──
    const addLeave = (username, date, type) => {
        setLeaves(prev => {
            const filtered = prev.filter(l => !(l.username === username && l.date === date));
            return [...filtered, { username, date, type, createdBy: user.username }];
        });
        setEditingLeave(null);
        addToast?.(`Leave added for ${username} on ${date}`);
    };

    const removeLeave = (username, date) => {
        setLeaves(prev => prev.filter(l => !(l.username === username && l.date === date)));
        addToast?.('Leave removed');
    };

    // ── Get status for a user on a date ──
    const getUserStatus = useCallback((username, date) => {
        const leaveRecord = leaves.find(l => l.username === username && l.date === date);
        if (leaveRecord) {
            if (leaveRecord.type === 'holiday') return 'holiday';
            return 'leave';
        }
        const att = attendance.find(a => a.username === username && a.date === date);
        if (att) return att.status;
        // If date is past and no record → absent (only for weekdays)
        const d = new Date(date);
        const dayOfWeek = d.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return 'dayoff'; // weekend
        if (date < today) return 'absent';
        return null; // future
    }, [leaves, attendance, today]);

    // ── Month calendar data ──
    const calendarData = useMemo(() => {
        const [year, month] = viewMonth.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const days = [];

        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, month - 1, d).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            const dayData = { date, day: d, dayOfWeek, isWeekend, isToday: date === today, users: {} };

            users.forEach(u => {
                const status = getUserStatus(u.username, date);
                const att = attendance.find(a => a.username === u.username && a.date === date);
                dayData.users[u.username] = {
                    status,
                    clockIn: att?.clockInStr || null,
                    clockOut: att?.clockOutStr || null,
                    hoursWorked: att?.hoursWorked || 0,
                    lateMinutes: att?.lateMinutes || 0,
                };
            });

            days.push(dayData);
        }
        return { year, month, days, firstDay, lastDay };
    }, [viewMonth, users, attendance, leaves, today, getUserStatus]);

    // ── Stats ──
    const monthStats = useMemo(() => {
        const stats = {};
        users.forEach(u => {
            const s = { present: 0, late: 0, absent: 0, leave: 0, holiday: 0, dayoff: 0, totalHours: 0, totalLateMin: 0, workDays: 0 };
            calendarData.days.forEach(day => {
                if (day.date > today) return; // skip future
                const userDay = day.users[u.username];
                if (!userDay?.status) return;
                s[userDay.status] = (s[userDay.status] || 0) + 1;
                if (userDay.status === 'present' || userDay.status === 'late') {
                    s.workDays++;
                    s.totalHours += userDay.hoursWorked;
                    s.totalLateMin += userDay.lateMinutes;
                }
            });
            const workableDays = calendarData.days.filter(d => !d.isWeekend && d.date <= today).length;
            s.attendanceRate = workableDays > 0 ? Math.round(((s.present + s.late) / workableDays) * 100) : 100;
            s.avgHours = s.workDays > 0 ? Math.round(s.totalHours / s.workDays * 10) / 10 : 0;
            s.onTimeRate = (s.present + s.late) > 0 ? Math.round((s.present / (s.present + s.late)) * 100) : 100;
            stats[u.username] = s;
        });
        return stats;
    }, [calendarData, users, today]);

    // ── Navigation helpers ──
    const changeMonth = (delta) => {
        const [y, m] = viewMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const monthLabel = (() => {
        const [y, m] = viewMonth.split('-').map(Number);
        return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    })();

    const ShiftIcon = ({ id }) => {
        if (id === 'morning' || id === 'sun') return <Sun className="w-3.5 h-3.5" />;
        if (id === 'afternoon' || id === 'moon') return <Moon className="w-3.5 h-3.5" />;
        return <Briefcase className="w-3.5 h-3.5" />;
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-6 h-6 text-purple-600" />
                        Time & Attendance
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Clock in/out, shifts, and attendance tracking</p>
                </div>

                {/* Clock status (auto clock-in on login, auto clock-out on end-of-day) */}
                <div className="flex items-center gap-3">
                    {amIClockedIn ? (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Clocked In ({myClockStatus?.clockInStr}) — auto
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-sm text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            Not clocked in (auto on login)
                        </span>
                    )}
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {[
                    { id: 'attendance', label: 'Attendance', icon: <UserCheck className="w-4 h-4" /> },
                    { id: 'schedule', label: 'Shift Schedule', icon: <Calendar className="w-4 h-4" /> },
                    { id: 'stats', label: 'Statistics', icon: <BarChart3 className="w-4 h-4" /> },
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── Attendance Tab ── */}
            {tab === 'attendance' && (
                <div className="space-y-4">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between">
                        <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ChevronLeft className="w-5 h-5 text-gray-500" />
                        </button>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{monthLabel}</h3>
                        <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Today's status */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Today's Status</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {users.map(u => {
                                const status = getUserStatus(u.username, today);
                                const att = attendance.find(a => a.username === u.username && a.date === today);
                                const cfg = STATUS_CONFIG[status] || { label: 'Not In', color: '#9ca3af', bg: '#f9fafb' };
                                const clock = clockStatus[u.username];
                                const isIn = clock?.clockedIn === true && clock?.date === today;

                                return (
                                    <div key={u.username} className="rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white`}
                                                style={{ background: cfg.color }}>
                                                {u.name?.charAt(0) || '?'}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{u.name}</p>
                                                <p className="text-[10px] text-gray-400">{u.role}</p>
                                            </div>
                                            {isIn && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                                                {cfg.label}
                                            </span>
                                            {att?.clockInStr && (
                                                <span className="text-[10px] text-gray-400">
                                                    {att.clockInStr}{att.clockOutStr ? ` — ${att.clockOutStr}` : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Monthly calendar grid */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto" ref={calendarScrollRef}>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700">
                                        <th className="text-left px-3 py-2 sticky left-0 bg-gray-50 dark:bg-gray-700 z-10 min-w-[120px] text-gray-700 dark:text-gray-300 font-bold">Employee</th>
                                        {calendarData.days.map(d => (
                                            <th key={d.date} data-today={d.isToday || undefined}
                                                className={`text-center px-1 py-2 min-w-[32px] relative ${d.isWeekend && !d.isToday ? 'bg-gray-100 dark:bg-gray-600' : ''}`}
                                                style={d.isToday ? { background: '#3b82f6', borderRadius: '6px 6px 0 0' } : undefined}>
                                                <div className={`text-[10px] font-semibold ${d.isToday ? 'text-blue-100' : d.isWeekend ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>{['Su','Mo','Tu','We','Th','Fr','Sa'][d.dayOfWeek]}</div>
                                                <div className={`font-black text-sm ${d.isToday ? 'text-white' : d.isWeekend ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-200'}`}>{d.day}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.username} className="border-t border-gray-100 dark:border-gray-700">
                                            <td className="px-3 py-1.5 sticky left-0 bg-white dark:bg-gray-800 z-10">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: 'var(--odoo-purple)' }}>
                                                        {u.name?.charAt(0)}
                                                    </span>
                                                    <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{u.name}</span>
                                                </div>
                                            </td>
                                            {calendarData.days.map(d => {
                                                const userDay = d.users[u.username];
                                                const status = userDay?.status;
                                                const cfg = STATUS_CONFIG[status];

                                                return (
                                                    <td key={d.date}
                                                        className={`text-center px-0.5 py-1.5 ${d.isWeekend && !d.isToday ? 'bg-gray-50 dark:bg-gray-700/30' : ''}`}
                                                        style={d.isToday ? { background: '#dbeafe', borderLeft: '2px solid #3b82f6', borderRight: '2px solid #3b82f6' } : undefined}
                                                        title={`${u.name} — ${d.date}: ${cfg?.label || '—'}${userDay?.clockIn ? ` (${userDay.clockIn})` : ''}`}
                                                    >
                                                        {cfg ? (
                                                            <span className="inline-block w-5 h-5 rounded-full text-[8px] font-bold leading-5"
                                                                style={{ background: cfg.bg, color: cfg.color }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (isAdmin && d.date >= today) {
                                                                        setEditingLeave({ username: u.username, date: d.date, current: status });
                                                                    }
                                                                }}
                                                            >
                                                                {status === 'present' ? '✓' : status === 'late' ? 'L' : status === 'absent' ? '✗' : status === 'leave' ? '◎' : status === 'holiday' ? 'H' : '—'}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-300 text-[8px] leading-5 cursor-pointer"
                                                                onClick={() => {
                                                                    if (isAdmin) setEditingLeave({ username: u.username, date: d.date, current: null });
                                                                }}
                                                            >·</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                <span key={key} className="flex items-center gap-1 text-[10px]">
                                    <span className="w-3 h-3 rounded-full" style={{ background: cfg.bg, border: `1px solid ${cfg.color}` }} />
                                    <span className="text-gray-500">{cfg.label}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Schedule Tab ── */}
            {tab === 'schedule' && (
                <div className="space-y-4">
                    {/* Shift templates */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-gray-500 uppercase">Shift Templates</h4>
                            {editingTemplate === null && (
                                <button onClick={() => { setEditingTemplate('new'); setCustomShift({ label: '', start: '08:00', end: '17:00' }); }}
                                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium">
                                    + Add Shift
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {allShiftTemplates.map((s, idx) => {
                                const isCustom = idx >= SHIFT_TEMPLATES.length;
                                const customIdx = idx - SHIFT_TEMPLATES.length;
                                return (
                                    <div key={s.id} className="rounded-lg p-3 border-2 transition-colors group relative"
                                        style={{ borderColor: s.color + '40', background: s.color + '10' }}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <ShiftIcon id={s.icon || s.id} />
                                            <span className="font-bold text-sm text-gray-900 dark:text-white">{s.label}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">{s.start} — {s.end}</p>
                                        {isCustom && (
                                            <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                                                <button onClick={() => { setEditingTemplate(customIdx); setCustomShift({ ...s }); }}
                                                    className="p-1 rounded bg-white/80 hover:bg-white shadow-sm">
                                                    <Edit3 className="w-3 h-3 text-gray-500" />
                                                </button>
                                                <button onClick={() => setCustomTemplates(prev => prev.filter((_, i) => i !== customIdx))}
                                                    className="p-1 rounded bg-white/80 hover:bg-white shadow-sm">
                                                    <X className="w-3 h-3 text-red-500" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add/Edit custom shift form */}
                        {editingTemplate !== null && (
                            <div className="mt-3 p-3 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 dark:bg-purple-900/10">
                                <div className="grid grid-cols-4 gap-2 items-end">
                                    <div>
                                        <label className="text-[10px] font-medium text-gray-500 uppercase">Name</label>
                                        <input type="text" value={customShift.label} onChange={e => setCustomShift(p => ({ ...p, label: e.target.value }))}
                                            placeholder="e.g. Night"
                                            className="w-full px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-gray-500 uppercase">Start</label>
                                        <input type="time" value={customShift.start} onChange={e => setCustomShift(p => ({ ...p, start: e.target.value }))}
                                            className="w-full px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-gray-500 uppercase">End</label>
                                        <input type="time" value={customShift.end} onChange={e => setCustomShift(p => ({ ...p, end: e.target.value }))}
                                            className="w-full px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none" />
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => {
                                            if (!customShift.label.trim()) return addToast?.('Please enter shift name', 'error');
                                            const shiftData = {
                                                id: editingTemplate === 'new' ? `custom-${Date.now()}` : customTemplates[editingTemplate]?.id || `custom-${Date.now()}`,
                                                label: customShift.label.trim(),
                                                start: customShift.start,
                                                end: customShift.end,
                                                color: '#714B67',
                                                icon: 'briefcase',
                                            };
                                            if (editingTemplate === 'new') {
                                                setCustomTemplates(prev => [...prev, shiftData]);
                                            } else {
                                                setCustomTemplates(prev => prev.map((s, i) => i === editingTemplate ? shiftData : s));
                                            }
                                            setEditingTemplate(null);
                                            addToast?.(`Shift "${shiftData.label}" ${editingTemplate === 'new' ? 'created' : 'updated'}`);
                                        }}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700">
                                            <Save className="w-3 h-3" /> Save
                                        </button>
                                        <button onClick={() => setEditingTemplate(null)}
                                            className="p-1.5 rounded-lg hover:bg-gray-200">
                                            <X className="w-3.5 h-3.5 text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Assign shifts to workers */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Worker Shifts</h4>
                        <div className="space-y-2">
                            {users.map(u => {
                                const currentShift = shifts[u.username] || SHIFT_TEMPLATES[0];
                                const isEditing = editingShift === u.username;

                                return (
                                    <div key={u.username} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-white">
                                                {u.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{u.name}</p>
                                                <p className="text-xs text-gray-400">{u.role}</p>
                                            </div>
                                        </div>

                                        {isEditing ? (
                                            <div className="flex flex-wrap gap-1">
                                                {allShiftTemplates.map(s => (
                                                    <button key={s.id} onClick={() => assignShift(u.username, s.id)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-medium border-2 hover:opacity-80"
                                                        style={{ borderColor: s.color, color: s.color, background: s.color + '10' }}>
                                                        {s.label}
                                                    </button>
                                                ))}
                                                <button onClick={() => setEditingShift(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                                    <X className="w-3.5 h-3.5 text-gray-400" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                                                    style={{ background: currentShift.color + '15', color: currentShift.color }}>
                                                    <ShiftIcon id={currentShift.icon || currentShift.id} />
                                                    {currentShift.label} ({currentShift.start}—{currentShift.end})
                                                </span>
                                                {isAdmin && (
                                                    <button onClick={() => setEditingShift(u.username)}
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                                        <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Leave management */}
                    {isAdmin && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Leave & Holidays</h4>
                            <div className="space-y-2">
                                {leaves.filter(l => l.date >= today).sort((a, b) => a.date.localeCompare(b.date)).map((l, i) => {
                                    const leaveType = LEAVE_TYPES.find(t => t.id === l.type) || LEAVE_TYPES[0];
                                    const u = users.find(u => u.username === l.username);
                                    return (
                                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-gray-500">{l.date}</span>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{u?.name || l.username}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: leaveType.color + '20', color: leaveType.color }}>
                                                    {leaveType.label}
                                                </span>
                                            </div>
                                            <button onClick={() => removeLeave(l.username, l.date)}
                                                className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                                {leaves.filter(l => l.date >= today).length === 0 && (
                                    <p className="text-sm text-gray-400 text-center py-4">No upcoming leaves scheduled</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Stats Tab ── */}
            {tab === 'stats' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ChevronLeft className="w-5 h-5 text-gray-500" />
                        </button>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{monthLabel}</h3>
                        <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Stats table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr className="text-xs text-gray-500 uppercase">
                                    <th className="text-left px-4 py-3">Employee</th>
                                    <th className="text-center px-3 py-3">Attendance</th>
                                    <th className="text-center px-3 py-3">Present</th>
                                    <th className="text-center px-3 py-3">Late</th>
                                    <th className="text-center px-3 py-3">Absent</th>
                                    <th className="text-center px-3 py-3">Leave</th>
                                    <th className="text-center px-3 py-3">On-Time %</th>
                                    <th className="text-center px-3 py-3">Avg Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => {
                                    const s = monthStats[u.username] || {};
                                    return (
                                        <tr key={u.username} className="border-t border-gray-100 dark:border-gray-700">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-white">
                                                        {u.name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                                                        <p className="text-[10px] text-gray-400">{u.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-center px-3 py-3">
                                                <span className={`text-sm font-bold ${(s.attendanceRate || 0) >= 95 ? 'text-green-600' : (s.attendanceRate || 0) >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {s.attendanceRate || 0}%
                                                </span>
                                            </td>
                                            <td className="text-center px-3 py-3 text-green-600 font-medium">{s.present || 0}</td>
                                            <td className="text-center px-3 py-3 text-yellow-600 font-medium">{s.late || 0}</td>
                                            <td className="text-center px-3 py-3 text-red-600 font-medium">{s.absent || 0}</td>
                                            <td className="text-center px-3 py-3 text-purple-600 font-medium">{s.leave || 0}</td>
                                            <td className="text-center px-3 py-3">
                                                <span className={`font-medium ${(s.onTimeRate || 0) >= 95 ? 'text-green-600' : 'text-yellow-600'}`}>
                                                    {s.onTimeRate || 0}%
                                                </span>
                                            </td>
                                            <td className="text-center px-3 py-3 text-gray-700 dark:text-gray-300 font-medium">{s.avgHours || 0}h</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Leave Edit Modal ── */}
            {editingLeave && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingLeave(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                            {editingLeave.current ? 'Update Status' : 'Set Leave'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {users.find(u => u.username === editingLeave.username)?.name} — {editingLeave.date}
                        </p>

                        <div className="space-y-2">
                            {LEAVE_TYPES.map(lt => (
                                <button key={lt.id} onClick={() => addLeave(editingLeave.username, editingLeave.date, lt.id)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <span className="w-3 h-3 rounded-full" style={{ background: lt.color }} />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{lt.label}</span>
                                </button>
                            ))}
                            {editingLeave.current && (
                                <button onClick={() => { removeLeave(editingLeave.username, editingLeave.date); setEditingLeave(null); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                                    <X className="w-3 h-3" />
                                    <span className="text-sm font-medium">Remove Status</span>
                                </button>
                            )}
                        </div>

                        <button onClick={() => setEditingLeave(null)}
                            className="w-full mt-3 p-2 text-sm text-gray-500 hover:text-gray-700 text-center">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeAttendance;
