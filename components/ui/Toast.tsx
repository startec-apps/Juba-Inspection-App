import React from 'react';

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info' | 'warning', onClose: () => void }) => {
    const configs = {
        success: { 
            bg: 'bg-emerald-950', 
            border: 'border-emerald-500/50', 
            icon: <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>,
            label: 'SUCCESS'
        },
        error: { 
            bg: 'bg-rose-950', 
            border: 'border-rose-500/50', 
            icon: <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12" /></svg>,
            label: 'CRITICAL'
        },
        info: { 
            bg: 'bg-slate-900', 
            border: 'border-indigo-500/50', 
            icon: <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
            label: 'SYSTEM'
        },
        warning: { 
            bg: 'bg-amber-950', 
            border: 'border-amber-500/50', 
            icon: <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
            label: 'ALERT'
        }
    };

    const config = configs[type];

    return (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[1000] animate-fadeIn no-print">
            <div className={`${config.bg} ${config.border} border-l-4 rounded-xl shadow-2xl p-4 flex items-center gap-4 relative overflow-hidden group`}>
                <div className="shrink-0 bg-white/5 p-2 rounded-lg border border-white/10 shadow-inner">
                    {config.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${type === 'success' ? 'text-emerald-400' : type === 'error' ? 'text-rose-400' : type === 'info' ? 'text-indigo-400' : 'text-amber-400'}`}>
                            {config.label}
                        </span>
                    </div>
                    <p className="text-white text-xs font-medium leading-relaxed truncate opacity-90">
                        {message}
                    </p>
                </div>

                <button 
                    onClick={onClose} 
                    className="p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-90"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    );
};

export default Toast;