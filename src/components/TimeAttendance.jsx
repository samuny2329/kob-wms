import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Clock, LogIn, LogOut, Calendar, Users, UserCheck, UserX, AlertTriangle, ChevronLeft, ChevronRight, Edit3, Check, X, Sun, Moon, Coffee, Briefcase, TrendingUp, BarChart3, Settings, Save, Shield, Download, ChevronDown } from 'lucide-react';

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

// ── Live clock hook ──
const useLiveClock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);
    return time;
};

// ── Reusable style objects ──
const cardStyle = {
    background: 'var(--odoo-surface)',
    borderRadius: '8px',
    border: '1px solid var(--odoo-border-ghost)',
    boxShadow: 'var(--odoo-shadow-sm)',
};

const labelStyle = {
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 700,
    color: 'var(--odoo-text-muted)',
    marginBottom: '4px',
};

const smallLabelStyle = {
    fontSize: '0.625rem',
    textTransform: 'uppercase',
    fontWeight: 700,
    color: 'var(--odoo-text-muted)',
    marginBottom: '4px',
};

const thStyle = {
    padding: '12px 24px',
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 700,
    color: 'var(--odoo-text-muted)',
};

const tdStyle = {
    padding: '16px 24px',
    fontSize: '0.875rem',
};

const TimeAttendance = ({ users = [], user, userRole: userRoleProp, addToast }) => {
    const userRole = userRoleProp || user?.role || 'picker';
    const liveTime = useLiveClock();

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
    const [showAllTeam, setShowAllTeam] = useState(false);

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
        // If date is past and no record -> absent (only for weekdays)
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

    // ── My stats for monthly summary ──
    const myStats = useMemo(() => {
        if (!user?.username || !monthStats[user.username]) {
            // Aggregate all users
            const agg = { present: 0, late: 0, absent: 0, leave: 0, totalHours: 0, workDays: 0, attendanceRate: 0, overtimeHours: 0 };
            const workableDays = calendarData.days.filter(d => !d.isWeekend && d.date <= today).length;
            users.forEach(u => {
                const s = monthStats[u.username];
                if (s) {
                    agg.present += s.present;
                    agg.late += s.late;
                    agg.totalHours += s.totalHours;
                    agg.workDays += s.workDays;
                }
            });
            agg.attendanceRate = workableDays > 0 && users.length > 0
                ? Math.round(((agg.present + agg.late) / (workableDays * users.length)) * 1000) / 10
                : 100;
            // Overtime = hours beyond 8h/day
            agg.overtimeHours = Math.max(0, Math.round((agg.totalHours - agg.workDays * 8) * 10) / 10);
            return { ...agg, daysPresent: agg.present + agg.late, totalDays: workableDays || 20 };
        }
        const s = monthStats[user.username];
        const workableDays = calendarData.days.filter(d => !d.isWeekend && d.date <= today).length;
        const overtimeHours = Math.max(0, Math.round((s.totalHours - s.workDays * 8) * 10) / 10);
        return {
            ...s,
            daysPresent: s.present + s.late,
            totalDays: workableDays || 20,
            overtimeHours,
        };
    }, [monthStats, user, users, calendarData, today]);

    // ── This week's attendance for current user ──
    const weekAttendance = useMemo(() => {
        const todayDate = new Date();
        const dayOfWeek = todayDate.getDay();
        const startOfWeek = new Date(todayDate);
        startOfWeek.setDate(todayDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const att = attendance.find(a => a.username === (user?.username) && a.date === dateStr);
            const status = getUserStatus(user?.username, dateStr);
            const isToday = dateStr === today;
            days.push({ date: dateStr, dateObj: d, att, status, isToday });
        }
        return days.filter(d => d.date <= today && d.dateObj.getDay() !== 0 && d.dateObj.getDay() !== 6);
    }, [attendance, user, today, getUserStatus]);

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

    // ── Computed values for the status strip ──
    const myTodayAtt = attendance.find(a => a.username === user?.username && a.date === today);
    const currentHoursWorked = useMemo(() => {
        if (!myTodayAtt?.clockIn) return 0;
        if (myTodayAtt.clockOut) return myTodayAtt.hoursWorked;
        return Math.round((Date.now() - new Date(myTodayAtt.clockIn).getTime()) / 3600000 * 10) / 10;
    }, [myTodayAtt, liveTime]);

    const formatTo12h = (str24) => {
        if (!str24) return '--:-- --';
        const [h, m] = str24.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
    };

    const clockInDisplayTime = myClockStatus?.clockInStr ? formatTo12h(myClockStatus.clockInStr) : '--:-- --';
    const clockOutDisplayTime = myClockStatus?.clockOutStr ? formatTo12h(myClockStatus.clockOutStr) : '--:-- --';

    const myShift = shifts[user?.username] || SHIFT_TEMPLATES[0];
    const shiftLocation = 'Warehouse Sector A';

    // Format live clock
    const formattedTime = liveTime.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    // Shift total hours helper
    const getShiftTotalHours = (shift) => {
        const [startH, startM] = (shift.start || '08:00').split(':').map(Number);
        const [endH, endM] = (shift.end || '17:00').split(':').map(Number);
        return (endH + endM / 60) - (startH + startM / 60);
    };

    // ── Team live status (for admin panel) ──
    const teamLiveStatus = useMemo(() => {
        return users.map(u => {
            const clock = clockStatus[u.username];
            const isOnDuty = clock?.clockedIn === true && clock?.date === today;
            const isOffDuty = clock?.clockedIn === false && clock?.date === today;
            let statusLabel = 'Not In';
            let statusColor = 'var(--odoo-text-muted)';
            let detail = '';

            if (isOnDuty) {
                statusLabel = 'On Duty';
                statusColor = 'var(--odoo-success)';
                detail = clock.clockInStr ? `In at ${formatTo12h(clock.clockInStr)}` : '';
            } else if (isOffDuty) {
                statusLabel = 'Off Duty';
                statusColor = 'var(--odoo-text-muted)';
                detail = clock.clockOutStr ? `Left at ${formatTo12h(clock.clockOutStr)}` : '';
            }

            return { ...u, isOnDuty, isOffDuty, statusLabel, statusColor, detail };
        });
    }, [users, clockStatus, today]);

    const visibleTeam = showAllTeam ? teamLiveStatus : teamLiveStatus.slice(0, 3);

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* ── Today's Status Strip ── */}
            <section style={{
                ...cardStyle,
                padding: '20px 24px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div>
                        <p style={labelStyle}>Clock In Time</p>
                        <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--odoo-text)' }}>
                            {clockInDisplayTime}
                        </p>
                    </div>
                    <div style={{ height: '40px', width: '1px', background: 'var(--odoo-border-ghost)' }} />
                    <div>
                        <p style={labelStyle}>Clock Out Time</p>
                        <p style={{ fontSize: '1.125rem', fontWeight: 600, color: amIClockedIn ? 'var(--odoo-text-muted)' : 'var(--odoo-text)' }}>
                            {amIClockedIn ? '--:-- --' : clockOutDisplayTime}
                        </p>
                    </div>
                    <div style={{ height: '40px', width: '1px', background: 'var(--odoo-border-ghost)' }} />
                    <div>
                        <p style={labelStyle}>Total Hours</p>
                        <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--odoo-purple)' }}>
                            {currentHoursWorked}h
                        </p>
                    </div>
                </div>
                <div>
                    {amIClockedIn ? (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '6px 14px',
                            background: 'rgba(1, 126, 132, 0.1)',
                            color: 'var(--odoo-success)',
                            borderRadius: '9999px',
                            fontSize: '0.75rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--odoo-success)' }} />
                            On Duty
                        </span>
                    ) : (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '6px 14px',
                            background: 'var(--odoo-surface-low)',
                            color: 'var(--odoo-text-muted)',
                            borderRadius: '9999px',
                            fontSize: '0.75rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--odoo-text-muted)' }} />
                            Off Duty
                        </span>
                    )}
                </div>
            </section>

            {/* ── Main Grid: Left (Clock + Table) | Right (Summary + Team) ── */}
            <div className="grid grid-cols-12 gap-6">
                {/* ── Left Column ── */}
                <div className="col-span-12 lg:col-span-8" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Clock In/Out Control */}
                    <div style={{
                        ...cardStyle,
                        padding: '48px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                    }}>
                        <p style={{ color: 'var(--odoo-text-muted)', fontWeight: 500, marginBottom: '8px', fontSize: '0.875rem' }}>
                            Current System Time
                        </p>
                        <h1 style={{
                            fontSize: '3rem', fontWeight: 900,
                            color: 'var(--odoo-text)',
                            letterSpacing: '-0.04em',
                            marginBottom: '32px', lineHeight: 1.1,
                        }}>
                            {formattedTime}
                        </h1>

                        {/* Main Action Button */}
                        {amIClockedIn ? (
                            <button
                                onClick={handleClockOut}
                                style={{
                                    padding: '20px 48px',
                                    background: 'linear-gradient(135deg, var(--odoo-success), #2bb6bd)',
                                    color: '#ffffff',
                                    borderRadius: '12px',
                                    border: 'none',
                                    boxShadow: '0 8px 24px rgba(1, 126, 132, 0.2)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                }}
                            >
                                <LogOut className="w-7 h-7" />
                                <span style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Clock Out</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleClockIn}
                                style={{
                                    padding: '20px 48px',
                                    background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
                                    color: '#ffffff',
                                    borderRadius: '12px',
                                    border: 'none',
                                    boxShadow: '0 8px 24px rgba(113, 75, 103, 0.2)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                }}
                            >
                                <LogIn className="w-7 h-7" />
                                <span style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Clock In</span>
                            </button>
                        )}

                        <p style={{ marginTop: '24px', fontSize: '0.875rem', color: 'var(--odoo-text-muted)' }}>
                            {amIClockedIn
                                ? `Working since ${clockInDisplayTime} (${shiftLocation})`
                                : 'Not clocked in yet'
                            }
                        </p>
                    </div>

                    {/* ── Tab bar ── */}
                    <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--odoo-surface-low)', borderRadius: '10px' }}>
                        {[
                            { id: 'attendance', label: 'This Week', icon: <UserCheck className="w-4 h-4" /> },
                            { id: 'schedule', label: 'Shift Schedule', icon: <Calendar className="w-4 h-4" /> },
                            { id: 'stats', label: 'Statistics', icon: <BarChart3 className="w-4 h-4" /> },
                        ].map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '6px', padding: '8px 12px',
                                    fontSize: '0.875rem', fontWeight: 500,
                                    borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    background: tab === t.id ? 'var(--odoo-surface)' : 'transparent',
                                    color: tab === t.id ? 'var(--odoo-text)' : 'var(--odoo-text-muted)',
                                    boxShadow: tab === t.id ? 'var(--odoo-shadow-sm)' : 'none',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* ── This Week's Attendance Tab ── */}
                    {tab === 'attendance' && (
                        <div style={{ ...cardStyle, overflow: 'hidden' }}>
                            <div style={{
                                padding: '20px 24px',
                                borderBottom: '1px solid var(--odoo-surface-low)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                    This Week's Attendance
                                </h3>
                                <button
                                    style={{
                                        color: 'var(--odoo-purple)', fontSize: '0.875rem', fontWeight: 600,
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                    }}
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Download Report
                                </button>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--odoo-surface-low)' }}>
                                            {['Date', 'Clock In', 'Clock Out', 'Hours Worked', 'Status', 'Overtime'].map(col => (
                                                <th key={col} style={thStyle}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weekAttendance.map((day) => {
                                            const att = day.att;
                                            const isToday = day.isToday;
                                            const hoursWorked = isToday && !att?.clockOut
                                                ? currentHoursWorked
                                                : (att?.hoursWorked || 0);
                                            const overtime = hoursWorked > 8 ? Math.round((hoursWorked - 8) * 10) / 10 : 0;
                                            const statusCfg = STATUS_CONFIG[day.status] || {};
                                            const dateObj = day.dateObj;

                                            return (
                                                <tr key={day.date} style={{ borderTop: '1px solid var(--odoo-surface-low)', background: isToday ? 'rgba(113, 75, 103, 0.03)' : undefined, transition: 'background 0.15s' }}>
                                                    <td style={{ ...tdStyle, fontWeight: 500 }}>
                                                        {isToday ? (
                                                            <span style={{ fontStyle: 'italic', color: 'var(--odoo-text-muted)' }}>Today</span>
                                                        ) : (
                                                            <span style={{ color: 'var(--odoo-text)' }}>
                                                                {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, color: 'var(--odoo-text-secondary)' }}>
                                                        {att?.clockInStr ? formatTo12h(att.clockInStr) : '--'}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        {isToday && amIClockedIn ? (
                                                            <span style={{ fontStyle: 'italic', color: 'var(--odoo-text-muted)', opacity: 0.5 }}>Active</span>
                                                        ) : (
                                                            <span style={{ color: 'var(--odoo-text-secondary)' }}>
                                                                {att?.clockOutStr ? formatTo12h(att.clockOutStr) : '--'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--odoo-purple)' : 'var(--odoo-text-secondary)' }}>
                                                        {hoursWorked > 0 ? `${hoursWorked}h` : '--'}
                                                    </td>
                                                    <td style={{ ...tdStyle }}>
                                                        {isToday && amIClockedIn ? (
                                                            <span className="animate-pulse" style={{
                                                                padding: '2px 8px',
                                                                background: 'rgba(113, 75, 103, 0.1)',
                                                                color: 'var(--odoo-purple)',
                                                                fontSize: '0.65rem', fontWeight: 900,
                                                                textTransform: 'uppercase',
                                                                borderRadius: '4px',
                                                                display: 'inline-block',
                                                            }}>
                                                                On Duty
                                                            </span>
                                                        ) : statusCfg.label ? (
                                                            <span style={{
                                                                padding: '2px 8px',
                                                                background: day.status === 'present' ? 'rgba(1, 126, 132, 0.1)' : day.status === 'late' ? 'rgba(232, 169, 64, 0.1)' : statusCfg.bg,
                                                                color: day.status === 'present' ? 'var(--odoo-success)' : day.status === 'late' ? 'var(--odoo-warning)' : statusCfg.color,
                                                                fontSize: '0.65rem', fontWeight: 900,
                                                                textTransform: 'uppercase',
                                                                borderRadius: '4px',
                                                                display: 'inline-block',
                                                            }}>
                                                                {statusCfg.label}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--odoo-text-muted)', opacity: 0.4 }}>--</span>
                                                        )}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        {overtime > 0 ? (
                                                            <span style={{ fontWeight: 600, color: 'var(--odoo-success)' }}>+{overtime}h</span>
                                                        ) : (
                                                            <span style={{ color: 'var(--odoo-text-muted)', opacity: 0.4 }}>--</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {weekAttendance.length === 0 && (
                                            <tr>
                                                <td colSpan={6} style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--odoo-text-muted)', fontSize: '0.875rem' }}>
                                                    No attendance records this week
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── Schedule Tab ── */}
                    {tab === 'schedule' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Shift templates */}
                            <div style={{ ...cardStyle, padding: '20px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <h4 style={labelStyle}>Shift Templates</h4>
                                    {editingTemplate === null && (
                                        <button onClick={() => { setEditingTemplate('new'); setCustomShift({ label: '', start: '08:00', end: '17:00' }); }}
                                            style={{
                                                fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px',
                                                background: 'rgba(113, 75, 103, 0.08)',
                                                color: 'var(--odoo-purple)', fontWeight: 500,
                                                border: 'none', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                            }}>
                                            + Add Shift
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {allShiftTemplates.map((s, idx) => {
                                        const isCustom = idx >= SHIFT_TEMPLATES.length;
                                        const customIdx = idx - SHIFT_TEMPLATES.length;
                                        return (
                                            <div key={s.id} className="group relative" style={{
                                                borderRadius: '8px', padding: '12px',
                                                border: `2px solid ${s.color}40`,
                                                background: `${s.color}10`,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <ShiftIcon id={s.icon || s.id} />
                                                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--odoo-text)' }}>{s.label}</span>
                                                </div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--odoo-text-muted)' }}>{s.start} — {s.end}</p>
                                                {isCustom && (
                                                    <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                                                        <button onClick={() => { setEditingTemplate(customIdx); setCustomShift({ ...s }); }}
                                                            style={{ padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.8)', border: 'none', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                                            <Edit3 className="w-3 h-3" style={{ color: 'var(--odoo-text-muted)' }} />
                                                        </button>
                                                        <button onClick={() => setCustomTemplates(prev => prev.filter((_, i) => i !== customIdx))}
                                                            style={{ padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.8)', border: 'none', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                                            <X className="w-3 h-3" style={{ color: 'var(--odoo-danger)' }} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Add/Edit custom shift form */}
                                {editingTemplate !== null && (
                                    <div style={{
                                        marginTop: '12px', padding: '12px', borderRadius: '8px',
                                        border: '2px dashed var(--odoo-border-ghost)',
                                        background: 'var(--odoo-surface-low)',
                                    }}>
                                        <div className="grid grid-cols-4 gap-2 items-end">
                                            <div>
                                                <label style={{ fontSize: '0.625rem', fontWeight: 500, color: 'var(--odoo-text-muted)', textTransform: 'uppercase' }}>Name</label>
                                                <input type="text" value={customShift.label} onChange={e => setCustomShift(p => ({ ...p, label: e.target.value }))}
                                                    placeholder="e.g. Night"
                                                    className="odoo-input w-full"
                                                    style={{ fontSize: '0.875rem', padding: '6px 8px' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.625rem', fontWeight: 500, color: 'var(--odoo-text-muted)', textTransform: 'uppercase' }}>Start</label>
                                                <input type="time" value={customShift.start} onChange={e => setCustomShift(p => ({ ...p, start: e.target.value }))}
                                                    className="odoo-input w-full"
                                                    style={{ fontSize: '0.875rem', padding: '6px 8px' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.625rem', fontWeight: 500, color: 'var(--odoo-text-muted)', textTransform: 'uppercase' }}>End</label>
                                                <input type="time" value={customShift.end} onChange={e => setCustomShift(p => ({ ...p, end: e.target.value }))}
                                                    className="odoo-input w-full"
                                                    style={{ fontSize: '0.875rem', padding: '6px 8px' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
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
                                                    style={{
                                                        padding: '6px 12px', borderRadius: '6px',
                                                        background: 'var(--odoo-purple)', color: '#fff',
                                                        fontSize: '0.75rem', fontWeight: 500,
                                                        border: 'none', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                    }}>
                                                    <Save className="w-3 h-3" /> Save
                                                </button>
                                                <button onClick={() => setEditingTemplate(null)}
                                                    style={{ padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent' }}>
                                                    <X className="w-3.5 h-3.5" style={{ color: 'var(--odoo-text-muted)' }} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Assign shifts to workers */}
                            <div style={{ ...cardStyle, padding: '20px 24px' }}>
                                <h4 style={{ ...labelStyle, marginBottom: '12px' }}>Worker Shifts</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {users.map(u => {
                                        const currentShift = shifts[u.username] || SHIFT_TEMPLATES[0];
                                        const isEditing = editingShift === u.username;

                                        return (
                                            <div key={u.username} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '12px', borderRadius: '8px',
                                                border: '1px solid var(--odoo-border-ghost)',
                                                transition: 'background 0.15s',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                                                        background: 'var(--odoo-purple)',
                                                    }}>
                                                        {u.name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--odoo-text)' }}>{u.name}</p>
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--odoo-text-muted)' }}>{u.role}</p>
                                                    </div>
                                                </div>

                                                {isEditing ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {allShiftTemplates.map(s => (
                                                            <button key={s.id} onClick={() => assignShift(u.username, s.id)}
                                                                style={{
                                                                    padding: '4px 12px', borderRadius: '6px',
                                                                    fontSize: '0.75rem', fontWeight: 500,
                                                                    border: `2px solid ${s.color}`,
                                                                    color: s.color, background: `${s.color}10`,
                                                                    cursor: 'pointer',
                                                                }}>
                                                                {s.label}
                                                            </button>
                                                        ))}
                                                        <button onClick={() => setEditingShift(null)}
                                                            style={{ padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent' }}>
                                                            <X className="w-3.5 h-3.5" style={{ color: 'var(--odoo-text-muted)' }} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            padding: '4px 10px', borderRadius: '6px',
                                                            fontSize: '0.75rem', fontWeight: 500,
                                                            background: `${currentShift.color}15`,
                                                            color: currentShift.color,
                                                        }}>
                                                            <ShiftIcon id={currentShift.icon || currentShift.id} />
                                                            {currentShift.label} ({currentShift.start}—{currentShift.end})
                                                        </span>
                                                        {isAdmin && (
                                                            <button onClick={() => setEditingShift(u.username)}
                                                                style={{ padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent' }}>
                                                                <Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--odoo-text-muted)' }} />
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
                                <div style={{ ...cardStyle, padding: '20px 24px' }}>
                                    <h4 style={{ ...labelStyle, marginBottom: '12px' }}>Leave & Holidays</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {leaves.filter(l => l.date >= today).sort((a, b) => a.date.localeCompare(b.date)).map((l, i) => {
                                            const leaveType = LEAVE_TYPES.find(t => t.id === l.type) || LEAVE_TYPES[0];
                                            const u = users.find(u => u.username === l.username);
                                            return (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '8px 12px', borderRadius: '8px',
                                                    background: 'var(--odoo-surface-low)',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--odoo-text-muted)' }}>{l.date}</span>
                                                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--odoo-text)' }}>{u?.name || l.username}</span>
                                                        <span style={{
                                                            fontSize: '0.75rem', padding: '2px 8px', borderRadius: '9999px',
                                                            background: leaveType.color + '20', color: leaveType.color,
                                                        }}>
                                                            {leaveType.label}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => removeLeave(l.username, l.date)}
                                                        style={{ padding: '4px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: 'transparent' }}>
                                                        <X className="w-3.5 h-3.5" style={{ color: 'var(--odoo-danger)' }} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {leaves.filter(l => l.date >= today).length === 0 && (
                                            <p style={{ fontSize: '0.875rem', color: 'var(--odoo-text-muted)', textAlign: 'center', padding: '16px 0' }}>
                                                No upcoming leaves scheduled
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Stats Tab ── */}
                    {tab === 'stats' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <button onClick={() => changeMonth(-1)} style={{ padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}>
                                    <ChevronLeft className="w-5 h-5" style={{ color: 'var(--odoo-text-muted)' }} />
                                </button>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--odoo-text)' }}>{monthLabel}</h3>
                                <button onClick={() => changeMonth(1)} style={{ padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}>
                                    <ChevronRight className="w-5 h-5" style={{ color: 'var(--odoo-text-muted)' }} />
                                </button>
                            </div>

                            {/* Monthly calendar grid (full view for admins) */}
                            {isAdmin && (
                                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                                    <div style={{ overflowX: 'auto' }} ref={calendarScrollRef}>
                                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--odoo-surface-low)' }}>
                                                    <th style={{
                                                        textAlign: 'left', padding: '8px 12px',
                                                        position: 'sticky', left: 0, zIndex: 10,
                                                        background: 'var(--odoo-surface-low)',
                                                        minWidth: '120px', fontWeight: 700,
                                                        color: 'var(--odoo-text-secondary)',
                                                        fontSize: '0.6875rem', textTransform: 'uppercase',
                                                        letterSpacing: '0.05em',
                                                    }}>Employee</th>
                                                    {calendarData.days.map(d => (
                                                        <th key={d.date} data-today={d.isToday || undefined}
                                                            style={{
                                                                textAlign: 'center', padding: '4px 2px',
                                                                minWidth: '32px',
                                                                ...(d.isToday ? { background: 'var(--odoo-purple)', borderRadius: '6px 6px 0 0' } : {}),
                                                                ...(d.isWeekend && !d.isToday ? { background: 'var(--odoo-surface-high)' } : {}),
                                                            }}>
                                                            <div style={{
                                                                fontSize: '0.625rem', fontWeight: 600,
                                                                color: d.isToday ? 'rgba(255,255,255,0.7)' : 'var(--odoo-text-muted)',
                                                            }}>
                                                                {['Su','Mo','Tu','We','Th','Fr','Sa'][d.dayOfWeek]}
                                                            </div>
                                                            <div style={{
                                                                fontWeight: 900, fontSize: '0.875rem',
                                                                color: d.isToday ? '#fff' : d.isWeekend ? 'var(--odoo-text-muted)' : 'var(--odoo-text)',
                                                            }}>
                                                                {d.day}
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {users.map(u => (
                                                    <tr key={u.username} style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                                                        <td style={{
                                                            padding: '6px 12px',
                                                            position: 'sticky', left: 0, zIndex: 10,
                                                            background: 'var(--odoo-surface)',
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{
                                                                    width: '24px', height: '24px', borderRadius: '50%',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '0.625rem', fontWeight: 900, color: '#fff',
                                                                    background: 'var(--odoo-purple)',
                                                                }}>
                                                                    {u.name?.charAt(0)}
                                                                </span>
                                                                <span style={{ fontWeight: 500, color: 'var(--odoo-text-secondary)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {u.name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        {calendarData.days.map(d => {
                                                            const userDay = d.users[u.username];
                                                            const status = userDay?.status;
                                                            const cfg = STATUS_CONFIG[status];

                                                            return (
                                                                <td key={d.date}
                                                                    style={{
                                                                        textAlign: 'center', padding: '4px 2px',
                                                                        ...(d.isToday ? { background: 'rgba(113, 75, 103, 0.06)', borderLeft: '2px solid var(--odoo-purple)', borderRight: '2px solid var(--odoo-purple)' } : {}),
                                                                        ...(d.isWeekend && !d.isToday ? { background: 'var(--odoo-surface-low)' } : {}),
                                                                    }}
                                                                    title={`${u.name} — ${d.date}: ${cfg?.label || '-'}${userDay?.clockIn ? ` (${userDay.clockIn})` : ''}`}
                                                                >
                                                                    {cfg ? (
                                                                        <span
                                                                            style={{
                                                                                display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%',
                                                                                background: cfg.bg, color: cfg.color,
                                                                                fontSize: '0.5rem', fontWeight: 700,
                                                                                lineHeight: '20px', textAlign: 'center',
                                                                                cursor: isAdmin && d.date >= today ? 'pointer' : 'default',
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isAdmin && d.date >= today) {
                                                                                    setEditingLeave({ username: u.username, date: d.date, current: status });
                                                                                }
                                                                            }}
                                                                        >
                                                                            {status === 'present' ? '\u2713' : status === 'late' ? 'L' : status === 'absent' ? '\u2717' : status === 'leave' ? '\u25CE' : status === 'holiday' ? 'H' : '\u2014'}
                                                                        </span>
                                                                    ) : (
                                                                        <span
                                                                            style={{
                                                                                display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%',
                                                                                background: 'var(--odoo-surface-low)',
                                                                                color: 'var(--odoo-text-muted)',
                                                                                fontSize: '0.5rem', lineHeight: '20px', textAlign: 'center',
                                                                                cursor: isAdmin ? 'pointer' : 'default',
                                                                            }}
                                                                            onClick={() => {
                                                                                if (isAdmin) setEditingLeave({ username: u.username, date: d.date, current: null });
                                                                            }}
                                                                        >&middot;</span>
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
                                    <div style={{
                                        display: 'flex', flexWrap: 'wrap', gap: '12px',
                                        padding: '8px 16px',
                                        borderTop: '1px solid var(--odoo-border-ghost)',
                                        background: 'var(--odoo-surface-low)',
                                    }}>
                                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.625rem' }}>
                                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: cfg.bg, border: `1px solid ${cfg.color}`, display: 'inline-block' }} />
                                                <span style={{ color: 'var(--odoo-text-muted)' }}>{cfg.label}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Stats table */}
                            <div style={{ ...cardStyle, overflow: 'hidden' }}>
                                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--odoo-surface-low)' }}>
                                            {['Employee', 'Attendance', 'Present', 'Late', 'Absent', 'Leave', 'On-Time %', 'Avg Hours'].map(col => (
                                                <th key={col} style={{
                                                    padding: '12px 16px',
                                                    fontSize: '0.6875rem', textTransform: 'uppercase',
                                                    letterSpacing: '0.05em', fontWeight: 700,
                                                    color: 'var(--odoo-text-muted)',
                                                    textAlign: col === 'Employee' ? 'left' : 'center',
                                                }}>
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => {
                                            const s = monthStats[u.username] || {};
                                            return (
                                                <tr key={u.username} style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{
                                                                width: '28px', height: '28px', borderRadius: '50%',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.625rem', fontWeight: 700, color: '#fff',
                                                                background: 'var(--odoo-purple)',
                                                            }}>
                                                                {u.name?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p style={{ fontWeight: 500, color: 'var(--odoo-text)' }}>{u.name}</p>
                                                                <p style={{ fontSize: '0.625rem', color: 'var(--odoo-text-muted)' }}>{u.role}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                                        <span style={{
                                                            fontSize: '0.875rem', fontWeight: 700,
                                                            color: (s.attendanceRate || 0) >= 95 ? 'var(--odoo-success)' : (s.attendanceRate || 0) >= 80 ? 'var(--odoo-warning)' : 'var(--odoo-danger)',
                                                        }}>
                                                            {s.attendanceRate || 0}%
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--odoo-success)', fontWeight: 500 }}>{s.present || 0}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--odoo-warning)', fontWeight: 500 }}>{s.late || 0}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--odoo-danger)', fontWeight: 500 }}>{s.absent || 0}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--odoo-purple)', fontWeight: 500 }}>{s.leave || 0}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                                        <span style={{
                                                            fontWeight: 500,
                                                            color: (s.onTimeRate || 0) >= 95 ? 'var(--odoo-success)' : 'var(--odoo-warning)',
                                                        }}>
                                                            {s.onTimeRate || 0}%
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--odoo-text-secondary)', fontWeight: 500 }}>{s.avgHours || 0}h</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right Column ── */}
                <div className="col-span-12 lg:col-span-4" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Monthly Summary Card */}
                    <div style={{ ...cardStyle, padding: '24px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--odoo-text)', marginBottom: '24px' }}>
                            Monthly Summary
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Attendance Rate */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <p style={labelStyle}>Attendance Rate</p>
                                    <p style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--odoo-success)' }}>
                                        {myStats.attendanceRate || 0}%
                                    </p>
                                </div>
                                {/* Mini bar chart */}
                                <div style={{ height: '48px', width: '96px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%' }}>
                                        {[40, 60, 90, 75, 100].map((h, i) => (
                                            <div key={i} style={{
                                                width: '8px',
                                                height: `${h}%`,
                                                background: i === 4 ? 'var(--odoo-success)' : 'rgba(1, 126, 132, 0.2)',
                                                borderRadius: '2px 2px 0 0',
                                            }} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ background: 'var(--odoo-surface-low)', padding: '16px', borderRadius: '6px' }}>
                                    <p style={smallLabelStyle}>Days Present</p>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                        {myStats.daysPresent || 0} / {myStats.totalDays || 20}
                                    </p>
                                </div>
                                <div style={{ background: 'var(--odoo-surface-low)', padding: '16px', borderRadius: '6px' }}>
                                    <p style={smallLabelStyle}>Total Hours</p>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                        {Math.round((myStats.totalHours || 0) * 10) / 10}h
                                    </p>
                                </div>
                                <div style={{ background: 'var(--odoo-surface-low)', padding: '16px', borderRadius: '6px' }}>
                                    <p style={smallLabelStyle}>Late Count</p>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--odoo-warning)' }}>
                                        {myStats.late || 0}
                                    </p>
                                </div>
                                <div style={{ background: 'var(--odoo-surface-low)', padding: '16px', borderRadius: '6px' }}>
                                    <p style={smallLabelStyle}>Overtime</p>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--odoo-success)' }}>
                                        {myStats.overtimeHours || 0}h
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Team Live Status (Admin Only) */}
                    {isAdmin && (
                        <div style={{ ...cardStyle, overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid var(--odoo-surface-low)',
                                background: 'rgba(113, 75, 103, 0.05)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Shield className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                                    <h3 style={{
                                        fontSize: '0.75rem', fontWeight: 700,
                                        color: 'var(--odoo-purple)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                    }}>
                                        Team Live Status
                                    </h3>
                                </div>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 700,
                                    color: 'var(--odoo-purple)',
                                    padding: '2px 8px',
                                    background: 'rgba(113, 75, 103, 0.1)',
                                    borderRadius: '4px',
                                }}>
                                    ADMIN
                                </span>
                            </div>

                            {/* Team Members */}
                            <div>
                                {visibleTeam.map((member, idx) => (
                                    <div key={member.username} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        borderTop: idx > 0 ? '1px solid var(--odoo-surface-low)' : 'none',
                                        transition: 'background 0.15s',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.875rem', fontWeight: 700, color: '#fff',
                                                background: 'var(--odoo-purple)',
                                                border: member.isOnDuty ? '2px solid rgba(1, 126, 132, 0.2)' : '2px solid var(--odoo-surface-high)',
                                            }}>
                                                {member.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                                    {member.name}
                                                </p>
                                                <p style={{ fontSize: '0.6875rem', color: 'var(--odoo-text-muted)', fontWeight: 500 }}>
                                                    {member.role}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                fontSize: '0.65rem', fontWeight: 900,
                                                textTransform: 'uppercase',
                                                color: member.statusColor,
                                            }}>
                                                <span style={{
                                                    width: 6, height: 6, borderRadius: '50%',
                                                    background: member.statusColor,
                                                    display: 'inline-block',
                                                }} />
                                                {member.statusLabel}
                                            </span>
                                            {member.detail && (
                                                <span style={{ fontSize: '0.625rem', color: 'var(--odoo-text-muted)', marginTop: '2px' }}>
                                                    {member.detail}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* View All */}
                            {teamLiveStatus.length > 3 && (
                                <div style={{
                                    padding: '12px 16px',
                                    background: 'var(--odoo-surface-low)',
                                    textAlign: 'center',
                                    borderTop: '1px solid var(--odoo-border-ghost)',
                                }}>
                                    <button
                                        onClick={() => setShowAllTeam(!showAllTeam)}
                                        style={{
                                            fontSize: '0.75rem', fontWeight: 700,
                                            color: 'var(--odoo-purple)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            border: 'none', background: 'none',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {showAllTeam
                                            ? 'Show Less'
                                            : `View All Team (${teamLiveStatus.length})`
                                        }
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Today's Status (all users - visible to everyone) */}
                    <div style={{ ...cardStyle, padding: '20px' }}>
                        <h4 style={{ ...labelStyle, marginBottom: '12px' }}>Today's Status</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {users.slice(0, showAllTeam ? users.length : 5).map(u => {
                                const status = getUserStatus(u.username, today);
                                const att = attendance.find(a => a.username === u.username && a.date === today);
                                const cfg = STATUS_CONFIG[status] || { label: 'Not In', color: '#9ca3af', bg: '#f9fafb' };
                                const clock = clockStatus[u.username];
                                const isIn = clock?.clockedIn === true && clock?.date === today;

                                return (
                                    <div key={u.username} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '8px 12px', borderRadius: '6px',
                                        border: '1px solid var(--odoo-border-ghost)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                                                background: cfg.color,
                                            }}>
                                                {u.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--odoo-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                                                <p style={{ fontSize: '0.625rem', color: 'var(--odoo-text-muted)' }}>{u.role}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 600,
                                                padding: '2px 8px', borderRadius: '9999px',
                                                background: cfg.bg, color: cfg.color,
                                            }}>
                                                {cfg.label}
                                            </span>
                                            {isIn && <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--odoo-success)', display: 'inline-block' }} />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Shift Progress */}
                    {amIClockedIn && (
                        <div style={{
                            padding: '16px',
                            background: 'rgba(113, 75, 103, 0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(113, 75, 103, 0.1)',
                        }}>
                            <p style={{
                                fontSize: '0.6875rem', textTransform: 'uppercase',
                                fontWeight: 700, color: 'var(--odoo-purple)',
                                letterSpacing: '0.1em', marginBottom: '6px',
                            }}>
                                Shift Progress
                            </p>
                            <div style={{
                                height: '6px', width: '100%',
                                background: 'var(--odoo-surface-high)',
                                borderRadius: '9999px', overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, Math.round((currentHoursWorked / getShiftTotalHours(myShift)) * 100))}%`,
                                    background: 'var(--odoo-purple)',
                                    borderRadius: '9999px',
                                    transition: 'width 1s ease',
                                }} />
                            </div>
                            <p style={{ fontSize: '0.75rem', marginTop: '8px', color: 'var(--odoo-text-muted)' }}>
                                {currentHoursWorked}h / {getShiftTotalHours(myShift)}h completed
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Leave Edit Modal ── */}
            {editingLeave && (
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 50, background: 'rgba(0,0,0,0.5)',
                    }}
                    onClick={() => setEditingLeave(null)}
                >
                    <div onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--odoo-surface)',
                            borderRadius: '16px',
                            padding: '24px',
                            width: '100%',
                            maxWidth: '384px',
                            margin: '0 16px',
                            boxShadow: 'var(--odoo-shadow-lg)',
                        }}
                    >
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--odoo-text)', marginBottom: '4px' }}>
                            {editingLeave.current ? 'Update Status' : 'Set Leave'}
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--odoo-text-muted)', marginBottom: '16px' }}>
                            {users.find(u => u.username === editingLeave.username)?.name} — {editingLeave.date}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {LEAVE_TYPES.map(lt => (
                                <button key={lt.id} onClick={() => addLeave(editingLeave.username, editingLeave.date, lt.id)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '12px', borderRadius: '12px',
                                        border: '1px solid var(--odoo-border-ghost)',
                                        background: 'var(--odoo-surface)',
                                        cursor: 'pointer', textAlign: 'left',
                                        transition: 'background 0.15s',
                                    }}>
                                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: lt.color, display: 'inline-block' }} />
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--odoo-text)' }}>{lt.label}</span>
                                </button>
                            ))}
                            {editingLeave.current && (
                                <button onClick={() => { removeLeave(editingLeave.username, editingLeave.date); setEditingLeave(null); }}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '12px', borderRadius: '12px',
                                        border: '1px solid rgba(228, 111, 120, 0.3)',
                                        color: 'var(--odoo-danger)',
                                        background: 'var(--odoo-surface)',
                                        cursor: 'pointer', textAlign: 'left',
                                    }}>
                                    <X className="w-3 h-3" />
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Remove Status</span>
                                </button>
                            )}
                        </div>

                        <button onClick={() => setEditingLeave(null)}
                            style={{
                                width: '100%', marginTop: '12px', padding: '8px',
                                fontSize: '0.875rem', color: 'var(--odoo-text-muted)',
                                textAlign: 'center', border: 'none',
                                background: 'none', cursor: 'pointer',
                            }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeAttendance;
