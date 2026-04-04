import React, { useState, useMemo } from 'react';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import {
    Receipt, Search, Check, FileText, DollarSign, CheckCircle2, Clock, Send,
    ChevronRight, ChevronDown, X, RefreshCw, Printer, Plus, Calendar,
    ArrowUpDown, ChevronLeft, AlertTriangle, Filter, Download, TrendingUp,
    Eye, Package, Truck, FileCheck
} from 'lucide-react';
import { PLATFORM_LABELS } from '../constants';
import { PlatformBadge } from './PlatformLogo';
import { postInvoice as odooPostInvoice } from '../services/odooApi';

const ITEMS_PER_PAGE = 10;

const Invoice = ({ invoices, setInvoices, salesOrders, addToast, apiConfigs }) => {
    const odooConfig = apiConfigs?.odoo;
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoices, setSelectedInvoices] = useState([]);
    const [expandedInvoice, setExpandedInvoice] = useState(null);
    const [isPosting, setIsPosting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState('date');
    const [sortDir, setSortDir] = useState('desc');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Auto-generate invoices for orders that are 'rts' but don't have invoices
    const filteredInvoices = useMemo(() => {
        let list = [...(invoices || [])];
        if (statusFilter !== 'all') {
            if (statusFilter === 'overdue') {
                const now = Date.now();
                list = list.filter(inv => inv.status === 'posted' && inv.dueDate && new Date(inv.dueDate).getTime() < now);
            } else {
                list = list.filter(inv => inv.status === statusFilter);
            }
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(inv =>
                inv.orderRef?.toLowerCase().includes(q) ||
                inv.customer?.toLowerCase().includes(q) ||
                inv.invoiceName?.toLowerCase().includes(q) ||
                String(inv.id)?.toLowerCase().includes(q) ||
                inv.odooOrigin?.toLowerCase().includes(q)
            );
        }
        if (dateFrom) {
            const from = new Date(dateFrom).getTime();
            list = list.filter(inv => (inv.createdAt || 0) >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo).getTime() + 86400000;
            list = list.filter(inv => (inv.createdAt || 0) < to);
        }
        // Sort
        list.sort((a, b) => {
            let va, vb;
            if (sortField === 'date') { va = a.createdAt || 0; vb = b.createdAt || 0; }
            else if (sortField === 'amount') { va = a.total || 0; vb = b.total || 0; }
            else if (sortField === 'customer') { va = a.customer || ''; vb = b.customer || ''; }
            else if (sortField === 'due') { va = a.dueDate || ''; vb = b.dueDate || ''; }
            else { va = a.createdAt || 0; vb = b.createdAt || 0; }
            if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortDir === 'asc' ? va - vb : vb - va;
        });
        return list;
    }, [invoices, statusFilter, searchQuery, dateFrom, dateTo, sortField, sortDir]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE));
    const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Reset page when filter changes
    useMemo(() => { setCurrentPage(1); }, [statusFilter, searchQuery, dateFrom, dateTo]);

    const stats = useMemo(() => {
        const all = invoices || [];
        const draft = all.filter(i => i.status === 'draft');
        const posted = all.filter(i => i.status === 'posted');
        const paid = all.filter(i => i.status === 'paid');
        const totalRevenue = posted.concat(paid).reduce((s, i) => s + (i.total || 0), 0);
        const pendingAmount = draft.concat(posted).reduce((s, i) => s + (i.total || 0), 0);
        const now = Date.now();
        const thisMonth = new Date();
        const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).getTime();
        const postedThisMonth = posted.filter(i => (i.postedAt || i.createdAt || 0) >= monthStart);
        const revenueThisMonth = postedThisMonth.reduce((s, i) => s + (i.total || 0), 0);
        const paidThisMonth = paid.filter(i => (i.paidAt || i.createdAt || 0) >= monthStart).reduce((s, i) => s + (i.total || 0), 0);
        const overdue = posted.filter(i => i.dueDate && new Date(i.dueDate).getTime() < now);
        return {
            total: all.length, draft: draft.length, posted: posted.length, paid: paid.length,
            totalRevenue, pendingAmount, paidThisMonth, revenueThisMonth,
            postedThisMonthCount: postedThisMonth.length,
            overdueCount: overdue.length
        };
    }, [invoices]);

    const handlePostInvoice = async (invoiceId) => {
        setIsPosting(true);
        try {
            if (odooConfig?.enabled && typeof invoiceId === 'number') {
                await odooPostInvoice(odooConfig, invoiceId);
            }
            setInvoices(prev => (prev || []).map(inv =>
                inv.id === invoiceId ? { ...inv, status: 'posted', postedAt: Date.now() } : inv
            ));
            addToast('Invoice posted to Odoo Accounting', 'success');
        } catch (err) {
            addToast(`Failed to post invoice: ${err.message}`, 'error');
        } finally {
            setIsPosting(false);
        }
    };

    const handleBulkPost = async () => {
        setIsPosting(true);
        try {
            if (odooConfig?.enabled) {
                for (const invId of selectedInvoices) {
                    if (typeof invId === 'number') {
                        try { await odooPostInvoice(odooConfig, invId); } catch { /* continue others */ }
                    }
                }
            }
            setInvoices(prev => (prev || []).map(inv =>
                selectedInvoices.includes(inv.id) && inv.status === 'draft' ? { ...inv, status: 'posted', postedAt: Date.now() } : inv
            ));
            addToast(`${selectedInvoices.length} invoices posted`, 'success');
            setSelectedInvoices([]);
        } catch (err) {
            addToast(`Bulk post failed: ${err.message}`, 'error');
        } finally {
            setIsPosting(false);
        }
    };

    const handleMarkPaid = (invoiceId) => {
        setInvoices(prev => (prev || []).map(inv =>
            inv.id === invoiceId ? { ...inv, status: 'paid', paidAt: Date.now() } : inv
        ));
        addToast('Invoice marked as paid');
    };

    const toggleSelect = (invId) => {
        setSelectedInvoices(prev => prev.includes(invId) ? prev.filter(id => id !== invId) : [...prev, invId]);
    };

    const toggleSelectAll = () => {
        const draftIds = paginatedInvoices.filter(inv => inv.status === 'draft').map(inv => inv.id);
        if (draftIds.every(id => selectedInvoices.includes(id))) {
            setSelectedInvoices(prev => prev.filter(id => !draftIds.includes(id)));
        } else {
            setSelectedInvoices(prev => [...new Set([...prev, ...draftIds])]);
        }
    };

    const toggleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const fmtCurrency = (v) => (v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const isOverdue = (inv) => inv.status === 'posted' && inv.dueDate && new Date(inv.dueDate).getTime() < Date.now();

    const fmtDate = formatDate;

    // Pipeline progress for timeline dots
    const getTimeline = (inv) => {
        // Pick, Pack, Ship always done (invoice exists from shipped order)
        const stages = [
            { label: 'Pick', done: true },
            { label: 'Pack', done: true },
            { label: 'Ship', done: true },
            { label: 'Inv', done: true },
            { label: 'Post', done: inv.status === 'posted' || inv.status === 'paid' },
        ];
        return stages;
    };

    // Export CSV
    const handleExportCSV = () => {
        const target = selectedInvoices.length > 0
            ? (invoices || []).filter(i => selectedInvoices.includes(i.id))
            : filteredInvoices;
        const header = 'Invoice #,Order Ref,Customer,Platform,Date,Amount,VAT,Total,Status\n';
        const rows = target.map(inv =>
            `"${inv.id}","${inv.orderRef || ''}","${inv.customer || ''}","${inv.platform || ''}","${inv.invoiceDate || ''}",${inv.subtotal || 0},${inv.tax || 0},${inv.total || 0},"${inv.status}"`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoices_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        addToast(`Exported ${target.length} invoices to CSV`);
    };

    const statusTabs = [
        { key: 'draft', label: 'JUST CREATED', count: stats.draft, pulse: stats.draft > 0 },
        { key: 'posted', label: 'POSTED', count: stats.posted },
        { key: 'paid', label: 'PAID', count: stats.paid },
        { key: 'all', label: 'ALL', count: stats.total },
    ];

    const allDraftsSelected = paginatedInvoices.filter(i => i.status === 'draft').length > 0
        && paginatedInvoices.filter(i => i.status === 'draft').every(i => selectedInvoices.includes(i.id));

    return (
        <div className="w-full animate-fade-in flex flex-col gap-6">

            {/* =========== KPI STRIP (4 cards) =========== */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Invoices */}
                <div className="p-5 rounded-xl flex flex-col justify-between min-h-[100px]"
                    style={{
                        backgroundColor: 'var(--odoo-surface)',
                        borderLeft: '4px solid var(--odoo-purple)',
                        boxShadow: 'var(--odoo-shadow-sm)',
                    }}>
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>
                            Total Invoices
                        </span>
                        <Receipt className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                    </div>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--odoo-text)' }}>
                            {stats.total.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Draft / Pending Post */}
                <div className="p-5 rounded-xl flex flex-col justify-between min-h-[100px]"
                    style={{
                        backgroundColor: 'var(--odoo-surface)',
                        borderLeft: '4px solid var(--odoo-warning)',
                        boxShadow: 'var(--odoo-shadow-sm)',
                    }}>
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>
                            Draft / Pending Post
                        </span>
                        <Clock className="w-5 h-5" style={{ color: 'var(--odoo-warning)' }} />
                    </div>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--odoo-warning)' }}>
                            {stats.draft}
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: 'var(--odoo-text-muted)' }}>
                            {stats.draft > 0 ? 'Needs posting' : 'All clear'}
                        </span>
                    </div>
                </div>

                {/* Posted This Month */}
                <div className="p-5 rounded-xl flex flex-col justify-between min-h-[100px]"
                    style={{
                        backgroundColor: 'var(--odoo-surface)',
                        borderLeft: '4px solid var(--odoo-success)',
                        boxShadow: 'var(--odoo-shadow-sm)',
                    }}>
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>
                            Posted This Month
                        </span>
                        <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--odoo-success)' }} />
                    </div>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--odoo-success)' }}>
                            {stats.postedThisMonthCount}
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: 'var(--odoo-text-muted)' }}>invoices</span>
                    </div>
                </div>

                {/* Revenue This Month */}
                <div className="p-5 rounded-xl flex flex-col justify-between min-h-[100px]"
                    style={{
                        backgroundColor: 'var(--odoo-surface)',
                        borderLeft: '4px solid var(--odoo-purple)',
                        boxShadow: 'var(--odoo-shadow-sm)',
                    }}>
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>
                            Revenue This Month
                        </span>
                        <DollarSign className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-semibold" style={{ color: 'var(--odoo-text-muted)' }}>฿</span>
                            <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--odoo-text)' }}>
                                {fmtCurrency(stats.revenueThisMonth)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* =========== PIPELINE STATUS TABS + SEARCH + FILTERS =========== */}
            <div className="rounded-xl p-2 flex flex-wrap items-center justify-between gap-3"
                style={{
                    backgroundColor: 'var(--odoo-surface)',
                    border: '1px solid var(--odoo-border-ghost)',
                    boxShadow: 'var(--odoo-shadow-sm)',
                }}>
                {/* Tabs */}
                <div className="flex items-center rounded-lg p-1" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                    {statusTabs.map(tab => (
                        <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                            style={statusFilter === tab.key
                                ? { backgroundColor: 'var(--odoo-surface)', color: 'var(--odoo-purple)', boxShadow: 'var(--odoo-shadow-sm)' }
                                : { backgroundColor: 'transparent', color: 'var(--odoo-text-muted)' }
                            }>
                            {tab.pulse && (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                        style={{ backgroundColor: 'var(--odoo-warning)' }} />
                                    <span className="relative inline-flex rounded-full h-2 w-2"
                                        style={{ backgroundColor: 'var(--odoo-warning)' }} />
                                </span>
                            )}
                            {tab.label}
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={statusFilter === tab.key
                                    ? { backgroundColor: 'rgba(113, 75, 103, 0.12)', color: 'var(--odoo-purple)' }
                                    : { backgroundColor: 'var(--odoo-surface-high)', color: 'var(--odoo-text-muted)' }
                                }>{tab.count}</span>
                        </button>
                    ))}
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="flex items-center rounded-lg px-3" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                        <Search className="w-3.5 h-3.5" style={{ color: 'var(--odoo-text-muted)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="bg-transparent border-none py-2 px-2 text-xs focus:ring-0 focus:outline-none w-36 placeholder:text-gray-400"
                            style={{ color: 'var(--odoo-text)' }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="opacity-50 hover:opacity-100">
                                <X className="w-3 h-3" style={{ color: 'var(--odoo-text-secondary)' }} />
                            </button>
                        )}
                    </div>

                    {/* Date range */}
                    <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                        <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--odoo-text-muted)' }} />
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="bg-transparent border-none text-xs focus:ring-0 focus:outline-none w-28"
                            style={{ color: 'var(--odoo-text-secondary)' }} />
                        <span className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>-</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="bg-transparent border-none text-xs focus:ring-0 focus:outline-none w-28"
                            style={{ color: 'var(--odoo-text-secondary)' }} />
                    </div>

                    {/* Sort */}
                    <button onClick={() => toggleSort(sortField)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                        style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)' }}>
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        {sortField === 'date' ? 'Date' : sortField === 'amount' ? 'Amount' : sortField === 'customer' ? 'Customer' : 'Due'}
                        <span className="text-[10px] opacity-60">{sortDir === 'asc' ? 'ASC' : 'DESC'}</span>
                    </button>
                </div>
            </div>

            {/* =========== INVOICE TABLE =========== */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}>

                {/* Table header */}
                <div className="hidden lg:grid items-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
                    style={{
                        gridTemplateColumns: '32px 120px 100px 100px 1fr 80px 90px 70px 60px 70px 80px 100px 80px',
                        backgroundColor: 'var(--odoo-surface-low)',
                        borderBottom: '1px solid var(--odoo-border-ghost)',
                        color: 'var(--odoo-text-muted)',
                    }}>
                    {/* Checkbox */}
                    <div className="flex items-center justify-center">
                        <button onClick={toggleSelectAll}
                            className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
                            style={{
                                border: `2px solid ${allDraftsSelected ? 'var(--odoo-purple)' : 'var(--odoo-border)'}`,
                                backgroundColor: allDraftsSelected ? 'var(--odoo-purple)' : 'transparent',
                            }}>
                            {allDraftsSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>
                    </div>
                    <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:opacity-80 text-left">
                        Invoice # {sortField === 'date' && <ArrowUpDown className="w-3 h-3" />}
                    </button>
                    <div>SO Ref</div>
                    <div>Order Ref</div>
                    <button onClick={() => toggleSort('customer')} className="flex items-center gap-1 hover:opacity-80 text-left">
                        Customer {sortField === 'customer' && <ArrowUpDown className="w-3 h-3" />}
                    </button>
                    <div className="text-center">Platform</div>
                    <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:opacity-80">
                        Date {sortField === 'date' && <ArrowUpDown className="w-3 h-3" />}
                    </button>
                    <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 hover:opacity-80 text-right justify-end">
                        Amount
                    </button>
                    <div className="text-right">VAT</div>
                    <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 hover:opacity-80 text-right justify-end">
                        Total {sortField === 'amount' && <ArrowUpDown className="w-3 h-3" />}
                    </button>
                    <div className="text-center">Status</div>
                    <div className="text-center">Timeline</div>
                    <div className="text-center">Actions</div>
                </div>

                {/* Table body */}
                <div>
                    {filteredInvoices.length === 0 ? (
                        <div className="text-center py-20">
                            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-10" style={{ color: 'var(--odoo-text-muted)' }} />
                            <p className="text-sm font-semibold" style={{ color: 'var(--odoo-text-muted)' }}>
                                {invoices?.length === 0 ? 'No invoices yet' : 'No matching invoices'}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--odoo-text-muted)', opacity: 0.6 }}>
                                {invoices?.length === 0 ? 'Create your first invoice or auto-generate from shipped orders' : 'Try adjusting your search or filters'}
                            </p>
                        </div>
                    ) : (
                        paginatedInvoices.map(inv => {
                            const isExpanded = expandedInvoice === inv.id;
                            const overdue = isOverdue(inv);
                            const timeline = getTimeline(inv);

                            // Status badge config
                            const statusBadge = overdue
                                ? { bg: 'var(--odoo-danger-light)', color: 'var(--odoo-danger)', label: 'OVERDUE', icon: <AlertTriangle className="w-3 h-3" /> }
                                : inv.status === 'draft'
                                    ? { bg: 'var(--odoo-warning-light)', color: 'var(--odoo-warning-dark)', label: 'DRAFT', icon: <Clock className="w-3 h-3" /> }
                                    : inv.status === 'posted'
                                        ? { bg: 'var(--odoo-info-light)', color: 'var(--odoo-info-dark)', label: 'POSTED', icon: <Send className="w-3 h-3" /> }
                                        : { bg: 'var(--odoo-success-light)', color: 'var(--odoo-success-dark)', label: 'PAID', icon: <CheckCircle2 className="w-3 h-3" /> };

                            return (
                                <div key={inv.id} style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                    {/* === Main Row (desktop) === */}
                                    <div className="hidden lg:grid items-center gap-2 px-4 py-3 transition-colors cursor-pointer group"
                                        style={{
                                            gridTemplateColumns: '32px 120px 100px 100px 1fr 80px 90px 70px 60px 70px 80px 100px 80px',
                                            backgroundColor: 'var(--odoo-surface)',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'}
                                        onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                                    >
                                        {/* Checkbox */}
                                        <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                                            {inv.status === 'draft' ? (
                                                <button onClick={() => toggleSelect(inv.id)}
                                                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
                                                    style={{
                                                        border: `2px solid ${selectedInvoices.includes(inv.id) ? 'var(--odoo-purple)' : 'var(--odoo-border)'}`,
                                                        backgroundColor: selectedInvoices.includes(inv.id) ? 'var(--odoo-purple)' : 'transparent',
                                                    }}>
                                                    {selectedInvoices.includes(inv.id) && <Check className="w-2.5 h-2.5 text-white" />}
                                                </button>
                                            ) : <div className="w-4" />}
                                        </div>

                                        {/* Invoice # */}
                                        <div className="min-w-0">
                                            <span className="font-mono font-bold text-xs truncate block" style={{ color: 'var(--odoo-purple)' }}>
                                                {inv.invoiceName || `INV-${inv.id}`}
                                            </span>
                                        </div>

                                        {/* SO Ref */}
                                        <div className="min-w-0">
                                            <span className="font-mono text-[11px] truncate block" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                {inv.odooOrigin || inv.orderRef || '--'}
                                            </span>
                                        </div>

                                        {/* Order Ref (picking ref) */}
                                        <div className="min-w-0">
                                            <span className="font-mono text-[11px] truncate block" style={{ color: 'var(--odoo-text-muted)' }}>
                                                {inv.orderRef || '--'}
                                            </span>
                                        </div>

                                        {/* Customer */}
                                        <div className="min-w-0">
                                            <span className="text-sm font-medium truncate block" style={{ color: 'var(--odoo-text)' }}>
                                                {inv.customer || '--'}
                                            </span>
                                        </div>

                                        {/* Platform badge */}
                                        <div className="flex items-center justify-center">
                                            {inv.platform ? <PlatformBadge name={inv.platform} size={22} /> : <span className="text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>--</span>}
                                        </div>

                                        {/* Date Created */}
                                        <div>
                                            <span className="text-[11px] tabular-nums" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                {fmtDate(inv.invoiceDate || inv.createdAt)}
                                            </span>
                                        </div>

                                        {/* Amount (subtotal) */}
                                        <div className="text-right">
                                            <span className="text-[11px] tabular-nums" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                ฿{fmtCurrency(inv.subtotal)}
                                            </span>
                                        </div>

                                        {/* VAT */}
                                        <div className="text-right">
                                            <span className="text-[11px] tabular-nums" style={{ color: 'var(--odoo-text-muted)' }}>
                                                ฿{fmtCurrency(inv.tax)}
                                            </span>
                                        </div>

                                        {/* Total */}
                                        <div className="text-right">
                                            <span className="font-bold text-xs tabular-nums" style={{ color: 'var(--odoo-text)' }}>
                                                ฿{fmtCurrency(inv.total)}
                                            </span>
                                        </div>

                                        {/* Status badge */}
                                        <div className="flex items-center justify-center">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight"
                                                style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}>
                                                {statusBadge.icon} {statusBadge.label}
                                            </span>
                                        </div>

                                        {/* Timeline mini dots */}
                                        <div className="flex items-center justify-center gap-0.5">
                                            {timeline.map((stage, idx) => (
                                                <div key={idx} className="flex flex-col items-center" title={`${stage.label}: ${stage.done ? 'Done' : 'Pending'}`}>
                                                    <div className="w-2.5 h-2.5 rounded-full flex items-center justify-center"
                                                        style={{
                                                            backgroundColor: stage.done ? 'var(--odoo-success)' : 'var(--odoo-surface-high)',
                                                        }}>
                                                        {stage.done && <Check className="w-1.5 h-1.5 text-white" />}
                                                    </div>
                                                    {idx < timeline.length - 1 && (
                                                        <div className="w-2 h-px" style={{ backgroundColor: stage.done ? 'var(--odoo-success)' : 'var(--odoo-surface-high)' }} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                                            {inv.status === 'draft' && (
                                                <button onClick={() => handlePostInvoice(inv.id)} disabled={isPosting}
                                                    className="px-2.5 py-1 rounded-md text-[10px] font-bold text-white transition-all disabled:opacity-50 flex items-center gap-1"
                                                    style={{ background: 'linear-gradient(135deg, var(--odoo-success), #016268)' }}>
                                                    <Send className="w-3 h-3" /> Post
                                                </button>
                                            )}
                                            {inv.status === 'posted' && (
                                                <button onClick={() => handleMarkPaid(inv.id)}
                                                    className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1"
                                                    style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)', border: '1px solid var(--odoo-border-ghost)' }}>
                                                    <DollarSign className="w-3 h-3" /> Paid
                                                </button>
                                            )}
                                            {inv.status === 'paid' && (
                                                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: 'var(--odoo-text-muted)' }}>
                                                    <CheckCircle2 className="w-3 h-3" />
                                                </span>
                                            )}
                                            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                style={{ color: 'var(--odoo-text-muted)' }} />
                                        </div>
                                    </div>

                                    {/* === Mobile Row === */}
                                    <div className="lg:hidden flex flex-col gap-2 px-4 py-3 cursor-pointer"
                                        style={{ backgroundColor: 'var(--odoo-surface)' }}
                                        onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {inv.status === 'draft' && (
                                                    <button onClick={e => { e.stopPropagation(); toggleSelect(inv.id); }}
                                                        className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                                                        style={{
                                                            border: `2px solid ${selectedInvoices.includes(inv.id) ? 'var(--odoo-purple)' : 'var(--odoo-border)'}`,
                                                            backgroundColor: selectedInvoices.includes(inv.id) ? 'var(--odoo-purple)' : 'transparent',
                                                        }}>
                                                        {selectedInvoices.includes(inv.id) && <Check className="w-2.5 h-2.5 text-white" />}
                                                    </button>
                                                )}
                                                <span className="font-mono font-bold text-xs" style={{ color: 'var(--odoo-purple)' }}>
                                                    {inv.id?.length > 20 ? inv.id.substring(0, 20) + '...' : inv.id}
                                                </span>
                                            </div>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase"
                                                style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}>
                                                {statusBadge.icon} {statusBadge.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium" style={{ color: 'var(--odoo-text)' }}>{inv.customer || '--'}</span>
                                            <span className="font-bold text-sm tabular-nums" style={{ color: 'var(--odoo-text)' }}>฿{fmtCurrency(inv.total)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px]" style={{ color: 'var(--odoo-text-muted)' }}>{fmtDate(inv.invoiceDate || inv.createdAt)}</span>
                                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                {inv.status === 'draft' && (
                                                    <button onClick={() => handlePostInvoice(inv.id)} disabled={isPosting}
                                                        className="px-2.5 py-1 rounded-md text-[10px] font-bold text-white disabled:opacity-50 flex items-center gap-1"
                                                        style={{ background: 'linear-gradient(135deg, var(--odoo-success), #016268)' }}>
                                                        <Send className="w-3 h-3" /> Post
                                                    </button>
                                                )}
                                                <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                    style={{ color: 'var(--odoo-text-muted)' }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* === Expanded detail === */}
                                    {isExpanded && (
                                        <div className="px-6 pb-5 animate-slide-up" style={{ backgroundColor: 'var(--odoo-surface-low)', borderTop: '1px solid var(--odoo-border-ghost)' }}>
                                            <table className="w-full text-sm mt-4">
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid var(--odoo-border-ghost)' }}>
                                                        <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Product</th>
                                                        <th className="text-center py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>SKU</th>
                                                        <th className="text-center py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Qty</th>
                                                        <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Unit Price</th>
                                                        <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {inv.items?.map((item, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                            <td className="py-2.5 font-medium text-sm" style={{ color: 'var(--odoo-text)' }}>{item.name}</td>
                                                            <td className="py-2.5 text-center font-mono text-xs" style={{ color: 'var(--odoo-text-muted)' }}>{item.sku}</td>
                                                            <td className="py-2.5 text-center font-bold text-sm" style={{ color: 'var(--odoo-text)' }}>{item.qty}</td>
                                                            <td className="py-2.5 text-right font-mono text-xs tabular-nums" style={{ color: 'var(--odoo-text-secondary)' }}>฿{fmtCurrency(item.unitPrice)}</td>
                                                            <td className="py-2.5 text-right font-bold text-sm tabular-nums" style={{ color: 'var(--odoo-text)' }}>฿{fmtCurrency(item.subtotal ?? item.qty * item.unitPrice)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr>
                                                        <td colSpan={4} className="py-2 text-right text-xs font-semibold" style={{ color: 'var(--odoo-text-muted)' }}>Subtotal</td>
                                                        <td className="py-2 text-right font-bold tabular-nums" style={{ color: 'var(--odoo-text)' }}>฿{fmtCurrency(inv.subtotal)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan={4} className="py-1 text-right text-xs font-semibold" style={{ color: 'var(--odoo-text-muted)' }}>VAT 7%</td>
                                                        <td className="py-1 text-right font-mono text-sm tabular-nums" style={{ color: 'var(--odoo-text-secondary)' }}>฿{fmtCurrency(inv.tax)}</td>
                                                    </tr>
                                                    <tr style={{ borderTop: '2px solid var(--odoo-border-ghost)' }}>
                                                        <td colSpan={4} className="py-2.5 text-right text-sm font-extrabold" style={{ color: 'var(--odoo-purple)' }}>Total (THB)</td>
                                                        <td className="py-2.5 text-right text-lg font-extrabold tabular-nums" style={{ color: 'var(--odoo-purple)' }}>฿{fmtCurrency(inv.total)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                            <div className="mt-3 flex flex-wrap justify-between items-center gap-2 text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>
                                                <div className="flex gap-4">
                                                    {inv.invoiceDate && <span>Invoice Date: <b style={{ color: 'var(--odoo-text-secondary)' }}>{inv.invoiceDate}</b></span>}
                                                    {inv.dueDate && <span>Due: <b style={{ color: overdue ? 'var(--odoo-danger)' : 'var(--odoo-text-secondary)' }}>{inv.dueDate}</b></span>}
                                                    {inv.odooOrigin && <span>Odoo Origin: <b style={{ color: 'var(--odoo-text-secondary)' }}>{inv.odooOrigin}</b></span>}
                                                </div>
                                                <div className="flex gap-4">
                                                    {inv.paymentState && <span style={{ textTransform: 'capitalize' }}>Payment: <b style={{ color: 'var(--odoo-text-secondary)' }}>{inv.paymentState.replace('_', ' ')}</b></span>}
                                                    {inv.paidAt && <span>Paid: {formatDate(inv.paidAt)}</span>}
                                                    {inv.postedAt && <span>Posted: {formatDate(inv.postedAt)}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* =========== PAGINATION FOOTER =========== */}
                {filteredInvoices.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: 'var(--odoo-surface-low)', borderTop: '1px solid var(--odoo-border-ghost)' }}>
                        <p className="text-xs font-medium" style={{ color: 'var(--odoo-text-muted)' }}>
                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length} invoices
                        </p>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                                style={{ color: 'var(--odoo-text-secondary)' }}>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let page;
                                if (totalPages <= 5) page = i + 1;
                                else if (currentPage <= 3) page = i + 1;
                                else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                                else page = currentPage - 2 + i;
                                return (
                                    <button key={page} onClick={() => setCurrentPage(page)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
                                        style={currentPage === page
                                            ? { background: 'linear-gradient(135deg, var(--odoo-purple), var(--odoo-purple-dark))', color: '#ffffff', boxShadow: 'var(--odoo-shadow-sm)' }
                                            : { color: 'var(--odoo-text-secondary)' }
                                        }>
                                        {page}
                                    </button>
                                );
                            })}
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                                style={{ color: 'var(--odoo-text-secondary)' }}>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* =========== STICKY BOTTOM ACTION BAR =========== */}
            {selectedInvoices.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-6 py-3 flex items-center gap-4"
                    style={{
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                        boxShadow: '0 8px 32px rgba(78, 68, 74, 0.15)',
                    }}>
                    <span className="text-sm font-bold" style={{ color: 'var(--odoo-text)' }}>
                        {selectedInvoices.length} invoice{selectedInvoices.length > 1 ? 's' : ''} selected
                    </span>
                    <div className="w-px h-6" style={{ backgroundColor: 'var(--odoo-border)' }} />
                    <button onClick={handleBulkPost} disabled={isPosting}
                        className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2 hover:opacity-90 active:scale-95"
                        style={{ background: 'linear-gradient(135deg, var(--odoo-purple), var(--odoo-purple-dark))' }}>
                        {isPosting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Post Selected to Odoo
                    </button>
                    <button onClick={handleExportCSV}
                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 hover:opacity-90"
                        style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)', border: '1px solid var(--odoo-border-ghost)' }}>
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                    <button onClick={() => window.print()}
                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 hover:opacity-90"
                        style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)', border: '1px solid var(--odoo-border-ghost)' }}>
                        <Printer className="w-3.5 h-3.5" />
                        Print
                    </button>
                    <button onClick={() => setSelectedInvoices([])}
                        className="p-2 rounded-lg transition-all hover:opacity-70"
                        style={{ color: 'var(--odoo-text-muted)' }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default Invoice;
