import React from 'react';
import { Search, ChevronLeft, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { getTrackingUrl } from '../utils';

const List = ({ t, searchInput, setSearchInput, paginatedListData, currentPage, totalPages, setCurrentPage, ITEMS_PER_PAGE, filteredListData }) => {
    return (
        <div className="h-full flex flex-col animate-slide-up w-full" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
            <div className="flex flex-wrap gap-4 justify-between items-center shrink-0" style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                <div className="relative" style={{ maxWidth: '320px', width: '100%' }}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#adb5bd' }} />
                    <input
                        placeholder={t('searchPlaceholder')}
                        className="odoo-input"
                        style={{ paddingLeft: '32px', width: '100%', boxSizing: 'border-box' }}
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                <table className="odoo-table w-full">
                    <thead>
                        <tr>
                            <th style={{ width: '60px', textAlign: 'center' }}>No.</th>
                            <th>Tracking / Barcode</th>
                            <th>Courier</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedListData.map((item, idx) => (
                            <tr key={item.barcode}
                                onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = '#f8f9fa'); }}
                                onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = ''); }}
                            >
                                <td style={{ textAlign: 'center', color: '#adb5bd', fontWeight: 500 }}>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                <td>
                                    <a href={getTrackingUrl(item.barcode, item.courier)} target="_blank" rel="noreferrer"
                                        style={{ fontFamily: 'monospace', fontWeight: 700, color: '#714B67', textDecoration: 'none' }}
                                        onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                                        onMouseLeave={e => e.target.style.textDecoration = 'none'}
                                    >{item.barcode}</a>
                                    {item.orderNumber && <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>Order: {item.orderNumber}</div>}
                                </td>
                                <td>
                                    <span className="odoo-badge" style={{ backgroundColor: '#f8f9fa', color: '#495057', border: '1px solid #dee2e6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.courier || 'N/A'}</span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    {item.scannedQty >= item.expectedQty
                                        ? <span className="odoo-badge" style={{ backgroundColor: '#d4edda', color: '#155724', border: '1px solid #c3e6cb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 className="w-3 h-3" /> Scanned</span>
                                        : <span className="odoo-badge" style={{ backgroundColor: '#f8f9fa', color: '#6c757d', border: '1px solid #dee2e6', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock className="w-3 h-3" /> Pending</span>
                                    }
                                </td>
                            </tr>
                        ))}
                        {paginatedListData.length === 0 && (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '48px', color: '#adb5bd', fontWeight: 500 }}>
                                <div className="flex flex-col items-center gap-3"><Search className="w-8 h-8 opacity-30" /> No matching records found</div>
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex justify-between items-center shrink-0" style={{ padding: '10px 16px', borderTop: '1px solid #dee2e6', backgroundColor: '#ffffff' }}>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredListData.length)} of {filteredListData.length}</div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                            style={{ padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#ffffff', cursor: 'pointer', color: '#6c757d', opacity: currentPage === 1 ? 0.4 : 1 }}>
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 700, backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529' }}>{currentPage} / {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                            style={{ padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#ffffff', cursor: 'pointer', color: '#6c757d', opacity: currentPage === totalPages ? 0.4 : 1 }}>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default List;
