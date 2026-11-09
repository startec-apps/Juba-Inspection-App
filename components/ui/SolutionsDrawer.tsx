import React from 'react';

interface SolutionsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onAction: (module: string) => void;
}

interface SolutionCardProps {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

const SolutionCard: React.FC<SolutionCardProps> = ({ label, icon, onClick }) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-xl hover:border-indigo-100 transition-all group active:scale-95 text-center min-h-[110px] sm:min-h-[130px] relative overflow-hidden"
    >
        <div className="mb-2 text-slate-300 group-hover:text-indigo-500 transition-colors scale-75 sm:scale-90 group-hover:scale-100 duration-500">
            {icon}
        </div>
        <span className="text-[8px] sm:text-[9px] font-semibold text-slate-400 group-hover:text-slate-800 uppercase tracking-widest leading-tight px-1 transition-colors">
            {label}
        </span>
        <div className="absolute bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[6px] font-medium text-indigo-400 uppercase tracking-widest">
                Integrate
            </span>
        </div>
    </button>
);

const SolutionsDrawer: React.FC<SolutionsDrawerProps> = ({ isOpen, onClose, onAction }) => {
    const solutions = [
        { id: 'HR & PAYROLL', label: 'HR & PAYROLL', icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
        )},
        { id: 'FLEET MAINTENANCE SOFTWARE', label: 'FLEET MAINTENANCE', icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
        )},
        { id: 'DRIVER MANAGEMENT SYSTEM', label: 'DRIVER MANAGEMENT', icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        )},
        { id: 'FLEET PLANNING SYSTEM', label: 'FLEET PLANNING', icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
        )},
        { id: 'INCIDENT MANAGEMENT SYSTEM', label: 'INCIDENT MANAGEMENT', icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        )},
        { id: 'FINANCE TICKETING SYSTEM', label: 'FINANCE TICKETING', icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>
        )},
        { id: 'AUTOMATED GATE PASS', label: 'AUTOMATED GATE PASS', icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        )},
        { id: 'FUEL PRO RECONCILIATION', label: 'FUEL RECONCILIATION', icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path d="M3 22V2h11l7 7v13H3z" /><path d="M14 2v7h7" /><path d="M7 13h10M7 17h10" /></svg>
        )},
    ];

    return (
        <div className="fixed inset-0 z-[200] animate-fadeIn flex items-center justify-center p-4 no-print">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-slideUp">
                <div className="p-6 sm:p-10">
                    <div className="flex justify-between items-start mb-6 sm:mb-8">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 uppercase tracking-tight leading-none">Enterprise Solutions</h2>
                            <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.2em] mt-2">Module Integrations</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-all text-slate-300 hover:text-slate-800">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        {solutions.map(sol => (
                            <SolutionCard 
                                key={sol.id} 
                                label={sol.label} 
                                icon={sol.icon} 
                                onClick={() => onAction(`support:info:${sol.id}`)} 
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SolutionsDrawer;