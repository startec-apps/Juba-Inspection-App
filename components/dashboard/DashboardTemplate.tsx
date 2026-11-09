import React, { useMemo } from 'react';
import { InspectionData } from '../../types';
import HistoryView from '../../views/HistoryView';
import { CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Plus, Calendar, Activity } from 'lucide-react';

interface DashboardTemplateProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    colorTheme: 'emerald' | 'orange' | 'rose' | 'purple' | 'blue' | 'slate';
    stats: { total: number; passRate: number | string };
    startNewInspection: () => void;
    fetchHistory: (force?: boolean) => void;
    searchDatabase?: (term: string) => Promise<InspectionData[]>;
    isLoadingHistory: boolean;
    historyList: InspectionData[];
    onViewReport: (item: InspectionData) => void;
    onEditRecord?: (item: InspectionData) => void;
    onDeleteRecord?: (item: InspectionData) => Promise<void> | void;
    onPrint: (item: InspectionData) => void;
    userRole?: string;
    titlePrefix?: string;
    isLocked?: boolean;
    docNo?: string;
    moduleKey?: string;
}

const DashboardTemplate: React.FC<DashboardTemplateProps> = ({ 
    title, 
    description,
    icon, 
    colorTheme = 'slate',
    stats, 
    startNewInspection, 
    fetchHistory, 
    searchDatabase, 
    isLoadingHistory, 
    historyList = [], 
    onViewReport, 
    onEditRecord,
    onDeleteRecord,
    userRole,
    isLocked = false,
    docNo = 'MNT-F-015',
    moduleKey = 'general'
}) => {
    const cleanRole = String(userRole || '').trim().toLowerCase();
    const isUserAdmin = cleanRole === 'admin' || cleanRole === 'superadmin' || cleanRole === 'super admin';
    const canCreate = (isUserAdmin || cleanRole === 'inspector') && !isLocked;

    // Real computed module analytics
    const metrics = useMemo(() => {
        const total = historyList.length;
        if (total === 0) {
            return {
                total: 0,
                passRate: typeof stats.passRate === 'number' ? stats.passRate : Number(stats.passRate || 100),
                passedCount: 0,
                flaggedCount: 0,
                lastAuditDate: 'No audits yet'
            };
        }

        let passed = 0;
        let flagged = 0;
        let mostRecentTime = 0;

        historyList.forEach(item => {
            const isPass = item.safeToLoad === 'Yes' || (item.rate !== undefined && Number(item.rate) >= 3);
            if (isPass) {
                passed++;
            } else {
                flagged++;
            }

            const itemTime = new Date(item.timestamp || 0).getTime();
            if (itemTime > mostRecentTime) {
                mostRecentTime = itemTime;
            }
        });

        const calculatedPassRate = Math.round((passed / total) * 100);

        let lastAuditDate = 'N/A';
        if (mostRecentTime > 0) {
            const dateObj = new Date(mostRecentTime);
            const now = Date.now();
            const diffHours = (now - mostRecentTime) / (3600 * 1000);
            if (diffHours < 24) {
                lastAuditDate = `Today, ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            } else if (diffHours < 48) {
                lastAuditDate = `Yesterday, ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            } else {
                lastAuditDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
        }

        return {
            total,
            passRate: calculatedPassRate,
            passedCount: passed,
            flaggedCount: flagged,
            lastAuditDate
        };
    }, [historyList, stats]);

    // Theme color styles
    const themeStyles = useMemo(() => {
        switch (colorTheme) {
            case 'rose':
            case 'orange':
                return {
                    badge: 'bg-amber-50 text-amber-800 border-amber-200/80',
                    iconBg: 'bg-amber-500/10 text-amber-700 border-amber-200',
                    primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
                    accentText: 'text-amber-700'
                };
            case 'purple':
                return {
                    badge: 'bg-purple-50 text-purple-800 border-purple-200/80',
                    iconBg: 'bg-purple-500/10 text-purple-700 border-purple-200',
                    primaryBtn: 'bg-purple-700 hover:bg-purple-800 text-white shadow-purple-700/20',
                    accentText: 'text-purple-700'
                };
            case 'slate':
            case 'blue':
            default:
                return {
                    badge: 'bg-blue-50 text-blue-800 border-blue-200/80',
                    iconBg: 'bg-blue-500/10 text-blue-700 border-blue-200',
                    primaryBtn: 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20',
                    accentText: 'text-blue-700'
                };
        }
    }, [colorTheme]);

    return (
        <div className="w-full max-w-6xl mx-auto space-y-3 sm:space-y-3.5 animate-fadeIn px-1 sm:px-2 overflow-x-hidden">
            {/* Header: Executive Module Banner with Clean Hierarchy */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 w-full">
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border ${themeStyles.iconBg}`}>
                        {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight uppercase truncate">
                                {title}
                            </h1>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60 uppercase shrink-0">
                                {docNo}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                            {description || 'Fleet roadworthiness, mechanical safety & compliance tracking'}
                        </p>
                    </div>
                </div>

                {/* Primary Action Buttons: Compact, Touch-Optimized */}
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                    {canCreate && (
                        <button
                            type="button"
                            onClick={startNewInspection}
                            className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${themeStyles.primaryBtn}`}
                        >
                            <Plus size={15} strokeWidth={2.5} />
                            <span>New Inspection</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => fetchHistory(true)}
                        disabled={isLoadingHistory}
                        className="px-3 py-2.5 sm:py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider active:scale-95 disabled:opacity-50"
                        title="Sync latest inspections from database"
                    >
                        <RefreshCw size={13} className={isLoadingHistory ? 'animate-spin text-blue-600' : 'text-slate-500'} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Executive KPI Metric Strip: Responsive 2x2 on mobile, 4-column on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 w-full">
                {/* 1. Total Audits */}
                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                            Total Audits
                        </span>
                        <span className="font-mono tabular-nums text-lg sm:text-xl font-bold text-slate-900 block truncate mt-0.5">
                            {metrics.total}
                        </span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Activity size={16} />
                    </div>
                </div>

                {/* 2. Compliance Pass Rate */}
                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                            Pass Rate
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-mono tabular-nums text-lg sm:text-xl font-bold text-emerald-600">
                                {metrics.passRate}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                                ({metrics.passedCount}/{metrics.total})
                            </span>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <ShieldCheck size={16} />
                    </div>
                </div>

                {/* 3. Defects / Attention */}
                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                            Flagged Defects
                        </span>
                        <span className={`font-mono tabular-nums text-lg sm:text-xl font-bold block truncate mt-0.5 ${
                            metrics.flaggedCount > 0 ? 'text-rose-600' : 'text-slate-700'
                        }`}>
                            {metrics.flaggedCount}
                        </span>
                    </div>
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                        metrics.flaggedCount > 0 
                            ? 'bg-rose-50 border-rose-100 text-rose-600' 
                            : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}>
                        <AlertTriangle size={16} />
                    </div>
                </div>

                {/* 4. Most Recent Audit */}
                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                            Recent Activity
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 block truncate mt-0.5" title={metrics.lastAuditDate}>
                            {metrics.lastAuditDate}
                        </span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Calendar size={16} />
                    </div>
                </div>
            </div>

            {/* Inspection Records List & Filter View */}
            <HistoryView 
                activeModule={title}
                isLoadingHistory={isLoadingHistory}
                historyList={historyList}
                fetchHistory={fetchHistory}
                onViewReport={onViewReport}
                onEditRecord={isUserAdmin ? onEditRecord : undefined}
                onDeleteRecord={isUserAdmin ? onDeleteRecord : undefined}
                userRole={userRole}
                searchDatabase={searchDatabase || (async () => [])}
            />
        </div>
    );
};

export default DashboardTemplate;
