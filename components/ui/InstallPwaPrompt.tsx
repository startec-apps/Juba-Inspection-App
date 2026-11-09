
import React, { useState, useEffect } from 'react';

const InstallPwaPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // 1. Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) return;

        // 2. Check if dismissed previously
        const hasDismissed = localStorage.getItem('sc_install_dismissed');
        // Reset dismissal after 7 days
        if (hasDismissed) {
            const dismissedDate = new Date(parseInt(hasDismissed));
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - dismissedDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < 7) return;
        }

        // 3. Detect Platform
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        if (isIosDevice) {
            // Show iOS prompt after a small delay
            setTimeout(() => setIsVisible(true), 3000);
        } else {
            // Listen for Chrome/Android event
            const handleBeforeInstallPrompt = (e: any) => {
                e.preventDefault();
                setDeferredPrompt(e);
                setIsVisible(true);
            };

            window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

            return () => {
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            };
        }
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setIsVisible(false);
        }
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
                    <div className="bg-white/10 p-2.5 rounded-xl shrink-0">
                        <img 
                            src="https://cdn-icons-png.flaticon.com/512/716/716766.png" 
                            alt="Logo" 
                            className="w-8 h-8 object-contain" 
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">Install SafetyCheck Pro</h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            Add to your home screen for offline access, full-screen view, and faster performance.
                        </p>
                    </div>
                    <button onClick={handleDismiss} className="text-slate-400 hover:text-white p-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {isIOS ? (
                    <div className="bg-white/10 rounded-lg p-3 text-xs text-slate-300 flex items-center gap-3">
                        <span className="text-xl">👉</span>
                        <span>
                            Tap the <span className="font-bold text-white">Share</span> button below and select <span className="font-bold text-white">"Add to Home Screen"</span> [+]
                        </span>
                    </div>
                ) : (
                    <button 
                        onClick={handleInstallClick}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Install App
                    </button>
                )}
            </div>
        </div>
    );
};

export default InstallPwaPrompt;
