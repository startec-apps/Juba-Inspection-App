
import React from 'react';

interface SubmissionOverlayProps {
    status: 'idle' | 'submitting' | 'success' | 'offline_saved';
    onClose?: () => void;
    onViewReport?: () => void;
    aiAnalysis?: string | null;
}

const SubmissionOverlay: React.FC<SubmissionOverlayProps> = ({ status, onClose, onViewReport, aiAnalysis }) => {
    if (status === 'idle') return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto py-10">
            {/* Backdrop with Blur */}
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-all duration-300"></div>

            {/* Content Card */}
            <div className={`relative bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full mx-4 text-center transform transition-all duration-300 scale-100 animate-fadeIn border border-white/20 max-w-xl my-auto`}>
                
                {status === 'submitting' && (
                    <div className="flex flex-col items-center gap-4 py-10">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Uploading Inspection</h3>
                            <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-widest opacity-60">Syncing with Fleet Database...</p>
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center gap-6 py-4 animate-fadeIn">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center shadow-inner">
                            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Submission Successful</h3>
                            <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-[0.2em]">Dispatching Digital Reports...</p>
                        </div>

                        {/* AI ANALYSIS SECTION */}
                        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left relative overflow-hidden">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                </div>
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Safety AI Insights</h4>
                            </div>

                            {!aiAnalysis ? (
                                <div className="flex flex-col items-center py-6 gap-3">
                                    <svg className="animate-spin h-5 w-5 text-indigo-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Analyzing Vehicle Condition...</p>
                                </div>
                            ) : (
                                <div className="animate-fadeIn">
                                    <p className="text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                                        {aiAnalysis}
                                    </p>
                                    <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-100 pt-3">
                                        Report logged to central cloud registry
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                            <button 
                                onClick={onViewReport}
                                className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
                            >
                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                Digital PDF
                            </button>
                            <button 
                                onClick={onClose}
                                className="w-full py-4 bg-slate-900 text-white font-black rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest active:scale-95"
                            >
                                Return Home
                            </button>
                        </div>
                    </div>
                )}

                {status === 'offline_saved' && (
                    <div className="flex flex-col items-center gap-4 py-10">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center shadow-inner">
                            <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Offline Saved</h3>
                            <p className="text-sm text-gray-500 mt-2 leading-relaxed font-medium">
                                Data stored on-device. Sync will resume automatically when internet returns.
                            </p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="w-full mt-4 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all text-[10px] uppercase tracking-widest"
                        >
                            Got It
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubmissionOverlay;
