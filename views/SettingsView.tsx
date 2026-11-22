import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SystemSettings, User, TemplateConfig } from '../types';
import { BACKEND_SCRIPT_TEMPLATE, BACKEND_FILES } from '../constants';
import { TemplateHeaderPreview } from '../components/TemplateHeaderPreview';
import { InvoicingSystem } from '../components/settings/InvoicingSystem';
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
    initialTab?: 'app' | 'invoicing' | 'backend';
}

type AppSectionKey = 'org' | 'database' | 'modules' | 'templates' | 'branding';

const SettingsView: React.FC<SettingsViewProps> = ({ 
    settings, setSettings, appScriptUrl, setAppScriptUrl, handleSaveSettings, isSavingSettings, user, showToast, initialTab = 'app'
}) => {
    const [logoError, setLogoError] = useState(false);
    const [activeTab, setActiveTab] = useState<'app' | 'invoicing' | 'backend'>(initialTab);
    const [activeSection, setActiveSection] = useState<AppSectionKey>('org');
    const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(() => Object.keys(settings.templates || {})[0] || 'general');
    const [selectedBackendFile, setSelectedBackendFile] = useState<string>('1_Controller.gs');
    const [previewingTemplate, setPreviewingTemplate] = useState<{key: string, config: TemplateConfig} | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

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
        setBackupProgressMsg("Syncing Firestore records...");
        try {
            const res = await syncFirestoreToSpreadsheet(appScriptUrl, (cur, tot, msg) => {
                setBackupProgressMsg(msg || `Syncing ${cur}/${tot}...`);
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
                showToast(`Spreadsheet Write Verified (${res.latencyMs}ms).`, 'success');
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
                showToast(`Google Group synchronized: ${data.subscribedCount || 0} subscriber(s).`, 'success');
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
        if (!isoString) return 'Pending';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return 'Standby';
            const diffMs = Date.now() - date.getTime();
            if (diffMs < 60000) return 'Just now';
            if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Standby';
        }
    };

    useEffect(() => { setLogoError(false); }, [settings.companyLogo]);

    const cleanRole = String(user?.role || '').trim().toLowerCase();
    const isSuperAdmin = cleanRole === 'superadmin' || cleanRole === 'super admin';
    const isAdmin = isSuperAdmin || cleanRole === 'admin';

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
        showToast(`${selectedBackendFile} copied`, "success");
    };

    const handleCopyFullBackend = () => {
        navigator.clipboard.writeText(BACKEND_SCRIPT_TEMPLATE);
        showToast("Full Script copied", "success");
    };

    const inputClasses = "w-full px-3 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all disabled:opacity-50";
    const labelClasses = "block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1";

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

    const templateEntries = Object.entries(settings.templates || {});
    const activeTemplateKey = settings.templates?.[selectedTemplateKey]
        ? selectedTemplateKey
        : (templateEntries[0]?.[0] || '');
    const activeTemplateConfig = activeTemplateKey ? settings.templates?.[activeTemplateKey] : undefined;

    return (
        <div className="max-w-5xl mx-auto py-1 sm:py-3 space-y-2.5 sm:space-y-3 animate-fadeIn px-1 sm:px-3 w-full">
             {/* Compact Header + Main Navigation Bar */}
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">System Settings</h2>
                    {!isAdmin && (
                        <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-[10px] font-bold text-amber-700 uppercase">Read-Only</span>
                    )}
                </div>

                <div className="grid grid-cols-3 sm:flex gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
                    <button 
                        type="button"
                        onClick={() => setActiveTab('app')}
                        className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all truncate ${activeTab === 'app' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        Application
                    </button>
                    {isAdmin && (
                        <button 
                            type="button"
                            onClick={() => setActiveTab('invoicing')}
                            className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all truncate ${activeTab === 'invoicing' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Invoicing
                        </button>
                    )}
                    {isSuperAdmin && (
                        <button 
                            type="button"
                            onClick={() => setActiveTab('backend')}
                            className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all truncate ${activeTab === 'backend' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Backend
                        </button>
                    )}
                </div>
             </div>

             {activeTab === 'invoicing' && isAdmin ? (
                <InvoicingSystem
                    settings={settings}
                    setSettings={setSettings}
                    handleSaveSettings={handleSaveSettings}
                    isSavingSettings={isSavingSettings}
                    user={user}
                    showToast={showToast}
                />
             ) : activeTab === 'app' ? (
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    {/* Sub-Section Switcher (Zero Vertical Scrolling on Mobile) */}
                    <div className="grid grid-cols-5 sm:inline-flex gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
                        {([
                            { id: 'org', label: 'Org' },
                            { id: 'database', label: 'Database' },
                            { id: 'modules', label: 'Modules' },
                            { id: 'templates', label: 'Templates' },
                            { id: 'branding', label: 'Branding' }
                        ] as { id: AppSectionKey; label: string }[]).map(sec => (
                            <button
                                key={sec.id}
                                type="button"
                                onClick={() => setActiveSection(sec.id)}
                                className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all truncate ${
                                    activeSection === sec.id
                                        ? 'bg-slate-900 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {sec.label}
                            </button>
                        ))}
                    </div>

                    {/* 1. Organization & Group Broadcast */}
                    {activeSection === 'org' && (
                        <section className="space-y-3.5 animate-fadeIn">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Organization &amp; Group Broadcast</span>
                                {isAdmin && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setShowGroupModal(true)}
                                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-indigo-200 transition-all"
                                        >
                                            Diagnostics
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSyncGroupMembers}
                                            disabled={isSyncingGroup}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-slate-200 transition-all disabled:opacity-50"
                                        >
                                            {isSyncingGroup ? 'Syncing...' : 'Sync Members'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                                <div>
                                    <label className={labelClasses}>Organization Name</label>
                                    <input type="text" disabled={!isAdmin} value={settings.companyName} onChange={(e) => setSettings(s => ({...s, companyName: e.target.value}))} className={inputClasses} placeholder="Company name" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between">
                                        <label className={labelClasses}>Google Group Email</label>
                                        <a 
                                            href={`https://groups.google.com/g/${(settings.groupEmail || 'juba_alerts@googlegroups.com').split('@')[0]}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-[10px] font-semibold text-indigo-600 hover:underline mb-1"
                                        >
                                            Archive ↗
                                        </a>
                                    </div>
                                    <input type="email" disabled={!isAdmin} value={settings.groupEmail || ''} onChange={(e) => setSettings(s => ({...s, groupEmail: e.target.value}))} className={inputClasses} placeholder="juba_alerts@googlegroups.com" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Service Email (Fallback)</label>
                                    <input type="email" disabled={!isSuperAdmin} value={settings.managerEmail} onChange={(e) => setSettings(s => ({...s, managerEmail: e.target.value}))} className={inputClasses} placeholder="notification@scbcnet.com" />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* 2. Database Gateway & Sync */}
                    {activeSection === 'database' && (
                        <section className="space-y-3 animate-fadeIn">
                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Database &amp; Failover</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        clearFirestoreQuotaStatus();
                                        checkRealTimeHealth(true, true);
                                    }}
                                    disabled={isTestingConnections}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-slate-200 transition-all disabled:opacity-50"
                                >
                                    {isTestingConnections ? 'Testing...' : 'Ping Status'}
                                </button>
                            </div>

                            {/* Compact Status Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-tight">Firebase Firestore</p>
                                        <p className="text-[10px] text-slate-400">Sync: {formatSyncTime(fbLastSync)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {fbQuotaExceeded && (
                                            <a
                                                href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] text-amber-400 underline font-semibold"
                                            >
                                                Upgrade
                                            </a>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            fbStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300' :
                                            fbStatus === 'checking' ? 'bg-amber-500/20 text-amber-300' :
                                            fbQuotaExceeded ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                                        }`}>
                                            {fbStatus === 'connected' ? `Online${fbLatency ? ` ${fbLatency}ms` : ''}` : fbStatus === 'checking' ? 'Testing' : fbQuotaExceeded ? 'Failover' : 'Offline'}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-tight">Google Spreadsheet</p>
                                        <p className="text-[10px] text-slate-400">Sync: {shLastSync ? formatSyncTime(shLastSync) : 'Standby'}</p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/20 text-sky-300 shrink-0">
                                        {routingMode === 'manual' && manualTarget === 'spreadsheet' ? 'Direct' : shStatus === 'connected' ? 'Connected' : 'Standby'}
                                    </span>
                                </div>
                            </div>

                            {/* Routing & Mirror Controls */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-slate-700 uppercase">Routing</span>
                                    <div className="inline-flex p-0.5 bg-slate-200 rounded-lg">
                                        <button
                                            type="button"
                                            disabled={!isAdmin}
                                            onClick={() => setSettings(s => ({ ...s, databaseRoutingMode: 'smart' }))}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${routingMode === 'smart' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                                        >
                                            Smart Auto
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!isAdmin}
                                            onClick={() => setSettings(s => ({ ...s, databaseRoutingMode: 'manual' }))}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${routingMode === 'manual' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                                        >
                                            Manual
                                        </button>
                                    </div>
                                    {routingMode === 'manual' && (
                                        <div className="flex gap-1.5 w-full">
                                            <button type="button" disabled={!isAdmin} onClick={() => setSettings(s => ({ ...s, manualTarget: 'firebase' }))} className={`flex-1 py-1 rounded text-[10px] font-bold border ${manualTarget === 'firebase' ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-slate-700 border-slate-200'}`}>
                                                Firebase
                                            </button>
                                            <button type="button" disabled={!isAdmin} onClick={() => setSettings(s => ({ ...s, manualTarget: 'spreadsheet' }))} className={`flex-1 py-1 rounded text-[10px] font-bold border ${manualTarget === 'spreadsheet' ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-slate-700 border-slate-200'}`}>
                                                Spreadsheet
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 sm:border-l sm:border-slate-200 sm:pl-3">
                                    <span className="text-[10px] font-bold text-slate-700 uppercase">Mirroring</span>
                                    <div className="inline-flex p-0.5 bg-slate-200 rounded-lg">
                                        <button
                                            type="button"
                                            disabled={!isAdmin}
                                            onClick={() => setSettings(s => ({ ...s, cloudBackupSync: 'auto_mirror' }))}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${settings.cloudBackupSync !== 'standby_failover' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'}`}
                                        >
                                            Active
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!isAdmin}
                                            onClick={() => setSettings(s => ({ ...s, cloudBackupSync: 'standby_failover' }))}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${settings.cloudBackupSync === 'standby_failover' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                                        >
                                            Failover
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Endpoints + Sync Trigger */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <label className={labelClasses}>Backup Script URL</label>
                                        <button type="button" onClick={handleRunPingTest} disabled={isTestingPing || !appScriptUrl} className="text-[10px] font-semibold text-indigo-600 hover:underline mb-1 disabled:opacity-50">
                                            {isTestingPing ? 'Testing...' : 'Test Write'}
                                        </button>
                                    </div>
                                    <input type="url" disabled={!isSuperAdmin} value={appScriptUrl} onChange={(e) => setAppScriptUrl(e.target.value)} placeholder="https://script.google.com/..." className={inputClasses} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Mobile App (APK) Link</label>
                                    <input type="url" disabled={!isSuperAdmin} value={settings.mobileApkLink || ''} onChange={(e) => setSettings(s => ({...s, mobileApkLink: e.target.value}))} placeholder="Mobile download link" className={inputClasses} />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                                    {backupProgressMsg || (syncStats ? `Cloud Backup: ${syncStats.backedUpCount}/${syncStats.totalInspections} synced` : 'Cloud Backup Ready')}
                                </span>
                                <button
                                    type="button"
                                    disabled={!isAdmin || isSyncingBackup || !appScriptUrl}
                                    onClick={handleRunBackupSync}
                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                                >
                                    {isSyncingBackup ? 'Syncing...' : 'Sync Now'}
                                </button>
                            </div>
                        </section>
                    )}

                    {/* 3. Module Governance */}
                    {activeSection === 'modules' && (
                        <section className="space-y-3 animate-fadeIn">
                            <div className="pb-2 border-b border-slate-100">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Module Governance</span>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {[
                                    { id: 'general', name: 'General Cargo', desc: 'Standard vehicle audit' },
                                    { id: 'petroleum_v2', name: 'Petroleum Tanker', desc: 'Tanker compliance' },
                                    { id: 'acid', name: 'Chemical / Acid', desc: 'Hazardous protocol' },
                                    { id: 'registry', name: 'Fleet Registry', desc: 'Asset tracking' },
                                    { id: 'analytics', name: 'Analytics Hub', desc: 'Safety insights' },
                                    { id: 'track_requests', name: 'Request Tracking', desc: 'Dispatch queue' }
                                ].map((mod) => (
                                    <div key={mod.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-slate-800 truncate">{mod.name}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{mod.desc}</p>
                                        </div>
                                        <button 
                                            type="button"
                                            disabled={!isAdmin}
                                            onClick={() => setSettings(prev => ({
                                                ...prev,
                                                enabledModules: {
                                                    ...(prev.enabledModules || {}),
                                                    [mod.id]: !(prev.enabledModules?.[mod.id] !== false)
                                                }
                                            }))}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${settings.enabledModules?.[mod.id] !== false ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${settings.enabledModules?.[mod.id] !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 4. Template Configuration */}
                    {activeSection === 'templates' && (
                        <section className="space-y-3 animate-fadeIn">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                                    {templateEntries.map(([key]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setSelectedTemplateKey(key)}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                                                activeTemplateKey === key ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            {key.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                                {activeTemplateConfig && (
                                    <button 
                                        type="button"
                                        onClick={() => setPreviewingTemplate({ key: activeTemplateKey, config: activeTemplateConfig })}
                                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                    >
                                        Preview Header
                                    </button>
                                )}
                            </div>

                            {activeTemplateConfig && (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                                    <div className="col-span-2 lg:col-span-1">
                                        <label className={labelClasses}>Document Title</label>
                                        <input type="text" disabled={!isAdmin} value={activeTemplateConfig.title} onChange={(e) => handleTemplateChange(activeTemplateKey, 'title', e.target.value)} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className={labelClasses}>Doc No.</label>
                                        <input type="text" disabled={!isAdmin} value={activeTemplateConfig.docNo} onChange={(e) => handleTemplateChange(activeTemplateKey, 'docNo', e.target.value)} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className={labelClasses}>Revision No.</label>
                                        <input type="text" disabled={!isAdmin} value={activeTemplateConfig.revisionNo} onChange={(e) => handleTemplateChange(activeTemplateKey, 'revisionNo', e.target.value)} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className={labelClasses}>Revision Date</label>
                                        <input type="text" disabled={!isAdmin} value={activeTemplateConfig.revisionDate} onChange={(e) => handleTemplateChange(activeTemplateKey, 'revisionDate', e.target.value)} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className={labelClasses}>Initial Issue Date</label>
                                        <input type="text" disabled={!isAdmin} value={activeTemplateConfig.initialIssueDate} onChange={(e) => handleTemplateChange(activeTemplateKey, 'initialIssueDate', e.target.value)} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className={labelClasses}>Next Revision Date</label>
                                        <input type="text" disabled={!isAdmin} value={activeTemplateConfig.nextRevisionDate || ''} onChange={(e) => handleTemplateChange(activeTemplateKey, 'nextRevisionDate', e.target.value)} className={inputClasses} />
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* 5. Branding */}
                    {activeSection === 'branding' && (
                        <section className="space-y-3 animate-fadeIn">
                            <div className="pb-2 border-b border-slate-100">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Company Branding</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                                <div>
                                    <label className={labelClasses}>Upload Logo (Max 1MB)</label>
                                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload} disabled={!isAdmin} />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!isAdmin} className="w-full h-24 sm:h-28 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:bg-slate-100 transition-all disabled:opacity-50">
                                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase">Select Image</span>
                                    </button>
                                </div>
                                <div>
                                    <label className={labelClasses}>Preview</label>
                                    <div className="w-full h-24 sm:h-28 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center p-3">
                                        {settings.companyLogo && !logoError ? (
                                            <img src={settings.companyLogo} alt="Preview" className="max-h-full object-contain" onError={() => setLogoError(true)} />
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">No Logo</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {isAdmin && (
                        <div className="pt-3 border-t border-slate-100 flex justify-end">
                            <button type="button" onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 text-[11px] uppercase tracking-wider">
                                {isSavingSettings ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    )}
                </div>
             ) : (
                <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800 space-y-3 animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="text-white text-sm font-bold uppercase tracking-tight">Apps Script Backend</h3>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={handleCopyFile}
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider"
                            >
                                Copy File
                            </button>
                            <button 
                                type="button"
                                onClick={handleCopyFullBackend}
                                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-[10px] uppercase tracking-wider border border-white/10"
                            >
                                Copy All
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {Object.keys(BACKEND_FILES).map((fileName) => (
                            <button
                                key={fileName}
                                type="button"
                                onClick={() => setSelectedBackendFile(fileName)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    selectedBackendFile === fileName 
                                        ? 'bg-indigo-600 text-white' 
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                                }`}
                            >
                                {fileName}
                            </button>
                        ))}
                    </div>

                    <div className="h-56 sm:h-80 bg-black/50 border border-white/10 rounded-xl p-3 sm:p-4 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2 shrink-0">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{selectedBackendFile}</span>
                            <span className="text-[9px] text-slate-500 uppercase">Google Apps Script</span>
                        </div>
                        <pre className="flex-1 text-indigo-300/90 font-mono text-[10px] leading-relaxed overflow-y-auto select-all">
                            {BACKEND_FILES[selectedBackendFile]}
                        </pre>
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