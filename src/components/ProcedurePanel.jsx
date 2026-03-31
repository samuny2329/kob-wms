import React, { useState } from 'react';
import { HelpCircle, X, ListOrdered, Target, Lightbulb, Users, ChevronRight, Clock, Shield, BookOpen } from 'lucide-react';
import { PROCEDURE_CONFIG, ROLE_PROCEDURES } from '../data/procedureConfig';
import { KPI_PILLARS } from '../constants';

function getPillarColor(pillarKey) {
    const pillar = KPI_PILLARS.find(p => p.key === pillarKey);
    return pillar?.color || '#6b7280';
}

function getPillarLabel(pillarKey) {
    const pillar = KPI_PILLARS.find(p => p.key === pillarKey);
    return pillar?.label || pillarKey;
}

// Helper: pick Thai or English field
function loc(obj, key, lang) {
    if (lang === 'th' && obj[key + 'Th']) return obj[key + 'Th'];
    return obj[key] || '';
}
function locArr(obj, key, lang) {
    if (lang === 'th' && obj[key + 'Th']?.length) return obj[key + 'Th'];
    return obj[key] || [];
}

export default function ProcedurePanel({ activeTab, userRole, language = 'en' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState('tab'); // 'tab' or 'role'
    const config = PROCEDURE_CONFIG[activeTab];
    const roleSop = ROLE_PROCEDURES[userRole];
    const isTh = language === 'th';

    if (!config && !roleSop) return null;

    return (
        <>
            {/* Floating help button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 flex items-center justify-center rounded-full shadow-lg hover:opacity-90 transition-opacity"
                style={{ width: 44, height: 44, backgroundColor: '#714B67' }}
                title="View Procedure"
            >
                <HelpCircle className="w-5 h-5 text-white" />
            </button>

            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Slide panel */}
            <div
                className={`fixed top-0 right-0 z-[60] h-full w-[380px] max-w-[90vw] bg-white dark:bg-gray-900 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="border-t-4 px-5 py-4 flex items-center justify-between border-b border-[#dee2e6] dark:border-gray-700" style={{ borderTopColor: '#714B67' }}>
                    <div className="flex items-center gap-2">
                        <ListOrdered className="w-5 h-5" style={{ color: '#714B67' }} />
                        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{view === 'role' && roleSop ? loc(roleSop, 'title', language) : loc(config, 'title', language)}</h2>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto h-[calc(100%-60px)] px-5 py-4 space-y-5">
                    {/* Tab/Role toggle */}
                    {roleSop && config && (
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                            <button onClick={() => setView('tab')}
                                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'tab' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-700' : 'text-gray-500'}`}>
                                <BookOpen className="w-3.5 h-3.5" /> {isTh ? 'หน้านี้' : 'This Page'}
                            </button>
                            <button onClick={() => setView('role')}
                                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'role' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-700' : 'text-gray-500'}`}>
                                <Users className="w-3.5 h-3.5" /> {isTh ? 'SOP ประจำวัน' : 'My Daily SOP'}
                            </button>
                        </div>
                    )}

                    {/* ── Role Daily SOP ── */}
                    {(view === 'role' && roleSop) ? (
                        <div className="space-y-4">
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                                <h3 className="text-sm font-bold text-purple-800 dark:text-purple-200">{loc(roleSop, 'title', language)}</h3>
                                <p className="text-[11px] text-purple-600 dark:text-purple-300 mt-0.5">{isTh ? 'กะ' : 'Shift'}: {roleSop.shift}</p>
                            </div>

                            {/* Timeline */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" style={{ color: '#714B67' }} /> {isTh ? 'ตารางงานประจำวัน' : 'Daily Workflow'}
                                </h4>
                                <div className="space-y-1">
                                    {roleSop.dailyWorkflow.map((item, i) => (
                                        <div key={i} className={`flex items-start gap-2 text-xs rounded-md px-2 py-1.5 ${!item.tab ? 'bg-gray-50 dark:bg-gray-800 text-gray-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                            <span className="font-mono text-[10px] text-gray-400 w-10 shrink-0 pt-0.5">{item.time}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-800 dark:text-gray-100">{isTh && item.actionTh ? item.actionTh : item.action}</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{isTh && item.detailTh ? item.detailTh : item.detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* KPI Targets */}
                            {roleSop.kpiTargets?.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                                        <Target className="w-3.5 h-3.5" style={{ color: '#714B67' }} /> {isTh ? 'เป้าหมาย KPI ของคุณ' : 'Your KPI Targets'}
                                    </h4>
                                    <div className="space-y-1.5">
                                        {roleSop.kpiTargets.map((kpi, i) => (
                                            <div key={i} className="rounded border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-800"
                                                style={{ borderLeftWidth: 3, borderLeftColor: getPillarColor(kpi.pillar) }}>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-medium text-gray-800 dark:text-gray-100">{kpi.name}</span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: getPillarColor(kpi.pillar) }}>{kpi.target}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Rules */}
                            {roleSop.rules?.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                                        <Shield className="w-3.5 h-3.5 text-red-500" /> {isTh ? 'กฎที่ต้องปฏิบัติ' : 'Rules'}
                                    </h4>
                                    <ul className="space-y-1 bg-red-50 dark:bg-red-900/10 rounded-lg p-3 border border-red-200 dark:border-red-800">
                                        {roleSop.rules.map((rule, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-red-800 dark:text-red-200">
                                                <span className="text-red-500 shrink-0 mt-0.5">*</span>
                                                <span>{rule}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                    <>
                    {/* Purpose */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-[#dee2e6] dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{loc(config, 'purpose', language)}</p>
                    </div>

                    {/* Procedure Steps */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                            <ChevronRight className="w-4 h-4" style={{ color: '#714B67' }} />
                            {isTh ? 'ขั้นตอนปฏิบัติ' : 'Procedure Steps'}
                        </h3>
                        <ol className="space-y-2">
                            {locArr(config, 'steps', language).map((step, i) => (
                                <li key={i} className="flex gap-3 text-sm">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#714B67' }}>
                                        {i + 1}
                                    </span>
                                    <span className="text-gray-700 dark:text-gray-300 pt-0.5 leading-snug">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* KPI Metrics */}
                    {config.kpiMetrics?.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                                <Target className="w-4 h-4" style={{ color: '#714B67' }} />
                                {isTh ? 'ตัวชี้วัด KPI' : 'KPI Metrics'}
                            </h3>
                            <div className="space-y-2">
                                {config.kpiMetrics.map((metric, i) => (
                                    <div
                                        key={i}
                                        className="rounded-lg border border-[#dee2e6] dark:border-gray-700 p-3 bg-white dark:bg-gray-800"
                                        style={{ borderLeftWidth: 4, borderLeftColor: getPillarColor(metric.pillar) }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{metric.name}</span>
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: getPillarColor(metric.pillar) }}>
                                                {metric.target}
                                            </span>
                                        </div>
                                        <span className="text-[11px] text-gray-400 mt-1 inline-block">{getPillarLabel(metric.pillar)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tips */}
                    {config.tips?.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                                <Lightbulb className="w-4 h-4 text-amber-500" />
                                {isTh ? 'เคล็ดลับ' : 'Tips'}
                            </h3>
                            <ul className="space-y-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                                {locArr(config, 'tips', language).map((tip, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                                        <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                                        <span>{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Roles */}
                    {config?.role?.length > 0 && (
                        <div className="pt-2 border-t border-[#dee2e6] dark:border-gray-700">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <Users className="w-3.5 h-3.5" />
                                <span>{isTh ? 'ใช้โดย' : 'Used by'}: {config.role.join(', ')}</span>
                            </div>
                        </div>
                    )}
                    </>
                    )}
                </div>
            </div>
        </>
    );
}
