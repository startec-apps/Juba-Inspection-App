import React, { useState } from 'react';
import { User, UserPreferences } from '../../types';

interface OnboardingWizardProps {
    user: User;
    appScriptUrl: string;
    onComplete: (updatedUser: User) => void;
    onLogout?: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ user, appScriptUrl, onComplete, onLogout }) => {
    const [step, setStep] = useState(0); // 0: Identity, 1: Security, 2: Notifications, 3: Success
    const [isLoading, setIsLoading] = useState(false);
    
    const [fullName, setFullName] = useState(user.name || '');
    const [email, setEmail] = useState(user.username || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const [prefs, setPrefs] = useState<UserPreferences>({
        emailNotifications: true,
        notifyGeneral: true,
        notifyPetroleumV2: true,
        notifyAcid: true
    });

    const nextStep = () => {
        setError('');
        setStep(prev => prev + 1);
    };

    const handleStepSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (step === 0) {
            if (!fullName.trim()) { setError("Enter your official name."); return; }
            if (!email.trim() || !email.includes('@')) { setError("Enter a valid email address."); return; }
        }
        if (step === 1) {
            if (newPassword.length < 4) { setError("Password must be at least 4 characters."); return; }
            if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
        }
        nextStep();
    };

    const handleSkip = () => {
        onComplete({ ...user, needsSetup: false });
    };

    const handleFinalize = async () => {
        setIsLoading(true);
        setError('');
        try {
            const payload = {
                action: 'update_user',
                originalUsername: user.username,
                username: email,
                name: fullName,
                password: newPassword,
                invitationStatus: 'active',
                preferences: { ...prefs, hasCompletedTour: false }
            };

            const response = await fetch(appScriptUrl, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                setStep(3);
            } else {
                setError(result.message || "Unable to sync profile. Try again.");
            }
        } catch (err) {
            setError("Connection error. Please check your signal.");
        } finally {
            setIsLoading(false);
        }
    };

    const steps = [
        { l: 'Identity' },
        { l: 'Security' },
        { l: 'Alerts' }
    ];

    return (
        <div className="fixed inset-0 z-[200] bg-slate-100 flex items-center justify-center p-0 sm:p-4 animate-fadeIn overflow-hidden">
            <div className="w-full h-full sm:h-auto sm:max-w-4xl bg-white sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row">
                
                {/* Compact Navigation Area */}
                <div className="md:w-1/3 bg-slate-900 p-4 md:p-10 flex flex-row md:flex-col justify-between items-center md:items-start text-white shrink-0">
                    <div className="flex items-center md:block gap-3">
                        <div className="w-8 h-8 md:w-12 md:h-12 bg-indigo-600 rounded-lg md:rounded-2xl flex items-center justify-center md:mb-8">
                            <svg className="w-4 h-4 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
                        </div>
                        <div className="md:block">
                            <h1 className="text-sm md:text-2xl font-bold uppercase tracking-tight leading-none">Onboarding</h1>
                            <p className="hidden md:block text-indigo-400 text-[10px] font-semibold uppercase tracking-widest mt-1 opacity-80">Profile Setup</p>
                        </div>
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 md:gap-5">
                        {steps.map((item, idx) => (
                            <div key={idx} className={`flex items-center gap-1.5 md:gap-4 transition-all duration-500 ${step >= idx ? 'opacity-100' : 'opacity-30'}`}>
                                <div className={`w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center border ${step > idx ? 'bg-emerald-500 border-emerald-500 text-white' : step === idx ? 'border-indigo-400 text-indigo-400' : 'border-slate-600 text-slate-400'} font-bold text-[9px] md:text-xs`}>
                                    {step > idx ? '✓' : idx + 1}
                                </div>
                                <span className="hidden md:block font-medium text-[10px] uppercase tracking-[0.1em]">{item.l}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content Panel - Optimized for Zero Scroll */}
                <div className="flex-1 p-6 md:p-12 bg-white flex flex-col justify-center relative">
                    
                    {step === 0 && (
                        <div className="animate-fadeIn w-full max-w-sm mx-auto flex flex-col">
                            <div className="mb-6 md:mb-10">
                                <h2 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Identity Profile</h2>
                                <p className="text-slate-400 text-xs mt-1">Please verify your details for the fleet registry.</p>
                            </div>
                            <form onSubmit={handleStepSubmit} className="space-y-4 md:space-y-6">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5 tracking-wide ml-1">Full Name</label>
                                    <input 
                                        type="text" 
                                        autoFocus 
                                        required
                                        className="w-full p-3 md:p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all text-sm" 
                                        value={fullName} 
                                        onChange={e => setFullName(e.target.value)} 
                                        placeholder="Enter your name" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5 tracking-wide ml-1">Email Address</label>
                                    <input 
                                        type="email" 
                                        required
                                        className="w-full p-3 md:p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all text-sm" 
                                        value={email} 
                                        onChange={e => setEmail(e.target.value.toLowerCase())} 
                                        placeholder="email@company.com" 
                                    />
                                </div>
                                {error && <div className="p-3 bg-rose-50 text-rose-600 text-xs font-medium rounded-lg border border-rose-100">{error}</div>}
                                <div className="pt-4 flex flex-col gap-2">
                                    <button type="submit" className="w-full py-4 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl uppercase tracking-widest text-xs shadow-lg active:scale-[0.98] transition-all">
                                        Update Profile
                                    </button>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={handleSkip} className="flex-1 py-3 text-slate-400 hover:text-slate-600 font-semibold text-[10px] uppercase tracking-wider transition-colors">
                                            Setup Later
                                        </button>
                                        {onLogout && (
                                            <button type="button" onClick={onLogout} className="flex-1 py-3 text-rose-500 hover:text-rose-600 font-semibold text-[10px] uppercase tracking-wider">
                                                Sign Out
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="animate-fadeIn w-full max-w-sm mx-auto">
                            <div className="mb-6 md:mb-10">
                                <h2 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Security Access</h2>
                                <p className="text-slate-400 text-xs mt-1">Set your master password for future logins.</p>
                            </div>
                            <form onSubmit={handleStepSubmit} className="space-y-4 md:space-y-5">
                                <input type="password" autoFocus required className="w-full p-3 md:p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all text-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password" />
                                <input type="password" required className="w-full p-3 md:p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all text-sm" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" />
                                {error && <div className="p-3 bg-rose-50 text-rose-600 text-xs font-medium rounded-lg border border-rose-100">{error}</div>}
                                <button type="submit" className="w-full py-4 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl uppercase tracking-widest text-xs shadow-lg active:scale-[0.98] transition-all mt-4">
                                    Finalize Security
                                </button>
                            </form>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-fadeIn w-full max-w-sm mx-auto flex flex-col justify-center">
                            <div className="mb-6 md:mb-10">
                                <h2 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Alert Preferences</h2>
                                <p className="text-slate-400 text-xs mt-1">Configure your automated notification streams.</p>
                            </div>
                            
                            <div className="space-y-3 mb-8">
                                <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-tight">System Email Alerts</span>
                                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600" checked={prefs.emailNotifications} onChange={() => setPrefs(p => ({...p, emailNotifications: !p.emailNotifications}))} />
                                </label>

                                <div className={`grid grid-cols-2 gap-2 transition-opacity duration-300 ${!prefs.emailNotifications && 'opacity-30 pointer-events-none'}`}>
                                    {[
                                        { k: 'notifyGeneral', l: 'General' },
                                        { k: 'notifyPetroleumV2', l: 'Petroleum Tanker' },
                                        { k: 'notifyAcid', l: 'Acid' }
                                    ].map(m => (
                                        <label key={m.k} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl cursor-pointer hover:border-indigo-200 transition-all shadow-sm">
                                            <span className="text-[10px] font-medium text-slate-500 uppercase">{m.l}</span>
                                            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600" checked={prefs[m.k as keyof UserPreferences] as boolean} onChange={() => setPrefs(p => ({...p, [m.k]: !p[m.k as keyof UserPreferences]}))} />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {error && <div className="p-3 bg-rose-50 text-rose-600 text-xs font-medium rounded-lg mb-6 border border-rose-100">{error}</div>}

                            <button onClick={handleFinalize} disabled={isLoading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all">
                                {isLoading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : 'Complete Registration'}
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="text-center animate-fadeIn w-full max-w-sm mx-auto py-8">
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-100 text-emerald-600">
                                <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Verified Successfully</h2>
                            <p className="text-slate-500 text-sm mb-10 leading-relaxed">Your workspace provisioning is complete. You now have full access to the inspection portal.</p>
                            <button 
                                onClick={() => onComplete({ ...user, username: email, name: fullName, preferences: prefs, needsSetup: false, invitationStatus: 'active' })} 
                                className="w-full py-5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl uppercase tracking-[0.2em] text-xs shadow-xl active:scale-[0.98] transition-all"
                            >
                                Enter Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;