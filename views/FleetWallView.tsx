import React, { useMemo } from 'react';
import { InspectionData } from '../types';

interface FleetWallViewProps {
    historyList: InspectionData[];
    isLoading: boolean;
    onClose?: () => void;
}

const FleetWallView: React.FC<FleetWallViewProps> = ({ historyList, isLoading, onClose }) => {
    
    const wallMetrics = useMemo(() => {
        if (!historyList.length) return null;

        // Group by truck to get current status (latest entry)
        const latestByTruck: Record<string, InspectionData> = {};
        historyList.forEach(h => {
            if (!latestByTruck[h.truckNo] || new Date(h.timestamp) > new Date(latestByTruck[h.truckNo].timestamp)) {
                latestByTruck[h.truckNo] = h;
            }
        });

        const assets = Object.values(latestByTruck);
        const grounded = assets.filter(a => Number(a.rate) <= 2);
        const warning = assets.filter(a => Number(a.rate) === 3);
        const active = assets.filter(a => Number(a.rate) >= 4);

        const recentLogs = [...historyList].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 12);

        return { grounded, warning, active, recentLogs, totalAssets: assets.length };
    }, [historyList]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center gap-6">
                <div className="w-16 h-16 border-4 border-slate-900 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Waking Operations Monitor...</p>
            </div>
        );
    }

    if (!wallMetrics) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950 text-white overflow-hidden flex flex-col font-sans">
            {/* Wall Header */}
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-10 shrink-0 bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-6">
                    <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-xl italic shadow-[0_0_20px_rgba(79,70,229,0.4)]">S</div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter leading-none">Fleet Control Center</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Live Telemetry Interface</p>
                    </div>
                </div>
                
                <div className="hidden lg:flex gap-10">
                    <div className="text-center">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Fleet Deployment</p>
                        <p className="text-2xl font-black tracking-tight">{wallMetrics.totalAssets}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Operational</p>
                        <p className="text-2xl font-black text-emerald-400 tracking-tight">{wallMetrics.active.length}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-1">Grounded</p>
                        <p className="text-2xl font-black text-rose-400 tracking-tight">{wallMetrics.grounded.length}</p>
                    </div>
                </div>

                <button 
                    onClick={onClose}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 group"
                >
                    <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                    Exit Monitor
                </button>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-px bg-white/5 overflow-hidden">
                {/* 1. Left Sidebar: Critical Alerts */}
                <div className="col-span-12 md:col-span-3 bg-slate-950 flex flex-col">
                    <div className="p-6 border-b border-white/5">
                        <h3 className="text-xs font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                            Safety Exceptions
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
                        {wallMetrics.grounded.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-600 text-[10px] font-bold uppercase tracking-widest italic text-center px-4">
                                No critical exceptions detected in active fleet.
                            </div>
                        ) : (
                            wallMetrics.grounded.map((a, i) => (
                                <div key={i} className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 animate-pulse">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-lg font-black text-white tracking-tighter uppercase">{a.truckNo}</span>
                                        <span className="text-[10px] font-bold text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">GROUNDED</span>
                                    </div>
                                    <p className="text-[10px] text-rose-200/60 font-medium leading-relaxed italic line-clamp-2">"{a.remarks}"</p>
                                    <div className="mt-4 pt-4 border-t border-rose-500/10 flex justify-between items-end">
                                        <span className="text-[8px] font-bold text-rose-300 uppercase">{a.inspectedBy}</span>
                                        <span className="text-[8px] font-black text-slate-500 uppercase">{new Date(a.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 2. Middle: Live Log Feed */}
                <div className="hidden md:flex md:col-span-5 bg-slate-900/20 flex-col border-x border-white/5">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Activity Stream</h3>
                        <span className="text-[8px] text-indigo-400 font-black animate-pulse uppercase">Syncing Now</span>
                    </div>
                    <div className="flex-1 overflow-hidden p-6 relative">
                        <div className="space-y-4">
                            {wallMetrics.recentLogs.map((log, i) => (
                                <div key={i} className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all duration-500 group">
                                    <div className={`w-3 h-3 rounded-full shrink-0 shadow-[0_0_10px_currentColor] ${
                                        Number(log.rate) >= 4 ? 'text-emerald-500' : Number(log.rate) === 3 ? 'text-amber-500' : 'text-rose-500'
                                    } bg-current`}></div>
                                    <div className="flex-1 flex items-center justify-between min-w-0">
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-tight group-hover:text-indigo-300 transition-colors">{log.truckNo}</p>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{log.inspectedBy}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-slate-300">{log.rate}/5</p>
                                            <p className="text-[8px] font-medium text-slate-600 uppercase mt-1">{new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent"></div>
                    </div>
                </div>

                {/* 3. Right: Fleet Status List */}
                <div className="hidden lg:flex lg:col-span-4 bg-slate-950 flex flex-col">
                    <div className="p-6 border-b border-white/5">
                        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">Asset Inventory Status</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
                        <div className="grid grid-cols-2 gap-3">
                            {[...wallMetrics.active, ...wallMetrics.warning, ...wallMetrics.grounded].map((a, i) => (
                                <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black uppercase truncate">{a.truckNo}</p>
                                        <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">{a.location}</p>
                                    </div>
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                        Number(a.rate) >= 4 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 
                                        Number(a.rate) === 3 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 
                                        'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                                    }`}></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 border-t border-white/5 bg-slate-900/30 text-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">© SCBCNET Operations Desk 2026</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FleetWallView;