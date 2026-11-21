import React, { useState, useEffect } from 'react';

const InstallPwaPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // 1. Already installed? Never show.
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) return;

        // 2. Detect platform
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        setIsIOS(isIosDevice);

        // 3. 5-minute cooldown after dismissal (was 7 days)
        const DismissedCooldownMs = 5 * 60 * 1000;
        const hasDismissed = localStorage.getItem('sc_install_dismissed');
        if (hasDismissed) {
            const elapsed = Date.now() - parseInt(hasDismissed);
            if (elapsed < DismissedCooldownMs) return;
        }

        if (isIosDevice) {
            const timer = setTimeout(() => setIsVisible(true), 3000);
            return () => clearTimeout(timer);
        }

        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setIsVisible(false);
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('sc_install_dismissed', Date.now().toString());
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-4 md:w-96 animate-fadeIn">
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                    <div className="bg-white p-1 rounded-xl shrink-0">
                        <img
                            src="/Juba-Inspection-App/pwa-192x192.png"
                            alt="Juba Pro"
                            className="w-10 h-10 object-contain rounded-lg"
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/Juba-Inspection-App/apple-touch-icon.png';
                            }}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">Install Juba Pro</h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            Add to your home screen for offline access, full-screen view, and faster performance.
                        </p>
                    </div>
                    <button onClick={handleDismiss} className="text-slate-400 hover:text-white p-1" aria-label="Dismiss">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {isIOS ? (
                    <div className="bg-white/10 rounded-lg p-3 text-xs text-slate-300 flex items-center gap-3">
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>
                            Tap <span className="font-bold text-white">Share</span> then <span className="font-bold text-white">"Add to Home Screen"</span>
                        </span>
                    </div>
                ) : (
                    <button
                        onClick={handleInstallClick}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Install App
                    </button>
                )}
            </div>
        </div>
    );
};

export default InstallPwaPrompt;