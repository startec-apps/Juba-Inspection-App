import React, { useState, useRef, useMemo } from 'react';
import { ValidationLists } from '../types';
import { saveFleetRegistryToFirebase } from '../services/firebase';

interface FleetRegistryViewProps {
    appScriptUrl: string;
    validationLists: ValidationLists;
    onRefresh: () => void;
    showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    isLocked?: boolean;
}

const FleetRegistryView: React.FC<FleetRegistryViewProps> = ({ 
    appScriptUrl, validationLists, onRefresh, showToast, isLocked 
}) => {
    const [newTruck, setNewTruck] = useState('');
    const [newTrailer, setNewTrailer] = useState('');
    const [truckSearch, setTruckSearch] = useState('');
    const [trailerSearch, setTrailerSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filtered lists with deduplication check
    const filteredTrucks = useMemo(() => {
        return validationLists.trucks
            .filter(t => t.toLowerCase().includes(truckSearch.toLowerCase()))
            .slice(0, 100); 
    }, [validationLists.trucks, truckSearch]);

    const filteredTrailers = useMemo(() => {
        return validationLists.trailers
            .filter(t => t.toLowerCase().includes(trailerSearch.toLowerCase()))
            .slice(0, 100);
    }, [validationLists.trailers, trailerSearch]);

    const handleAddAsset = async (type: 'truck' | 'trailer') => {
        const val = (type === 'truck' ? newTruck : newTrailer).trim().toUpperCase();
        if (!val || isLocked) return;

        // Duplicate Check
        const list = type === 'truck' ? validationLists.trucks : validationLists.trailers;
        if (list.some(item => item.toUpperCase() === val)) {
            showToast(`${type === 'truck' ? 'Truck' : 'Trailer'} already exists.`, "warning");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. PRIMARY: Write to Firebase Firestore first
            const updatedLists: ValidationLists = {
                ...validationLists,
                trucks: type === 'truck' ? [...validationLists.trucks, val] : validationLists.trucks,
                trailers: type === 'trailer' ? [...validationLists.trailers, val] : validationLists.trailers
            };
            await saveFleetRegistryToFirebase(updatedLists);

            // 2. BACKUP: Sync to Google Spreadsheet
            if (appScriptUrl) {
                try {
                    await fetch(appScriptUrl, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'manage_fleet', type, value: val }),
                        mode: 'no-cors'
                    });
                } catch (e) {
                    console.warn("Spreadsheet fleet sync backup warning:", e);
                }
            }

            showToast(`${type === 'truck' ? 'Truck' : 'Trailer'} added to database.`, "success");
            if (type === 'truck') setNewTruck(''); else setNewTrailer('');
            setTimeout(onRefresh, 500);
        } finally { setIsSubmitting(false); }
    };

    const downloadSampleCsv = () => {
        const headers = "Truck,Trailer\n";
        const sampleRows = "ZM 1234,T-001\nZM 5678,T-002";
        const blob = new Blob([headers + sampleRows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "fleet_import_template.csv");
        link.click();
        URL.revokeObjectURL(url);
    };

    const downloadCurrentRegistry = () => {
        const headers = "Truck,Trailer\n";
        const maxLen = Math.max(validationLists.trucks.length, validationLists.trailers.length);
        let rows = "";
        for (let i = 0; i < maxLen; i++) {
            const t = validationLists.trucks[i] || "";
            const tr = validationLists.trailers[i] || "";
            rows += `${t},${tr}\n`;
        }
        const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `fleet_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || isLocked) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (!content) return;
            setIsImporting(true);
            try {
                const lines = content.split(/\r?\n/);
                const trucks: string[] = [];
                const trailers: string[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const parts = line.split(',');
                    const truck = parts[0]?.trim().toUpperCase();
                    const trailer = parts[1]?.trim().toUpperCase();
                    if (truck && !validationLists.trucks.includes(truck)) trucks.push(truck);
                    if (trailer && !validationLists.trailers.includes(trailer)) trailers.push(trailer);
                }
                if (trucks.length === 0 && trailers.length === 0) {
                    showToast("No unique data found.", "info");
                    return;
                }
                
                // 1. PRIMARY: Write bulk import to Firebase Firestore first
                const updatedLists: ValidationLists = {
                    ...validationLists,
                    trucks: Array.from(new Set([...validationLists.trucks, ...trucks])),
                    trailers: Array.from(new Set([...validationLists.trailers, ...trailers]))
                };
                await saveFleetRegistryToFirebase(updatedLists);

                // 2. BACKUP: Sync to Google Spreadsheet
                if (appScriptUrl) {
                    try {
                        await fetch(appScriptUrl, {
                            method: 'POST',
                            body: JSON.stringify({ action: 'bulk_manage_fleet', trucks, trailers }),
                            mode: 'no-cors'
                        });
                    } catch (e) {
                        console.warn("Spreadsheet bulk fleet sync backup warning:", e);
                    }
                }
                showToast("Bulk import synced to database.", "success");
                setTimeout(onRefresh, 500);
            } finally { 
                setIsImporting(false); 
                if (fileInputRef.current) fileInputRef.current.value = ""; 
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-140px)] py-2 sm:py-4 px-2 sm:px-4 animate-fadeIn font-sans overflow-hidden">
            {/* PINNED HEADER SECTION */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2 mb-6 shrink-0">
                <div>
                    <h2 className="text-3xl font-normal text-slate-800 uppercase tracking-tight leading-none">Fleet Registry</h2>
                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mt-2">Assets & Equipment</p>
                </div>
                <div className="flex gap-1.5 w-full sm:w-auto">
                    <button 
                        onClick={downloadCurrentRegistry}
                        className="flex-1 sm:flex-none px-4 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-medium text-[10px] uppercase tracking-widest transition-all hover:bg-slate-50 active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export
                    </button>
                    <button 
                        onClick={() => setShowInstructions(true)}
                        className="p-3 bg-white border border-slate-200 text-indigo-500 rounded-xl hover:bg-indigo-50 transition-all shadow-sm"
                        title="Bulk Import Guide"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLocked || isImporting}
                        className="flex-[2] sm:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl font-medium text-[10px] uppercase tracking-widest transition-all hover:bg-black active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg"
                    >
                        {isImporting ? (
                            <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        )}
                        Bulk Sync
                    </button>
                </div>
            </div>

            {/* FLEXIBLE CONTENT SECTION */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-h-0">
                {/* TRUCK MANAGEMENT COLUMN */}
                <div className="flex flex-col min-h-0 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/30 shrink-0">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Horses ({validationLists.trucks.length})</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Enter Reg..." 
                                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-normal uppercase outline-none focus:ring-4 focus:ring-indigo-50/50 transition-all placeholder:text-slate-300 placeholder:normal-case" 
                                    value={newTruck} 
                                    onChange={e => setNewTruck(e.target.value.toUpperCase())} 
                                />
                                <button 
                                    onClick={() => handleAddAsset('truck')} 
                                    disabled={isSubmitting || !newTruck.trim() || isLocked} 
                                    className="px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-medium text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 shrink-0"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" /></svg>
                                <input 
                                    type="text" 
                                    placeholder="Filter horses..." 
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-normal outline-none focus:border-indigo-200 transition-all"
                                    value={truckSearch}
                                    onChange={e => setTruckSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        <div className="divide-y divide-slate-50">
                            {filteredTrucks.length === 0 ? (
                                <div className="p-12 text-center text-[10px] font-medium text-slate-300 uppercase tracking-widest italic">No matches</div>
                            ) : (
                                filteredTrucks.map((t, i) => (
                                    <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-100 group-hover:bg-indigo-400 transition-colors"></div>
                                            <span className="text-sm font-normal text-slate-600 group-hover:text-slate-900 transition-colors">{t}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* TRAILER MANAGEMENT COLUMN */}
                <div className="flex flex-col min-h-0 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/30 shrink-0">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Trailers ({validationLists.trailers.length})</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Enter ID..." 
                                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-normal uppercase outline-none focus:ring-4 focus:ring-emerald-50/50 transition-all placeholder:text-slate-300 placeholder:normal-case" 
                                    value={newTrailer} 
                                    onChange={e => setNewTrailer(e.target.value.toUpperCase())} 
                                />
                                <button 
                                    onClick={() => handleAddAsset('trailer')} 
                                    disabled={isSubmitting || !newTrailer.trim() || isLocked} 
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 shrink-0"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" /></svg>
                                <input 
                                    type="text" 
                                    placeholder="Filter trailers..." 
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-normal outline-none focus:border-emerald-200 transition-all"
                                    value={trailerSearch}
                                    onChange={e => setTrailerSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        <div className="divide-y divide-slate-50">
                            {filteredTrailers.length === 0 ? (
                                <div className="p-12 text-center text-[10px] font-medium text-slate-300 uppercase tracking-widest italic">No matches</div>
                            ) : (
                                filteredTrailers.map((t, i) => (
                                    <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-100 group-hover:bg-emerald-400 transition-colors"></div>
                                            <span className="text-sm font-normal text-slate-600 group-hover:text-slate-900 transition-colors">{t}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* INSTRUCTION OVERLAY */}
            {showInstructions && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-normal text-slate-800 uppercase tracking-tight">Bulk Import Guide</h3>
                                    <p className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest mt-1">Setup Instructions</p>
                                </div>
                                <button onClick={() => setShowInstructions(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="space-y-6 text-sm font-normal text-slate-600 leading-relaxed">
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-xs">1</div>
                                    <p>Ensure your file is in <strong className="text-slate-900 font-medium">CSV (.csv)</strong> format. Use commas to separate columns.</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-xs">2</div>
                                    <p>The first row must be the header: <code className="bg-slate-50 px-2 py-1 rounded text-indigo-600 font-mono text-xs">Truck,Trailer</code></p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-xs">3</div>
                                    <p>Duplicates or small letters will be automatically converted and handled by the system.</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                                    <p className="text-xs font-medium text-slate-400 uppercase tracking-tight">Need a template?</p>
                                    <button 
                                        onClick={downloadSampleCsv}
                                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
                                    >
                                        Get Sample File
                                    </button>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowInstructions(false)}
                                className="w-full mt-10 py-4 bg-slate-900 text-white font-medium rounded-xl text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all shadow-lg"
                            >
                                Got It
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FleetRegistryView;