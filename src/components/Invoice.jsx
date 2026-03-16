import React, { useState, useMemo } from 'react';
import { Receipt, Search, Check, FileText, DollarSign, CheckCircle2, Clock, Send, ChevronRight, ChevronDown, X, RefreshCw, Printer } from 'lucide-react';
import { PLATFORM_LABELS } from '../constants';
import { PlatformBadge } from './PlatformLogo';

const Invoice = ({ invoices, setInvoices, salesOrders, addToast }) => {
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoices, setSelectedInvoices] = useState([]);
    const [expandedInvoice, setExpandedInvoice] = useState(null);
    const [isPosting, setIsPosting] = useState(false);

    // Auto-generate invoices for orders that are 'rts' but don't have invoices
    const uninvoicedOrders = useMemo(() => {
        const invoicedRefs = new Set((invoices || []).map(inv => inv.orderRef));
        return salesOrders.filter(o => o.status === 'rts' && !invoicedRefs.has(o.ref));
    }, [salesOrders, invoices]);

    const filteredInvoices = useMemo(() => {
        let list = [...(invoices || [])];
        if (statusFilter !== 'all') {
            list = list.filter(inv => inv.status === statusFilter);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(inv =>
                inv.orderRef?.toLowerCase().includes(q) ||
                inv.customer?.toLowerCase().includes(q) ||
                inv.id?.toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [invoices, statusFilter, searchQuery]);

    const stats = useMemo(() => {
        const all = invoices || [];
        const draft = all.filter(i => i.status === 'draft');
        const posted = all.filter(i => i.status === 'posted');
        const paid = all.filter(i => i.status === 'paid');
        const totalRevenue = posted.concat(paid).reduce((s, i) => s + (i.total || 0), 0);
        const todayRevenue = posted.concat(paid).filter(i => {
            const d = new Date(i.createdAt);
            const today = new Date();
            return d.toDateString() === today.toDateString();
        }).reduce((s, i) => s + (i.total || 0), 0);
        return { total: all.length, draft: draft.length, posted: posted.length, paid: paid.length, totalRevenue, todayRevenue };
    }, [invoices]);

    const handleAutoCreateInvoices = () => {
        const newInvoices = uninvoicedOrders.map(order => {
            const totalAmount = order.items.reduce((sum, item) => {
                const qty = item.picked || item.expected || 0;
                const price = item.unitPrice || 299;
                return sum + (qty * price);
            }, 0);
            const tax = Math.round(totalAmount * 0.07);
            return {
                id: 'INV-' + Date.now() + '-' + order.id,
                orderRef: order.ref,
                customer: order.customer,
                platform: order.platform || order.courier,
                items: order.items.map(i => ({ sku: i.sku, name: i.name, qty: i.picked || i.expected, unitPrice: i.unitPrice || 299 })),
                subtotal: totalAmount,
                tax,
                total: totalAmount + tax,
                status: 'draft',
                createdAt: Date.now()
            };
        });
        if (newInvoices.length > 0) {
            setInvoices(prev => [...newInvoices, ...(prev || [])]);
            addToast(`Created ${newInvoices.length} draft invoices`);
        }
    };

    const handlePostInvoice = (invoiceId) => {
        setIsPosting(true);
        setTimeout(() => {
            setInvoices(prev => (prev || []).map(inv =>
                inv.id === invoiceId ? { ...inv, status: 'posted', postedAt: Date.now() } : inv
            ));
            setIsPosting(false);
            addToast('Invoice posted to Odoo Accounting');
        }, 500);
    };

    const handleBulkPost = () => {
        setIsPosting(true);
        setTimeout(() => {
            setInvoices(prev => (prev || []).map(inv =>
                selectedInvoices.includes(inv.id) && inv.status === 'draft' ? { ...inv, status: 'posted', postedAt: Date.now() } : inv
            ));
            addToast(`${selectedInvoices.length} invoices posted`);
            setSelectedInvoices([]);
            setIsPosting(false);
        }, 800);
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

    const statusConfig = {
        draft: { bg: '#fff8e1', color: '#856404', border: '#ffc107', label: 'Draft', icon: <Clock className="w-3 h-3" /> },
        posted: { bg: '#e8f4fd', color: '#17a2b8', border: '#17a2b8', label: 'Posted', icon: <Send className="w-3 h-3" /> },
        paid: { bg: '#e8f5e9', color: '#28a745', border: '#28a745', label: 'Paid', icon: <CheckCircle2 className="w-3 h-3" /> },
    };

    return (
        <div className="w-full animate-slide-up">
            {/* Revenue KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-4" style={{ backgroundColor: '#714B67', borderRadius: '4px', color: '#ffffff' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ opacity: 0.75 }}>Total Revenue</p>
                    <p className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()}</p>
                    <p className="text-[10px] mt-0.5" style={{ opacity: 0.55 }}>{stats.posted + stats.paid} invoices</p>
                </div>
                <div className="p-4" style={{ backgroundColor: '#017E84', borderRadius: '4px', color: '#ffffff' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ opacity: 0.75 }}>Today</p>
                    <p className="text-2xl font-bold">{stats.todayRevenue.toLocaleString()}</p>
                    <p className="text-[10px] mt-0.5" style={{ opacity: 0.55 }}>THB</p>
                </div>
                <div className="p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ffc107', borderLeft: '3px solid #ffac00', borderRadius: '4px' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#856404' }}>Draft</p>
                    <p className="text-2xl font-bold" style={{ color: '#856404' }}>{stats.draft}</p>
                </div>
                <div className="p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #b8e0c4', borderLeft: '3px solid #28a745', borderRadius: '4px' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#28a745' }}>Paid</p>
                    <p className="text-2xl font-bold" style={{ color: '#28a745' }}>{stats.paid}</p>
                </div>
            </div>

            {/* Main Table */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <div className="flex flex-wrap gap-3 justify-between items-center">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded flex items-center justify-center text-white shrink-0" style={{ backgroundColor: '#714B67' }}>
                                <Receipt className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold" style={{ color: '#212529' }}>Invoices</h2>
                                <p className="text-[11px]" style={{ color: '#6c757d' }}>{filteredInvoices.length} invoices</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {uninvoicedOrders.length > 0 && (
                                <button onClick={handleAutoCreateInvoices} className="odoo-btn odoo-btn-secondary flex items-center gap-1.5 text-xs" style={{ color: '#714B67', borderColor: '#714B67' }}>
                                    <FileText className="w-3.5 h-3.5" /> Auto-create ({uninvoicedOrders.length})
                                </button>
                            )}
                            {selectedInvoices.length > 0 && (
                                <button onClick={handleBulkPost} disabled={isPosting} className="odoo-btn odoo-btn-primary disabled:opacity-50 flex items-center gap-1.5 text-xs">
                                    {isPosting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    Post ({selectedInvoices.length})
                                </button>
                            )}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#adb5bd' }} />
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="odoo-input pl-8 w-44" />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-1 mt-2.5">
                        {['all', 'draft', 'posted', 'paid'].map(f => (
                            <button key={f} onClick={() => setStatusFilter(f)}
                                className="odoo-btn text-xs capitalize"
                                style={statusFilter === f
                                    ? { backgroundColor: '#714B67', color: '#ffffff', borderColor: '#714B67' }
                                    : { backgroundColor: 'transparent', color: '#6c757d', borderColor: 'transparent' }}
                            >
                                {f === 'all' ? 'All' : f}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    {filteredInvoices.length === 0 ? (
                        <div className="text-center py-14" style={{ color: '#adb5bd' }}>
                            <Receipt className="w-9 h-9 mx-auto mb-2.5 opacity-20" />
                            <p className="text-sm">{invoices?.length === 0 ? 'No invoices yet' : 'No matching invoices'}</p>
                            {uninvoicedOrders.length > 0 && (
                                <button onClick={handleAutoCreateInvoices} className="mt-2 text-xs font-medium underline" style={{ color: '#714B67' }}>
                                    Create {uninvoicedOrders.length} invoices from shipped orders
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredInvoices.map(inv => {
                            const sc = statusConfig[inv.status] || statusConfig.draft;
                            const pl = PLATFORM_LABELS[inv.platform];
                            const isExpanded = expandedInvoice === inv.id;

                            return (
                                <div key={inv.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                                    <div className="px-4 py-3 flex items-center gap-3 transition-colors"
                                        style={{ backgroundColor: '#ffffff' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                                    >
                                        {inv.status === 'draft' && (
                                            <button onClick={() => toggleSelect(inv.id)} className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{
                                                border: `2px solid ${selectedInvoices.includes(inv.id) ? '#714B67' : '#dee2e6'}`,
                                                backgroundColor: selectedInvoices.includes(inv.id) ? '#714B67' : '#ffffff',
                                                color: '#ffffff',
                                            }}>
                                                {selectedInvoices.includes(inv.id) && <Check className="w-2.5 h-2.5" />}
                                            </button>
                                        )}
                                        {inv.status !== 'draft' && <div className="w-4" />}

                                        <PlatformBadge name={inv.platform} size={28} />

                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-mono font-semibold text-sm" style={{ color: '#714B67' }}>{inv.id}</span>
                                                <span className="odoo-badge text-[10px] flex items-center gap-1" style={{ backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.icon} {sc.label}</span>
                                                {inv.paymentState === 'paid' && <span className="odoo-badge text-[10px]" style={{ backgroundColor: '#e8f5e9', color: '#28a745', border: '1px solid #28a745' }}>In Payment</span>}
                                            </div>
                                            <p className="text-xs truncate" style={{ color: '#6c757d' }}>
                                                {inv.customer}
                                                {inv.orderRef && inv.orderRef !== inv.id && <span className="ml-1">| {inv.orderRef}</span>}
                                                {inv.invoiceDate && <span className="ml-1">| {inv.invoiceDate}</span>}
                                                {inv.dueDate && <span className="ml-1 font-medium" style={{ color: inv.status === 'posted' ? '#856404' : 'inherit' }}>Due: {inv.dueDate}</span>}
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-sm tabular-nums" style={{ color: '#212529' }}>{inv.total?.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                                            <p className="text-[10px]" style={{ color: '#adb5bd' }}>฿ incl. VAT</p>
                                        </div>

                                        {inv.status === 'draft' && (
                                            <button onClick={() => handlePostInvoice(inv.id)} disabled={isPosting} className="odoo-btn disabled:opacity-50 shrink-0 flex items-center gap-1 text-xs" style={{ backgroundColor: '#017E84', color: '#ffffff', borderColor: '#017E84' }}>
                                                <Send className="w-3 h-3" /> Post
                                            </button>
                                        )}
                                        {inv.status === 'posted' && (
                                            <span className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded cursor-not-allowed select-none" style={{ backgroundColor: '#e9ecef', color: '#adb5bd', border: '1px solid #dee2e6' }} title="ยืนยันการชำระเงินใน Odoo">
                                                <DollarSign className="w-3 h-3" /> Paid
                                            </span>
                                        )}

                                        <ChevronRight className={`w-4 h-4 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} style={{ color: '#dee2e6' }} />
                                    </div>

                                    {isExpanded && (
                                        <div className="px-5 pb-4 animate-slide-up" style={{ backgroundColor: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
                                            <table className="w-full text-sm mt-3 odoo-table">
                                                <thead>
                                                    <tr>
                                                        <th className="text-left">Product</th>
                                                        <th className="text-center">SKU</th>
                                                        <th className="text-center">Qty</th>
                                                        <th className="text-right">Unit Price</th>
                                                        <th className="text-right">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {inv.items?.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="font-medium" style={{ color: '#212529' }}>{item.name}</td>
                                                            <td className="text-center font-mono text-xs" style={{ color: '#6c757d' }}>{item.sku}</td>
                                                            <td className="text-center font-semibold" style={{ color: '#212529' }}>{item.qty}</td>
                                                            <td className="text-right font-mono" style={{ color: '#6c757d' }}>{item.unitPrice?.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                                                            <td className="text-right font-semibold" style={{ color: '#212529' }}>{(item.subtotal ?? item.qty * item.unitPrice).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot style={{ borderTop: '2px solid #dee2e6' }}>
                                                    <tr><td colSpan={4} className="py-1.5 text-right text-xs font-semibold" style={{ color: '#6c757d' }}>Subtotal</td><td className="py-1.5 text-right font-semibold" style={{ color: '#212529' }}>{inv.subtotal?.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>
                                                    <tr><td colSpan={4} className="py-1 text-right text-xs font-semibold" style={{ color: '#6c757d' }}>VAT 7%</td><td className="py-1 text-right font-mono" style={{ color: '#6c757d' }}>{inv.tax?.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>
                                                    <tr><td colSpan={4} className="py-1.5 text-right text-sm font-bold" style={{ color: '#714B67' }}>Total (THB)</td><td className="py-1.5 text-right text-base font-bold" style={{ color: '#714B67' }}>{inv.total?.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>
                                                </tfoot>
                                            </table>
                                            <div className="mt-2 flex flex-wrap justify-between items-center gap-2 text-[10px]" style={{ color: '#adb5bd' }}>
                                                <div className="flex gap-3">
                                                    {inv.invoiceDate && <span>Invoice Date: <b style={{color:'#495057'}}>{inv.invoiceDate}</b></span>}
                                                    {inv.dueDate && <span>Due: <b style={{color: inv.status==='posted' ? '#856404' : '#495057'}}>{inv.dueDate}</b></span>}
                                                </div>
                                                <div className="flex gap-3">
                                                    {inv.paymentState && <span style={{textTransform:'capitalize'}}>Payment: <b style={{color:'#495057'}}>{inv.paymentState.replace('_',' ')}</b></span>}
                                                    {inv.paidAt && <span>Paid: {new Date(inv.paidAt).toLocaleDateString('th-TH')}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default Invoice;
