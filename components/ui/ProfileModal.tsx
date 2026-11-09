import React, { useState } from 'react';
import { User, SystemSettings, UserPreferences } from '../../types';

interface ProfileModalProps {
    user: User;
    settings: SystemSettings;
    appScriptUrl: string;
    onClose: () => void;
    showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    onUpdateSuccess: (newUser: User) => void;
    onLogout: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ 
    user, 
    settings, 
    appScriptUrl, 
    onClose, 
    showToast, 
    onUpdateSuccess, 
    onLogout
}) => {
    const nameParts = (user.name || '').split(' ');
    const [firstName, setFirstName] = useState(nameParts[0] || '');
    const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    // Password State
    const [oldPassword, setOldPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    // Preferences State
    const [prefs, setPrefs] = useState<UserPreferences>(user.preferences || {
        emailNotifications: true,
        notifyGeneral: true,
        notifyPetroleumV2: true,
        notifyAcid: true
    });
    const [isUpdatingPrefs, setIsUpdatingPrefs] = useState(false);

    const handlePasswordChange = async () => {
        if (!oldPassword) {
            showToast("Please enter your current password.", "warning");
            return;
        }
        if (!password) {
            showToast("Please enter a new password.", "warning");
            return;
        }
        
        // Professional Password Strength Validation
        const weakPasswords = ['1234', '12345', '123456', 'password', 'qwerty', '12345678', 'admin'];
        if (weakPasswords.includes(password.toLowerCase()) || password.length < 6) {
            showToast("Password too simple. Please choose a more secure credential.", "error");
            return;
        }
        if (/^(\d)\1+$/.test(password)) {
            showToast("Repeating characters are not permitted for security.", "error");
            return;
        }

        if (password === oldPassword) {
            showToast("New password must be different from the old one.", "warning");
            return;
        }

        if (password !== confirmPassword) {
            showToast("Passwords do not match.", "error");
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const response = await fetch(appScriptUrl, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update_user',
                    originalUsername: user.username,
                    oldPassword: oldPassword,
                    password: password
                })
            });
            const result = await response.json();

            if (result.status === 'success') {
                showToast("Security updated!", 'success');
                setOldPassword('');
                setPassword('');
                setConfirmPassword('');
            } else {
                showToast(result.message || "Failed to update. Check current password.", 'error');
            }
        } catch (e) {
            showToast("Sync failed.", 'error');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleUpdateName = async () => {
        if (!firstName.trim()) {
            showToast("First name is required.", "warning");
            return;
        }
        setIsUpdatingName(true);
        try {
            const newFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
            const response = await fetch(appScriptUrl, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update_user',
                    originalUsername: user.username,
                    name: newFullName
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                onUpdateSuccess({ ...user, name: newFullName });
                showToast("Profile name updated!", 'success');
            }
        } catch (e) {
            showToast("Sync failed.", 'error');
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleUpdatePrefs = async (newPrefs: UserPreferences) => {
        setPrefs(newPrefs);
        setIsUpdatingPrefs(true);
        try {
            const response = await fetch(appScriptUrl, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update_user',
                    originalUsername: user.username,
                    groupEmail: settings.groupEmail || '',
                    preferences: newPrefs
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                onUpdateSuccess({ ...user, preferences: newPrefs });
                if (newPrefs.emailNotifications) {
                    showToast(`Subscribed to ${settings.groupEmail || 'Google Group'} inspection emails.`, 'success');
                } else {
                    showToast("Unsubscribed from inspection group emails.", 'info');
                }
            }
        } catch (e) {
            showToast("Sync failed.", 'error');
        } finally {
            setIsUpdatingPrefs(false);
        }
    };

    const togglePref = (key: keyof UserPreferences) => {
        const next = { ...prefs, [key]: !prefs[key] };
        handleUpdatePrefs(next);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fadeIn overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center shrink-0 z-10 shadow-sm">
                <button 
                    onClick={onClose}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-all"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <h1 className="flex-1 text-center font-bold text-slate-800 text-sm uppercase tracking-widest">My Workspace</h1>
                <div className="w-10"></div>
            </div>

            <div className="max-w-2xl mx-auto w-full px-6 py-10 space-y-12 pb-24">
                
                {/* 1. YOUR DETAILS */}
                <section className="space-y-4">
                    <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                        <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Identity Profile</h3>
                        <span className="text-[10px] font-black px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg uppercase tracking-widest border border-indigo-100">
                            Role: {user.role || 'Member'}
                        </span>
                    </div>
                    
                    <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                                <input 
                                    type="text" 
                                    value={firstName} 
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Enter first name"
                                    className="w-full p-3.5 border border-gray-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                                <input 
                                    type="text" 
                                    value={lastName} 
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Enter last name"
                                    className="w-full p-3.5 border border-gray-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-1">
                            <div className="space-y-1">
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Organization & ID</span>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                    {settings.companyName || 'Transport Pro'} • {user.username}
                                </span>
                            </div>
                            
                            <button 
                                onClick={handleUpdateName}
                                disabled={isUpdatingName}
                                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
                            >
                                {isUpdatingName ? (
                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : 'Save Profile Changes'}
                            </button>
                        </div>
                    </div>
                </section>

                {/* 2. CHANGE PASSWORD */}
                <section className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-gray-100 pb-2 uppercase tracking-tight">Security Access</h3>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Authorization</label>
                            <input 
                                type="password" 
                                placeholder="Enter Old Password"
                                className="w-full p-3.5 border border-gray-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                            />
                        </div>
                        <div className="h-px bg-gray-100 my-2"></div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Credentials</label>
                            <input 
                                type="password" 
                                placeholder="Set New Password"
                                className="w-full p-3.5 border border-gray-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <input 
                            type="password" 
                            placeholder="Confirm New Password"
                            className="w-full p-3.5 border border-gray-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button 
                            onClick={handlePasswordChange}
                            disabled={isUpdatingPassword}
                            className="w-full py-4 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                        >
                            {isUpdatingPassword ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Verifying...
                                </>
                            ) : 'Update Security'}
                        </button>
                    </div>
                </section>

                {/* 3. EMAIL NOTIFICATIONS */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Alert Preferences</h3>
                        {isUpdatingPrefs && <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    </div>
                    
                    <div className="space-y-2">
                        <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer group hover:bg-slate-100/60 transition-colors">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-slate-800">Master Email Alert</p>
                                    {prefs.emailNotifications && (
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            Subscribed to Google Group
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                    {prefs.emailNotifications 
                                        ? `Subscribed to ${settings.groupEmail || 'Google Group'} • Automatically receives inspection reports`
                                        : 'Enable to automatically subscribe and receive inspection reports via Google Group'}
                                </p>
                            </div>
                            <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={prefs.emailNotifications} onChange={() => togglePref('emailNotifications')} />
                        </label>

                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 transition-opacity duration-300 ${!prefs.emailNotifications && 'opacity-40 pointer-events-none'}`}>
                            {[
                                { key: 'notifyGeneral', label: 'General Fleet' },
                                { key: 'notifyPetroleumV2', label: 'Petroleum Tanker' },
                                { key: 'notifyAcid', label: 'Acid Tankers' }
                            ].map((item) => (
                                <label key={item.key} className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 cursor-pointer transition-colors shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600" 
                                        checked={prefs[item.key as keyof UserPreferences] as boolean} 
                                        onChange={() => togglePref(item.key as keyof UserPreferences)} 
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 4. LOGOUT */}
                <section className="pt-8">
                    <button 
                        onClick={onLogout}
                        className="w-full py-4 bg-white border-2 border-red-500 text-red-500 hover:bg-red-50 font-bold rounded-xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95 text-xs"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H5a3 3-0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        Sign Out
                    </button>
                </section>
            </div>
        </div>
    );
};

export default ProfileModal;