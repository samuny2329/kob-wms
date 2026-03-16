import React from 'react';
import { Printer, Info } from 'lucide-react';

const Reports = ({ reportViewMode, setReportViewMode, reportFilterCourier, setReportFilterCourier, orderData, reportFilterBatchId, setReportFilterBatchId, historyData, courierBatches, orderId }) => {

    let displayReportData = {};
    let currentReportOrderId = orderId;

    if (reportViewMode === 'current') {
        const activeScans = orderData.filter(i => i.scannedQty > 0);
        if (reportFilterCourier === 'All') {
            displayReportData = activeScans.reduce((acc, curr) => {
                const name = curr.courier || 'KISS';
                if (!acc[name]) acc[name] = [];
                acc[name].push(curr);
                return acc;
            }, {});
        } else {
            const filtered = activeScans.filter(i => (i.courier || 'KISS') === reportFilterCourier);
            if (filtered.length > 0) displayReportData = { [reportFilterCourier]: filtered };
            currentReportOrderId = courierBatches[reportFilterCourier] || orderId;
        }
    } else {
        const selectedBatch = historyData.find(h => h.id === reportFilterBatchId);
        if (selectedBatch && selectedBatch.items) {
            currentReportOrderId = selectedBatch.id;
            const batchItems = selectedBatch.items;
            displayReportData = batchItems.reduce((acc, curr) => {
                const name = curr.courier || 'KISS';
                if (!acc[name]) acc[name] = [];
                acc[name].push(curr);
                return acc;
            }, {});
        }
    }

    const handleExportPDF = () => {
        const element = document.getElementById('printable-area');
        if (!element || !window.html2pdf) return;
        element.classList.add('generating-pdf');
        const opt = { margin: 0, filename: `Manifest_${currentReportOrderId}.pdf`, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        window.html2pdf().set(opt).from(element).save().then(() => element.classList.remove('generating-pdf')).catch(() => element.classList.remove('generating-pdf'));
    };

    return (
        <div className="flex flex-col items-center animate-slide-up pb-10 w-full">
            <div className="w-full print-hide mb-5 flex flex-wrap gap-4 items-end" style={{ maxWidth: '210mm', backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', padding: '16px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Data Source</label>
                    <select value={reportViewMode} onChange={e => setReportViewMode(e.target.value)} className="odoo-input" style={{ width: '160px' }}>
                        <option value="current">Current Session</option>
                        <option value="history">History Batch</option>
                    </select>
                </div>

                {reportViewMode === 'current' && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Courier Filter</label>
                        <select value={reportFilterCourier} onChange={e => setReportFilterCourier(e.target.value)} className="odoo-input" style={{ width: '192px' }}>
                            <option value="All">All Couriers</option>
                            {Array.from(new Set(orderData.filter(i => i.scannedQty > 0).map(i => i.courier || 'KISS'))).map(c => (<option key={c} value={c}>{c}</option>))}
                        </select>
                    </div>
                )}

                {reportViewMode === 'history' && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Select Batch</label>
                        <select value={reportFilterBatchId} onChange={e => setReportFilterBatchId(e.target.value)} className="odoo-input" style={{ width: '256px' }}>
                            <option value="">-- Select --</option>
                            {historyData.map(h => (<option key={h.id} value={h.id}>{h.id} ({h.timestamp})</option>))}
                        </select>
                    </div>
                )}

                <div className="ml-auto">
                    <button onClick={handleExportPDF} className="odoo-btn" style={{ backgroundColor: '#714B67', color: '#ffffff', borderColor: '#714B67' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#5a3d52'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#714B67'}
                    >
                        <Printer className="w-4 h-4" /> Export PDF
                    </button>
                </div>
            </div>

            <div id="printable-area" className="page bg-white shadow-md border border-slate-200 relative overflow-hidden text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-[20mm]">
                <div className="absolute top-0 left-0 w-full h-2 bg-slate-900 print:bg-slate-900"></div>

                <div className="flex justify-between items-start pb-6 border-b-[3px] border-slate-900 mb-8 mt-4">
                    <div>
                        <div className="font-black text-3xl text-slate-900 tracking-tighter">KISS OF BEAUTY</div>
                        <div className="text-slate-500 text-sm font-bold mt-1 uppercase tracking-[0.2em]">Outbound Manifest</div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                        <div className="text-sm font-bold font-mono text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md inline-block">{currentReportOrderId}</div>
                        <div className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-widest">Generated: {new Date().toLocaleString('th-TH')}</div>
                    </div>
                </div>

                {Object.entries(displayReportData).map(([courier, items]) => (
                    <div key={courier} className="mb-10 page-break-inside-avoid">
                        <h3 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-slate-900 block rounded-full"></span>
                            {courier} <span className="text-sm font-medium text-slate-400 border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-md">({items.length} items)</span>
                        </h3>

                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-100 border-y-2 border-slate-900 text-slate-800">
                                    <th className="p-3 text-center font-bold w-12 text-xs uppercase tracking-wider">No.</th>
                                    <th className="p-3 text-left font-bold text-xs uppercase tracking-wider">Barcode / Tracking Number</th>
                                    <th className="p-3 text-left font-bold text-xs uppercase tracking-wider">Order Ref</th>
                                    <th className="p-3 text-left font-bold text-xs uppercase tracking-wider">Platform</th>
                                    <th className="p-3 text-center font-bold w-24 text-xs uppercase tracking-wider">Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {items.map((item, idx) => (
                                    <tr key={idx} className="text-slate-800">
                                        <td className="p-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                                        <td className="p-3 font-mono font-bold tracking-tight">{item.barcode}</td>
                                        <td className="p-3">{item.orderNumber || '-'}</td>
                                        <td className="p-3 text-xs font-semibold"><span className="bg-slate-100 px-2 py-1 rounded">{item.shopName || 'System'}</span></td>
                                        <td className="p-3 text-center font-bold">{item.scannedQty}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}

                {Object.keys(displayReportData).length === 0 && (
                    <div className="text-center py-24 text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">No scan data available for this selection.</div>
                )}

                {Object.keys(displayReportData).length > 0 && (
                    <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-10 page-break-inside-avoid">
                        <div className="text-center">
                            <div className="h-20 border-b border-dashed border-slate-400 mb-2 mx-10"></div>
                            <div className="text-xs font-bold text-slate-800 uppercase tracking-widest">Handed Over By (Sender)</div>
                            <div className="text-[10px] text-slate-400 mt-1">Date: ____ / ____ / ______</div>
                        </div>
                        <div className="text-center">
                            <div className="h-20 border-b border-dashed border-slate-400 mb-2 mx-10"></div>
                            <div className="text-xs font-bold text-slate-800 uppercase tracking-widest">Received By (Courier)</div>
                            <div className="text-[10px] text-slate-400 mt-1">Date: ____ / ____ / ______</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
