import React, { useState, useEffect } from 'react';
import { InspectionData, InspectionStatus, InspectionItemConfig, ValidationLists, SystemSettings } from '../types';
import { INSPECTION_ITEMS, INSPECTION_CATEGORIES, ACID_INSPECTION_ITEMS, ACID_CATEGORIES, PETROLEUM_V2_ITEMS, PETROLEUM_V2_CATEGORIES, SECTIONS } from '../constants';
import CameraCapture from '../components/CameraCapture';
import SignaturePad from '../components/SignaturePad';
import StatusButton from '../components/ui/StatusButton';
import Input from '../components/ui/Input';
import AutocompleteInput from '../components/ui/AutocompleteInput';

interface InspectionFormViewProps {
    initialData: InspectionData;
    activeModule: string;
    validationLists: ValidationLists;
    settings: SystemSettings;
    onSaveDraft: (data: InspectionData) => void;
    onSubmit: (data: InspectionData) => void;
    onExit: () => void;
    submissionStatus: 'idle' | 'submitting' | 'success' | 'offline_saved';
    onViewReport: (data: InspectionData) => void;
}

const InspectionFormView: React.FC<InspectionFormViewProps> = ({ 
    initialData, activeModule, validationLists, onSaveDraft, onSubmit, onExit, submissionStatus
}) => {
    const [formData, setFormData] = useState<InspectionData & any>(initialData);
    const [currentSection, setCurrentSection] = useState(0);
    const [errors, setErrors] = useState<Record<string, boolean>>({});
    const [showDraftSaved, setShowDraftSaved] = useState(false);

    const isEditMode = Boolean(formData.id && !formData.id.startsWith('DRAFT'));

    useEffect(() => {
        setFormData(initialData);
    }, [initialData]);

    const updateField = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const next = {...prev};
                delete next[field];
                return next;
            });
        }
    };

    const handleSaveDraftLocal = () => {
        onSaveDraft(formData);
        setShowDraftSaved(true);
        setTimeout(() => setShowDraftSaved(false), 2000);
    };

    const getItemsForStep = (stepIndex: number): InspectionItemConfig[] => {
        let categories: string[] = [];
        let sourceItems: InspectionItemConfig[] = [];

        if (activeModule === 'general') sourceItems = INSPECTION_ITEMS;
        else if (activeModule === 'petroleum_v2') sourceItems = PETROLEUM_V2_ITEMS;
        else if (activeModule === 'acid') sourceItems = ACID_INSPECTION_ITEMS;

        if (activeModule === 'general') {
            if (stepIndex === 2) categories = [INSPECTION_CATEGORIES.PPE, INSPECTION_CATEGORIES.DOCUMENTATION];
            if (stepIndex === 3) categories = [INSPECTION_CATEGORIES.VEHICLE_EXTERIOR, INSPECTION_CATEGORIES.LIGHTS_ELECTRICAL];
            if (stepIndex === 4) categories = [INSPECTION_CATEGORIES.MECHANICAL, INSPECTION_CATEGORIES.TRAILER];
        } else if (activeModule === 'petroleum_v2') {
            if (stepIndex === 2) categories = [PETROLEUM_V2_CATEGORIES.PRIME_MOVER];
            if (stepIndex === 3) categories = [PETROLEUM_V2_CATEGORIES.TRAILER_TANKS];
            if (stepIndex === 4) categories = [PETROLEUM_V2_CATEGORIES.DRIVER, PETROLEUM_V2_CATEGORIES.SAFETY_SIGNS, PETROLEUM_V2_CATEGORIES.DOCUMENTS];
        } else if (activeModule === 'acid') {
            if (stepIndex === 2) categories = [ACID_CATEGORIES.PPE];
            if (stepIndex === 3) categories = [ACID_CATEGORIES.VEHICLE];
            if (stepIndex === 4) categories = [ACID_CATEGORIES.SPILL_KIT, ACID_CATEGORIES.DOCUMENTATION];
        }

        return sourceItems.filter(item => categories.includes(item.category));
    };

    const validateSection = (sectionIndex: number): boolean => {
        const newErrors: Record<string, boolean> = {};
        
        if (sectionIndex === 0) {
            if (!formData.truckNo) newErrors.truckNo = true;
            if (!formData.trailerNo) newErrors.trailerNo = true;
            if (!formData.driverName) newErrors.driverName = true;
            if (!formData.location) newErrors.location = true;
            if (!formData.odometer) newErrors.odometer = true;
            if (activeModule !== 'general' && !formData.jobCard) newErrors.jobCard = true;
        }

        if (sectionIndex >= 2 && sectionIndex <= 4) {
            const requiredItems = getItemsForStep(sectionIndex);
            requiredItems.forEach(item => {
                if (!formData[item.id]) newErrors[item.id] = true;
            });
        }

        if (sectionIndex === 5) {
             if (!formData.remarks || formData.remarks.trim() === '') newErrors.remarks = true;
             if (!formData.rate || formData.rate === 0) newErrors.rate = true;
             if (!formData.safeToLoad) newErrors.safeToLoad = true;
             if (!formData.inspectorSignature) newErrors.inspectorSignature = true;
             if (!formData.driverSignature) newErrors.driverSignature = true;
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Scroll to the first missing field
            setTimeout(() => {
                const firstErrorKey = Object.keys(newErrors)[0];
                const errorElement = document.querySelector(`[data-field-id="${firstErrorKey}"]`);
                if (errorElement) {
                    errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 100);
            return false;
        }

        setErrors({});
        return true;
    };

    const handleNext = () => {
        if (!validateSection(currentSection)) return;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setCurrentSection(prev => Math.min(prev + 1, SECTIONS.length - 1));
    };

    const handleBack = () => {
        if (currentSection === 0) onExit();
        else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setCurrentSection(prev => Math.max(prev - 1, 0));
        }
    };

    const handleSubmitInspection = () => {
        if (validateSection(currentSection)) onSubmit(formData);
    };

    return (
        <div className="flex flex-col min-h-[calc(100vh-56px)] bg-slate-50/50">
             {/* ADMIN EDIT MODE BANNER */}
             {isEditMode && (
                 <div className="bg-amber-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-xs sticky top-14 z-40">
                     <div className="flex items-center gap-2 max-w-[80%] truncate">
                         <span className="px-2 py-0.5 bg-black/25 rounded uppercase text-[9px] tracking-wider font-mono shrink-0">Admin Edit Mode</span>
                         <span className="truncate">Modifying record for <strong className="font-extrabold">{formData.truckNo || 'Unit'}</strong> <span className="font-mono text-[10px] opacity-80">({formData.id})</span></span>
                     </div>
                     <button
                         type="button"
                         onClick={onExit}
                         className="text-[10px] font-black uppercase tracking-wider bg-black/20 hover:bg-black/35 px-3 py-1 rounded-lg transition-colors shrink-0"
                     >
                         Exit Edit
                     </button>
                 </div>
             )}

             {/* COMPACT FLOW INDICATOR */}
             <div className="bg-white border-b border-slate-100 sticky top-14 z-30 shadow-sm shrink-0">
                <div className="max-w-5xl mx-auto px-4 py-4 sm:py-5 overflow-hidden">
                    <div className="flex justify-between items-center gap-1 sm:gap-4">
                        {SECTIONS.slice(0, 6).map((section, idx) => {
                            const isActive = idx === currentSection;
                            const isCompleted = idx < currentSection;
                            return (
                                <React.Fragment key={section.id}>
                                    <div className="flex flex-col items-center gap-1.5 min-w-0 transition-all duration-500">
                                        <div className={`
                                            w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[8px] sm:text-xs font-black transition-all
                                            ${isActive ? 'bg-slate-900 text-white shadow-lg scale-110' : isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}
                                        `}>
                                            {isCompleted ? '✓' : idx + 1}
                                        </div>
                                        <span className={`text-[7px] font-black uppercase tracking-tighter sm:tracking-widest truncate w-full text-center hidden xs:block ${isActive ? 'text-slate-900' : 'text-slate-300'}`}>
                                            {section.title}
                                        </span>
                                    </div>
                                    {idx < 5 && (
                                        <div className={`h-px flex-1 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* FLUID CONTENT AREA */}
            <div className="flex-1 p-4 sm:p-8 w-full max-w-5xl mx-auto pb-32">
                {currentSection === 0 && (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="bg-white p-6 sm:p-10 rounded-[2rem] border border-slate-100 shadow-sm">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-8 uppercase tracking-tight">Inspection Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                                <div data-field-id="truckNo"><AutocompleteInput label="Truck Registration *" value={formData.truckNo} onChange={v => updateField('truckNo', v)} options={validationLists.trucks} isRegNo={true} error={errors.truckNo} /></div>
                                <div data-field-id="trailerNo"><AutocompleteInput label="Trailer ID *" value={formData.trailerNo} onChange={v => updateField('trailerNo', v)} options={validationLists.trailers} isRegNo={true} error={errors.trailerNo} /></div>
                                <div data-field-id="jobCard"><Input label="Job Card (if any)" value={formData.jobCard || ''} onChange={v => updateField('jobCard', v)} error={errors.jobCard} /></div>
                                <div data-field-id="inspectedBy"><AutocompleteInput label="Inspector" value={formData.inspectedBy} onChange={v => updateField('inspectedBy', v)} options={validationLists.inspectors} readOnly={true} /></div>
                                <div data-field-id="driverName"><AutocompleteInput label="Driver Name *" value={formData.driverName} onChange={v => updateField('driverName', v)} options={validationLists.drivers} isTitleCase={true} error={errors.driverName} /></div>
                                <div data-field-id="location"><AutocompleteInput label="Location *" value={formData.location} onChange={v => updateField('location', v)} options={validationLists.locations} isTitleCase={true} error={errors.location} /></div>
                                <div data-field-id="odometer"><Input label="Odometer Reading (KM) *" type="number" value={formData.odometer} onChange={v => updateField('odometer', v)} error={errors.odometer} /></div>
                            </div>
                        </div>
                    </div>
                )}

                {currentSection === 1 && (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="bg-white p-6 sm:p-10 rounded-[2rem] border border-slate-100 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight">Vehicle Photos</h2>
                                </div>
                            </div>

                            <div className="p-8 sm:p-12 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                                </div>
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Vehicle Photos</h3>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="mt-6 px-8 py-3.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl transition shadow-lg active:scale-95 flex items-center gap-2"
                                >
                                    Proceed to Checklist
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {(currentSection >= 2 && currentSection <= 4) && (
                    <div className="space-y-6 animate-fadeIn">
                        {Array.from(new Set(getItemsForStep(currentSection).map(i => i.category))).map(cat => (
                            <div key={cat} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{cat}</h3>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {getItemsForStep(currentSection).filter(i => i.category === cat).map(item => (
                                        <div key={item.id} data-field-id={item.id} className={`p-6 sm:p-8 transition-colors ${errors[item.id] ? 'bg-rose-50/30' : ''}`}>
                                            <p className="font-bold text-xs sm:text-sm text-slate-700 uppercase tracking-tight mb-5 leading-snug">{item.label}</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 max-w-2xl">
                                                <StatusButton label="Good" status={InspectionStatus.GOOD} current={formData[item.id]} onClick={() => updateField(item.id, InspectionStatus.GOOD)} colorClass="green" />
                                                <StatusButton label="Fault" status={InspectionStatus.BAD} current={formData[item.id]} onClick={() => updateField(item.id, InspectionStatus.BAD)} colorClass="red" />
                                                <StatusButton label="Review" status={InspectionStatus.ATTENTION} current={formData[item.id]} onClick={() => updateField(item.id, InspectionStatus.ATTENTION)} colorClass="yellow" />
                                                <StatusButton label="N/A" status={InspectionStatus.NIL} current={formData[item.id]} onClick={() => updateField(item.id, InspectionStatus.NIL)} colorClass="gray" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {currentSection === 5 && (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="bg-white p-6 sm:p-10 rounded-[2rem] border border-slate-100 shadow-sm">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-8 uppercase tracking-tight">Review & Sign</h2>
                            <div className="space-y-8">
                                <div data-field-id="remarks">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Comments *</label>
                                    <textarea className={`w-full p-6 bg-slate-50 border rounded-2xl h-40 outline-none font-medium text-sm focus:ring-4 focus:ring-indigo-50/50 resize-none transition-all ${errors.remarks ? 'border-rose-300 bg-rose-50/30' : 'border-slate-100'}`} value={formData.remarks} onChange={e => updateField('remarks', e.target.value)} />
                                </div>
                                <div data-field-id="rate">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Overall Condition Rating *</label>
                                    <div className={`flex gap-2 sm:gap-4 p-1 rounded-2xl ${errors.rate ? 'bg-rose-50/50 ring-1 ring-rose-200' : ''}`}>
                                        {[1, 2, 3, 4, 5].map(num => (
                                            <button key={num} onClick={() => updateField('rate', num)} className={`flex-1 h-12 sm:h-14 rounded-xl font-black text-lg transition-all ${formData.rate === num ? 'bg-slate-900 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{num}</button>
                                        ))}
                                    </div>
                                </div>

                                <div data-field-id="safeToLoad" className={`p-6 rounded-2xl border ${errors.safeToLoad ? 'bg-rose-50/30 border-rose-300' : 'bg-slate-50/30 border-slate-100'}`}>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-5 tracking-[0.2em]">Safety Certification *</label>
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <p className="flex-1 font-bold text-slate-700 uppercase tracking-tight text-sm">Is this vehicle safe to load/dispatch?</p>
                                        <div className="flex gap-2 shrink-0">
                                            <button 
                                                onClick={() => updateField('safeToLoad', 'Yes')}
                                                className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${formData.safeToLoad === 'Yes' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                Yes
                                            </button>
                                            <button 
                                                onClick={() => updateField('safeToLoad', 'No')}
                                                className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${formData.safeToLoad === 'No' ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
                                    <div data-field-id="inspectorSignature">
                                        <SignaturePad label="Inspector Signature *" existingSignature={formData.inspectorSignature} onSave={sig => updateField('inspectorSignature', sig)} />
                                        {errors.inspectorSignature && <p className="text-[9px] text-rose-500 font-bold mt-1 uppercase tracking-widest">Required</p>}
                                    </div>
                                    <div data-field-id="driverSignature">
                                        <SignaturePad label="Driver Signature *" existingSignature={formData.driverSignature} onSave={sig => updateField('driverSignature', sig)} />
                                        {errors.driverSignature && <p className="text-[9px] text-rose-500 font-bold mt-1 uppercase tracking-widest">Required</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ADAPTIVE FOOTER NAV */}
            <footer className="bg-white/90 backdrop-blur-md border-t border-slate-100 p-3 sm:p-6 fixed bottom-0 left-0 right-0 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-6">
                    <button onClick={handleBack} className="flex-1 sm:flex-none px-4 sm:px-10 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-200 font-black text-slate-400 hover:text-slate-800 transition-all text-[9px] sm:text-[10px] uppercase tracking-widest active:scale-95 whitespace-nowrap">
                        {currentSection === 0 ? 'Cancel' : 'Previous'}
                    </button>
                    
                    <div className="flex gap-2 sm:gap-4 items-center shrink-0">
                        <button onClick={handleSaveDraftLocal} className="px-3 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 font-black hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] uppercase tracking-widest active:scale-95 whitespace-nowrap">
                            {showDraftSaved ? 'Saved' : 'Draft'}
                        </button>
                        
                        {currentSection < 5 ? (
                            <button onClick={handleNext} className="px-5 sm:px-12 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black hover:bg-black shadow-lg transition-all flex items-center justify-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] uppercase tracking-widest sm:tracking-[0.2em] active:scale-95 border-t border-white/10 whitespace-nowrap">
                                Continue
                                <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </button>
                        ) : (
                            <button 
                                onClick={handleSubmitInspection} 
                                disabled={submissionStatus !== 'idle'} 
                                className="px-6 sm:px-12 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg transition-all flex items-center justify-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] uppercase tracking-widest sm:tracking-[0.2em] active:scale-95 border-t border-white/10 disabled:bg-slate-400 whitespace-nowrap"
                            >
                                {submissionStatus === 'submitting' ? (
                                    <svg className="animate-spin h-3.5 sm:h-4 w-3.5 sm:w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                                )}
                                {submissionStatus === 'submitting' ? 'Wait...' : (isEditMode ? 'Save & Update Record' : 'Submit Inspection')}
                            </button>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default InspectionFormView;