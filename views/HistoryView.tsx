import React, { useState, useMemo, useEffect, useRef } from 'react';
import { InspectionData } from '../types';
import { Clock, Calendar, Database, Search, FileText, Activity, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowRight, ShieldCheck, AlertCircle, Edit, Trash2, AlertTriangle, Loader2, X } from 'lucide-react';

interface HistoryViewProps {
    activeModule: string;
    isLoadingHistory: boolean;
    historyList: InspectionData[];
    fetchHistory: (force?: boolean) => void;
    onViewReport: (item: InspectionData) => void;
    onEditRecord?: (item: InspectionData) => void;
    onDeleteRecord?: (item: InspectionData) => Promise<void> | void;
    userRole?: string;
    searchDatabase: (searchTerm: string) => Promise<InspectionData[]>;
}

const HistoryView: React.FC<HistoryViewProps> = ({ 
    activeModule, 
    isLoadingHistory, 
    historyList = [], 
    fetchHistory, 
    onViewReport, 
    onEditRecord,
    onDeleteRecord,
    userRole,
    searchDatabase 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'24h' | '7d' | '30d' | 'total'>('24h');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [recordToDelete, setRecordToDelete] = useState<InspectionData | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const cleanRole = String(userRole || '').trim().toLowerCase();
    const isUserAdmin = cleanRole === 'admin' || cleanRole === 'superadmin' || cleanRole === 'super admin';
    const canEdit = isUserAdmin && Boolean(onEditRecord);
    const canDelete = isUserAdmin && Boolean(onDeleteRecord);
    const now = Date.now();
    const DAY_MS = 24 * 3600 * 1000;

    const handleConfirmDelete = async () => {
        if (!recordToDelete || !onDeleteRecord) return;
        setIsDeleting(true);
        try {
            await onDeleteRecord(recordToDelete);
            setRecordToDelete(null);
        } finally {
            setIsDeleting(false);
        }
    };

    // Filter calculations
    const stats = useMemo(() => {
        const sortedAll = [...historyList].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        const last24h = sortedAll.filter(i => (now - new Date(i.timestamp || 0).getTime()) < DAY_MS);
        const last7d = sortedAll.filter(i => (now - new Date(i.timestamp || 0).getTime()) < DAY_MS * 7);
        const last30d = sortedAll.filter(i => (now - new Date(i.timestamp || 0).getTime()) < DAY_MS * 30);
        
        return {
            h24: last24h,
            d7: last7d,
            d30: last30d,
            totalAll: sortedAll,
            totalCount: historyList.length
        };
    }, [historyList, now]);

    // Active displayed list
    const displayedList = useMemo(() => {
        if (searchTerm.trim()) {
            const clean = searchTerm.trim().toLowerCase();
            return historyList.filter(item => {
                const matchesTruck = (item.truckNo || '').toLowerCase().includes(clean);
                const matchesTrailer = (item.trailerNo || '').toLowerCase().includes(clean);
                const matchesDriver = (item.driverName || '').toLowerCase().includes(clean);
                const matchesInspector = (item.inspectedBy || '').toLowerCase().includes(clean);
                const matchesLocation = (item.location || '').toLowerCase().includes(clean);
                const matchesJob = (item.jobCard || '').toLowerCase().includes(clean);
                const matchesRemarks = (item.remarks || '').toLowerCase().includes(clean);
                return matchesTruck || matchesTrailer || matchesDriver || matchesInspector || matchesLocation || matchesJob || matchesRemarks;
            });
        }

        if (activeFilter === '24h') return stats.h24;
        if (activeFilter === '7d') return stats.d7;
        if (activeFilter === '30d') return stats.d30;
        return stats.totalAll;
    }, [searchTerm, activeFilter, stats, historyList]);

    // Reset pagination to first page when filter or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilter, searchTerm, pageSize]);

    // Pagination math
    const totalItems = displayedList.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedItems = displayedList.slice(startIndex, endIndex);

    const handleFilterClick = (filter: '24h' | '7d' | '30d' | 'total') => {
        setActiveFilter(filter);
        if (filter === 'total') {
            searchInputRef.current?.focus();
        } else {
            setSearchTerm('');
        }
    };

    return (
        <div className="w-full max-w-full space-y-2.5 sm:space-y-3 animate-fadeIn overflow-x-hidden">
            {/* Unified Filter & Search Bar: Fully responsive, zero horizontal scroll */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 w-full">
                {/* Segmented Timeframe Selector */}
                <div className="grid grid-cols-4 sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto shrink-0">
                    {[
                        { id: '24h', label: 'Last 24h', shortLabel: '24h', count: stats.h24.length, icon: Clock },
                        { id: '7d', label: 'Last 7 Days', shortLabel: '7d', count: stats.d7.length, icon: Calendar },
                        { id: '30d', label: 'Last 30 Days', shortLabel: '30d', count: stats.d30.length, icon: Activity },
                        { id: 'total', label: 'All Records', shortLabel: 'All', count: stats.totalCount, icon: Database },
                    ].map((filter) => {
                        const isActive = activeFilter === filter.id && !searchTerm;
                        const Icon = filter.icon;
                        return (
                            <button
                                key={filter.id}
                                type="button"
                                onClick={() => handleFilterClick(filter.id as any)}
                                className={`px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-tight flex items-center justify-center gap-1.5 transition-all ${
                                    isActive
                                        ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/60'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                                }`}
                                title={filter.label}
                            >
                                <Icon size={12} className={isActive ? 'text-blue-600 shrink-0' : 'text-slate-400 shrink-0'} />
                                <span className="hidden sm:inline truncate">{filter.label}</span>
                                <span className="sm:hidden truncate">{filter.shortLabel}</span>
                                <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                    isActive ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/70 text-slate-600'
                                }`}>
                                    {filter.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Search Bar & Page Size Selector */}
                <div className="flex items-center gap-2 w-full md:w-auto flex-1 md:justify-end min-w-0">
                    <div className="relative flex-1 md:w-64 min-w-0">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Filter by plate, inspector, depot..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl outline-none focus:border-slate-400 focus:bg-white transition-all placeholder:text-slate-400"
                        />
                        {searchTerm && (
                            <button 
                                type="button"
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold w-4 h-4 rounded-full flex items-center justify-center"
                                title="Clear filter"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-2 outline-none font-medium shrink-0 cursor-pointer focus:bg-white transition-all"
                        title="Records per page"
                    >
                        <option value={5}>5 / page</option>
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                        <option value={50}>50 / page</option>
                    </select>
                </div>
            </div>

            {/* Main Inspection Grid / Cards: Guaranteed zero horizontal overflow */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden w-full max-w-full">
                {isLoadingHistory && (
                    <div className="h-0.5 bg-blue-600 w-full animate-pulse" />
                )}

                {totalItems === 0 ? (
                    <div className="py-12 sm:py-16 text-center px-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400 border border-slate-100">
                            <Search size={22} />
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-tight">
                            No inspection records found
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                            {searchTerm 
                                ? `No audits match "${searchTerm}". Clear filter or adjust your keywords.`
                                : `No audits recorded for ${activeFilter === '24h' ? 'the last 24 hours' : activeFilter === '7d' ? 'the last 7 days' : 'this timeframe'}.`
                            }
                        </p>
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="mt-3.5 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all"
                            >
                                Reset Search
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop & Tablet Table: table-fixed with zero horizontal scrolling */}
                        <div className="hidden sm:block w-full overflow-x-hidden">
                            <table className="w-full table-fixed text-left divide-y divide-slate-100">
                                <thead>
                                    <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="w-[20%] lg:w-[18%] px-4 py-3">Date & Time</th>
                                        <th className="w-[34%] lg:w-[32%] px-4 py-3">Vehicle & Unit</th>
                                        <th className="w-[26%] lg:w-[26%] px-4 py-3">Inspector & Depot</th>
                                        <th className="w-[10%] lg:w-[12%] px-4 py-3 text-center">Verdict</th>
                                        <th className="w-[10%] lg:w-[12%] px-4 py-3 text-right">Report</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {paginatedItems.map((item, idx) => {
                                        const isPassed = item.safeToLoad === 'Yes' || (item.rate !== undefined && Number(item.rate) >= 3);
                                        const dateObj = new Date(item.timestamp || 0);
                                        const isValidDate = !isNaN(dateObj.getTime());

                                        return (
                                            <tr 
                                                key={item.id || idx} 
                                                className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                                                onClick={() => onViewReport(item)}
                                            >
                                                {/* Date & Time */}
                                                <td className="px-4 py-3 truncate">
                                                    <span className="font-mono tabular-nums font-bold text-slate-900 block truncate">
                                                        {isValidDate ? dateObj.toLocaleDateString() : 'N/A'}
                                                    </span>
                                                    <span className="font-mono tabular-nums text-[10px] text-slate-400 font-medium block truncate mt-0.5">
                                                        {isValidDate ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </span>
                                                </td>
                                                
                                                {/* Vehicle Plate & Trailer */}
                                                <td className="px-4 py-3 truncate">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0 border border-slate-200/60 font-mono">
                                                            {String(item.truckNo || 'V').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <span className="font-bold text-slate-900 tracking-tight uppercase truncate block">
                                                                {item.truckNo || 'N/A'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                                                                {item.trailerNo ? `Trailer: ${item.trailerNo}` : 'Single Unit'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Inspector & Depot */}
                                                <td className="px-4 py-3 truncate">
                                                    <span className="font-medium text-slate-800 block truncate">
                                                        {item.inspectedBy || 'Staff'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                                                        {item.location || 'Lusaka Depot'}
                                                    </span>
                                                </td>

                                                {/* Verdict */}
                                                <td className="px-4 py-3 text-center truncate">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                                        isPassed 
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                                                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                                    }`}>
                                                        {isPassed ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                                                        <span>{item.safeToLoad === 'Yes' ? 'PASS' : item.safeToLoad === 'No' ? 'FAIL' : `${item.rate || 0}/5`}</span>
                                                    </span>
                                                </td>

                                                {/* Action */}
                                                <td className="px-4 py-3 text-right">
                                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onViewReport(item);
                                                            }} 
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-all active:scale-95 shadow-2xs"
                                                            title="View full audit certificate"
                                                        >
                                                            <FileText size={12} />
                                                            <span className="hidden md:inline">View</span>
                                                        </button>

                                                        {canEdit && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEditRecord?.(item);
                                                                }}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 text-xs font-semibold rounded-lg transition-all active:scale-95 border border-amber-200/60 shadow-2xs"
                                                                title="Edit inspection record (Admin rank)"
                                                            >
                                                                <Edit size={12} />
                                                                <span className="hidden lg:inline">Edit</span>
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRecordToDelete(item);
                                                                }}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-xs font-semibold rounded-lg transition-all active:scale-95 border border-rose-200/60 shadow-2xs"
                                                                title="Delete inspection record (Admin rank)"
                                                            >
                                                                <Trash2 size={12} />
                                                                <span className="hidden lg:inline">Delete</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards View (<640px): High-density, touch targets >= 44px, zero horizontal scroll */}
                        <div className="sm:hidden divide-y divide-slate-100 w-full">
                            {paginatedItems.map((item, idx) => {
                                const isPassed = item.safeToLoad === 'Yes' || (item.rate !== undefined && Number(item.rate) >= 3);
                                const dateObj = new Date(item.timestamp || 0);
                                const isValidDate = !isNaN(dateObj.getTime());

                                return (
                                    <div 
                                        key={item.id || idx} 
                                        onClick={() => onViewReport(item)}
                                        className="p-3.5 space-y-2.5 hover:bg-slate-50/70 transition-colors cursor-pointer w-full"
                                    >
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200/60">
                                                    {String(item.truckNo || 'V').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="font-bold text-slate-900 uppercase text-xs block truncate">
                                                        {item.truckNo || 'N/A'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block truncate">
                                                        {item.trailerNo ? `Trailer: ${item.trailerNo}` : 'Solo Unit'}
                                                    </span>
                                                </div>
                                            </div>

                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase shrink-0 flex items-center gap-1 ${
                                                isPassed 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                            }`}>
                                                {isPassed ? <ShieldCheck size={11} /> : <AlertCircle size={11} />}
                                                <span>{item.safeToLoad === 'Yes' ? 'PASS' : item.safeToLoad === 'No' ? 'FAIL' : `${item.rate || 0}/5`}</span>
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                            <span className="truncate max-w-[55%]">
                                                Inspector: <strong className="text-slate-700 font-medium">{item.inspectedBy || 'Staff'}</strong>
                                            </span>
                                            <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                                                {isValidDate ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                                            </span>
                                        </div>

                                        <div className="pt-1 flex items-center gap-2">
                                            <button 
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewReport(item);
                                                }} 
                                                className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                            >
                                                <FileText size={13} />
                                                <span>View Report</span>
                                                <ArrowRight size={13} className="text-slate-400 ml-0.5" />
                                            </button>
                                            {(canEdit || canDelete) && (
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEditRecord?.(item);
                                                            }}
                                                            className="h-11 px-3.5 bg-amber-50 hover:bg-amber-600 hover:text-white border border-amber-200 text-amber-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                                            title="Edit record (Admin only)"
                                                        >
                                                            <Edit size={13} />
                                                            <span>Edit</span>
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRecordToDelete(item);
                                                            }}
                                                            className="h-11 px-3.5 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                                            title="Delete record (Admin only)"
                                                        >
                                                            <Trash2 size={13} />
                                                            <span>Delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination Bar - Fully responsive, zero horizontal scroll */}
                        <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs w-full">
                            <span className="text-[11px] text-slate-500 font-medium">
                                Showing <strong className="text-slate-800 font-mono tabular-nums">{startIndex + 1}</strong>–<strong className="text-slate-800 font-mono tabular-nums">{endIndex}</strong> of <strong className="text-slate-800 font-mono tabular-nums">{totalItems}</strong>
                            </span>

                            <div className="flex items-center gap-1 ml-auto">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                    title="First Page"
                                >
                                    <ChevronsLeft size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                    title="Previous Page"
                                >
                                    <ChevronLeft size={15} />
                                </button>

                                {/* Page Indicator */}
                                <span className="text-xs font-mono tabular-nums font-bold text-slate-700 px-2 py-1 bg-white border border-slate-200 rounded-lg">
                                    {currentPage} / {totalPages}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                    title="Next Page"
                                >
                                    <ChevronRight size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                    title="Last Page"
                                >
                                    <ChevronsRight size={15} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Admin Delete Confirmation Modal */}
            {recordToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                    Delete Inspection Record?
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Are you sure you want to permanently delete the inspection record for{' '}
                                    <strong className="text-slate-800 font-semibold">{recordToDelete.truckNo || 'this unit'}</strong>?
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => !isDeleting && setRecordToDelete(null)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                                disabled={isDeleting}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-xs space-y-1 font-mono">
                            <div className="flex justify-between text-slate-500">
                                <span>Record ID:</span>
                                <span className="font-semibold text-slate-800 truncate max-w-[200px]">{recordToDelete.id || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                                <span>Inspector:</span>
                                <span className="font-semibold text-slate-800">{recordToDelete.inspectedBy || 'Staff'}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                                <span>Date:</span>
                                <span className="font-semibold text-slate-800">{new Date(recordToDelete.timestamp || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        <p className="text-[11px] text-rose-600 font-medium">
                            ⚠️ This will permanently remove this record from both Firebase Firestore and Google Spreadsheet backup. This action cannot be undone.
                        </p>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setRecordToDelete(null)}
                                disabled={isDeleting}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        <span>Delete Record</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoryView;