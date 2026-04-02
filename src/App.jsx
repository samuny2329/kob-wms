import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Upload, X, FileSpreadsheet, AlertTriangle, Unlock, Building2, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';

import { TRANSLATIONS } from './translations';
import { getTrackingUrl, useDebounce } from './utils';
import { rolesInfo, tabInfo, INITIAL_SALES_ORDERS, ITEMS_PER_PAGE, PRODUCT_CATALOG, ROLE_KPI_CONFIG, computeOkrResults, COMPANIES, getCompany } from './constants';

// Sub-components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Pick from './components/Pick';
import Pack from './components/Pack';
import Scan from './components/Scan';
import List from './components/List';
import Dispatch from './components/Dispatch';
import Reports from './components/Reports';
import Users from './components/Users';
import Settings from './components/Settings';
import Manual from './components/Manual';
import Login from './components/Login';
import HandheldPack from './components/HandheldPack';
import POSPack from './components/POSPack';
import Inventory from './components/Inventory';
import Sorting from './components/Sorting';
import Fulfillment from './components/Fulfillment';
import Invoice from './components/Invoice';
import HandheldLayout from './components/HandheldLayout';
import PlatformMonitor from './components/PlatformMonitor';
import TeamPerformance from './components/TeamPerformance';
import WorkerPerformance from './components/WorkerPerformance';
import SLATracker from './components/SLATracker';
import CycleCount from './components/CycleCount';
import ProcedurePanel from './components/ProcedurePanel';
import TimeAttendance, { autoClockIn } from './components/TimeAttendance';
import KPIAssessment from './components/KPIAssessment';
import GWPManager from './components/GWPManager';
import ClaudeChat from './components/ClaudeChat';
import AIAnalyzer from './components/AIAnalyzer';
import MarketIntelligence from './components/MarketIntelligence';
import ActivityHistory from './components/ActivityHistory';
import TxDebugPanel from './components/TxDebugPanel';

// Hooks & Services
import useOdooSync from './hooks/useOdooSync';
import useTransactionRing from './hooks/useTransactionRing';
import { secureSet } from './utils/crypto';
import { confirmRTS, createInvoiceFromPicking, syncAllPlatforms as apiSyncAllPlatforms, createSalesOrder } from './services/odooApi';
import { hashPassword, verifyPassword, createSession, getSession, refreshSession, destroySession, isSessionExpiringSoon, getSessionTimeRemaining, isAccountLocked, recordLoginAttempt, auditLog, validateFileUpload, validatePasswordStrength } from './utils/security';
import { addActivity } from './utils/activityDB';

const App = () => {
    // 1. Initial & System State
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
    const [language, setLanguage] = useState(() => localStorage.getItem('lang') || 'en');
    const [user, setUser] = useState(() => { try { const session = getSession(); return session?.user ? { ...JSON.parse(localStorage.getItem('currentUser') || 'null'), ...session.user } : JSON.parse(localStorage.getItem('currentUser')); } catch { return null; } });
    const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || 'picker');
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
    const [selectedWorker, setSelectedWorker] = useState(null);
    const [workDate, setWorkDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeCompanies, setActiveCompanies] = useState(() => {
        try { return JSON.parse(localStorage.getItem('wms_active_companies')) || ['kob']; }
        catch { return ['kob']; }
    });

    // 2. Data State
    // One-time cleanup: clear mock data from localStorage
    if (localStorage.getItem('wms_mock_cleared') !== '2') {
        ['wms_orders', 'wms_sales_orders', 'wms_inventory', 'wms_waves', 'wms_invoices', 'wms_history', 'wms_logs', 'wms_box_usage', 'wms_cycle_counts', 'wms_count_notifications', 'wms_reorder_rules'].forEach(k => localStorage.removeItem(k));
        localStorage.setItem('wms_mock_cleared', '2');
    }
    // Safe JSON parse helper — prevents white screen on corrupted localStorage
    const safeParse = (key, fallback) => {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
        catch { if (import.meta.env.DEV) console.warn(`Corrupted localStorage key: ${key}`); return fallback; }
    };

    const [orderData, setOrderData] = useState(() => safeParse('wms_orders', []));
    const [salesOrders, setSalesOrders] = useState(() => safeParse('wms_sales_orders', INITIAL_SALES_ORDERS));
    const [users, setUsers] = useState(() => safeParse('wms_users', [{ name: 'Admin User', username: 'admin', password: '$wms$default$setup', role: 'admin', isFirstLogin: true }]));
    const [historyData, setHistoryData] = useState(() => safeParse('wms_history', []));
    const [activityLogs, setActivityLogs] = useState(() => safeParse('wms_logs', []));
    const [apiConfigs, setApiConfigs] = useState(() => {
        const stored = safeParse('wms_apis', {});
        const odooDefaults = { enabled: true, useMock: false, url: 'https://odoo-uat.kissgroupbim.work', db: 'kiss-production_2026-03-09', username: 'admin', password: 'admin' };
        return {
            odoo: { ...odooDefaults, ...stored.odoo, url: stored.odoo?.url || odooDefaults.url, db: stored.odoo?.db || odooDefaults.db, username: stored.odoo?.username || odooDefaults.username },
            shopee: stored.shopee || { enabled: false, shopId: '', partnerId: '', partnerKey: '' },
            lazada: stored.lazada || { enabled: false, appKey: '', appSecret: '', accessToken: '' },
            tiktok: stored.tiktok || { enabled: false, appKey: '', appSecret: '', accessToken: '' },
            claude: stored.claude || { enabled: false, apiKey: '' },
        };
    });
    const [boxUsageLog, setBoxUsageLog] = useState(() => safeParse('wms_box_usage', []));
    const [inventory, setInventory] = useState(() => safeParse('wms_inventory', null));
    const [waves, setWaves] = useState(() => safeParse('wms_waves', []));
    const [invoices, setInvoices] = useState(() => safeParse('wms_invoices', []));

    // 3. UI Interaction State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [scanInput, setScanInput] = useState('');
    const [scanBinHint, setScanBinHint] = useState(null);
    const [lastScans, setLastScans] = useState([]);
    const [activeOrderId, setActiveOrderId] = useState('BATCH-' + new Date().getTime());
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: null, isAlert: false });

    // Tabs sub-states
    const [selectedPickOrder, setSelectedPickOrder] = useState(null);
    const [pickScanInput, setPickScanInput] = useState('');
    const [selectedPackOrder, setSelectedPackOrder] = useState(null);
    const [packScanInput, setPackScanInput] = useState('');
    const [packAwbInput, setPackAwbInput] = useState('');
    const [dispatchCourier, setDispatchCourier] = useState('');
    const [signatureEmpty, setSignatureEmpty] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebounce(searchInput, 300);
    const [currentPage, setCurrentPage] = useState(1);
    const [reportViewMode, setReportViewMode] = useState('current');
    const [reportFilterCourier, setReportFilterCourier] = useState('All');
    const [reportFilterBatchId, setReportFilterBatchId] = useState('');
    const [isErrorLocked, setIsErrorLocked] = useState(false);
    const [scanStatus, setScanStatus] = useState(null);
    const [isProcessingImport, setIsProcessingImport] = useState(false);
    const [isProcessingAPI, setIsProcessingAPI] = useState(false);
    const [sessionWarning, setSessionWarning] = useState(null); // { minutesLeft }
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [newPwInput, setNewPwInput] = useState('');
    const [confirmPwInput, setConfirmPwInput] = useState('');
    const [pwStrength, setPwStrength] = useState(null);

    // 4. Admin sub-states
    const [newUserName, setNewUserName] = useState('');
    const [newUserUsername, setNewUserUsername] = useState('');
    const [newUserRole, setNewUserRole] = useState('outbound');
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [sheetNames, setSheetNames] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [excelData, setExcelData] = useState(null);
    const [excelHeaders, setExcelHeaders] = useState([]);
    const [columnMapping, setColumnMapping] = useState({ barcode: '', courier: '', orderNumber: '', shopName: '' });

    // Refs
    const inputRef = useRef(null);
    const pickInputRef = useRef(null);
    const packInputRef = useRef(null);
    const packAwbRef = useRef(null);
    const canvasRef = useRef(null);
    const isDrawing = useRef(false);
    // Tracks last successful scan time per barcode to prevent stale-state duplicates
    const recentScansRef = useRef({}); // { [barcode]: timestamp }


    // Sync to LS
    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    useEffect(() => { localStorage.setItem('lang', language); }, [language]);
    useEffect(() => { localStorage.setItem('userRole', userRole); }, [userRole]);
    useEffect(() => { localStorage.setItem('activeTab', activeTab); }, [activeTab]);
    useEffect(() => { localStorage.setItem('wms_active_companies', JSON.stringify(activeCompanies)); }, [activeCompanies]);
    useEffect(() => { localStorage.setItem('wms_orders', JSON.stringify(orderData)); }, [orderData]);
    useEffect(() => {
        try {
            // Strip images before saving to localStorage to avoid QuotaExceededError
            const stripped = salesOrders.map(o => ({
                ...o,
                items: o.items?.map(({ image, ...rest }) => rest) || [],
            }));
            localStorage.setItem('wms_sales_orders', JSON.stringify(stripped.slice(0, 500)));
        } catch (e) {
            console.warn('localStorage quota exceeded, clearing old data');
            localStorage.removeItem('wms_sales_orders');
        }
    }, [salesOrders]);
    useEffect(() => { localStorage.setItem('wms_users', JSON.stringify(users)); }, [users]);
    useEffect(() => { localStorage.setItem('wms_history', JSON.stringify(historyData)); }, [historyData]);
    useEffect(() => { localStorage.setItem('wms_logs', JSON.stringify(activityLogs)); }, [activityLogs]);
    useEffect(() => { secureSet('wms_apis', apiConfigs); }, [apiConfigs]);
    useEffect(() => { localStorage.setItem('wms_box_usage', JSON.stringify(boxUsageLog)); }, [boxUsageLog]);
    useEffect(() => {
        try { if (inventory) localStorage.setItem('wms_inventory', JSON.stringify(inventory)); }
        catch { localStorage.removeItem('wms_inventory'); }
    }, [inventory]);
    useEffect(() => { localStorage.setItem('wms_waves', JSON.stringify(waves)); }, [waves]);
    useEffect(() => { localStorage.setItem('wms_invoices', JSON.stringify(invoices)); }, [invoices]);

    // ── Session timeout checker ──
    useEffect(() => {
        if (!user) return;
        const checkSession = () => {
            const session = getSession();
            if (!session) {
                handleLogout();
                setSessionWarning(null);
                addToast?.('Session expired. Please log in again.', 'warning');
                return;
            }
            if (isSessionExpiringSoon()) {
                const mins = Math.ceil(getSessionTimeRemaining() / 60000);
                setSessionWarning({ minutesLeft: mins });
            } else {
                setSessionWarning(null);
            }
        };
        checkSession();
        const interval = setInterval(checkSession, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [user]);

    // Refresh session on user activity
    useEffect(() => {
        if (!user) return;
        const refresh = () => refreshSession();
        window.addEventListener('click', refresh);
        window.addEventListener('keydown', refresh);
        return () => {
            window.removeEventListener('click', refresh);
            window.removeEventListener('keydown', refresh);
        };
    }, [user]);

    // Shared OKR computation — single source of truth for TeamPerformance + KPIAssessment
    const workerOkrData = useMemo(() => {
        if (!activityLogs?.length || !users?.length) return {};
        const today = new Date().toISOString().split('T')[0];
        const result = {};
        users.forEach(u => {
            const role = u.role || 'picker';
            const config = ROLE_KPI_CONFIG[role];
            if (!config) return;
            const userLogs = activityLogs.filter(l => l.username === u.username);
            const todayLogs = userLogs.filter(l => l.timestamp && new Date(l.timestamp).toISOString().split('T')[0] === today);
            const okrAll = computeOkrResults(role, userLogs, salesOrders);
            const okrToday = computeOkrResults(role, todayLogs, salesOrders);
            result[u.username] = { role, config, okrAll, okrToday, todayLogs, allLogs: userLogs };
        });
        return result;
    }, [activityLogs, users, salesOrders]);

    // Helpers
    const t = (key) => TRANSLATIONS[language][key] || key;

    const showAlert = (title, message, type = 'info', onConfirm = null, isAlert = true) => {
        setConfirmModal({ open: true, title, message, type, onConfirm, isAlert });
    };

    const triggerConfirm = (title, message, type, onConfirm) => {
        setConfirmModal({ open: true, title, message, type, onConfirm, isAlert: false });
    };

    const addToast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };

    // Odoo Sync Hook
        const companyIds = activeCompanies.map(c => COMPANIES[c]?.id).filter(Boolean);
    const companyId = companyIds.length === 1 ? companyIds[0] : null; // null = show all selected
    const syncStatus = useOdooSync({ apiConfigs, salesOrders, setSalesOrders, inventory, setInventory, waves, setWaves, invoices, setInvoices, addToast, companyId, companyIds });

    // Transaction Ring — event ledger with cross-tab broadcast
    const txRing = useTransactionRing({
        userId: user?.username,
        role: userRole,
        onNotification: (tx, msg) => addToast(msg, 'info'),
    });

    // HTML escape to prevent XSS in print windows
    const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const updateAndSyncData = (newData) => {
        setOrderData(newData);
    };

    const logActivity = (action, details) => {
        const entry = { timestamp: new Date().getTime(), username: user.username, name: user.name, action, details };
        setActivityLogs(prev => [entry, ...prev].slice(0, 1000));
        // Persist to IndexedDB with flat fields for querying
        addActivity({
            action,
            username: user.username,
            name: user.name,
            timestamp: entry.timestamp,
            orderRef: details?.order || details?.soName || '',
            awb: details?.awb || '',
            sku: details?.sku || '',
            boxType: details?.boxType || '',
            courier: details?.courier || '',
            platform: details?.platform || '',
            itemCount: details?.items || details?.count || 0,
            picking: details?.picking || '',
            barcode: details?.barcode || '',
        });
    };

    const playSound = (type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const t = ctx.currentTime;

            if (type === 'success') {
                // Bright chime — C6 → E6 → G6 arpeggio
                [1047, 1319, 1568].forEach((freq, i) => {
                    const g = ctx.createGain(); g.connect(ctx.destination);
                    const start = t + i * 0.08;
                    g.gain.setValueAtTime(0.15, start);
                    g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
                    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
                    o.connect(g); o.start(start); o.stop(start + 0.2);
                });
            } else if (type === 'error') {
                // SAP System Error — classic ERP triple-beep alert
                [0, 0.12, 0.24].forEach((offset) => {
                    const g = ctx.createGain(); g.connect(ctx.destination);
                    const s = t + offset;
                    g.gain.setValueAtTime(0.22, s);
                    g.gain.setValueAtTime(0.22, s + 0.06);
                    g.gain.linearRampToValueAtTime(0, s + 0.09);
                    const o = ctx.createOscillator(); o.type = 'sine';
                    o.frequency.value = 750;
                    o.connect(g); o.start(s); o.stop(s + 0.09);
                });
            } else if (type === 'click') {
                // Crisp pop
                const g = ctx.createGain(); g.connect(ctx.destination);
                g.gain.setValueAtTime(0.12, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
                const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 800;
                o.connect(g); o.start(t); o.stop(t + 0.04);
            }

            setTimeout(() => ctx.close(), 1200);
        } catch (e) { }
    };

    // User Logics
    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        // Lockout disabled — allow unlimited login attempts

        try {
            const foundUser = users.find(u => u.username === username);

            if (foundUser) {
                // Support default setup password, salted hash, legacy hash, and plaintext (auto-migrate)
                let passwordMatch = false;
                if (foundUser.password === '$wms$default$setup') {
                    // Default setup account — accept 'admin123' and force password change
                    passwordMatch = password === 'admin123';
                } else if (foundUser.password?.includes(':')) {
                    // New salted format (salt:hash)
                    passwordMatch = await verifyPassword(password, foundUser.password);
                } else if (foundUser.password?.length === 64) {
                    // Legacy unsalted SHA-256 hash
                    passwordMatch = await verifyPassword(password, foundUser.password);
                    if (passwordMatch) {
                        // Re-hash with salt
                        const hashed = await hashPassword(password);
                        const updatedUsers = users.map(u =>
                            u.username === username ? { ...u, password: hashed } : u
                        );
                        setUsers(updatedUsers);
                        auditLog('password_rehashed', { username }, username);
                    }
                } else if (foundUser.password) {
                    // Legacy plaintext — migrate on successful login
                    passwordMatch = foundUser.password === password;
                    if (passwordMatch) {
                        const hashed = await hashPassword(password);
                        const updatedUsers = users.map(u =>
                            u.username === username ? { ...u, password: hashed } : u
                        );
                        setUsers(updatedUsers);
                        auditLog('password_migrated', { username }, username);
                    }
                }

                if (passwordMatch) {
                    recordLoginAttempt(true);
                    const session = createSession(foundUser);
                    setUser(foundUser);
                    setUserRole(foundUser.role);
                    auditLog('login_success', { username, role: foundUser.role }, username);
                    playSound('success');
                    // Auto clock-in on first login of the day
                    autoClockIn(foundUser.username, foundUser.name);
                    // Force password change on first login
                    if (foundUser.isFirstLogin) {
                        setShowPasswordChange(true);
                    }
                } else {
                    setError('Invalid username or password.');
                    auditLog('login_failed', { username });
                    playSound('error');
                }
            } else {
                setError('Invalid username or password.');
                auditLog('login_failed', { username });
                playSound('error');
            }
        } catch (err) {
            setError('Login error. Please try again.');
            console.error('Login error:', err);
        }

        setIsLoading(false);
    };

    // EOD Archive — save daily snapshot to localStorage (max 30 days)
    const saveEodArchive = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];
        const archives = safeParse('wms_eod_archives', []);
        if (archives.some(a => a.date === today)) return;
        const snapshot = { salesOrders, activityLogs, inventory, invoices };
        const updated = [{ date: today, data: snapshot }, ...archives].slice(0, 30);
        localStorage.setItem('wms_eod_archives', JSON.stringify(updated));
    }, [salesOrders, activityLogs, inventory, invoices]);

    const handleLogout = () => {
        saveEodArchive();
        auditLog('logout', { username: user?.username });
        destroySession();
        setUser(null);
        setUserRole('picker'); // Don't default to admin!
        setActiveTab('dashboard');
        setUsername('');
        setPassword('');
    };

    const handleAddUser = async () => {
        if (!newUserName || !newUserUsername) return;
        if (users.find(u => u.username === newUserUsername)) return addToast('User already exists', 'error');
        const hashedPw = await hashPassword('123456');
        const newUser = { name: newUserName, username: newUserUsername, role: newUserRole, password: hashedPw, isFirstLogin: true };
        setUsers([...users, newUser]);
        setNewUserName(''); setNewUserUsername('');
        auditLog('user_created', { username: newUserUsername, role: newUserRole });
        addToast('User created successfully');
    };

    const handleDeleteUser = (uname) => {
        triggerConfirm('Delete User', `Are you sure you want to delete ${uname}?`, 'danger', () => {
            setUsers(users.filter(u => u.username !== uname));
            addToast('User deleted');
        });
    };

    const handleResetPassword = async (uname) => {
        const hashedPw = await hashPassword('123456');
        setUsers(users.map(u => u.username === uname ? { ...u, password: hashedPw, isFirstLogin: true } : u));
        auditLog('password_reset', { targetUser: uname });
        addToast('Password reset to 123456');
    };

    const handlePasswordChange = async () => {
        if (newPwInput !== confirmPwInput) {
            addToast('Passwords do not match', 'error');
            return;
        }
        const strength = validatePasswordStrength(newPwInput);
        if (!strength.valid) {
            addToast(strength.errors[0], 'error');
            return;
        }
        const hashed = await hashPassword(newPwInput);
        const updatedUsers = users.map(u =>
            u.username === user.username ? { ...u, password: hashed, isFirstLogin: false } : u
        );
        setUsers(updatedUsers);
        setUser({ ...user, isFirstLogin: false });
        auditLog('password_changed', { username: user.username }, user.username);
        setShowPasswordChange(false);
        setNewPwInput('');
        setConfirmPwInput('');
        setPwStrength(null);
        addToast('Password changed successfully', 'success');
    };

    // Remove orders with Dummy/non-SKINOXY products (no real odooPickingId and no real SKU)
    const REAL_SKUS = Object.keys(PRODUCT_CATALOG);
    const clearDummyOrders = () => {
        setSalesOrders(prev => prev.filter(o =>
            o.odooPickingId ||
            o.items?.some(i => REAL_SKUS.includes(i.sku))
        ));
        addToast('Dummy orders removed');
    };

    // Create SO directly in Odoo, then sync back
    const [isCreatingSO, setIsCreatingSO] = useState(false);
    const handleCreateSOInOdoo = async (orderData) => {
        setIsCreatingSO(true);
        try {
            const result = await createSalesOrder(apiConfigs.odoo, orderData);
            addToast(`SO created in Odoo: ${result.soName} → ${result.pickingRef}`);
            logActivity('create-so-odoo', { soName: result.soName, picking: result.pickingRef, platform: orderData.platform });
            // Trigger sync to pull the new picking into WMS
            if (typeof syncStatus.syncNow === 'function') syncStatus.syncNow();
        } catch (err) {
            addToast('SO creation failed: ' + err.message, 'error');
        } finally {
            setIsCreatingSO(false);
        }
    };

    // Pick/Pack Logic
    const handlePickScanSubmit = (e) => {
        if (e.key !== 'Enter') return;
        const raw = (pickInputRef.current?.value || e.target.value || pickScanInput).trim();
        if (!raw) return;
        {
            const input = raw;
            const inputUpper = input.toUpperCase();
            const items = selectedPickOrder.items.map(i => ({ ...i }));
            const item = items.find(i => {
                const sku = (i.sku || '').toUpperCase();
                const catalog = PRODUCT_CATALOG[i.sku];
                const skuMatch = sku && sku === inputUpper;
                const catalogBarcodeMatch = catalog?.barcode && (catalog.barcode === input || catalog.barcode.toUpperCase() === inputUpper);
                const itemBarcodeMatch = i.barcode && (i.barcode === input || i.barcode.toUpperCase() === inputUpper);
                return (skuMatch || catalogBarcodeMatch || itemBarcodeMatch) && i.picked < i.expected;
            });
            if (item) {
                // Check stock — use onHand (not available = onHand - reserved, because reserved includes all pending picks)
                const invItems = Array.isArray(inventory) ? inventory : (inventory?.items || []);
                const stockItem = invItems.find(inv => (inv.sku || inv.default_code) === item.sku);
                const onHand = stockItem?.onHand ?? stockItem?.quantity ?? 0;
                if (onHand <= 0 && invItems.length > 0) {
                    playSound('error');
                    addToast(`Out of Stock: ${item.sku} — on hand: ${onHand}`, 'error');
                    setPickScanInput('');
                    return;
                }
                item.picked++;
                const isFinished = items.every(i => i.picked >= i.expected);
                const updatedOrder = { ...selectedPickOrder, items, status: isFinished ? 'picked' : 'picking' };
                const updatedOrders = salesOrders.map(o => o.id === selectedPickOrder.id ? updatedOrder : o);
                setSalesOrders(updatedOrders);
                setSelectedPickOrder(updatedOrder);
                playSound('success');
                logActivity('pick', { order: selectedPickOrder.ref, sku: item.sku });
                txRing?.emit?.('pick', { orderId: selectedPickOrder.id, orderRef: selectedPickOrder.ref, sku: item.sku, qty: 1, finished: isFinished });
                if (isFinished) {
                    addToast(`✓ Pick completed: ${selectedPickOrder.ref}`, 'success');
                    setTimeout(() => setSelectedPickOrder(null), 800);
                }
            } else {
                playSound('error');
            }
            setPickScanInput('');
        }
    };

    const handlePackScanSubmit = (e) => {
        if (e.key !== 'Enter') return;
        const raw = (packInputRef.current?.value || e.target.value || packScanInput).trim();
        if (!raw) return;
        {
            const input = raw;
            const inputUpper = input.toUpperCase();
            const items = selectedPackOrder.items.map(i => ({ ...i }));
            const item = items.find(i => {
                const sku = (i.sku || '').toUpperCase();
                const catalog = PRODUCT_CATALOG[i.sku];
                const skuMatch = sku && sku === inputUpper;
                const catalogBarcodeMatch = catalog?.barcode && (catalog.barcode === input || catalog.barcode.toUpperCase() === inputUpper);
                const itemBarcodeMatch = i.barcode && (i.barcode === input || i.barcode.toUpperCase() === inputUpper);
                return (skuMatch || catalogBarcodeMatch || itemBarcodeMatch) && (i.packed || 0) < (i.picked || i.expected || 0);
            });
            if (item) {
                item.packed = (item.packed || 0) + 1;
                const isFinished = items.every(i => (i.packed || 0) >= (i.picked || i.expected || 0));
                const updatedOrder = { ...selectedPackOrder, items, status: isFinished ? 'packed' : 'packing' };
                const updatedOrders = salesOrders.map(o => o.id === selectedPackOrder.id ? updatedOrder : o);
                setSalesOrders(updatedOrders);
                setSelectedPackOrder(updatedOrder);
                playSound('success');
                logActivity('pack', { order: selectedPackOrder.ref, sku: item.sku });
                txRing?.emit?.('pack', { orderId: selectedPackOrder.id, orderRef: selectedPackOrder.ref, sku: item.sku, qty: 1, finished: isFinished });
            } else {
                playSound('error');
            }
            setPackScanInput('');
        }
    };

    const handleBoxSelect = (order, boxId) => {
        handleFulfillmentAndAWB({ ...order, boxType: boxId });
    };

    const handleAwbConfirmScan = (e) => {
        if (e.key === 'Enter' && packAwbInput) {
            const input = packAwbInput.trim().toUpperCase();
            const orderAwb = selectedPackOrder.awb?.toUpperCase();
            if (input === orderAwb) {
                const updatedOrder = { ...selectedPackOrder, status: 'locked' };
                const updatedOrders = salesOrders.map(o => o.id === selectedPackOrder.id ? updatedOrder : o);
                setSalesOrders(updatedOrders);
                setSelectedPackOrder(updatedOrder);
                playSound('success');
                logActivity('awb_confirm', { order: selectedPackOrder.ref, awb: input });
            } else {
                playSound('error');
            }
            setPackAwbInput('');
        }
    };

    const printAwbLabel = (order, awbCode) => {
        const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const totalQty = order.items ? order.items.reduce((s, i) => s + (i.picked || i.expected || 0), 0) : '-';
        const courierRaw = (order.courier || order.platform || '').toLowerCase();
        const recipient = order.customer || 'Customer';
        const sender = 'SKINOXY / KOB';
        const ref = order.ref || '';
        const box = order.boxType || '-';

        // Detect platform
        const isShopee = courierRaw.includes('shopee');
        const isLazada = courierRaw.includes('lazada');
        const isFlash = courierRaw.includes('flash');
        const isJT = courierRaw.includes('j&t') || courierRaw.includes('jt');
        const isKerry = courierRaw.includes('kerry');
        const isSCG = courierRaw.includes('scg') || courierRaw.includes('skootar');
        const isThaiPost = courierRaw.includes('thailand post') || courierRaw.includes('ems') || courierRaw.includes('thai post');

        // Platform theme config
        let theme = { bg: '#fff', headerBg: '#333', headerColor: '#fff', logo: '📦', name: order.courier || order.platform || 'COURIER', accentColor: '#333', borderColor: '#ccc' };
        if (isShopee)   theme = { bg:'#fff5f0', headerBg:'#EE4D2D', headerColor:'#fff', logo:'shopee', name:'Shopee Express', accentColor:'#EE4D2D', borderColor:'#EE4D2D', isText:true };
        if (isLazada)   theme = { bg:'#f5f0ff', headerBg:'#0F1689', headerColor:'#fff', logo:'Lazada', name:'LEX (Lazada Express)', accentColor:'#0F1689', borderColor:'#0F1689', isText:true };
        if (isFlash)    theme = { bg:'#fffbf0', headerBg:'#F5A623', headerColor:'#1a1a1a', logo:'⚡ FLASH', name:'Flash Express', accentColor:'#F5A623', borderColor:'#F5A623', isText:true };
        if (isJT)       theme = { bg:'#fff0f0', headerBg:'#E30613', headerColor:'#fff', logo:'J&T', name:'J&T Express', accentColor:'#E30613', borderColor:'#E30613', isText:true };
        if (isKerry)    theme = { bg:'#fff8f0', headerBg:'#D0021B', headerColor:'#fff', logo:'KERRY', name:'Kerry Express', accentColor:'#D0021B', borderColor:'#D0021B', isText:true };
        if (isSCG)      theme = { bg:'#f0f8ff', headerBg:'#003087', headerColor:'#fff', logo:'SCG', name:'SCG Express', accentColor:'#003087', borderColor:'#003087', isText:true };
        if (isThaiPost) theme = { bg:'#f0fff4', headerBg:'#7B2D8B', headerColor:'#fff', logo:'🇹🇭 THP', name:'Thailand Post EMS', accentColor:'#7B2D8B', borderColor:'#7B2D8B', isText:true };

        const win = window.open('', '_blank', 'width=500,height=750');
        if (!win) { addToast('Popup blocked by browser', 'error'); return; }
        win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>AWB-${esc(awbCode)}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
  @page{size:100mm 150mm;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;background:${theme.bg}}
  @media screen{
    .label{width:100vw;height:100vh;display:flex;flex-direction:column;background:${theme.bg}}
    .header{background:${theme.headerBg};color:${theme.headerColor};padding:2.5vw 3vw;display:flex;align-items:center;justify-content:space-between;min-height:13vh}
    .logo-txt{font-size:8vw;font-weight:900;letter-spacing:-0.05em}
    .courier-sub{font-size:3vw;opacity:0.85;margin-top:0.5vw}
    .sort-box{background:${theme.headerColor};color:${theme.headerBg};font-size:7vw;font-weight:900;padding:1.5vw 3vw;border-radius:1vw;min-width:15vw;text-align:center}
    .body{padding:2vw 3vw;flex:1;display:flex;flex-direction:column;gap:1.5vw}
    .bc-wrap{text-align:center;padding:1vw 0}
    .awb-num{font-size:5.5vw;font-weight:900;text-align:center;letter-spacing:0.1em;color:#111;margin-top:1vw;word-break:break-all}
    .divider{border:none;border-top:0.5vw solid ${theme.accentColor};margin:1vw 0}
    .divider-dash{border:none;border-top:1px dashed #aaa;margin:1vw 0}
    .addr-block{background:#fff;border:1px solid ${theme.borderColor};border-radius:1vw;padding:1.5vw 2vw}
    .addr-label{font-size:2.5vw;color:${theme.accentColor};font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.8vw}
    .addr-name{font-size:4vw;font-weight:800;color:#111}
    .addr-sub{font-size:3vw;color:#444;margin-top:0.5vw}
    .info-row{display:flex;justify-content:space-between;font-size:3vw;padding:0.5vw 0;border-bottom:1px solid #eee}
    .info-row:last-child{border-bottom:none}
    .il{color:#777}
    .iv{font-weight:700;color:#111}
    .items-box{background:#fff;border:1px solid #ddd;border-radius:1vw;padding:1.5vw 2vw}
    .items-title{font-size:2.5vw;color:#777;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.8vw}
    .item-row{display:flex;justify-content:space-between;font-size:3vw;padding:0.4vw 0;border-bottom:1px solid #f0f0f0}
    .item-row:last-child{border-bottom:none}
    .footer{background:${theme.headerBg};color:${theme.headerColor};text-align:center;font-size:2.5vw;padding:1.5vw;opacity:0.9}
  }
  @media print{
    .label{width:100mm;height:150mm;display:flex;flex-direction:column;background:${theme.bg}}
    .header{background:${theme.headerBg};color:${theme.headerColor};padding:3mm 4mm;display:flex;align-items:center;justify-content:space-between;min-height:18mm}
    .logo-txt{font-size:10mm;font-weight:900;letter-spacing:-0.05em}
    .courier-sub{font-size:3.5mm;opacity:0.85;margin-top:0.5mm}
    .sort-box{background:${theme.headerColor};color:${theme.headerBg};font-size:8mm;font-weight:900;padding:2mm 3mm;border-radius:1mm;min-width:18mm;text-align:center}
    .body{padding:2mm 3mm;flex:1;display:flex;flex-direction:column;gap:1.5mm}
    .bc-wrap{text-align:center;padding:1mm 0}
    .awb-num{font-size:6mm;font-weight:900;text-align:center;letter-spacing:0.08mm;color:#111;margin-top:1mm;word-break:break-all}
    .divider{border:none;border-top:0.5mm solid ${theme.accentColor};margin:1mm 0}
    .divider-dash{border:none;border-top:0.2mm dashed #aaa;margin:1mm 0}
    .addr-block{background:#fff;border:0.3mm solid ${theme.borderColor};border-radius:1mm;padding:1.5mm 2mm}
    .addr-label{font-size:3mm;color:${theme.accentColor};font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.8mm}
    .addr-name{font-size:4.5mm;font-weight:800;color:#111}
    .addr-sub{font-size:3mm;color:#444;margin-top:0.5mm}
    .info-row{display:flex;justify-content:space-between;font-size:3mm;padding:0.5mm 0;border-bottom:0.2mm solid #eee}
    .info-row:last-child{border-bottom:none}
    .il{color:#777}
    .iv{font-weight:700;color:#111}
    .items-box{background:#fff;border:0.2mm solid #ddd;border-radius:1mm;padding:1.5mm 2mm}
    .items-title{font-size:2.8mm;color:#777;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.8mm}
    .item-row{display:flex;justify-content:space-between;font-size:3mm;padding:0.4mm 0;border-bottom:0.2mm solid #f0f0f0}
    .item-row:last-child{border-bottom:none}
    .footer{background:${theme.headerBg};color:${theme.headerColor};text-align:center;font-size:3mm;padding:2mm;opacity:0.9}
  }
</style></head><body>
<div class="label">
  <div class="header">
    <div>
      <div class="logo-txt">${theme.logo}</div>
      <div class="courier-sub">${theme.name}</div>
    </div>
    <div class="sort-box">${box}</div>
  </div>
  <div class="body">
    <div class="bc-wrap"><svg id="bc"></svg></div>
    <div class="awb-num">${awbCode}</div>
    <hr class="divider">
    <div class="addr-block">
      <div class="addr-label">▼ SHIP TO</div>
      <div class="addr-name">${recipient}</div>
    </div>
    <div class="addr-block">
      <div class="addr-label">▲ FROM</div>
      <div class="addr-sub">${sender}</div>
    </div>
    <hr class="divider-dash">
    <div class="info-row"><span class="il">Order</span><span class="iv">${ref}</span></div>
    <div class="info-row"><span class="il">Date</span><span class="iv">${today}</span></div>
    <div class="info-row"><span class="il">Items</span><span class="iv">${totalQty} pcs</span></div>
    ${(order.items || []).map(i => `<div class="item-row"><span>${i.name || i.sku}</span><span style="font-weight:700">×${i.picked || i.expected || 0}</span></div>`).join('')}
  </div>
  <div class="footer">${theme.name} • ${awbCode}</div>
</div>
<script>
window.onload=function(){
  var isScreen=window.matchMedia('screen').matches;
  var h=isScreen?Math.round(window.innerHeight*0.22):70;
  JsBarcode("#bc","${awbCode}",{format:"CODE128",width:2.5,height:h,displayValue:false,margin:0});
  setTimeout(function(){window.print();window.close();},400);
};
<\/script>
</body></html>`);
        win.document.close();
    };

    const handleFulfillmentAndAWB = async (order) => {
        setIsProcessingAPI(true);
        try {
            // Use real Odoo picking ID if available; fallback to ref string for lookup in Odoo
            const pickingRef = order.odooPickingId || order.ref || order.id;
            const result = await confirmRTS(apiConfigs.odoo, pickingRef, order.courier || order.platform);
            const awbCode = result.awb || 'AWB-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            const updatedOrder = { ...order, status: 'rts', awb: awbCode };
            const updatedOrders = salesOrders.map(o => o.id === order.id ? updatedOrder : o);
            setSalesOrders(updatedOrders);
            addToast('AWB ready: ' + awbCode);
            txRing?.emit?.('confirmRTS', { orderId: order.id, orderRef: order.ref, awb: awbCode, courier: order.courier || order.platform });
            if (selectedPackOrder && selectedPackOrder.id === order.id) {
                setSelectedPackOrder(updatedOrder);
            }
            printAwbLabel(updatedOrder, awbCode);
            // expectedQty = 1 because 1 AWB = 1 box (not item count)
            const newOutbound = { barcode: awbCode, courier: order.courier || order.platform, expectedQty: 1, scannedQty: 0, orderNumber: order.ref, shopName: order.platform };
            updateAndSyncData([...orderData, newOutbound]);
        } catch (err) {
            // Odoo validate failed — generate AWB locally but warn user
            addToast(`Odoo: ${err.message} — AWB generated locally`, 'warning');
            console.warn('confirmRTS failed:', err);
            const platformPrefixes = { 'Shopee Express': 'SPXTH', 'Lazada Express': 'LZTH', 'Flash Express': 'FLTH', 'Kerry Express': 'KETH', 'J&T Express': 'JTTH', 'Thai Post': 'TPTH', 'TikTok Shop': 'TTTH' };
            const prefix = platformPrefixes[order.courier || order.platform] || 'TH';
            const awbCode = prefix + Math.floor(Math.random() * 88888888 + 10000000);
            const updatedOrder = { ...order, status: 'rts', awb: awbCode };
            const updatedOrders = salesOrders.map(o => o.id === order.id ? updatedOrder : o);
            setSalesOrders(updatedOrders);
            addToast('AWB ready: ' + awbCode);
            if (selectedPackOrder && selectedPackOrder.id === order.id) {
                setSelectedPackOrder(updatedOrder);
            }
            printAwbLabel(updatedOrder, awbCode);
            // expectedQty = 1 because 1 AWB = 1 box (not item count)
            const newOutbound = { barcode: awbCode, courier: order.courier || order.platform, expectedQty: 1, scannedQty: 0, orderNumber: order.ref, shopName: order.platform };
            updateAndSyncData([...orderData, newOutbound]);
        } finally {
            setIsProcessingAPI(false);
        }
    };

    // Scan Logic
    const handleScan = (e) => {
        if (e.key === 'Enter') {
            const barcode = scanInput.trim().toUpperCase();
            if (!barcode) return;
            processBarcode(barcode);
            setScanInput('');
        }
    };

    const processBarcode = (barcode) => {
        // Ref-based duplicate guard — blocks re-scan within 3s regardless of state staleness
        const now = Date.now();
        // Prune old entries to prevent memory growth over long shifts
        for (const key in recentScansRef.current) {
            if (now - recentScansRef.current[key] > 10000) delete recentScansRef.current[key];
        }
        if (recentScansRef.current[barcode] && now - recentScansRef.current[barcode] < 3000) {
            setScanStatus({ type: 'error', message: 'Already Scanned: ' + barcode });
            setIsErrorLocked(true);
            playSound('error');
            return;
        }

        let item = orderData.find(i => i.barcode === barcode);

        // Fallback: check salesOrders by AWB only (not order ref — outbound scan must be real AWB)
        if (!item) {
            const order = salesOrders.find(o =>
                o.awb && o.awb.toUpperCase() === barcode
            );
            if (order) {
                const newEntry = {
                    barcode,
                    courier: order.courier || order.platform || 'COURIER',
                    expectedQty: 1, // 1 AWB = 1 box
                    scannedQty: 0,
                    orderNumber: order.ref,
                    shopName: order.platform,
                };
                const updatedData = [...orderData, newEntry];
                updateAndSyncData(updatedData);
                item = newEntry;
            }
        }

        if (!item) {
            setScanStatus({ type: 'error', message: 'Unknown Barcode: ' + barcode });
            setIsErrorLocked(true);
            playSound('error');
            return;
        }

        if (item.scannedQty >= item.expectedQty) {
            setScanStatus({ type: 'error', message: 'Already Scanned: ' + barcode });
            setIsErrorLocked(true);
            playSound('error');
            return;
        }

        // Mark scanned in ref immediately (before state update propagates)
        recentScansRef.current[barcode] = now;

        const updatedData = orderData.map(i => i.barcode === barcode ? { ...i, scannedQty: i.scannedQty + 1, lastScanned: now } : i);
        updateAndSyncData(updatedData);

        const courier = (item.courier || 'KISS').toUpperCase();
        let bin = 'MISC';
        let color = 'bg-slate-500';
        let border = 'border-slate-400';

        if (courier.includes('FLASH')) { bin = '1'; color = 'bg-yellow-500'; border = 'border-yellow-400'; }
        else if (courier.includes('SHOPEE') || courier.includes('KERRY')) { bin = '2'; color = 'bg-orange-500'; border = 'border-orange-400'; }
        else if (courier.includes('J&T')) { bin = '3'; color = 'bg-red-500'; border = 'border-red-400'; }
        else if (courier.includes('POST')) { bin = '4'; color = 'bg-pink-500'; border = 'border-pink-400'; }

        setScanBinHint({ bin, label: courier, color, border });
        setLastScans(prev => [{ barcode, status: 'OK', time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
        playSound('success');
        logActivity('scan', { barcode });

        // Auto create + post invoice after AWB scan
        const scannedOrder = salesOrders.find(o => o.awb?.toUpperCase() === barcode);
        if (scannedOrder && apiConfigs?.odoo?.enabled && !apiConfigs?.odoo?.useMock) {
            const pickingRef = scannedOrder.odooPickingId || scannedOrder.ref;
            createInvoiceFromPicking(apiConfigs.odoo, pickingRef)
                .then(result => {
                    if (result.status === 'success' && result.invoiceName) {
                        addToast(`Invoice ${result.invoiceName} created & posted`, 'success');
                    }
                })
                .catch(err => {
                    console.warn('Auto-invoice after scan failed:', err.message);
                });
        }
        txRing?.emit?.('scan', { barcode, courier, bin });
    };

    // Dispatch & Signature
    const clearSignature = () => {
        const c = canvasRef.current;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        setSignatureEmpty(true);
    };

    const startDrawing = (e) => {
        isDrawing.current = true;
        setSignatureEmpty(false);
        const { offsetX, offsetY } = e.nativeEvent.touches ? { offsetX: e.nativeEvent.touches[0].clientX - canvasRef.current.getBoundingClientRect().left, offsetY: e.nativeEvent.touches[0].clientY - canvasRef.current.getBoundingClientRect().top } : e.nativeEvent;
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
    };

    const draw = (e) => {
        if (!isDrawing.current) return;
        const { offsetX, offsetY } = e.nativeEvent.touches ? { offsetX: e.nativeEvent.touches[0].clientX - canvasRef.current.getBoundingClientRect().left, offsetY: e.nativeEvent.touches[0].clientY - canvasRef.current.getBoundingClientRect().top } : e.nativeEvent;
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const endDrawing = () => { isDrawing.current = false; };

    const handleDispatchSubmit = () => {
        const matchCourier = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();
        const batch = { id: activeOrderId, timestamp: new Date().toLocaleString(), courier: dispatchCourier, items: orderData.filter(i => i.scannedQty > 0 && matchCourier(i.courier || 'KISS', dispatchCourier)) };
        setHistoryData([batch, ...historyData]);
        updateAndSyncData(orderData.filter(i => !(i.scannedQty > 0 && matchCourier(i.courier || 'KISS', dispatchCourier))));
        setDispatchCourier('');
        clearSignature();
        setActiveOrderId('BATCH-' + new Date().getTime());
        addToast('Batch Dispatched Successfully');
        logActivity('dispatch', { courier: batch.courier, items: batch.items.length });
        txRing?.emit?.('dispatch', { courier: batch.courier, count: batch.items.length, batchId: batch.id });
    };

    // Excel Logic
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const validation = validateFileUpload(file);
        if (!validation.valid) {
            addToast(validation.error, 'error');
            return;
        }
        setUploadedFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            setSheetNames(wb.SheetNames);
            setExcelData(wb);
            handleSheetSelect(wb.SheetNames[0], wb);
        };
        reader.readAsBinaryString(file);
    };

    const handleSheetSelect = (name, wbInstance = excelData) => {
        setSelectedSheet(name);
        const sheet = wbInstance.Sheets[name];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (data.length > 0) {
            setExcelHeaders(data[0]);
            const autoMapping = { barcode: '', courier: '', orderNumber: '', shopName: '' };
            data[0].forEach(h => {
                const s = String(h).toLowerCase();
                if (s.includes('track') || s.includes('barcode')) autoMapping.barcode = h;
                if (s.includes('courier')) autoMapping.courier = h;
                if (s.includes('order')) autoMapping.orderNumber = h;
                if (s.includes('shop') || s.includes('platform')) autoMapping.shopName = h;
            });
            setColumnMapping(autoMapping);
        }
    };

    const processImport = () => {
        setIsProcessingImport(true);
        setTimeout(() => {
            const sheet = excelData.Sheets[selectedSheet];
            const rows = XLSX.utils.sheet_to_json(sheet);
            const newItems = rows.map(r => ({
                barcode: String(r[columnMapping.barcode] || '').trim(),
                courier: r[columnMapping.courier] || 'Unknown',
                orderNumber: r[columnMapping.orderNumber] || '',
                shopName: r[columnMapping.shopName] || '',
                expectedQty: 1,
                scannedQty: 0
            })).filter(i => i.barcode);

            updateAndSyncData([...orderData, ...newItems]);
            setIsImportModalOpen(false);
            setIsProcessingImport(false);
            addToast(`Imported ${newItems.length} records`);
            logActivity('import', { count: newItems.length });
        }, 1000);
    };

    const syncPlatformOrders = async () => {
        setIsProcessingImport(true);
        try {
            const result = await apiSyncAllPlatforms(apiConfigs.odoo);
            // Deduplicate by ref to prevent duplicates on re-sync
            const dedup = (prev, newOrders) => {
                const existingRefs = new Set(prev.map(o => o.ref));
                return [...prev, ...newOrders.filter(o => !existingRefs.has(o.ref))];
            };
            if (result.shopee) setSalesOrders(prev => dedup(prev, result.shopee));
            if (result.lazada) setSalesOrders(prev => dedup(prev, result.lazada));
            if (result.tiktok) setSalesOrders(prev => dedup(prev, result.tiktok));
            addToast(`Synced ${result.total || 0} orders from platforms`);
        } catch (err) {
            addToast('Platform sync failed: ' + err.message, 'error');
        } finally {
            setIsProcessingImport(false);
        }
    };

    // Stock Frozen flag — check if any Full Count session has freezeStock enabled
    const stockFrozen = useMemo(() => {
        try {
            const sessions = JSON.parse(localStorage.getItem('wms_fullcount_sessions') || '[]');
            return sessions.some(s => s.status !== 'closed' && s.settings?.freezeStock);
        } catch { return false; }
    }, []);

    // Calculated Stats
    const totalExpected = useMemo(() => orderData.reduce((s, i) => s + i.expectedQty, 0), [orderData]);
    const totalScanned = useMemo(() => orderData.reduce((s, i) => s + i.scannedQty, 0), [orderData]);
    const progressPercent = totalExpected > 0 ? Math.round((totalScanned / totalExpected) * 100) : 0;

    // UPH Calculation
    const uph = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = activityLogs.filter(l => new Date(l.timestamp).toISOString().split('T')[0] === today && l.action === 'scan');
        if (todayLogs.length === 0) return 0;
        const first = Math.min(...todayLogs.map(l => l.timestamp));
        const last = Math.max(...todayLogs.map(l => l.timestamp));
        const hours = (last - first) / 3600000;
        return hours > 0.016 ? Math.round(todayLogs.length / hours) : todayLogs.length;
    }, [activityLogs]);

    const dailyBoxUsage = useMemo(() => activityLogs.filter(l => new Date(l.timestamp).toISOString().split('T')[0] === new Date().toISOString().split('T')[0] && (l.action === 'box' || l.action === 'box-handheld' || l.action === 'box-pos')).length, [activityLogs]);

    // Delayed Orders / SLA
    // Calculate actual delayed orders (pending for > 4 hours)
    const totalDelayed = useMemo(() => {
        const now = Date.now();
        return salesOrders.filter(o => o.status === 'pending' && o.createdAt && (now - o.createdAt) > 4 * 3600000).length;
    }, [salesOrders]);
    const courierDistributionData = useMemo(() => {
        const dist = orderData.reduce((acc, curr) => {
            const name = curr.courier || 'KISS';
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(dist).map(([name, value]) => ({ name, value }));
    }, [orderData]);

    // Calculate delayed orders by actual platform
    const delayedOrdersData = useMemo(() => {
        const now = Date.now();
        const delayed = salesOrders.filter(o => o.status === 'pending' && o.createdAt && (now - o.createdAt) > 4 * 3600000);
        const platformColors = { 'Shopee Express': '#fbbf24', 'Lazada Express': '#3b82f6', 'TikTok Shop': '#ec4899' };
        const dist = {};
        delayed.forEach(o => {
            const p = o.platform || 'Other';
            dist[p] = (dist[p] || 0) + 1;
        });
        return Object.entries(dist).map(([platform, count]) => ({
            platform, count, fill: platformColors[platform] || '#8b5cf6'
        }));
    }, [salesOrders]);

    const filteredListData = useMemo(() => {
        const s = debouncedSearch.toLowerCase();
        return orderData.filter(i => (i.barcode || '').toLowerCase().includes(s) || (i.orderNumber || '').toLowerCase().includes(s));
    }, [orderData, debouncedSearch]);

    const paginatedListData = useMemo(() => {
        return filteredListData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    }, [filteredListData, currentPage]);

    const totalPages = Math.ceil(filteredListData.length / ITEMS_PER_PAGE);

    const readyToDispatchCouriers = useMemo(() => {
        const dist = orderData.filter(i => i.scannedQty > 0).reduce((acc, curr) => {
            const name = curr.courier || 'KISS';
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(dist).map(([name, count]) => ({ name, count }));
    }, [orderData]);

    // Keyboard Shortcuts
    useEffect(() => {
        const keys = (e) => {
            if (e.key === 'F1') { e.preventDefault(); setActiveTab('pick'); }
            if (e.key === 'F2') { e.preventDefault(); setActiveTab('pack'); }
            if (e.key === 'F3') { e.preventDefault(); setActiveTab('scan'); }
            if (e.key === 'F4') { e.preventDefault(); setActiveTab('dispatch'); }
            if (isErrorLocked && e.key === ' ') {
                e.preventDefault();
                setIsErrorLocked(false);
                setScanStatus(null);
                setScanBinHint(null);
            }
        };
        window.addEventListener('keydown', keys);
        return () => window.removeEventListener('keydown', keys);
    }, [isErrorLocked]);

    if (!user) return <Login t={t} username={username} setUsername={setUsername} password={password} setPassword={setPassword} isLoading={isLoading} error={error} handleLogin={handleLogin} language={language} setLanguage={setLanguage} />;

    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isHandheld = isMobileDevice || (window.innerWidth < 768 && 'ontouchstart' in window);
    // Handheld: send max 200 active orders (strip images) + total count for display
    const activeOrders = salesOrders.filter(o => ['pending','picking','picked','packing','packed'].includes(o.status));
    const handheldOrders = activeOrders.slice(0, 200).map(o => ({ ...o, items: o.items?.map(({ image, ...rest }) => rest) }));
    const handheldTotalCount = activeOrders.length;
    if (isHandheld) return <HandheldLayout user={user} handleLogout={handleLogout} salesOrders={handheldOrders} setSalesOrders={setSalesOrders} allSalesOrders={salesOrders} totalOrderCount={handheldTotalCount} selectedPickOrder={selectedPickOrder} setSelectedPickOrder={setSelectedPickOrder} handlePickScanSubmit={handlePickScanSubmit} pickScanInput={pickScanInput} setPickScanInput={setPickScanInput} pickInputRef={pickInputRef} playSound={playSound} logActivity={logActivity} addToast={addToast} handleFulfillmentAndAWB={handleFulfillmentAndAWB} isProcessingAPI={isProcessingAPI} apiConfigs={apiConfigs} setApiConfigs={setApiConfigs} inventory={inventory} printAwbLabel={printAwbLabel} syncPlatformOrders={syncPlatformOrders} isProcessingImport={isProcessingImport} syncStatus={syncStatus} syncNow={syncStatus.syncNow} activityLogs={activityLogs} />;

    return (
        <div className="flex h-screen font-sans" style={{ backgroundColor: '#f8f9fa', color: '#212529' }}>
            <Sidebar t={t} user={user} userRole={userRole} activeTab={activeTab} setActiveTab={setActiveTab} tabInfo={tabInfo} rolesInfo={rolesInfo} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} syncStatus={syncStatus} activeCompanies={activeCompanies} setActiveCompanies={setActiveCompanies} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Odoo 18 Top Navbar — white bg, 46px, matches kissgroupdatacenter.com style */}
                <header className="shrink-0 flex items-center justify-between px-5 z-40"
                    style={{ height: '46px', backgroundColor: '#ffffff', borderBottom: '1px solid #dee2e6' }}>
                    <div className="flex items-center gap-2">
                        {/* Breadcrumb: Apps > Page */}
                        <span className="text-xs" style={{ color: '#adb5bd' }}>WMS Pro</span>
                        <span style={{ color: '#dee2e6', fontSize: '12px' }}>/</span>
                        <h2 className="text-sm font-semibold" style={{ color: '#212529' }}>
                            {t('tab' + activeTab.charAt(0).toUpperCase() + activeTab.slice(1))}
                        </h2>
                        <div className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: syncStatus.isOnline ? '#d4edda' : '#f8d7da' }}>
                            <div className={`w-1.5 h-1.5 rounded-full ${syncStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-[10px] font-medium" style={{ color: syncStatus.isOnline ? '#155724' : '#721c24' }}>
                                {syncStatus.isOnline ? 'Connected' : 'Offline'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeTab === 'scan' && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: '#d1ecf1', color: '#0c5460' }}>
                                Live Outbound
                            </span>
                        )}
                        {userRole === 'admin' && (
                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors"
                                style={{ backgroundColor: '#ffffff', color: '#714B67', border: '1px solid #dee2e6' }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0e8ed'; e.currentTarget.style.borderColor = '#714B67'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#dee2e6'; }}
                            >
                                <Upload className="w-3.5 h-3.5" /> Import
                            </button>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ color: '#adb5bd', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                            #{activeOrderId.split('-')[1]}
                        </span>
                    </div>
                </header>

                {/* Session timeout warning banner */}
                {sessionWarning && (
                    <div className="shrink-0 flex items-center justify-between px-4 py-2 text-xs font-medium"
                        style={{ backgroundColor: '#fff3cd', color: '#856404', borderBottom: '1px solid #ffc107' }}>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Session expires in {sessionWarning.minutesLeft} minute{sessionWarning.minutesLeft !== 1 ? 's' : ''}.</span>
                        </div>
                        <button onClick={() => { refreshSession(); setSessionWarning(null); }}
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ backgroundColor: '#ffc107', color: '#212529' }}>
                            Stay logged in
                        </button>
                    </div>
                )}

                {/* Page breadcrumb / title bar */}
                <div className="shrink-0 px-6 py-2.5 flex items-center gap-2 border-b" style={{ backgroundColor: '#ffffff', borderColor: '#dee2e6' }}>
                    <h1 className="text-sm font-semibold" style={{ color: '#212529' }}>
                        {t('tab' + activeTab.charAt(0).toUpperCase() + activeTab.slice(1))}
                    </h1>
                    {syncStatus.lastSyncTime && (
                        <span className="text-[11px] ml-2" style={{ color: '#adb5bd' }}>
                            {t('lastSync')}: {new Date(syncStatus.lastSyncTime).toLocaleTimeString()}
                        </span>
                    )}
                </div>

                <main className="flex-1 overflow-y-auto p-5 custom-scrollbar relative z-30" style={{ backgroundColor: '#f8f9fa' }}>
                    {activeTab === 'dashboard' && <Dashboard t={t} totalExpected={totalExpected} totalScanned={totalScanned} uph={uph} dailyBoxUsage={dailyBoxUsage} totalDelayed={totalDelayed} courierDistributionData={courierDistributionData} progressPercent={progressPercent} delayedOrdersData={delayedOrdersData} userRole={userRole} activityLogs={activityLogs} isDarkMode={isDarkMode} salesOrders={salesOrders} inventory={inventory} waves={waves} invoices={invoices} user={user} />}
                    {activeTab === 'pick' && <Pick salesOrders={salesOrders} selectedPickOrder={selectedPickOrder} setSelectedPickOrder={setSelectedPickOrder} syncPlatformOrders={syncPlatformOrders} isProcessingImport={isProcessingImport} handlePickScanSubmit={handlePickScanSubmit} pickScanInput={pickScanInput} setPickScanInput={setPickScanInput} pickInputRef={pickInputRef} inventory={inventory} clearDummyOrders={clearDummyOrders} onCreateSOInOdoo={handleCreateSOInOdoo} isCreatingSO={isCreatingSO} stockFrozen={stockFrozen} />}
                    {activeTab === 'pack' && <Pack salesOrders={salesOrders} selectedPackOrder={selectedPackOrder} setSelectedPackOrder={setSelectedPackOrder} handlePackScanSubmit={handlePackScanSubmit} packScanInput={packScanInput} setPackScanInput={setPackScanInput} packInputRef={packInputRef} handleBoxSelect={handleBoxSelect} isProcessingAPI={isProcessingAPI} packAwbInput={packAwbInput} setPackAwbInput={setPackAwbInput} packAwbRef={packAwbRef} handleAwbConfirmScan={handleAwbConfirmScan} printAwbLabel={printAwbLabel} stockFrozen={stockFrozen} boxUsageLog={boxUsageLog} addToast={addToast} logActivity={logActivity} user={user} />}
                    {activeTab === 'handheldPack' && <HandheldPack salesOrders={salesOrders} setSalesOrders={setSalesOrders} playSound={playSound} logActivity={logActivity} addToast={addToast} boxUsageLog={boxUsageLog} setBoxUsageLog={setBoxUsageLog} handleFulfillmentAndAWB={handleFulfillmentAndAWB} isProcessingAPI={isProcessingAPI} apiConfigs={apiConfigs} />}
                    {activeTab === 'posPack' && <POSPack salesOrders={salesOrders} setSalesOrders={setSalesOrders} playSound={playSound} logActivity={logActivity} addToast={addToast} handleFulfillmentAndAWB={handleFulfillmentAndAWB} isProcessingAPI={isProcessingAPI} boxUsageLog={boxUsageLog} setBoxUsageLog={setBoxUsageLog} printAwbLabel={printAwbLabel} />}
                    {activeTab === 'scan' && <Scan currentBatchId={activeOrderId.split('-')[1]} totalScanned={totalScanned} totalExpected={totalExpected} progressPercent={progressPercent} inputRef={inputRef} scanInput={scanInput} setScanInput={setScanInput} handleScan={handleScan} scanBinHint={scanBinHint} lastScans={lastScans} orderData={orderData} />}
                    {activeTab === 'list' && <List t={t} searchInput={searchInput} setSearchInput={setSearchInput} paginatedListData={paginatedListData} currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} ITEMS_PER_PAGE={ITEMS_PER_PAGE} filteredListData={filteredListData} />}
                    {activeTab === 'dispatch' && <Dispatch readyToDispatchCouriers={readyToDispatchCouriers} dispatchCourier={dispatchCourier} setDispatchCourier={setDispatchCourier} clearSignature={clearSignature} canvasRef={canvasRef} startDrawing={startDrawing} draw={draw} endDrawing={endDrawing} signatureEmpty={signatureEmpty} handleDispatchSubmit={handleDispatchSubmit} />}
                    {activeTab === 'report' && <Reports reportViewMode={reportViewMode} setReportViewMode={setReportViewMode} reportFilterCourier={reportFilterCourier} setReportFilterCourier={setReportFilterCourier} orderData={orderData} reportFilterBatchId={reportFilterBatchId} setReportFilterBatchId={setReportFilterBatchId} historyData={historyData} courierBatches={{}} orderId={activeOrderId} salesOrders={salesOrders} activityLogs={activityLogs} inventory={inventory} invoices={invoices} onSaveArchive={saveEodArchive} />}
                    {activeTab === 'users' && <Users t={t} userRole={userRole} newUserName={newUserName} setNewUserName={setNewUserName} newUserUsername={newUserUsername} setNewUserUsername={setNewUserUsername} newUserRole={newUserRole} setNewUserRole={setNewUserRole} handleAddUser={handleAddUser} rolesInfo={rolesInfo} users={users} handleResetPassword={handleResetPassword} handleDeleteUser={handleDeleteUser} />}
                    {activeTab === 'inventory' && <Inventory inventory={inventory} addToast={addToast} syncStatus={syncStatus} apiConfigs={apiConfigs} />}
                    {activeTab === 'cycleCount' && <CycleCount inventory={inventory} activityLogs={activityLogs} salesOrders={salesOrders} addToast={addToast} user={user} users={users} logActivity={logActivity} apiConfigs={apiConfigs} />}
                    {activeTab === 'gwp' && <GWPManager inventory={inventory} addToast={addToast} logActivity={logActivity} user={user} apiConfigs={apiConfigs} />}
                    {activeTab === 'sorting' && <Sorting salesOrders={salesOrders} waves={waves} setWaves={setWaves} addToast={addToast} />}
                    {activeTab === 'fulfillment' && <Fulfillment salesOrders={salesOrders} handleFulfillmentAndAWB={handleFulfillmentAndAWB} isProcessingAPI={isProcessingAPI} addToast={addToast} />}
                    {activeTab === 'platformMonitor' && <PlatformMonitor salesOrders={salesOrders} addToast={addToast} syncStatus={syncStatus} apiConfigs={apiConfigs} activityLogs={activityLogs} inventory={inventory} users={users} orders={orderData} />}
                    {activeTab === 'invoice' && <Invoice invoices={invoices} setInvoices={setInvoices} salesOrders={salesOrders} addToast={addToast} />}
                    {activeTab === 'settings' && <Settings t={t} language={language} setLanguage={setLanguage} userRole={userRole} apiConfigs={apiConfigs} setApiConfigs={setApiConfigs} workDate={workDate} setWorkDate={setWorkDate} triggerConfirm={triggerConfirm} updateAndSyncData={updateAndSyncData} showAlert={showAlert} syncStatus={syncStatus} />}
                    {activeTab === 'teamPerformance' && <TeamPerformance activityLogs={activityLogs} orders={orderData} users={users} t={t} onSelectWorker={(w) => setSelectedWorker(w)} workerOkrData={workerOkrData} />}
                    {activeTab === 'slaTracker' && <SLATracker activityLogs={activityLogs} orders={orderData} salesOrders={salesOrders} onSelectWorker={(w) => setSelectedWorker(w)} t={t} />}
                    {activeTab === 'timeAttendance' && <TimeAttendance user={user} users={users} userRole={userRole} addToast={addToast} logActivity={logActivity} />}
                    {activeTab === 'kpiAssessment' && <KPIAssessment user={user} users={users} activityLogs={activityLogs} salesOrders={salesOrders} addToast={addToast} logActivity={logActivity} workerOkrData={workerOkrData} />}
                    {activeTab === 'chat' && <ClaudeChat t={t} apiConfigs={apiConfigs} setActiveTab={setActiveTab} />}
                    {activeTab === 'aiAnalyzer' && <AIAnalyzer language={language} addToast={addToast} activityLogs={activityLogs} inventory={inventory} orders={salesOrders} users={users} invoices={invoices} apiConfigs={apiConfigs} />}
                    {activeTab === 'marketIntelligence' && <MarketIntelligence language={language} addToast={addToast} />}
                    {activeTab === 'activityHistory' && <ActivityHistory language={language} />}
                    {activeTab === 'txRing' && <TxDebugPanel notifications={txRing.notifications} unreadCount={txRing.unreadCount} onVerifyChain={txRing.verifyChain} />}
                    {activeTab === 'manual' && <Manual />}
                </main>

                {/* Procedure Help Panel */}
                <ProcedurePanel activeTab={activeTab} userRole={userRole} language={language} />

                {/* Worker Performance Detail Panel */}
                {selectedWorker && <WorkerPerformance activityLogs={activityLogs} worker={selectedWorker} users={users} onClose={() => setSelectedWorker(null)} t={t} />}
            </div>

            {/* Modals & Toasts */}
            {isImportModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}>
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col font-sans" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div className="px-5 py-3.5 flex justify-between items-center" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                                <Upload className="w-4 h-4" style={{ color: '#714B67' }} /> Import Master Data
                            </h2>
                            <button onClick={() => setIsImportModalOpen(false)} className="p-1 rounded transition-colors hover:bg-gray-200" style={{ color: '#6c757d' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            <div className="relative border-2 border-dashed rounded p-8 text-center cursor-pointer transition-colors group" style={{ borderColor: '#dee2e6' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                            >
                                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" id="excel-upload" />
                                <div className="flex flex-col items-center gap-3 pointer-events-none">
                                    <div className="p-3 rounded" style={{ backgroundColor: '#f0e8ed' }}>
                                        <FileSpreadsheet className="w-7 h-7" style={{ color: '#714B67' }} />
                                    </div>
                                    <div>
                                        <span className="text-sm font-semibold block mb-0.5" style={{ color: '#212529' }}>Drop Excel file here or click to browse</span>
                                        <span className="text-xs" style={{ color: '#6c757d' }}>{uploadedFileName || 'Supports .xlsx, .xls, .csv'}</span>
                                    </div>
                                </div>
                            </div>

                            {sheetNames.length > 0 && (
                                <div className="space-y-4 animate-slide-up">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#6c757d' }}>Select Sheet</label>
                                        <select value={selectedSheet} onChange={e => handleSheetSelect(e.target.value)} className="odoo-input w-full">
                                            {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    {excelHeaders.length > 0 && (
                                        <div className="p-4 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6c757d' }}>Column Mapping</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {['barcode', 'courier', 'orderNumber', 'shopName'].map(field => (
                                                    <div key={field}>
                                                        <label className="text-xs font-semibold mb-1 block capitalize" style={{ color: '#495057' }}>
                                                            {field === 'barcode' ? 'Tracking / Barcode *' : field}
                                                        </label>
                                                        <select value={columnMapping[field]} onChange={e => setColumnMapping({ ...columnMapping, [field]: e.target.value })} className="odoo-input w-full">
                                                            <option value="">-- Ignore --</option>
                                                            {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <button onClick={() => setIsImportModalOpen(false)} className="odoo-btn odoo-btn-secondary">Cancel</button>
                            <button onClick={processImport} disabled={!columnMapping.barcode || isProcessingImport} className="odoo-btn odoo-btn-primary disabled:opacity-50 flex items-center gap-1.5">
                                {isProcessingImport ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null} Start Import
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isRoleModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}>
                    <div className="w-full max-w-sm font-sans" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <h2 className="text-sm font-semibold" style={{ color: '#212529' }}>Switch Role</h2>
                            <p className="text-xs mt-0.5" style={{ color: '#6c757d' }}>Select your operational department</p>
                        </div>
                        <div className="p-4 space-y-1.5">
                            {Object.entries(rolesInfo).map(([roleKey, roleInfo]) => (
                                <button
                                    key={roleKey}
                                    onClick={() => { setUserRole(roleKey); setIsRoleModalOpen(false); }}
                                    className="w-full p-3 flex items-center gap-3 rounded text-left transition-colors text-sm"
                                    style={{
                                        border: `1px solid ${userRole === roleKey ? '#714B67' : '#dee2e6'}`,
                                        backgroundColor: userRole === roleKey ? '#f9f5f8' : '#ffffff',
                                        color: '#212529',
                                    }}
                                    onMouseEnter={e => { if (userRole !== roleKey) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                    onMouseLeave={e => { if (userRole !== roleKey) e.currentTarget.style.backgroundColor = '#ffffff'; }}
                                >
                                    <div className="p-1.5 rounded shrink-0" style={{ backgroundColor: userRole === roleKey ? '#f0e8ed' : '#f8f9fa' }}>
                                        <span className="[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-[#714B67]">{roleInfo.icon}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-xs" style={{ color: '#212529' }}>{roleInfo.label}</div>
                                        <div className="text-[11px]" style={{ color: '#6c757d' }}>{roleInfo.desc}</div>
                                    </div>
                                    {userRole === roleKey && <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#714B67' }} />}
                                </button>
                            ))}
                        </div>
                        <div className="px-4 py-3" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <button onClick={() => setIsRoleModalOpen(false)} className="odoo-btn odoo-btn-secondary w-full justify-center">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {isErrorLocked && (
                <div className="fixed inset-0 bg-red-600 flex flex-col items-center justify-center p-6 z-[120] text-white text-center animate-pulse-fast font-sans">
                    <AlertTriangle className="w-24 h-24 mb-6 opacity-90 drop-shadow-md" />
                    <h1 className="text-5xl font-black mb-2 uppercase tracking-tight drop-shadow-md">Alert</h1>
                    <p className="text-2xl font-semibold mb-12 opacity-90">{scanStatus?.message}</p>
                    <button onClick={() => { setIsErrorLocked(false); setScanStatus(null); setScanBinHint(null); }} className="bg-white text-red-600 px-10 py-4 rounded-2xl text-lg font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                        <Unlock className="w-6 h-6" /> Press Spacebar to Unlock
                    </button>
                </div>
            )}

            {/* Password Change Modal (first login or forced reset) — cannot be bypassed when isFirstLogin */}
            {(showPasswordChange || user?.isFirstLogin) && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[120] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.75)' }}>
                    <div className="w-full max-w-sm font-sans" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <h2 className="text-sm font-semibold" style={{ color: '#212529' }}>Change Password Required</h2>
                            <p className="text-xs mt-0.5" style={{ color: '#6c757d' }}>Please set a new password to continue</p>
                        </div>
                        <div className="p-5 space-y-3">
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: '#495057' }}>New Password</label>
                                <input type="password" value={newPwInput}
                                    onChange={e => { setNewPwInput(e.target.value); setPwStrength(validatePasswordStrength(e.target.value)); }}
                                    className="w-full px-3 py-2 text-sm rounded" placeholder="Minimum 8 characters"
                                    style={{ border: '1px solid #ced4da', outline: 'none' }}
                                    onFocus={e => e.target.style.borderColor = '#714B67'}
                                    onBlur={e => e.target.style.borderColor = '#ced4da'} />
                            </div>
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: '#495057' }}>Confirm Password</label>
                                <input type="password" value={confirmPwInput}
                                    onChange={e => setConfirmPwInput(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded" placeholder="Re-enter password"
                                    style={{ border: '1px solid #ced4da', outline: 'none' }}
                                    onFocus={e => e.target.style.borderColor = '#714B67'}
                                    onBlur={e => e.target.style.borderColor = '#ced4da'} />
                            </div>
                            {/* Strength indicator */}
                            {pwStrength && newPwInput && (
                                <div>
                                    <div className="flex gap-1 mb-1">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="h-1.5 flex-1 rounded-full" style={{
                                                backgroundColor: pwStrength.score >= i
                                                    ? pwStrength.strength === 'strong' ? '#28a745'
                                                    : pwStrength.strength === 'medium' ? '#ffc107' : '#dc3545'
                                                    : '#dee2e6'
                                            }} />
                                        ))}
                                    </div>
                                    <div className="text-[10px] font-medium" style={{
                                        color: pwStrength.strength === 'strong' ? '#28a745'
                                            : pwStrength.strength === 'medium' ? '#856404' : '#dc3545'
                                    }}>
                                        Strength: {pwStrength.strength.charAt(0).toUpperCase() + pwStrength.strength.slice(1)}
                                    </div>
                                    {pwStrength.errors.length > 0 && (
                                        <ul className="mt-1 space-y-0.5">
                                            {pwStrength.errors.map((err, i) => (
                                                <li key={i} className="text-[10px]" style={{ color: '#dc3545' }}>- {err}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                            {confirmPwInput && newPwInput !== confirmPwInput && (
                                <p className="text-[10px]" style={{ color: '#dc3545' }}>Passwords do not match</p>
                            )}
                        </div>
                        <div className="px-5 py-3 flex justify-end" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <button onClick={handlePasswordChange}
                                disabled={!pwStrength?.valid || newPwInput !== confirmPwInput}
                                className="px-4 py-2 text-xs font-semibold rounded transition-colors disabled:opacity-50"
                                style={{ backgroundColor: '#714B67', color: '#ffffff', border: '1px solid #714B67' }}>
                                Set Password
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmModal.open && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[110] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}>
                    <div className="w-full max-w-sm font-sans" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            {confirmModal.type === 'danger'
                                ? <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#dc3545' }} />
                                : <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#28a745' }} />}
                            <h3 className="text-sm font-semibold" style={{ color: '#212529' }}>{confirmModal.title}</h3>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-sm leading-relaxed" style={{ color: '#6c757d' }}>{confirmModal.message}</p>
                        </div>
                        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            {!confirmModal.isAlert && <button onClick={() => setConfirmModal({ open: false })} className="odoo-btn odoo-btn-secondary">Cancel</button>}
                            <button
                                onClick={() => { if (confirmModal.onConfirm) confirmModal.onConfirm(); setConfirmModal({ open: false }); }}
                                className="odoo-btn"
                                style={{ backgroundColor: confirmModal.type === 'danger' ? '#dc3545' : '#714B67', color: '#ffffff', borderColor: confirmModal.type === 'danger' ? '#dc3545' : '#714B67' }}
                            >
                                {confirmModal.isAlert ? 'Got it' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Odoo-style toast notifications */}
            <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className="animate-slide-in-right flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium"
                        style={{
                            backgroundColor: toast.type === 'error' ? '#dc3545' : '#28a745',
                            color: '#ffffff',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            minWidth: '200px',
                        }}
                    >
                        {toast.type === 'error'
                            ? <AlertCircle className="w-4 h-4 shrink-0" />
                            : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        {toast.msg}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default App;
