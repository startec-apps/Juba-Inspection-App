import React from 'react';

interface InspectionStartModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartNew: () => void;
    onResume: () => void;
    hasDraft: boolean;
    moduleName: string;
}

const InspectionStartModal: React.FC<InspectionStartModalProps> = ({ 
    isOpen, onClose, onStartNew, onResume, hasDraft, moduleName 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
                <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 p-6 text-white">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                        Start {moduleName} Inspection
                    </h3>
                    <p className="text-emerald-100 text-sm mt-1">Select how you would like to proceed.</p>
                </div>
                
                <div className="p-6 space-y-4">
                    {hasDraft && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-2">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-1">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-amber-800 text-sm">Unsaved Draft Found</h4>
                                    <p className="text-xs text-amber-700 mt-0.5">You have an inspection in progress. Would you like to continue where you left off?</p>
                                </div>
                            </div>
                            <button 
                                onClick={onResume}
                                className="w-full mt-3 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2"
                            >
                                Resume Draft
                            </button>
                        </div>
                    )}

                    <button 
                        onClick={onStartNew}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition flex items-center justify-center gap-3 group"
                    >
                        <div className="w-8 h-8 rounded-full bg-emerald-500/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        </div>
                        <div className="text-left">
                            <div className="text-sm font-black uppercase tracking-wide">Start Inspection</div>
                            {hasDraft && <div className="text-[10px] font-medium text-emerald-100 opacity-80">This will discard the current draft</div>}
                        </div>
                    </button>

                    <button 
                        onClick={onClose}
                        className="w-full py-3 bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-bold rounded-xl transition"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InspectionStartModal;