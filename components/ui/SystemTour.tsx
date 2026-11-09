
import React, { useState, useEffect } from 'react';

interface SystemTourProps {
    onComplete: () => void;
}

const TOUR_STEPS = [
    {
        targetId: 'system-mgmt-section',
        title: 'Central Control',
        description: 'Manage your staff, fleet registry, and global system settings from this primary control hub.',
        position: 'bottom'
    },
    {
        targetId: 'inspection-forms-section',
        title: 'Inspection Hub',
        description: 'Choose from various specialized inspection modules. All reports are synced to Google Sheets in real-time.',
        position: 'bottom'
    },
    {
        targetId: 'notification-bell',
        title: 'Live Alerts',
        description: 'Real-time notifications for critical vehicle failures and automated safety broadcasts.',
        position: 'bottom'
    },
    {
        targetId: 'profile-trigger',
        title: 'User Profile',
        description: 'Update your password, manage email alert preferences, or sign out of your session here.',
        position: 'bottom'
    }
];

const SystemTour: React.FC<SystemTourProps> = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        const updatePosition = () => {
            const step = TOUR_STEPS[currentStep];
            const element = document.getElementById(step.targetId);
            
            if (element) {
                const rect = element.getBoundingClientRect();
                
                setSpotlightStyle({
                    position: 'fixed',
                    top: rect.top - 4,
                    left: rect.left - 4,
                    width: rect.width + 8,
                    height: rect.height + 8,
                    borderRadius: '12px',
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.85)',
                    zIndex: 150,
                    pointerEvents: 'none',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                });

                const tooltipWidth = Math.min(340, window.innerWidth * 0.85);
                let top = rect.bottom + 16;
                let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);

                // Flip to top if no room at bottom
                if (top + 250 > window.innerHeight) {
                    top = rect.top - 220; // estimate height
                }

                // Horizontal boundary checks
                if (left + tooltipWidth > window.innerWidth - 20) {
                    left = window.innerWidth - tooltipWidth - 20;
                }
                if (left < 20) left = 20;

                setTooltipStyle({
                    position: 'fixed',
                    top: Math.max(20, top),
                    left: left,
                    width: tooltipWidth,
                    zIndex: 151,
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                });

            } else {
                setSpotlightStyle({ display: 'none' });
                setTooltipStyle({
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    width: Math.min(340, window.innerWidth * 0.85),
                    transform: 'translate(-50%, -50%)',
                    zIndex: 151
                });
            }
        };

        const timer = setTimeout(updatePosition, 150);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('resize', updatePosition);
            clearTimeout(timer);
        };
    }, [currentStep]);

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const stepData = TOUR_STEPS[currentStep];

    return (
        <div className="fixed inset-0 z-[140] overflow-hidden pointer-events-none">
            {/* The Cutout Spotlight */}
            <div style={spotlightStyle} className="ring-2 ring-indigo-400 animate-pulse"></div>

            {/* The Tooltip Card */}
            <div 
                className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-6 sm:p-8 animate-fadeIn border border-slate-100 pointer-events-auto flex flex-col"
                style={tooltipStyle}
            >
                <div className="flex justify-between items-center mb-5 shrink-0">
                    <span className="text-[10px] font-black text-white bg-indigo-600 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                        Tip {currentStep + 1} / {TOUR_STEPS.length}
                    </span>
                    <button onClick={onComplete} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                <div className="flex-1 overflow-visible">
                    <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-3 uppercase tracking-tight leading-tight">
                        {stepData.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium break-words">
                        {stepData.description}
                    </p>
                </div>

                <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-50 shrink-0">
                    <div className="flex gap-2">
                        {TOUR_STEPS.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentStep ? 'bg-indigo-600 w-6' : 'bg-slate-100 w-1.5'}`}></div>
                        ))}
                    </div>
                    <button 
                        onClick={handleNext}
                        className="px-6 py-3 bg-slate-900 hover:bg-black text-white text-[10px] font-black rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 uppercase tracking-widest"
                    >
                        {currentStep === TOUR_STEPS.length - 1 ? 'Start Working' : 'Next Tip'}
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SystemTour;
