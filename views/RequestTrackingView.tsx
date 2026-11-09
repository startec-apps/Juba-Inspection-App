import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { getRequestsFromFirebase, saveRequestToFirebase } from '../services/firebase';

interface RequestTrackingViewProps {
    appScriptUrl: string;
    currentUser: User | null;
    showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    onRequestNew?: () => void;
}

interface RequestItem {
    id: string;
    requester: string;
    truck: string;
    trailer: string;
    type: string;
    reason: string;
    priority: string;
    assignedTo: string;
    status: string;
    timestamp: string;
}

const RequestTrackingView: React.FC<RequestTrackingViewProps> = ({ appScriptUrl, currentUser, showToast, onRequestNew }) => {
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Optimized polling interval: 5 minutes instead of 1 minute to save API calls
    const REFRESH_INTERVAL = 300000;

    useEffect(() => {
        fetchRequests();
        const interval = setInterval(fetchRequests, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [currentUser?.username, appScriptUrl]);

    const filterRequestsByRole = (items: RequestItem[]) => {
        if (!currentUser) return [];
        const role = (currentUser.role || '').toLowerCase();
        if (role === 'admin' || role === 'superadmin') return items;
        
        const myName = String(currentUser.name || '').toLowerCase();
        return items.filter((req: RequestItem) => {
            const isRequester = String(req.requester).toLowerCase() === myName;
            const isAssigned = String(req.assignedTo).toLowerCase() === myName;
            const isUnassigned = String(req.assignedTo).toLowerCase() === 'unassigned';
            
            if (role === 'inspector') {
                return isAssigned || isUnassigned || isRequester;
            }
            return isRequester;
        });
    };

    const fetchRequests = async () => {
        if (!currentUser) return;
        // Do not query when tab is in background to preserve daily read quotas
        if (typeof document !== 'undefined' && document.hidden) return;
        if (requests.length === 0) setIsLoading(true);
        
        try {
            // 1. PRIMARY: Fetch from Firebase Firestore first (uses 4-min cache)
            const fbRequests = await getRequestsFromFirebase();
            if (fbRequests && fbRequests.length > 0) {
                const mappedFb: RequestItem[] = fbRequests.map(r => ({
                    id: r.id,
                    requester: r.requester || 'Staff',
                    truck: r.truck || r.truckNo || 'N/A',
                    trailer: r.trailer || r.trailerNo || 'N/A',
                    type: r.type || 'general',
                    reason: r.reason || '',
                    priority: r.priority || 'normal',
                    assignedTo: r.assignedTo || 'Unassigned',
                    status: r.status || 'Pending',
                    timestamp: r.timestamp || new Date().toISOString()
                }));

                const filtered = filterRequestsByRole(mappedFb).sort(
                    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                setRequests(filtered);
                setIsLoading(false);
                return;
            }

            // 2. BACKUP: If Firebase is empty, load from spreadsheet backup
            if (appScriptUrl && appScriptUrl.startsWith('https')) {
                const response = await fetch(`${appScriptUrl}?t=${new Date().getTime()}`);
                const json = await response.json();
                
                const reqSheet = json['Inspection_Requests'];
                if (reqSheet && Array.isArray(reqSheet) && reqSheet.length > 1) {
                    const allMapped: RequestItem[] = reqSheet.slice(1)
                        .map((row: any[]) => ({
                            id: row[0],
                            requester: row[1],
                            truck: row[3],
                            trailer: row[4],
                            type: row[5],
                            reason: row[6],
                            priority: row[7],
                            assignedTo: row[8],
                            status: row[9] || 'Pending',
                            timestamp: row[10]
                        }));

                    const filtered = filterRequestsByRole(allMapped).sort(
                        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );

                    setRequests(filtered);
                } else {
                    setRequests([]);
                }
            }
        } catch (error) {
            console.error("Failed to fetch requests", error);
            if (requests.length === 0) showToast("Failed to load requests.", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const pendingCount = requests.filter(r => r.status === 'Pending').length;
    const completedCount = requests.filter(r => r.status === 'Completed').length;
    const completionRate = requests.length > 0 ? Math.round((completedCount / requests.length) * 100) : 0;

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn px-2 sm:px-4 pb-12">
            {/* Standardized Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800 tracking-tight uppercase">Inspection Requests</h2>
                    <p className="text-slate-400 font-medium mt-1 uppercase tracking-widest text-[9px]">Live Pipeline</p>
                </div>
                {onRequestNew && (
                    <button 
                        onClick={onRequestNew}
                        className="w-full sm:w-auto px-6 py-3 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2.5 text-[10px] uppercase tracking-widest bg-slate-900 hover:bg-black border-t border-white/10"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 4v16m8-8H4"></path></svg>
                        New Request
                    </button>
                )}
            </div>

            {/* Standardized Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pending</p>
                    <h3 className="text-2xl font-semibold text-amber-500">{pendingCount}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Completed</p>
                    <h3 className="text-2xl font-semibold text-emerald-600">{completedCount}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm col-span-2 md:col-span-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Overall Progress</p>
                    <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-semibold text-slate-700">{completionRate}%</h3>
                        <div className="flex-1 h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Redesigned Request Container */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Active Queue</h3>
                </div>

                <div className="divide-y divide-slate-50">
                    {isLoading ? (
                        <div className="py-20 text-center">
                            <div className="w-8 h-8 border-3 border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">Updating data...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="py-20 text-center">
                            <p className="text-[11px] font-medium text-slate-300 uppercase tracking-widest">No active requests found</p>
                        </div>
                    ) : requests.map((req) => (
                        <div key={req.id} className="p-5 sm:px-8 sm:py-6 hover:bg-slate-50/30 transition-colors flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-12">
                            
                            {/* Asset Identity Block */}
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${req.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 uppercase tracking-tight truncate">{req.truck}</div>
                                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{req.trailer || 'Stand-alone Unit'}</div>
                                </div>
                            </div>

                            {/* Details Block */}
                            <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-12 shrink-0">
                                <div className="min-w-[110px]">
                                    <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-tight">{req.type}</div>
                                    <div className={`text-[9px] font-bold uppercase tracking-widest ${
                                        req.priority === 'Critical' || req.priority === 'Urgent' ? 'text-rose-500' : 'text-slate-400'
                                    }`}>
                                        {req.priority} Priority
                                    </div>
                                </div>

                                <div className="min-w-[130px] text-right sm:text-left">
                                    <div className="text-[11px] font-semibold text-slate-600 truncate max-w-[120px]">
                                        {req.assignedTo && req.assignedTo !== 'Unassigned' ? req.assignedTo : 'Unassigned'}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Personnel</div>
                                </div>
                            </div>

                            {/* Timeline & Status Block */}
                            <div className="flex items-center justify-between sm:justify-end gap-8 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                                <div className="text-left sm:text-right shrink-0">
                                    <div className="text-[11px] font-semibold text-slate-500">{new Date(req.timestamp).toLocaleDateString()}</div>
                                    <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">{new Date(req.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </div>
                                <div className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border shrink-0
                                    ${req.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}
                                `}>
                                    {req.status === 'Completed' ? 'Completed' : 'Pending'}
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RequestTrackingView;