import React, { useState } from 'react';
import { HelpCircle, X, ListOrdered, Target, Lightbulb, Users, ChevronRight } from 'lucide-react';
import { PROCEDURE_CONFIG } from '../data/procedureConfig';
import { KPI_PILLARS } from '../constants';

function getPillarColor(pillarKey) {
    const pillar = KPI_PILLARS.find(p => p.key === pillarKey);
    return pillar?.color || '#6b7280';
}

function getPillarLabel(pillarKey) {
    const pillar = KPI_PILLARS.find(p => p.key === pillarKey);
    return pillar?.label || pillarKey;
}

export default function ProcedurePanel({ activeTab }) {
    const [isOpen, setIsOpen] = useState(false);
    const config = PROCEDURE_CONFIG[activeTab];

    if (!config) return null;

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
                        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{config.title}</h2>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto h-[calc(100%-60px)] px-5 py-4 space-y-5">
                    {/* Purpose */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-[#dee2e6] dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{config.purpose}</p>
                    </div>

                    {/* Procedure Steps */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                            <ChevronRight className="w-4 h-4" style={{ color: '#714B67' }} />
                            Procedure Steps
                        </h3>
                        <ol className="space-y-2">
                            {config.steps.map((step, i) => (
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
                                KPI Metrics
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
                                Tips
                            </h3>
                            <ul className="space-y-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                                {config.tips.map((tip, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                                        <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                                        <span>{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Roles */}
                    {config.role?.length > 0 && (
                        <div className="pt-2 border-t border-[#dee2e6] dark:border-gray-700">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <Users className="w-3.5 h-3.5" />
                                <span>Used by: {config.role.join(', ')}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
