import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdateBanner = () => {
    const [progress, setProgress] = useState(0);
    const [applying, setApplying] = useState(false);
    const [applied, setApplied] = useState(false);

    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(_swUrl, registration) {
            if (registration) {
                setInterval(() => registration.update(), 60 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('[PWA] SW registration error:', error);
        },
    });

    useEffect(() => {
        if (!applying) return;
        let value = 0;
        const timer = setInterval(() => {
            value = Math.min(value + Math.floor(Math.random() * 15) + 5, 95);
            setProgress(value);
        }, 150);
        return () => clearInterval(timer);
    }, [applying]);

    const handleUpdate = async () => {
        setApplying(true);
        setProgress(10);
        try {
            await updateServiceWorker(true);
            setProgress(100);
            setApplied(true);
        } catch (err) {
            console.error('[PWA] Update failed:', err);
            setApplying(false);
            setProgress(0);
        }
    };

    if (applied) {
        return (
            <div className="fixed top-4 left-4 right-4 z-[10000] md:left-auto md:right-4 md:w-96 animate-fadeIn">
                <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3">
                    <svg className="w-6 h-6 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">Update applied successfully</h4>
                        <p className="text-xs text-emerald-50 mt-1 leading-relaxed">
                            Please refresh the application to load version {__APP_VERSION__}.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-3 w-full py-2 bg-white text-emerald-700 font-bold rounded-lg text-sm hover:bg-emerald-50 transition-colors"
                        >
                            Refresh Now
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!needRefresh) return null;

    return (
        <div className="fixed top-4 left-4 right-4 z-[10000] md:left-auto md:right-4 md:w-96 animate-fadeIn">
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700">
                {applying ? (
                    <div>
                        <h4 className="font-bold text-sm">Applying update...</h4>
                        <div className="mt-3 w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-150 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-300 mt-2 text-right font-mono">{progress}%</p>
                    </div>
                ) : (
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 shrink-0 mt-0.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm">New version available</h4>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                Version {__APP_VERSION__} is ready. Update now for the latest features and fixes.
                            </p>
                            <button
                                onClick={handleUpdate}
                                className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors"
                            >
                                Update Now
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpdateBanner;