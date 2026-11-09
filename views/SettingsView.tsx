import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SystemSettings, User, TemplateConfig } from '../types';
import { BACKEND_SCRIPT_TEMPLATE, BACKEND_FILES } from '../constants';
import { TemplateHeaderPreview } from '../components/TemplateHeaderPreview';
import { 
    testFirebaseConnection, 
    testSpreadsheetConnection, 
    getFirebaseLastSync, 
    getSheetLastSync,
    syncFirestoreToSpreadsheet,
    sendTestBackupPing,
    getBackupSyncStats,
    isFirestoreQuotaExceeded,
    clearFirestoreQuotaStatus
} from '../services/firebase';
import firebaseConfig from '../firebase-applet-config.json';

interface SettingsViewProps {
    settings: SystemSettings;
    setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
    appScriptUrl: string;
    setAppScriptUrl: (url: string) => void;
    handleSaveSettings: () => void;
    isSavingSettings: boolean;
    showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    user?: User | null;
}

const SectionHeader = ({ label }: { label: string }) => (
    <div className="w-full flex items-center gap-4 mb-6 opacity-60">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">{label}</span>
        <div className="h-px flex-1 bg-slate-200"></div>
    </div>
);

const SettingsView: React.FC<SettingsViewProps> = ({ 
    settings, setSettings, appScriptUrl, setAppScriptUrl, handleSaveSettings, isSavingSettings, user, showToast
}) => {
    const [logoError, setLogoError] = useState(false);
    const [activeTab, setActiveTab] = useState<'app' | 'backend'>('app');
    const [selectedBackendFile, setSelectedBackendFile] = useState<string>('1_Controller.gs');
    const [previewingTemplate, setPreviewingTemplate] = useState<{key: string, config: TemplateConfig} | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Real-Time Database Connection & Sync Status
    const [fbStatus, setFbStatus] = useState<'connected' | 'offline' | 'checking'>('checking');
    const [fbLatency, setFbLatency] = useState<number | null>(null);
    const [fbLastSync, setFbLastSync] = useState<string | null>(() => getFirebaseLastSync());
    const [fbQuotaExceeded, setFbQuotaExceeded] = useState<boolean>(() => isFirestoreQuotaExceeded());

    const [shStatus, setShStatus] = useState<'standby' | 'active_failover' | 'connected' | 'offline' | 'checking'>('standby');
    const [shLatency, setShLatency] = useState<number | null>(null);
    const [shLastSync, setShLastSync] = useState<string | null>(() => getSheetLastSync());

    const [isTestingConnections, setIsTestingConnections] = useState(false);
    const [isSyncingBackup, setIsSyncingBackup] = useState(false);
    const [backupProgressMsg, setBackupProgressMsg] = useState<string | null>(null);
    const [isTestingPing, setIsTestingPing] = useState(false);
    const [syncStats, setSyncStats] = useState<{ totalInspections: number; backedUpCount: number; pendingCount: number } | null>(null);

    const refreshSyncStats = async () => {
        try {
            const stats = await getBackupSyncStats();
            setSyncStats(stats);
        } catch {}
    };

    const routingMode = settings.databaseRoutingMode || 'smart';
    const manualTarget = settings.manualTarget || 'firebase';

    const checkRealTimeHealth = async (notify: boolean = false, forceFresh: boolean = false) => {
        setIsTestingConnections(true);
        setFbStatus('checking');
        setShStatus('checking');

        try {
            const [fbRes, shRes] = await Promise.all([
                testFirebaseConnection(forceFresh),
                testSpreadsheetConnection(appScriptUrl)
            ]);

            setFbStatus(fbRes.ok ? 'connected' : 'offline');
            setFbLatency(fbRes.ok ? fbRes.latencyMs : null);
            setFbQuotaExceeded(Boolean(fbRes.isQuota || isFirestoreQuotaExceeded()));
            setFbLastSync(getFirebaseLastSync());

            if (routingMode === 'manual' && manualTarget === 'spreadsheet') {
                setShStatus(shRes.ok ? 'connected' : (appScriptUrl ? 'offline' : 'standby'));
            } else {
                setShStatus(shRes.ok ? 'standby' : (appScriptUrl ? 'offline' : 'standby'));
            }
            setShLatency(shRes.ok ? shRes.latencyMs : null);
            setShLastSync(getSheetLastSync());

            if (notify) {
                if (fbRes.ok) {
                    showToast(`Firebase Online (${fbRes.latencyMs}ms)${shRes.ok ? ` • Spreadsheet Standby (${shRes.latencyMs}ms)` : ''}`, 'success');
                } else if (fbRes.isQuota) {
                    showToast("Firestore daily free read quota reached. Spreadsheet failover active.", 'warning');
                } else {
                    showToast("Firebase check degraded. Failover ready.", 'warning');
                }
            }
        } catch {
            setFbStatus('offline');
        } finally {
            setIsTestingConnections(false);
        }
    };

    useEffect(() => {
        checkRealTimeHealth(false);
        const onSync = () => {
            setFbLastSync(getFirebaseLastSync());
            setShLastSync(getSheetLastSync());
        };
        window.addEventListener('sc_db_sync', onSync);
        return () => window.removeEventListener('sc_db_sync', onSync);
    }, [appScriptUrl]);

    useEffect(() => {
        refreshSyncStats();
    }, [fbLastSync, shLastSync]);

    const handleRunBackupSync = async () => {
        if (!appScriptUrl || !appScriptUrl.startsWith('https://script.google.com')) {
            showToast("Please enter and save a valid Google Apps Script URL first.", "error");
            return;
        }
        setIsSyncingBackup(true);
        setBackupProgressMsg("Connecting to Firestore records...");
        try {
            const res = await syncFirestoreToSpreadsheet(appScriptUrl, (cur, tot, msg) => {
                setBackupProgressMsg(msg || `Syncing record ${cur} of ${tot}...`);
            });
            if (res.success) {
                showToast(`Backup Complete: ${res.syncedCount} records synced to Google Sheets.`, 'success');
                setShLastSync(getSheetLastSync());
                refreshSyncStats();
            } else {
                showToast(`Backup sync warning: ${res.error || 'Failed to sync'}`, 'error');
            }
        } catch (err: any) {
            showToast(`Sync error: ${err?.message || 'Connection interrupted'}`, 'error');
        } finally {
            setIsSyncingBackup(false);
            setBackupProgressMsg(null);
        }
    };

    const handleRunPingTest = async () => {
        if (!appScriptUrl || !appScriptUrl.startsWith('https://script.google.com')) {
            showToast("Script URL is not configured.", "error");
            return;
        }
        setIsTestingPing(true);
        try {
            const res = await sendTestBackupPing(appScriptUrl);
            if (res.ok) {
                showToast(`Spreadsheet Write Verified (${res.latencyMs}ms)! Connection and write permissions active.`, 'success');
                setShLastSync(getSheetLastSync());
            } else {
                showToast(`Test write failed: ${res.error || 'Endpoint rejected write'}`, 'error');
            }
        } catch (err: any) {
            showToast(`Test write error: ${err?.message || 'Network error'}`, 'error');
        } finally {
            setIsTestingPing(false);
        }
    };

    const [isSyncingGroup, setIsSyncingGroup] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupSyncData, setGroupSyncData] = useState<{
        subscribedCount?: number;
        groupEmail?: string;
        subscribers?: Array<{ email: string; name: string; role: string }>;
        groupUrl?: string;
    } | null>(null);

    const handleSyncGroupMembers = async () => {
        if (!appScriptUrl || !appScriptUrl.startsWith('https://script.google.com')) {
            showToast("Google Apps Script URL is not configured.", "error");
            return;
        }
        setIsSyncingGroup(true);
        try {
            const res = await fetch(appScriptUrl, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'sync_group_subscribers',
                    groupEmail: settings.groupEmail || 'juba_alerts@googlegroups.com'
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setGroupSyncData(data);
                setShowGroupModal(true);
                showToast(`Google Group synchronized: ${data.subscribedCount || 0} user(s) subscribed to group.`, 'success');
            } else {
                showToast(data.message || "Failed to sync group subscribers.", 'warning');
            }
        } catch (e: any) {
            showToast("Google Group sync request sent.", 'info');
        } finally {
            setIsSyncingGroup(false);
        }
    };

    const formatSyncTime = (isoString: string | null) => {
        if (!isoString) return 'Pending First Sync';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return 'Standby';
            const now = Date.now();
            const diffMs = now - date.getTime();
            if (diffMs < 60000) return 'Just now';
            if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch {
            return 'Standby';
        }
    };

    useEffect(() => { setLogoError(false); }, [settings.companyLogo]);

    const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';
    const isSuperAdmin = user?.role === 'SuperAdmin';

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1 * 1024 * 1024) {
            showToast("Logo must be under 1MB", "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target?.result as string;
            setSettings(s => ({ ...s, companyLogo: base64String }));
            showToast("Logo updated", "success");
        };
        reader.readAsDataURL(file);
    };

    const handleCopyFile = () => {
        const content = BACKEND_FILES[selectedBackendFile];
        navigator.clipboard.writeText(content);
        showToast(`${selectedBackendFile} copied to clipboard`, "success");
    };

    const handleCopyFullBackend = () => {
        navigator.clipboard.writeText(BACKEND_SCRIPT_TEMPLATE);
        showToast("Full Merged Script copied", "success");
    };

    const inputClasses = "w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all disabled:opacity-50";
    const labelClasses = "block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 ml-1";
    
    const handleTemplateChange = (moduleKey: string, field: keyof TemplateConfig, value: string) => {
        setSettings(prev => {
            const currentTemplates = prev.templates || {};
            const currentTemplate = currentTemplates[moduleKey] || {
                title: '',
                docNo: '',
                revisionNo: '',
                revisionDate: '',
                initialIssueDate: ''
            };
            
            return {
                ...prev,
                templates: {
                    ...currentTemplates,
                    [moduleKey]: {
                        ...currentTemplate,
                        [field]: value
                    }
                }
            };
        });
    };

    return (
        <div className="max-w-4xl mx-auto py-4 sm:py-8 space-y-8 animate-fadeIn px-2">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800 tracking-tight uppercase">System Configuration</h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">Manage workspace and cloud integration</p>
                </div>
                {!isAdmin && (
                    <div className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-lg">
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Read-Only</span>
                    </div>
                )}
             </div>

             <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                <button 
                    onClick={() => setActiveTab('app')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'app' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Application
                </button>
                {isSuperAdmin && (
                    <button 
                        onClick={() => setActiveTab('backend')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'backend' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Cloud Backend
                    </button>
                )}
             </div>

             {activeTab === 'app' ? (
                <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-10">
                    <section>
                        <div className="flex items-center justify-between mb-2">
                            <SectionHeader label="Organization & Group Email Broadcast" />
                            {isAdmin && (
                                <div className="flex items-center gap-2 shrink-0 -mt-3 sm:-mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowGroupModal(true)}
                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
                                        title="View Google Group status, web archive link, and delivery checklist"
                                    >
                                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Group Diagnostics
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSyncGroupMembers}
                                        disabled={isSyncingGroup}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-2xs"
                                        title="Synchronize all staff with email notifications enabled into Google Group"
                                    >
                                        <svg className={`w-3.5 h-3.5 text-indigo-500 ${isSyncingGroup ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        {isSyncingGroup ? 'Syncing...' : 'Sync Group Members'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className={labelClasses}>Organization Name</label>
                                <input type="text" disabled={!isAdmin} value={settings.companyName} onChange={(e) => setSettings(s => ({...s, companyName: e.target.value}))} className={inputClasses} placeholder="Enter company name" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className={labelClasses}>Google Group Email (Broadcast)</label>
                                    <a 
                                        href={`https://groups.google.com/g/${(settings.groupEmail || 'juba_alerts@googlegroups.com').split('@')[0]}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                                        title="Open group web archive to view all received inspection emails"
                                    >
                                        <span>Web Archive</span>
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </a>
                                </div>
                                <input type="email" disabled={!isAdmin} value={settings.groupEmail || ''} onChange={(e) => setSettings(s => ({...s, groupEmail: e.target.value}))} className={inputClasses} placeholder="juba_alerts@googlegroups.com" />
                                <p className="text-[9px] text-slate-400 font-medium mt-1">Inspection emails are dispatched exclusively to this Google Group. No individual users receive direct emails; delivery occurs solely via group subscription.</p>
                            </div>
                            <div className="space-y-1">
                                <label className={labelClasses}>System Service Email (Fallback)</label>
                                <input type="email" disabled={!isSuperAdmin} value={settings.managerEmail} onChange={(e) => setSettings(s => ({...s, managerEmail: e.target.value}))} className={inputClasses} placeholder="notification@scbcnet.com" />
                                {!isSuperAdmin && <p className="text-[9px] text-amber-500 font-bold uppercase mt-1">Contact SuperAdmin to modify system notification endpoint</p>}
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <SectionHeader label="Database Gateway & Real-Time Cloud Health" />
                            <button
                                type="button"
                                onClick={() => {
                                    clearFirestoreQuotaStatus();
                                    checkRealTimeHealth(true, true);
                                }}
                                disabled={isTestingConnections}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 shrink-0 -mt-6 active:scale-95 disabled:opacity-50"
                            >
                                <svg className={`w-3 h-3 text-slate-600 ${isTestingConnections ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {isTestingConnections ? 'Testing...' : 'Ping Status'}
                            </button>
                        </div>
                        
                        {/* Compact Real-Time Dual Database Status Strip */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Firebase Firestore Card */}
                            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-white/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                                {/* Firebase Official Flame Logo */}
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                    <path fill="#FFA000" d="M3.89 15.67L6.82.97a.78.78 0 011.45-.19l2.76 5.17-7.14 9.72z" />
                                                    <path fill="#F57F17" d="M12.92 7.74l1.6-3.05a.78.78 0 011.43.08l4.16 10.9-7.19-7.93z" />
                                                    <path fill="#FFCA28" d="M2.57 19.33l1.32-3.66 7.14-9.72-2.76-5.17a.78.78 0 00-1.45.19L3.89 15.67l-1.32 3.66z" />
                                                    <path fill="#FFA000" d="M2.57 19.33l8.52 4.79a1.86 1.86 0 001.82 0l8.52-4.79-1.32-3.66L12.92 7.74l-7.14 9.72-3.21 1.87z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black tracking-tight uppercase text-white">Firebase Firestore</span>
                                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-widest">
                                                        Live Primary
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-medium">Primary production database</p>
                                            </div>
                                        </div>

                                        {/* Connection State Badge */}
                                        <div className="flex items-center gap-1.5 shrink-0 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                                                fbStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
                                                fbStatus === 'checking' ? 'bg-amber-400 animate-spin' :
                                                fbQuotaExceeded ? 'bg-amber-400' : 'bg-rose-500'
                                            }`} />
                                            <span className={`text-[9px] font-black uppercase tracking-wider ${
                                                fbStatus === 'connected' ? 'text-emerald-300' :
                                                fbStatus === 'checking' ? 'text-amber-300' :
                                                fbQuotaExceeded ? 'text-amber-400' : 'text-rose-400'
                                            }`}>
                                                {fbStatus === 'connected' ? 'Online' : fbStatus === 'checking' ? 'Testing' : fbQuotaExceeded ? 'Failover Active' : 'Offline'}
                                            </span>
                                            {fbLatency !== null && fbStatus === 'connected' && (
                                                <span className="text-[8px] text-slate-400 font-mono">({fbLatency}ms)</span>
                                            )}
                                        </div>
                                    </div>

                                    {fbQuotaExceeded && (
                                        <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[9px] space-y-1.5">
                                            <div className="flex items-center justify-between text-amber-300 font-bold uppercase tracking-wider">
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    Daily Free Read Quota Reached
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        clearFirestoreQuotaStatus();
                                                        checkRealTimeHealth(true, true);
                                                    }}
                                                    className="text-[8px] bg-white/10 hover:bg-white/20 text-slate-200 px-2 py-0.5 rounded border border-white/10 transition-colors uppercase font-bold"
                                                >
                                                    Clear &amp; Recheck
                                                </button>
                                            </div>
                                            <p className="text-slate-300 leading-normal">
                                                Google Cloud free daily read quota was reached today and resets every 24h. The app is 100% operational via your connected Google Spreadsheet backup.
                                            </p>
                                            <a 
                                                href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-amber-400 hover:text-amber-300 underline font-semibold inline-flex items-center gap-1"
                                            >
                                                Upgrade database in Firebase Console ↗
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[9px]">
                                    <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                                        <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        <span>Last Sync: <strong className="text-white font-semibold">{formatSyncTime(fbLastSync)}</strong></span>
                                    </div>
                                    <span className="text-slate-400 font-mono text-[8px]">Payload: &lt;1.5KB/doc</span>
                                </div>
                            </div>

                            {/* Google Spreadsheet Backup Card */}
                            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-white/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                            {/* Google Sheets Official Icon */}
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                <path fill="#0F9D58" d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                                                <path fill="#87CEAB" d="M14.5 2v5.5H20L14.5 2z" />
                                                <path fill="#FFFFFF" d="M7 11.5h10v1H7zm0 2.5h10v1H7zm0 2.5h10v1H7z" />
                                                <path fill="#0B8043" d="M14.5 2L20 7.5V8h-5.5V2z" opacity="0.2" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black tracking-tight uppercase text-white">Google Spreadsheet</span>
                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest ${
                                                    routingMode === 'manual' && manualTarget === 'spreadsheet' 
                                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                        : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                                }`}>
                                                    {routingMode === 'manual' && manualTarget === 'spreadsheet' ? 'Manual Active' : 'Passive Backup'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium">Secondary failover storage</p>
                                        </div>
                                    </div>

                                    {/* Connection State Badge */}
                                    <div className="flex items-center gap-1.5 shrink-0 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                                            routingMode === 'manual' && manualTarget === 'spreadsheet' ? 'bg-amber-400 animate-pulse' :
                                            shStatus === 'standby' ? 'bg-sky-400' :
                                            shStatus === 'checking' ? 'bg-amber-400 animate-spin' :
                                            shStatus === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'
                                        }`} />
                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-200">
                                            {routingMode === 'manual' && manualTarget === 'spreadsheet' ? 'Direct Engaged' :
                                             shStatus === 'standby' ? 'Standby (Failover)' :
                                             shStatus === 'checking' ? 'Testing' :
                                             shStatus === 'connected' ? 'Connected' : 'Standby'}
                                        </span>
                                        {shLatency !== null && shStatus !== 'offline' && (
                                            <span className="text-[8px] text-slate-400 font-mono">({shLatency}ms)</span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[9px]">
                                    <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                                        <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        <span>Last Sync: <strong className="text-white font-semibold">{shLastSync ? formatSyncTime(shLastSync) : 'Standby (Zero Bloat)'}</strong></span>
                                    </div>
                                    <span className="text-emerald-400 text-[8px] font-bold uppercase tracking-wider">
                                        {routingMode === 'smart' ? 'Read/Write On Failure Only' : 'Manual Mode Active'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Database Routing Switch (Smart Switch vs Manual Switch) */}
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div>
                                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide block">Database Routing Switch</span>
                                    <span className="text-[9px] text-slate-500 font-medium">Configure whether the spreadsheet backup is engaged automatically or manually</span>
                                </div>

                                {/* Switch Selector Buttons */}
                                <div className="inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-300/60 shrink-0">
                                    <button
                                        type="button"
                                        disabled={!isAdmin}
                                        onClick={() => setSettings(s => ({ ...s, databaseRoutingMode: 'smart' }))}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                            routingMode === 'smart' 
                                                ? 'bg-slate-900 text-white shadow-sm' 
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                        Smart Switch
                                        <span className="text-[8px] font-extrabold px-1 rounded bg-emerald-500 text-slate-950 ml-0.5">Auto</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!isAdmin}
                                        onClick={() => setSettings(s => ({ ...s, databaseRoutingMode: 'manual' }))}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                            routingMode === 'manual' 
                                                ? 'bg-slate-900 text-white shadow-sm' 
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                                        Manual Switch
                                    </button>
                                </div>
                            </div>

                            {/* Active Mode Explanation & Manual Target Selector */}
                            {routingMode === 'smart' ? (
                                <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center gap-2.5 text-[9px] text-emerald-800 font-medium">
                                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                                    <span>
                                        <strong>Smart Auto-Failover Active:</strong> All inspections, users, and queries execute directly on <strong>Firebase Firestore</strong>. The backup spreadsheet remains strictly dormant and will <strong>only be read/written directly if Firebase fails</strong> or goes offline.
                                    </span>
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                                            Manual Database Override Target:
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={!isAdmin}
                                                onClick={() => setSettings(s => ({ ...s, manualTarget: 'firebase' }))}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                                                    manualTarget === 'firebase'
                                                        ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                                                        : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
                                                }`}
                                            >
                                                Firebase Direct (Live)
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!isAdmin}
                                                onClick={() => setSettings(s => ({ ...s, manualTarget: 'spreadsheet' }))}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                                                    manualTarget === 'spreadsheet'
                                                        ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                                                        : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
                                                }`}
                                            >
                                                Spreadsheet Direct (Failover)
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-amber-800 font-medium">
                                        {manualTarget === 'firebase' 
                                            ? "Direct mode: Forces 100% of operations to Firebase Firestore only." 
                                            : "Manual failover: Forces all operations to read and write directly to your Google Spreadsheet backup."}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className={labelClasses}>Cloud Backup Script URL (Google Sheets)</label>
                                        <button
                                            type="button"
                                            onClick={handleRunPingTest}
                                            disabled={isTestingPing || !appScriptUrl}
                                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-all flex items-center gap-1 -mt-1"
                                        >
                                            <svg className={`w-3 h-3 ${isTestingPing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                            {isTestingPing ? 'Testing...' : 'Test Write Ping'}
                                        </button>
                                    </div>
                                    <input type="url" disabled={!isSuperAdmin} value={appScriptUrl} onChange={(e) => setAppScriptUrl(e.target.value)} placeholder="https://script.google.com/..." className={inputClasses} />
                                    <p className="text-[9px] text-slate-500 font-medium mt-1">
                                        Google Apps Script endpoint for secondary backup storage and automated email distribution.
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClasses}>Mobile App (APK) Link</label>
                                    <input type="url" disabled={!isSuperAdmin} value={settings.mobileApkLink || ''} onChange={(e) => setSettings(s => ({...s, mobileApkLink: e.target.value}))} placeholder="Download link for mobile app" className={inputClasses} />
                                    {!isSuperAdmin && <p className="text-[9px] text-amber-500 font-bold uppercase mt-1">Mobile deployment link is restricted to SuperAdmin</p>}
                                </div>
                            </div>

                            {/* Firestore to Spreadsheet Active Backup & Mirroring Controls */}
                            <div className="mt-4 p-4 bg-white border border-slate-200 rounded-xl space-y-3.5">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-wide">
                                                Firestore &rarr; Spreadsheet Cloud Backup
                                            </span>
                                            {syncStats && (
                                                <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase font-mono">
                                                    {syncStats.backedUpCount}/{syncStats.totalInspections} Backed Up
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-slate-500 font-medium mt-0.5">
                                            Keep your secondary Google Spreadsheet synchronized with all Firestore inspections with zero-bloat sanitized rows (&lt;1KB, no photos).
                                        </p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            disabled={!isAdmin || isSyncingBackup || !appScriptUrl}
                                            onClick={handleRunBackupSync}
                                            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <svg className={`w-3.5 h-3.5 ${isSyncingBackup ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            {isSyncingBackup ? 'Syncing Now...' : 'Sync Firestore to Spreadsheet Now'}
                                        </button>
                                    </div>
                                </div>

                                {backupProgressMsg && (
                                    <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-2 text-[9px] font-bold text-indigo-800 animate-pulse">
                                        <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></div>
                                        <span>{backupProgressMsg}</span>
                                    </div>
                                )}

                                {/* Backup Mode Selector (Continuous Mirroring vs Dormant Standby) */}
                                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-700 uppercase tracking-wide block">
                                            Automated Submission Mirroring:
                                        </span>
                                        <span className="text-[8px] text-slate-400 font-medium">
                                            {settings.cloudBackupSync === 'standby_failover'
                                                ? 'Dormant: Spreadsheet receives writes ONLY if Firebase fails or is offline.'
                                                : 'Active Mirror: Inspections save to Firebase (primary) and mirror to Google Sheets in background.'}
                                        </span>
                                    </div>

                                    <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
                                        <button
                                            type="button"
                                            disabled={!isAdmin}
                                            onClick={() => setSettings(s => ({ ...s, cloudBackupSync: 'auto_mirror' }))}
                                            className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all ${
                                                settings.cloudBackupSync !== 'standby_failover'
                                                    ? 'bg-white text-indigo-700 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            Continuous Mirror (Active)
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!isAdmin}
                                            onClick={() => setSettings(s => ({ ...s, cloudBackupSync: 'standby_failover' }))}
                                            className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all ${
                                                settings.cloudBackupSync === 'standby_failover'
                                                    ? 'bg-white text-slate-900 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            Standby Failover Only
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <SectionHeader label="Module Governance" />
                        <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-6 lg:p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[
                                    { id: 'general', name: 'General Cargo Inspection', desc: 'Standard vehicle audit flow' },
                                    { id: 'petroleum_v2', name: 'Petroleum Tanker', desc: 'Advanced enterprise tanker flow' },
                                    { id: 'acid', name: 'Chemical / Acid', desc: 'Hazardous material audit protocol' },
                                    { id: 'registry', name: 'Equipment Registry', desc: 'Asset and fleet tracking' },
                                    { id: 'analytics', name: 'Analytics Hub', desc: 'Data-driven performance insights' },
                                    { id: 'track_requests', name: 'Request Tracking', desc: 'Inspection request workflow' }
                                ].map((mod) => (
                                    <div key={mod.id} className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm transition-all hover:shadow-md">
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">{mod.name}</p>
                                            <p className="text-[8px] text-slate-400 uppercase tracking-[0.1em] mt-0.5">{mod.desc}</p>
                                        </div>
                                        <button 
                                            disabled={!isAdmin}
                                            onClick={() => setSettings(prev => ({
                                                ...prev,
                                                enabledModules: {
                                                    ...(prev.enabledModules || {}),
                                                    [mod.id]: !(prev.enabledModules?.[mod.id] !== false)
                                                }
                                            }))}
                                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${settings.enabledModules?.[mod.id] !== false ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.enabledModules?.[mod.id] !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 flex items-start gap-3 bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-xl">
                                <svg className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                <p className="text-[9px] font-medium text-indigo-700/80 uppercase tracking-widest leading-loose">
                                    Disabling a module hides it from the dashboard for all users. All related data in the cloud remains safe and accessible via direct database queries.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <SectionHeader label="Template Configuration" />
                        <div className="space-y-8">
                            {Object.entries(settings.templates || {}).map(([key, config]) => (
                                <div key={key} className="p-6 bg-slate-50/50 border border-slate-100 rounded-[2rem] space-y-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{key.replace('_', ' ')}</h4>
                                        </div>
                                        <button 
                                            onClick={() => setPreviewingTemplate({ key, config })}
                                            className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-500 uppercase tracking-tighter hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center gap-2 group"
                                        >
                                            <svg className="w-3 h-3 text-slate-400 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                            Preview Header
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className={labelClasses}>Document Title</label>
                                            <input 
                                                type="text" 
                                                disabled={!isAdmin} 
                                                value={config.title} 
                                                onChange={(e) => handleTemplateChange(key, 'title', e.target.value)} 
                                                className={inputClasses} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClasses}>Doc No.</label>
                                            <input 
                                                type="text" 
                                                disabled={!isAdmin} 
                                                value={config.docNo} 
                                                onChange={(e) => handleTemplateChange(key, 'docNo', e.target.value)} 
                                                className={inputClasses} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClasses}>Revision No.</label>
                                            <input 
                                                type="text" 
                                                disabled={!isAdmin} 
                                                value={config.revisionNo} 
                                                onChange={(e) => handleTemplateChange(key, 'revisionNo', e.target.value)} 
                                                className={inputClasses} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClasses}>Revision Date</label>
                                            <input 
                                                type="text" 
                                                disabled={!isAdmin} 
                                                value={config.revisionDate} 
                                                onChange={(e) => handleTemplateChange(key, 'revisionDate', e.target.value)} 
                                                className={inputClasses} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClasses}>Initial Issue Date</label>
                                            <input 
                                                type="text" 
                                                disabled={!isAdmin} 
                                                value={config.initialIssueDate} 
                                                onChange={(e) => handleTemplateChange(key, 'initialIssueDate', e.target.value)} 
                                                className={inputClasses} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClasses}>Next Revision Date</label>
                                            <input 
                                                type="text" 
                                                disabled={!isAdmin} 
                                                value={config.nextRevisionDate || ''} 
                                                onChange={(e) => handleTemplateChange(key, 'nextRevisionDate', e.target.value)} 
                                                className={inputClasses} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <SectionHeader label="Branding" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            <div className="space-y-3">
                                <label className={labelClasses}>Company Logo</label>
                                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload} disabled={!isAdmin} />
                                <button onClick={() => fileInputRef.current?.click()} disabled={!isAdmin} className="w-full py-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-all disabled:opacity-50">
                                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Upload Identity</span>
                                </button>
                            </div>
                            <div className="flex flex-col">
                                <label className={labelClasses}>Preview</label>
                                <div className="w-full h-32 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center p-4">
                                    {settings.companyLogo && !logoError ? (
                                        <img src={settings.companyLogo} alt="Preview" className="max-h-full object-contain" onError={() => setLogoError(true)} />
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-300 uppercase">No Logo Configured</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {isAdmin && (
                        <div className="pt-6 border-t border-slate-100 flex justify-end">
                            <button onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full sm:w-auto px-10 py-3.5 bg-slate-900 hover:bg-black text-white font-black rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 text-[10px] uppercase tracking-[0.2em]">
                                {isSavingSettings ? 'Synchronizing...' : 'Save All Changes'}
                            </button>
                        </div>
                    )}
                </div>
             ) : (
                <div className="bg-slate-900 p-6 sm:p-10 rounded-[2.5rem] shadow-2xl border border-white/5 space-y-8 animate-fadeIn">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="max-w-md">
                            <h3 className="text-white text-lg font-black uppercase tracking-tight">Cloud Integration Engine</h3>
                            <p className="text-slate-400 text-[10px] font-medium leading-relaxed mt-2 uppercase tracking-widest">
                                Your private fleet backend is modular. Copy each file below into your Google Sheet script editor for a complete deployment.
                            </p>
                            <div className="mt-4 space-y-2">
                                <div className="p-3.5 bg-slate-800/80 border border-white/10 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                                            Apps Script Required File Names (9 Files):
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const fileList = Object.keys(BACKEND_FILES).join('\n');
                                                navigator.clipboard.writeText(fileList);
                                                showToast("File names copied to clipboard", "success");
                                            }}
                                            className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[8px] font-black uppercase tracking-wider transition-all"
                                        >
                                            Copy Names
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[9px] font-mono text-slate-300">
                                        <div>1. <strong className="text-white">1_Controller.gs</strong></div>
                                        <div>2. <strong className="text-white">2_AuthAndAdmin.gs</strong></div>
                                        <div>3. <strong className="text-white">3_CoreOperations.gs</strong></div>
                                        <div>4. <strong className="text-white">4_SupportModule.gs</strong></div>
                                        <div>5. <strong className="text-white">5_LibAndUtils.gs</strong></div>
                                        <div>6. <strong className="text-emerald-400">EmergencyRepair.gs</strong></div>
                                        <div>7. <strong className="text-white">GeneralreportPDF.gs</strong></div>
                                        <div>8. <strong className="text-white">AcidreportPDF.gs</strong></div>
                                        <div>9. <strong className="text-white">PetroV2reportPDF.gs</strong></div>
                                    </div>
                                </div>
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest leading-loose">
                                        <span className="bg-emerald-500 text-slate-900 px-1 rounded mr-1">Anti-Bloat Protection</span>
                                        Spreadsheet backup is strictly dormant and triggers directly only if Firebase fails. Run <code className="text-white font-mono">EmergencyRepair.gs</code> if an old sheet ever hit Google's size limits.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button 
                                onClick={handleCopyFile}
                                className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                            >
                                Copy File
                            </button>
                            <button 
                                onClick={handleCopyFullBackend}
                                className="flex-1 md:flex-none px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 border border-white/5"
                            >
                                Copy Full (All)
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* File Explorer Sidebar */}
                        <div className="lg:w-64 shrink-0 space-y-1.5">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-2">Project Files</h4>
                            {Object.keys(BACKEND_FILES).map((fileName) => (
                                <button
                                    key={fileName}
                                    onClick={() => setSelectedBackendFile(fileName)}
                                    className={`w-full px-4 py-3 rounded-xl text-left text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-between group
                                        ${selectedBackendFile === fileName 
                                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20' 
                                            : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <svg className={`w-3.5 h-3.5 ${selectedBackendFile === fileName ? 'text-indigo-200' : 'text-slate-600 group-hover:text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                        <span className="truncate">{fileName}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Code Display Area */}
                        <div className="flex-1 relative group">
                            <div className="absolute inset-0 bg-indigo-500/5 blur-2xl rounded-3xl group-hover:bg-indigo-500/10 transition-colors"></div>
                            <div className="relative h-[450px] bg-black/40 border border-white/10 rounded-3xl p-6 overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">{selectedBackendFile}</span>
                                    <span className="text-[8px] font-bold text-slate-600 uppercase">Google Apps Script</span>
                                </div>
                                <pre className="flex-1 text-indigo-300/80 font-mono text-[10px] leading-relaxed overflow-y-auto scrollbar-hide select-all">
                                    {BACKEND_FILES[selectedBackendFile]}
                                </pre>
                                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none"></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-950/40 border border-indigo-900/50 p-6 rounded-[2rem] space-y-4">
                        <h4 className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">Deployment Checklist</h4>
                        <ul className="text-slate-300 text-[10px] font-medium space-y-2 list-disc pl-4">
                            <li>Create a new <span className="text-white">Apps Script</span> project within your Google Sheet.</li>
                            <li>Add files in the script editor matching the names on the left (e.g. 1_Controller.gs).</li>
                            <li>Paste the corresponding code for each file.</li>
                            <li>Click <span className="text-white">Deploy &gt; New Deployment</span>.</li>
                            <li>Set "Who has access" to <span className="text-white font-bold uppercase text-emerald-400">"Anyone"</span>.</li>
                        </ul>
                    </div>
                </div>
             )}

             {/* Template Header Preview Modal */}
             <AnimatePresence>
                {previewingTemplate && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
                    >
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPreviewingTemplate(null)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        ></motion.div>

                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
                            style={{ height: 'auto', maxHeight: '90vh' }}
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Document Header Preview</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Report Type: {previewingTemplate.key.replace('_', ' ')}</p>
                                </div>
                                <button 
                                    onClick={() => setPreviewingTemplate(null)}
                                    className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>

                            <div className="flex-1 p-4 sm:p-12 overflow-hidden flex items-center justify-center bg-slate-100/50">
                                <div className="w-full max-w-4xl shadow-lg transform origin-top md:scale-100 scale-75 overflow-visible">
                                    <TemplateHeaderPreview 
                                        config={previewingTemplate.config} 
                                        logoUrl={settings.companyLogo}
                                        type={previewingTemplate.key as any}
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-indigo-600 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">This is how the document header will look on your generated PDF reports.</p>
                                <button 
                                    onClick={() => setPreviewingTemplate(null)}
                                    className="w-full sm:w-auto px-8 py-2 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-md active:scale-95"
                                >
                                    Got it, Back to settings
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
             </AnimatePresence>

             {/* Google Group Diagnostic & Subscriber Verification Modal */}
             <AnimatePresence>
                {showGroupModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
                    >
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowGroupModal(false)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        ></motion.div>

                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Google Group Broadcast & Subscriber Verification</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                            Destination: <span className="text-indigo-600 lowercase font-mono">{settings.groupEmail || 'juba_alerts@googlegroups.com'}</span>
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowGroupModal(false)}
                                    className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>

                            {/* Content Body */}
                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-700">
                                {/* Direct Links Quick Bar */}
                                <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="space-y-1 text-center sm:text-left">
                                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">Google Groups Web Portal</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400">All dispatched inspection reports are permanently archived in the group account.</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <a 
                                            href={`https://groups.google.com/g/${(settings.groupEmail || 'juba_alerts@googlegroups.com').split('@')[0]}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                        >
                                            <span>View Group Archive</span>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                        </a>
                                        <a 
                                            href={`https://groups.google.com/g/${(settings.groupEmail || 'juba_alerts@googlegroups.com').split('@')[0]}/members`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 border border-white/10"
                                        >
                                            <span>Manage Members</span>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                                        </a>
                                    </div>
                                </div>

                                {/* Question 1: How do I know users are subscribed & does mail show in group? */}
                                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase tracking-wider">
                                        <span className="w-5 h-5 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                                        Where do inspection emails show up, and how do I know users are subscribed?
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
                                        <div className="bg-white p-3.5 rounded-xl border border-indigo-100/80 shadow-2xs">
                                            <p className="font-bold text-slate-800 mb-1">In Google Groups Archive:</p>
                                            <p className="leading-relaxed">
                                                A Google Group operates as an archived email repository. Every inspection email sent to <span className="font-mono text-indigo-600 font-semibold">{settings.groupEmail || 'juba_alerts@googlegroups.com'}</span> is stored under <strong>Conversations</strong> at <a href={`https://groups.google.com/g/${(settings.groupEmail || 'juba_alerts@googlegroups.com').split('@')[0]}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">groups.google.com</a>.
                                            </p>
                                        </div>
                                        <div className="bg-white p-3.5 rounded-xl border border-indigo-100/80 shadow-2xs">
                                            <p className="font-bold text-slate-800 mb-1">In Database & Group Subscribers Sheet:</p>
                                            <p className="leading-relaxed">
                                                In your connected Google Spreadsheet, the <strong>Group_Subscribers</strong> sheet records all staff members who have enabled email alerts, along with their status (<span className="text-emerald-600 font-bold">SUBSCRIBED</span>).
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Question 2: Why are subscribers not receiving emails? */}
                                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                                        <span className="w-5 h-5 rounded-lg bg-amber-500 text-white flex items-center justify-center text-[10px]">2</span>
                                        Why subscribers may not receive emails (4 Google Groups Settings Checklist)
                                    </div>
                                    <div className="space-y-2.5 text-xs text-slate-700">
                                        <div className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-black rounded text-[9px] uppercase tracking-wider shrink-0 mt-0.5">Crucial</span>
                                            <div>
                                                <strong className="text-slate-900">1. "Who can post" Permission:</strong> In <a href={`https://groups.google.com/g/${(settings.groupEmail || 'juba_alerts@googlegroups.com').split('@')[0]}/settings`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">Group Settings &gt; General</a>, set <strong>Who can post</strong> to <span className="font-bold text-emerald-700">"Anyone on the web"</span>. If set to "Group members" only, Google Groups silently rejects inspection reports sent from your script.
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-black rounded text-[9px] uppercase tracking-wider shrink-0 mt-0.5">Crucial</span>
                                            <div>
                                                <strong className="text-slate-900">2. Spam Moderation:</strong> In <a href={`https://groups.google.com/g/${(settings.groupEmail || 'juba_alerts@googlegroups.com').split('@')[0]}/settings`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">Group Settings &gt; Posting policies</a>, set <strong>Spam moderation</strong> to <span className="font-bold text-emerald-700">"Skip the moderation queue and post to group"</span>. Otherwise, inspection reports with PDF attachments are held in the "Pending" tab!
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-black rounded text-[9px] uppercase tracking-wider shrink-0 mt-0.5">Check</span>
                                            <div>
                                                <strong className="text-slate-900">3. Member Subscription Setting:</strong> In the <a href={`https://groups.google.com/g/${(settings.groupEmail || 'juba_alerts@googlegroups.com').split('@')[0]}/members`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">Members tab</a>, ensure each subscriber has their subscription set to <span className="font-bold text-indigo-700">"Each email"</span> (not "No email" or "Digest").
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-black rounded text-[9px] uppercase tracking-wider shrink-0 mt-0.5">Info</span>
                                            <div>
                                                <strong className="text-slate-900">4. Gmail Self-Delivery Suppression:</strong> Google Groups automatically suppresses sending a copy back to the Google account that submitted the inspection (standard Gmail deduplication). To test delivery, verify using another member's inbox or check the group web archive!
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Clarification on Why 1 Person Received Emails & Why Members Weren't in Portal */}
                                <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 space-y-2.5 text-xs text-slate-700">
                                    <div className="flex items-center gap-2 text-blue-900 font-black text-xs uppercase tracking-wider">
                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Resolution & Member Status Explanation
                                    </div>
                                    <p className="leading-relaxed">
                                        <strong>Why only 1 recipient received emails and wasn't listed in "Members":</strong> In Google Groups, the group creator is categorized as an <em>Owner/Manager</em>, not a standard member (change the role filter in the Google Groups portal from "Members" to "All" or "Owners" to see them), or they are configured as the notification contact.
                                    </p>
                                    <p className="leading-relaxed">
                                        <strong>Why the other 3 users weren't in the Google Groups portal:</strong> Google security rules do not allow external web scripts to inject members into a <span className="font-mono">@googlegroups.com</span> group without Google Workspace Admin Directory API privileges.
                                    </p>
                                    <p className="leading-relaxed text-indigo-900 font-semibold bg-white/80 p-3 rounded-xl border border-blue-200/60">
                                        ✓ <strong>Quota Optimization Mode (1 Quota Unit per Inspection):</strong> The backend dispatches strictly to <span className="font-mono text-indigo-700">{settings.groupEmail || 'juba_alerts@googlegroups.com'}</span> with ZERO BCC. Google Groups handles all member distribution across your staff without consuming your daily script email quota!
                                    </p>
                                </div>

                                {/* Subscribed Staff Roster */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                                Subscribed Staff Members ({groupSyncData?.subscribers?.length || groupSyncData?.subscribedCount || 0})
                                            </h4>
                                            <span className="text-[10px] text-slate-400 font-medium">From User Accounts</span>
                                        </div>
                                        {groupSyncData?.subscribers && groupSyncData.subscribers.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const emails = groupSyncData.subscribers!.map(s => s.email).join(', ');
                                                    navigator.clipboard.writeText(emails);
                                                    showToast("Subscriber emails copied! Paste into Google Groups 'Add members'.", "success");
                                                }}
                                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95"
                                            >
                                                <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                                                Copy All Emails for Google Groups
                                            </button>
                                        )}
                                    </div>

                                    {groupSyncData?.subscribers && groupSyncData.subscribers.length > 0 ? (
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                    <tr>
                                                        <th className="py-2.5 px-4">Staff Member</th>
                                                        <th className="py-2.5 px-4">Email</th>
                                                        <th className="py-2.5 px-4">Role</th>
                                                        <th className="py-2.5 px-4 text-right">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                                                    {groupSyncData.subscribers.map((sub, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50">
                                                            <td className="py-2.5 px-4 font-bold text-slate-800">{sub.name}</td>
                                                            <td className="py-2.5 px-4 font-mono text-[11px] text-indigo-600">{sub.email}</td>
                                                            <td className="py-2.5 px-4"><span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] uppercase font-bold text-slate-600">{sub.role}</span></td>
                                                            <td className="py-2.5 px-4 text-right">
                                                                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                    Subscribed
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                                            <p className="text-xs text-slate-500 font-medium">Click "Sync Group Members" in settings to load and audit the live subscriber list from your database.</p>
                                            <button
                                                type="button"
                                                onClick={handleSyncGroupMembers}
                                                disabled={isSyncingGroup}
                                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                            >
                                                {isSyncingGroup ? 'Syncing...' : 'Sync & Load Subscribed Staff Now'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-center sm:text-left">
                                    Google Group: {settings.groupEmail || 'juba_alerts@googlegroups.com'}
                                </p>
                                <button 
                                    onClick={() => setShowGroupModal(false)}
                                    className="w-full sm:w-auto px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
             </AnimatePresence>
        </div>
    );
}

export default SettingsView;