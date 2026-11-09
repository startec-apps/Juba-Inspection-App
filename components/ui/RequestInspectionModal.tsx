import React, { useState, useEffect, useRef } from 'react';
import { ValidationLists } from '../../types';

interface RequestInspectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    validationLists: ValidationLists;
    currentUserRole: string;
}

const RequestInspectionModal: React.FC<RequestInspectionModalProps> = ({ 
    isOpen, onClose, onSubmit, validationLists 
}) => {
    if (!isOpen) return null;

    const [truckNo, setTruckNo] = useState('');
    const [trailerNo, setTrailerNo] = useState('');
    const [type, setType] = useState('General');
    const [priority, setPriority] = useState('Normal');
    const [reason, setReason] = useState('');
    const [inspector, setInspector] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};

        if (!truckNo) newErrors.truckNo = "Required";
        if (!reason.trim()) newErrors.reason = "Required";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        
        setIsSubmitting(true);
        try {
            await onSubmit({ 
                truckNo, 
                trailerNo, 
                type, 
                priority, 
                reason,
                assignedInspector: inspector 
            });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const SelectField = ({ 
        label, 
        value, 
        onChange, 
        options, 
        placeholder = "Select...", 
        error, 
        isOptional = false 
    }: { 
        label: string, 
        value: string, 
        onChange: (val: string) => void, 
        options: string[], 
        placeholder?: string, 
        error?: string, 
        isOptional?: boolean 
    }) => {
        const [showDropdown, setShowDropdown] = useState(false);
        const [searchTerm, setSearchTerm] = useState('');
        const wrapperRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            function handleClickOutside(event: any) {
                if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                    setShowDropdown(false);
                }
            }
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, [wrapperRef]);

        const filteredOptions = options.filter(opt => 
            String(opt).toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="relative" ref={wrapperRef}>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    {label} {isOptional && <span className="opacity-50 text-[8px]">(Optional)</span>}
                </label>
                
                <div 
                    onClick={() => { if (options.length > 0) setShowDropdown(!showDropdown); }}
                    className={`relative w-full p-4 bg-slate-50 border rounded-2xl outline-none text-sm font-medium text-slate-700 transition-all cursor-pointer flex items-center justify-between
                        ${error ? 'border-red-200 bg-red-50 text-red-900 shadow-sm' : showDropdown ? 'border-indigo-400 ring-4 ring-indigo-50 bg-white' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-100/30'}
                        ${options.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}
                    `}
                >
                    <span className={`truncate mr-4 ${!value && 'text-slate-300'}`}>
                        {value || (options.length === 0 ? "No data" : placeholder)}
                    </span>
                    <svg className={`w-3.5 h-3.5 text-slate-300 transition-transform ${showDropdown ? 'rotate-180 text-indigo-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 9l-7 7-7-7"></path></svg>
                </div>

                {showDropdown && options.length > 0 && (
                    <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-56 animate-fadeIn">
                        <div className="p-3 border-b border-slate-50 bg-slate-50/50 sticky top-0 shrink-0">
                            <input 
                                type="text" 
                                autoFocus
                                className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 placeholder-slate-300 font-medium"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="overflow-y-auto scrollbar-hide flex-1 py-1">
                            {filteredOptions.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400 font-medium uppercase tracking-widest">No results</div>
                            ) : (
                                filteredOptions.map((opt, idx) => (
                                    <div 
                                        key={idx}
                                        onClick={() => { onChange(opt); setShowDropdown(false); }}
                                        className={`px-5 py-3 text-sm cursor-pointer transition-all ${value === opt ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {opt}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
                {error && <p className="text-[10px] text-red-500 font-semibold mt-1 ml-1 uppercase">{error}</p>}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto no-print">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border border-white/20 my-auto">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-semibold text-slate-800 tracking-tight uppercase">Request Inspection</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-300 hover:text-slate-800 transition-colors p-2 hover:bg-slate-50 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <SelectField label="Truck Number" value={truckNo} onChange={setTruckNo} options={validationLists.trucks} placeholder="Select Truck..." error={errors.truckNo} />
                            <SelectField label="Trailer Number" value={trailerNo} onChange={setTrailerNo} options={validationLists.trailers} placeholder="Select Trailer..." isOptional={true} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <SelectField label="Inspection Type" value={type} onChange={setType} options={['General', 'Petroleum', 'Petroleum_V2', 'Acid']} />
                            <SelectField label="Priority" value={priority} onChange={setPriority} options={['Normal', 'Urgent', 'Critical']} />
                        </div>

                        <SelectField label="Assign Inspector" value={inspector} onChange={setInspector} options={validationLists.inspectors} placeholder="Unassigned" isOptional={true} />

                        <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Details</label>
                            <textarea 
                                className={`w-full p-5 bg-slate-50 border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 text-sm font-medium h-28 placeholder:text-slate-300 resize-none transition-all
                                    ${errors.reason ? 'border-red-200 bg-red-50 text-red-900' : 'border-slate-100 focus:border-indigo-100'}
                                `}
                                placeholder="Enter any specific instructions..."
                                value={reason}
                                onChange={(e) => { setReason(e.target.value); setErrors(prev => ({...prev, reason: ''})); }}
                                required
                            ></textarea>
                            {errors.reason && <p className="text-[10px] text-red-500 font-semibold mt-1 ml-1 uppercase">{errors.reason}</p>}
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className={`w-full py-4.5 rounded-xl font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest active:scale-95 border-t border-white/10
                                ${isSubmitting ? 'bg-slate-400 cursor-wait' : 'bg-slate-900 hover:bg-black'}
                            `}
                        >
                            {isSubmitting ? 'Processing...' : 'Send Request'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RequestInspectionModal;