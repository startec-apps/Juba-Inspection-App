
import React, { useState, useEffect, useRef } from 'react';
import { User, ValidationLists, SystemSettings } from '../types';
import AutocompleteInput from '../components/ui/AutocompleteInput';
import { dbService } from '../lib/db';
import { getUsersFromFirebase, saveUserToFirebase } from '../services/firebase';

interface UserManagementViewProps {
    currentUser: User;
    appScriptUrl: string;
    showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    validationLists: ValidationLists;
    settings?: SystemSettings;
}

const SectionHeader = ({ label }: { label: string }) => (
    <div className="w-full flex items-center gap-4 mb-4 sm:mb-6 opacity-70 shrink-0">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">{label}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-slate-100 to-transparent"></div>
    </div>
);

const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, appScriptUrl, showToast, validationLists, settings }) => {
    const [users, setUsers] = useState<(User & {password?: string})[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [isEditing, setIsEditing] = useState(false);
    const [originalUsername, setOriginalUsername] = useState('');
    const lastFetchRef = useRef<number>(0);
    
    const [formData, setFormData] = useState({
        name: '', username: '', password: '', role: 'Inspector' as any, position: '', sendEmail: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isSuperAdmin = currentUser.role === 'SuperAdmin';
    const isAdmin = currentUser.role === 'Admin' || isSuperAdmin;

    const CACHE_KEY = `sc_user_directory_${btoa(appScriptUrl || 'default').substring(0, 8)}`;

    useEffect(() => { 
        if (isAdmin) {
            loadCachedUsers();
            fetchUsers(); 
        }
    }, [isAdmin, appScriptUrl]);

    const ensureAdminInList = (rawUsers: (User & {password?: string})[]): (User & {password?: string})[] => {
        const hasAdmin = rawUsers.some(u => (u.username || '').toLowerCase() === 'admin');
        if (!hasAdmin) {
            const masterAdmin: User = {
                id: 'USR-MASTER-ADMIN',
                username: 'admin',
                name: 'System Administrator',
                role: 'SuperAdmin',
                position: 'Fleet & Safety Operations Director',
                isActive: true,
                lastLogin: new Date().toISOString()
            };
            return [masterAdmin, ...rawUsers];
        }
        return rawUsers;
    };

    async function loadCachedUsers() {
        try {
            const cached = await dbService.get(CACHE_KEY);
            if (cached && Array.isArray(cached.data)) {
                setUsers(ensureAdminInList(cached.data));
            } else {
                setUsers(ensureAdminInList([]));
            }
        } catch (e) {
            setUsers(ensureAdminInList([]));
        }
    }

    const fetchUsers = async (force: boolean = false) => {
        if (!isAdmin) return;
        
        // Anti-flicker: if not forced and fetch happened recently, skip
        if (!force && Date.now() - lastFetchRef.current < 30000 && users.length > 0) return;

        setIsLoading(users.length === 0);
        try {
            lastFetchRef.current = Date.now();
            
            // 1. PRIMARY: Fetch from Firebase Firestore
            const fbUsers = await getUsersFromFirebase();
            if (fbUsers && fbUsers.length > 0) {
                const combined = ensureAdminInList(fbUsers);
                setUsers(combined);
                await dbService.set(CACHE_KEY, combined);
                setIsLoading(false);
                return;
            }

            // 2. BACKUP: If Firebase is empty, fetch from Google Spreadsheet and seed Firebase
            if (appScriptUrl && appScriptUrl.startsWith('https')) {
                const response = await fetch(appScriptUrl, { 
                    method: 'POST', 
                    body: JSON.stringify({ action: 'get_users' }),
                    mode: 'cors'
                });
                const result = await response.json();
                if (result.status === 'success' && Array.isArray(result.users)) {
                    // Seed users into Firebase Firestore
                    result.users.forEach((u: User) => {
                        saveUserToFirebase(u).catch(() => {});
                    });

                    const combined = ensureAdminInList(result.users);
                    setUsers(combined);
                    await dbService.set(CACHE_KEY, combined);
                }
            } else {
                setUsers(ensureAdminInList([]));
            }
        } catch (e) { 
            showToast("Failed to load users", 'error'); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const handleDelete = async (userToDelete: User) => {
        if ((userToDelete.username || '').toLowerCase() === 'admin') {
            showToast("Protected Account: Master Administrator (admin) cannot be deleted.", "warning");
            return;
        }
        if (userToDelete.role === 'SuperAdmin' && !isSuperAdmin) {
            showToast("Unauthorized: Admins cannot remove SuperAdmins.", "error");
            return;
        }
        
        const confirmMsg = `WARNING: Are you sure you want to permanently delete "${userToDelete.name || userToDelete.username}" from the system? This action cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        setIsLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

        try {
            // Optimistic update
            const snapshot = [...users];
            setUsers(prev => prev.filter(u => u.username !== userToDelete.username));

            const response = await fetch(appScriptUrl, { 
                method: 'POST', 
                body: JSON.stringify({ 
                    action: 'delete_user', 
                    username: userToDelete.username 
                }),
                mode: 'cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const result = await response.json();
            
            if (result.status === 'success') {
                showToast("User successfully removed", 'success');
                // Persist new list to cache
                const newList = snapshot.filter(u => u.username !== userToDelete.username);
                await dbService.set(CACHE_KEY, newList);
            } else { 
                setUsers(snapshot);
                showToast(result.message || "Deletion failed. User may be protected.", 'error'); 
            }
        } catch (e: any) { 
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                showToast("Request timed out. The server might be slow.", 'warning');
            } else {
                showToast("Network error or CORS restriction. Please refresh.", 'error'); 
            }
            fetchUsers(true);
        } finally { 
            setIsLoading(false); 
        }
    };

    const handleToggleStatus = async (user: User) => {
        if ((user.username || '').toLowerCase() === 'admin') {
            showToast("Protected Account: Master Administrator (admin) cannot be disabled.", "warning");
            return;
        }
        if (user.role === 'SuperAdmin' && !isSuperAdmin) {
            showToast("Unauthorized: Admins cannot modify SuperAdmin status.", "error");
            return;
        }
        if (user.username === currentUser.username) {
            showToast("Cannot restrict own access.", "warning");
            return;
        }
        const nextStatus = !user.isActive;
        setUsers(prev => prev.map(u => u.username === user.username ? { ...u, isActive: nextStatus } : u));
        
        // 1. PRIMARY: Update Firebase Firestore
        await saveUserToFirebase({ ...user, isActive: nextStatus });

        // 2. BACKUP: Sync to Google Spreadsheet
        if (appScriptUrl && appScriptUrl.startsWith('https')) {
            try {
                await fetch(appScriptUrl, { 
                    method: 'POST', 
                    body: JSON.stringify({ 
                        action: 'update_user', 
                        username: user.username, 
                        isActive: nextStatus,
                        groupEmail: settings?.groupEmail || ''
                    }) 
                });
            } catch (e) {
                console.warn("Spreadsheet backup sync failed:", e);
            }
        }
    };

    const handleResetPassword = async (user: User) => {
        if (user.role === 'SuperAdmin' && !isSuperAdmin) {
            showToast("Unauthorized: Cannot reset SuperAdmin password.", "error");
            return;
        }
        
        const tempPassword = Math.random().toString(36).substring(2, 10).toUpperCase();
        const confirmMsg = `Are you sure you want to grant a password reset for "${user.name || user.username}"? This will clear their reset request and provide a temporary access key.`;
        if (!window.confirm(confirmMsg)) return;

        setIsLoading(true);
        try {
            const response = await fetch(appScriptUrl, { 
                method: 'POST', 
                body: JSON.stringify({ 
                    action: 'update_user', 
                    username: user.username, 
                    password: tempPassword,
                    passwordResetRequested: false, // Clear the request
                    preferences: { mustChangePassword: true } // Force them to change it
                }) 
            });
            const result = await response.json();
            if (result.status === 'success') {
                showToast("Password reset successful. Temporary password generated.", "success");
                alert(`SUCCESS: The user's password has been reset.\n\nTemporary Pass: ${tempPassword}\n\nProvide this to the staff member. They will be forced to change it upon login.`);
                fetchUsers(true);
            } else {
                showToast(result.message || "Reset failed.", "error");
            }
        } catch (e) {
            showToast("Sync error.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (user: User) => {
        if (user.role === 'SuperAdmin' && !isSuperAdmin) {
            showToast("Unauthorized: Admins cannot modify SuperAdmin credentials.", "error");
            return;
        }
        setFormData({ name: user.name || '', username: user.username, role: user.role as any, position: user.position || '', password: '', sendEmail: false });
        setOriginalUsername(user.username);
        setIsEditing(true);
        setViewMode('form');
    };

    const handleShare = async (u: User) => {
        const orgName = settings?.companyName || 'Fleet Portal';
        const msg = `*${orgName.toUpperCase()} STAFF*\n\n*Name:* ${u.name || 'N/A'}\n*ID:* ${u.username}\n*Role:* ${u.role}`;
        if (navigator.share) {
            try { await navigator.share({ title: 'Staff Identity', text: msg }); } catch (e) { if (e instanceof Error && e.name !== 'AbortError') fallbackCopy(msg); }
        } else { fallbackCopy(msg); }
    };

    const fallbackCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => showToast("Copied", "success")).catch(() => showToast("Failed", "error"));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.username) return;
        setIsSubmitting(true);
        try {
            const userRecord: User = {
                username: formData.username.trim().toLowerCase(),
                name: formData.name,
                role: formData.role,
                position: formData.position,
                password: formData.password || undefined,
                isActive: true,
                needsSetup: false,
                addedBy: isEditing ? undefined : (currentUser.name || currentUser.username),
                invitationStatus: isEditing ? undefined : 'invited',
                preferences: { mustChangePassword: !isEditing, emailNotifications: false, notifyGeneral: true, notifyPetroleumV2: true, notifyAcid: true }
            };

            // 1. PRIMARY: Write to Firebase Firestore first
            await saveUserToFirebase(userRecord);

            // 2. BACKUP: Sync to Google Spreadsheet
            if (appScriptUrl && appScriptUrl.startsWith('https')) {
                const payload: any = { 
                    action: isEditing ? 'update_user' : 'register_user', 
                    ...formData, 
                    groupEmail: settings?.groupEmail || '',
                    addedBy: isEditing ? undefined : currentUser.name || currentUser.username,
                    invitationStatus: isEditing ? undefined : 'invited',
                    preferences: { ... (isEditing ? {} : { mustChangePassword: true, emailNotifications: false }) } 
                };
                if (isEditing) payload.originalUsername = originalUsername;
                
                try {
                    await fetch(appScriptUrl, { method: 'POST', body: JSON.stringify(payload) });
                } catch (sheetErr) {
                    console.warn("Spreadsheet backup sync delayed:", sheetErr);
                }
            }

            showToast(isEditing ? "Updated" : (formData.sendEmail ? "Enrolled & Invitation Sent" : "Enrolled Successfully"), 'success');
            setViewMode('list');
            fetchUsers(true);
        } catch (e) { 
            showToast("Failed to save user", 'error'); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    if (viewMode === 'form') {
        return (
            <div className="max-w-2xl mx-auto py-4 flex flex-col items-center justify-center min-h-[calc(100vh-140px)] px-4 animate-fadeIn font-sans overflow-hidden">
                <div className="w-full space-y-4">
                    <button onClick={() => setViewMode('list')} className="text-[10px] font-medium text-slate-400 hover:text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
                        Back
                    </button>
                    <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 p-6 md:p-10">
                        <SectionHeader label={isEditing ? "Modify Profile" : "Staff Enrollment"} />
                        
                        {!isEditing && (
                            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3">
                                <span className="text-lg">📧</span>
                                <div className="flex-1">
                                    <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-tight leading-relaxed mb-3">
                                        Invitation Control: Decide if an automated secure invitation should be dispatched to the user.
                                    </p>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, sendEmail: !formData.sendEmail})}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${formData.sendEmail ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-indigo-200 text-indigo-600'}`}
                                    >
                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${formData.sendEmail ? 'bg-indigo-400' : 'bg-slate-200'}`}>
                                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${formData.sendEmail ? 'left-4.5' : 'left-0.5'}`} />
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-widest">
                                            {formData.sendEmail ? 'Email Enabled' : 'Email Disabled'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[9px] font-semibold uppercase text-slate-400 mb-1.5 tracking-widest">Email Address</label>
                                        <input type="email" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 text-sm" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="staff@domain.com" />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold uppercase text-slate-400 mb-1.5 tracking-widest">Role</label>
                                        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none h-[46px] appearance-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                                            <option value="Inspector">Inspector</option>
                                            <option value="Operations">Operations</option>
                                            <option value="Maintenance">Maintenance</option>
                                            <option value="Admin">Admin</option>
                                            {isSuperAdmin && <option value="SuperAdmin">SuperAdmin</option>}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <AutocompleteInput 
                                        label="Designation (Optional)" 
                                        value={formData.position} 
                                        onChange={v => setFormData({...formData, position: v})} 
                                        options={validationLists.positions} 
                                        isTitleCase={true} 
                                    />
                                    <div>
                                        <label className="block text-[9px] font-semibold uppercase text-slate-400 mb-1.5 tracking-widest">
                                            Password {isEditing ? '(Set to Update)' : '(Optional)'}
                                        </label>
                                        <input 
                                            type="password" 
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 text-sm" 
                                            value={formData.password} 
                                            onChange={e => setFormData({...formData, password: e.target.value})} 
                                            placeholder={isEditing ? "Leave blank to keep current" : "One-time entry if blank"} 
                                        />
                                    </div>
                                    {isEditing && (
                                        <AutocompleteInput label="Display Name" value={formData.name} onChange={v => setFormData({...formData, name: v})} options={validationLists.inspectors} isTitleCase={true} />
                                    )}
                                </div>
                            </div>
                            <div className="pt-2 flex justify-end">
                                <button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-10 py-3 bg-slate-900 hover:bg-black text-white font-medium rounded-xl transition-all text-[10px] uppercase tracking-widest active:scale-95">
                                    {isSubmitting ? 'Wait...' : isEditing ? 'Sync' : 'Enroll Personnel'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-2 flex flex-col min-h-[calc(100vh-140px)] px-2 sm:px-4 animate-fadeIn font-sans overflow-hidden">
            <div className="w-full flex-1 flex flex-col min-h-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2 mb-6 shrink-0">
                    <div>
                        <h2 className="text-3xl font-normal text-slate-800 uppercase tracking-tight leading-none">Staff Directory</h2>
                        <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mt-2">Access Control</p>
                    </div>
                    <button onClick={() => { setFormData({ name: '', username: '', password: '', role: 'Inspector', position: '', sendEmail: true }); setIsEditing(false); setViewMode('form'); }} className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-black text-white font-medium rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest active:scale-95">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M12 4v16m8-8H4"></path></svg>
                        Enroll Personnel
                    </button>
                </div>

                <div className="flex flex-col flex-1 min-h-0">
                    <SectionHeader label="Fleet Personnel" />
                    <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto scrollbar-hide">
                            <table className="w-full text-left text-sm border-collapse hidden md:table">
                                <thead className="bg-slate-50/50 text-[9px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-50 sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="px-8 py-4">Identity</th>
                                        <th className="px-8 py-4">Privileges</th>
                                        <th className="px-8 py-4">Audited By</th>
                                        <th className="px-8 py-4">State</th>
                                        <th className="px-8 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {isLoading ? (
                                        <tr><td colSpan={5} className="py-24 text-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mx-auto"></div></td></tr>
                                    ) : users.length === 0 ? (
                                        <tr><td colSpan={5} className="py-24 text-center text-[10px] font-medium text-slate-300 uppercase tracking-widest">No personnel logged</td></tr>
                                    ) : users.map((u, i) => (
                                        <tr key={i} className={`hover:bg-slate-50/30 transition-colors group ${!u.isActive && 'opacity-60'} ${u.passwordResetRequested ? 'bg-amber-50/40' : ''}`}>
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center font-semibold text-slate-300 text-[10px] shrink-0">{u.name ? u.name.substring(0, 2).toUpperCase() : '??'}</div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-medium text-slate-800 text-xs tracking-tight truncate uppercase">{u.name || 'Invite Pending'}</div>
                                                            {u.passwordResetRequested && (
                                                                <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" title="Password Reset Requested"></span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-normal truncate">{u.role === 'SuperAdmin' && !isSuperAdmin ? '••••••' : u.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex flex-col">
                                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-widest border w-fit ${u.role === 'Admin' || u.role === 'SuperAdmin' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                        {u.role}
                                                    </span>
                                                    {u.passwordResetRequested && (
                                                        <span className="text-[7px] text-amber-600 font-bold uppercase tracking-widest mt-1">Reset Requested</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-medium text-slate-600 truncate uppercase">{u.addedBy || 'System Admin'}</span>
                                                    <span className="text-[8px] text-slate-400 uppercase tracking-tighter">Onboarded</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <button onClick={() => handleToggleStatus(u)} disabled={u.role === 'SuperAdmin' && !isSuperAdmin} className={`relative inline-flex h-3.5 w-8 items-center rounded-full transition-all ${u.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${u.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {u.passwordResetRequested && (
                                                        <button 
                                                            onClick={() => handleResetPassword(u)} 
                                                            className="p-1.5 text-amber-500 hover:text-amber-700 transition-colors" 
                                                            title="Process Reset Request"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleEdit(u)} className={`p-1.5 transition-colors ${u.role === 'SuperAdmin' && !isSuperAdmin ? 'text-slate-200 cursor-not-allowed' : 'text-blue-400 hover:text-blue-600'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2.5"/></svg></button>
                                                    <button onClick={() => handleDelete(u)} className={`p-1.5 transition-colors ${u.role === 'SuperAdmin' && !isSuperAdmin ? 'text-slate-200 cursor-not-allowed' : 'text-rose-400 hover:text-rose-600'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2.5"/></svg></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* MOBILE TIGHT VIEW */}
                            <div className="md:hidden divide-y divide-slate-50">
                                {isLoading ? (
                                    <div className="py-24 text-center"><div className="w-6 h-6 border-2 border-slate-100 border-t-indigo-500 rounded-full animate-spin mx-auto"></div></div>
                                ) : users.length === 0 ? (
                                    <div className="py-24 text-center text-[10px] font-medium text-slate-300 uppercase tracking-widest">No Personnel</div>
                                ) : users.map((u, i) => (
                                    <div key={i} className={`p-3.5 flex flex-col gap-2.5 transition-all ${!u.isActive && 'opacity-60'}`}>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center font-semibold text-slate-300 text-[10px] shrink-0">{u.name ? u.name.substring(0, 2).toUpperCase() : '??'}</div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-slate-800 text-xs tracking-tight truncate uppercase leading-none">{u.name || 'Invite Pending'}</div>
                                                    <div className="text-[9px] text-slate-400 font-normal truncate mt-1">{u.role === 'SuperAdmin' && !isSuperAdmin ? '••••••' : u.username}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => handleEdit(u)} className={`p-1.5 rounded-lg ${u.role === 'SuperAdmin' && !isSuperAdmin ? 'text-slate-200 bg-slate-50 cursor-not-allowed' : 'text-blue-500 bg-blue-50'}`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                                                <button onClick={() => handleDelete(u)} className={`p-1.5 rounded-lg ${u.role === 'SuperAdmin' && !isSuperAdmin ? 'text-slate-200 bg-slate-50 cursor-not-allowed' : 'text-rose-500 bg-rose-50'}`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex flex-col">
                                                <div className="flex gap-2">
                                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-semibold uppercase tracking-widest border ${u.role === 'Admin' || u.role === 'SuperAdmin' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{u.role}</span>
                                                    {u.position && <span className="text-[8px] font-medium text-slate-400 uppercase tracking-tight self-center truncate max-w-[100px]">{u.position}</span>}
                                                </div>
                                                <div className="text-[7px] text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                    Audit: {u.addedBy || 'System'}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-semibold uppercase tracking-widest ${u.isActive ? 'text-emerald-500' : 'text-slate-300'}`}>{u.isActive ? 'Live' : 'Off'}</span>
                                                <button onClick={() => handleToggleStatus(u)} disabled={u.role === 'SuperAdmin' && !isSuperAdmin} className={`relative inline-flex h-3.5 w-8 items-center rounded-full transition-all ${u.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${u.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserManagementView;