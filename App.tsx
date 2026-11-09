import React, { useState, useEffect } from 'react';
import { INITIAL_DATA, InspectionData, User } from './types';
import { 
    PRE_CONFIGURED_SCRIPT_URL,
    SHEET_HEADERS, PETROLEUM_V2_HEADERS, ACID_HEADERS,
    INSPECTION_ITEMS, PETROLEUM_V2_ITEMS, ACID_INSPECTION_ITEMS
} from './constants';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useSettings } from './hooks/useSettings';
import { useNotifications } from './hooks/useNotifications';
import { useHistory } from './hooks/useHistory';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useOfflineStorage } from './hooks/useOfflineStorage';

// Services
import { analyzeInspection } from './services/geminiService';
import { 
    saveInspectionToFirebase, 
    markInspectionBackupComplete, 
    deleteInspectionFromFirebase,
    saveRequestToFirebase, 
    updateRequestStatusInFirebase,
    recordSheetSync,
    getBackupSyncStats,
    syncFirestoreToSpreadsheet
} from './services/firebase';

// UI Components
import Toast from './components/ui/Toast';
import SubmissionOverlay from './components/ui/SubmissionOverlay';
import SystemTour from './components/ui/SystemTour'; 
import InstallPwaPrompt from './components/ui/InstallPwaPrompt';
import UpdatePrompt from './components/ui/UpdatePrompt';
import AppBadge from './components/ui/AppBadge';
import WhatsNewModal from './components/ui/WhatsNewModal';
import VersionTag from './components/ui/VersionTag';
import OnboardingWizard from './components/ui/OnboardingWizard'; 

// Layout Components
import AppHeader from './components/layout/AppHeader';
import AppContent from './components/layout/AppContent';
import AppModals from './components/layout/AppModals';
import AppFooter from './components/layout/AppFooter';

// Views
import LoginView from './views/LoginView';

// Main Application Logic
const App = () => {
  // Core Business Hooks
  const { currentUser, setCurrentUser, handleLogin, handleLogout, sessionExpired, setSessionExpired } = useAuth();
  const { 
    settings, setSettings, appScriptUrl, setAppScriptUrl, 
    isSavingSettings, handleSaveSettings, fetchSystemSettings 
  } = useSettings();

  // View Routing State
  const [activeModule, setActiveModule] = useState('overview'); 
  const [viewMode, setViewMode] = useState<'dashboard' | 'form'>('dashboard');
  
  // UI Interaction State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);
  const [showTour, setShowTour] = useState(false);
  
  // Data Handlers State
  const [lastSubmittedData, setLastSubmittedData] = useState<InspectionData | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [selectedReportData, setSelectedReportData] = useState<InspectionData | null>(null);
  const [formInitialData, setFormInitialData] = useState<InspectionData>(INITIAL_DATA);
  const [supportPrefill, setSupportPrefill] = useState<{subject: string, description: string} | null>(null);
  const [pendingModule, setPendingModule] = useState<string | null>(null);
  const [hasExistingDraft, setHasExistingDraft] = useState(false);
  
  const effectiveScriptUrl = (PRE_CONFIGURED_SCRIPT_URL || appScriptUrl || settings?.backupSpreadsheetUrl || '').trim();

  // Core Data Fetching Hook
  const { historyList, isLoadingHistory, validationLists, stats, fetchHistory, searchDatabase } = useHistory(effectiveScriptUrl, activeModule, currentUser, settings);
  
  // Handlers
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
  };

  const { submissionStatus, setSubmissionStatus, isSyncing, addToQueue } = useOfflineSync(effectiveScriptUrl, showToast, () => fetchHistory(true));

  // Offline Storage - automatically caches all critical data
  const { cacheData } = useOfflineStorage({
    currentUser,
    settings,
    validationLists,
    historyList,
    appScriptUrl: effectiveScriptUrl,
  });

  const isSystemLocked = false;

  useEffect(() => {
    (window as any).isSubscriptionLocked = false;
  }, []);

  // Dynamic Favicon Update Only (No Manifest Override - Keeps PWA Intact)
  useEffect(() => {
    if (settings.companyLogo) {
      // Update standard Favicon
      const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = settings.companyLogo;
      document.getElementsByTagName('head')[0].appendChild(link);

      // Update Apple Touch Icon
      const appleLink: HTMLLinkElement = document.querySelector("link[rel='apple-touch-icon']") || document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = settings.companyLogo;
      document.getElementsByTagName('head')[0].appendChild(appleLink);
    }
  }, [settings.companyLogo]);

  useEffect(() => {
    if (currentUser && !currentUser.needsSetup) {
        setActiveModule('overview');
        setViewMode('dashboard');
    }
  }, [currentUser?.username, currentUser?.needsSetup]);

  useEffect(() => {
      if (sessionExpired === 'idle') showToast("Session expired due to inactivity.", 'warning');
      else if (sessionExpired === 'max_duration') showToast("Session limit reached. Log in again.", 'info');
      if (sessionExpired) setSessionExpired(null);
  }, [sessionExpired]);

  // Continuous Parity: Ensure all records on Firestore sync to spreadsheet database backup
  useEffect(() => {
    if (!effectiveScriptUrl || !effectiveScriptUrl.startsWith('https://script.google.com')) return;
    if (settings.cloudBackupSync === 'standby_failover') return;
    // Only administrators or managers run background backup reconciliation
    const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'manager';
    if (!isAdminUser) return;

    // Throttle to at most once every 30 minutes to conserve daily read quota
    const lastCheck = localStorage.getItem('sc_last_parity_check');
    const now = Date.now();
    if (lastCheck && (now - Number(lastCheck) < 30 * 60 * 1000)) return;

    let isMounted = true;
    const runBackgroundBackupReconciliation = async () => {
      try {
        localStorage.setItem('sc_last_parity_check', String(now));
        const stats = await getBackupSyncStats();
        if (isMounted && stats.pendingCount > 0) {
          console.log(`[Backup Parity Engine] Found ${stats.pendingCount} pending Firestore record(s). Synchronizing to spreadsheet backup...`);
          await syncFirestoreToSpreadsheet(effectiveScriptUrl);
        }
      } catch (err) {
        console.warn("[Backup Parity Engine] Sync check deferred:", err);
      }
    };

    // Staggered trigger 8s after mount
    const timer = setTimeout(runBackgroundBackupReconciliation, 8000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [effectiveScriptUrl, settings.cloudBackupSync, currentUser?.role]);

  const handleNavigate = async (module: string) => {
    if (module.startsWith('support:info:')) {
        const solutionName = module.replace('support:info:', '');
        setSupportPrefill({
            subject: `Inquiry: ${solutionName}`,
            description: `Automated Request: User is interested in learning more about integrating the "${solutionName}" module into the current fleet workflow.`
        });
        setActiveModule('support');
        setViewMode('dashboard');
        setIsSolutionsOpen(false);
        return;
    }

    if (module.startsWith('request:start_inspection')) {
        const parts = module.split('|');
        const type = parts[1]?.toLowerCase();
        const truck = parts[2];
        const trailer = parts[3];
        const requester = parts[4];
        const reason = parts[5];
        let moduleKey = 'general';
        if (type === 'petroleum_v2') moduleKey = 'petroleum_v2';
        else if (type === 'acid') moduleKey = 'acid';

        setActiveModule(moduleKey);
        startFreshInspection(moduleKey, {
            truckNo: truck,
            trailerNo: trailer,
            remarks: `Requested by ${requester}: ${reason}`,
            requestId: parts[0].split('-')[1]
        });
        return;
    }

    if (module !== 'support') setSupportPrefill(null);
    setActiveModule(module);
    setViewMode('dashboard');
  };

  useEffect(() => {
    (window as any).handleNavigate = handleNavigate;
  }, [handleNavigate]);

  const handleOpenInspectionFlow = (module: string) => {
    const draftKey = `sc_draft_${module}`;
    const draft = localStorage.getItem(draftKey);
    if (draft) {
        setPendingModule(module);
        setHasExistingDraft(true);
        setIsStartModalOpen(true);
    } else {
        startFreshInspection(module);
    }
  };

  const { notifications, handleMarkNotificationRead, handleDismissNotification, handleClearAllNotifications, handleGlobalAcknowledge } = useNotifications(effectiveScriptUrl, currentUser, showToast);

  const startFreshInspection = (module: string, prefill?: Partial<InspectionData>) => {
      setLastSubmittedData(null);
      setAiAnalysisResult(null);
      setFormInitialData({ ...INITIAL_DATA, timestamp: new Date().toISOString(), inspectedBy: currentUser?.name || '', ...prefill });
      setViewMode('form');
  };

  const handleResumeDraft = () => {
    if (!pendingModule) return;
    const draftKey = `sc_draft_${pendingModule}`;
    const draftData = localStorage.getItem(draftKey);
    if (draftData) {
        setFormInitialData(JSON.parse(draftData));
        setActiveModule(pendingModule);
        setViewMode('form');
    }
    setIsStartModalOpen(false);
  };

  const handleDiscardAndStartNew = () => {
    if (!pendingModule) return;
    localStorage.removeItem(`sc_draft_${pendingModule}`);
    setActiveModule(pendingModule);
    startFreshInspection(pendingModule);
    setIsStartModalOpen(false);
  };

  const handleSaveDraft = (data: InspectionData) => {
    localStorage.setItem(`sc_draft_${activeModule}`, JSON.stringify(data));
    setViewMode('dashboard');
  };

  const handleExitForm = () => setViewMode('dashboard');

  const isCurrentUserAdmin = Boolean(
    currentUser?.role &&
    ['admin', 'superadmin', 'super admin'].includes(String(currentUser.role).trim().toLowerCase())
  );

  const handleEditRecord = (item: InspectionData) => {
    if (!isCurrentUserAdmin) {
      showToast("Access restricted: Only Admin rank and above can edit records.", "error");
      return;
    }

    let targetModule = 'general';
    const m = String(item.module || (item as any)._module || activeModule || '').toLowerCase();
    if (m.includes('petro')) targetModule = 'petroleum_v2';
    else if (m.includes('acid')) targetModule = 'acid';

    setActiveModule(targetModule);
    setFormInitialData({ ...item });
    setViewMode('form');
    showToast(`Editing inspection record for ${item.truckNo || 'unit'}`, "info");
  };

  const handleDeleteRecord = async (item: InspectionData) => {
    if (!isCurrentUserAdmin) {
      showToast("Access restricted: Only Admin rank and above can delete records.", "error");
      return;
    }

    const inspectionId = item.id || (item as any)._id || '';
    if (!inspectionId) {
      showToast("Cannot delete record: Missing inspection record ID.", "error");
      return;
    }

    try {
      const res = await deleteInspectionFromFirebase(inspectionId, effectiveScriptUrl, item.module || (item as any)._module);
      if (res.success) {
        showToast(`Record ${item.truckNo || inspectionId} deleted permanently.`, "success");
        fetchHistory(true);
        if (selectedReportData?.id === inspectionId) {
          setIsReportModalOpen(false);
          setSelectedReportData(null);
        }
      } else {
        showToast(res.error || "Failed to delete record.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to delete record.", "error");
    }
  };

  const handleGoogleSheetSubmit = async (rawFormData: InspectionData) => {
    setSubmissionStatus('submitting');
    
    // Disable picture uploading for all modules temporarily: zero out all photo fields
    const formData: InspectionData = {
        ...rawFormData,
        photoFront: undefined,
        photoLS: undefined,
        photoRS: undefined,
        photoBack: undefined,
        photoDamage: undefined
    };

    setLastSubmittedData(formData);
    setAiAnalysisResult(null);

    const routingMode = settings.databaseRoutingMode || 'smart';
    const manualTarget = settings.manualTarget || 'firebase';
    const forceSpreadsheetDirect = routingMode === 'manual' && manualTarget === 'spreadsheet';

    // 1. PRIMARY: Write to Firebase Firestore first (unless manual switch forces spreadsheet direct)
    let firebaseSuccess = false;
    let firebaseId = formData.id || '';
    if (!forceSpreadsheetDirect) {
        try {
            const fbRes = await saveInspectionToFirebase(formData, activeModule);
            if (fbRes.success && fbRes.id) {
                firebaseSuccess = true;
                firebaseId = fbRes.id;
                formData.id = firebaseId;
            }
        } catch (fbErr) {
            console.warn("Primary save to Firebase encountered error:", fbErr);
            firebaseSuccess = false;
        }
    }

    // If linked to an inspection request and Firebase succeeded, mark request completed in Firebase
    if (formData.requestId && firebaseId && firebaseSuccess) {
        updateRequestStatusInFirebase(formData.requestId, 'completed', firebaseId).catch(() => {});
    }

    let sheetName = 'General', headers = SHEET_HEADERS, moduleTitle = "General Vehicle Inspection", activeItems = INSPECTION_ITEMS;
    if (activeModule === 'petroleum_v2') { 
        sheetName = 'Petroleum_V2'; headers = PETROLEUM_V2_HEADERS; moduleTitle = "Petroleum Tanker Inspection"; activeItems = PETROLEUM_V2_ITEMS;
    } else if (activeModule === 'acid') { 
        sheetName = 'Acid'; headers = ACID_HEADERS; moduleTitle = "Acid Tanker Inspection"; activeItems = ACID_INSPECTION_ITEMS;
    }

    // Sanitize row for spreadsheet backup:
    // Ensures row is strictly lightweight (<1KB) so tens of thousands of rows will never bloat the sheet
    const row = headers.map(h => {
        if (h.toLowerCase().startsWith('photo')) {
            return "[Photos Paused]";
        }
        const val = formData[h];
        if (typeof val === 'string' && (val.startsWith('data:image/') || val.length > 250)) {
            return `[Attached in Firebase]`;
        }
        return val !== undefined ? val : "";
    });
    
    // Explicitly define report data for cloud PDF rendering
    const reportData = {
        title: moduleTitle, 
        timestamp: formData.timestamp || new Date().toISOString(), 
        truckNo: formData.truckNo || 'N/A', 
        trailerNo: formData.trailerNo || 'N/A', 
        jobCard: formData.jobCard || '',
        location: formData.location || 'N/A', 
        odometer: formData.odometer || '0', 
        inspectedBy: String(formData.inspectedBy || currentUser?.name || 'Inspector').trim(), 
        driverName: formData.driverName || 'N/A',
        remarks: formData.remarks || '', 
        rate: formData.rate || 0, 
        rateLabel: formData.rate ? `${formData.rate} / 5` : 'N/A',
        safeToLoad: formData.safeToLoad || 'Not Specified', 
        resultStatus: formData.safeToLoad === 'Yes' ? 'PASSED - SAFE TO LOAD' : 'FAILED - UNSAFE TO LOAD',
        summaryText: `${formData.safeToLoad === 'Yes' ? 'PASSED' : 'FAILED'} - ${moduleTitle} for Truck ${formData.truckNo}. Condition Rating: ${formData.rate}/5.`,
        appUrl: settings.webAppUrl || window.location.origin,
        signatures: { 
            inspector: formData.inspectorSignature || null, 
            driver: formData.driverSignature || null 
        },
        inspectorSignature: formData.inspectorSignature || null,
        driverSignature: formData.driverSignature || null,
        photos: { 
            front: null, 
            ls: null, 
            rs: null, 
            back: null, 
            damage: null 
        },
        items: activeItems.map(item => ({ 
            label: item.label, 
            category: item.category, 
            status: formData[item.id] || 'N/A' 
        })),
        companyName: settings.companyName || 'Juba Transport', 
        companyLogo: settings.companyLogo || null,
        templateConfig: settings.templates?.[activeModule] || null
    };

    const inspectionId = formData.id || firebaseId || row[0] || `INSP-${Date.now()}`;
    const payload = { 
        id: inspectionId,
        action: 'create', 
        sheet: sheetName, 
        headers: headers, 
        row: row, 
        requestId: formData.requestId || null, 
        groupEmail: settings.groupEmail || null,
        reportData: { ...reportData, id: inspectionId, sheet: sheetName, groupEmail: settings.groupEmail || null },
        sendNotification: true
    };

    // Always sync inspection to the spreadsheet backup to record the inspection row
    // and trigger automated email dispatch with PDF attachment to staff and Google Group
    if (effectiveScriptUrl && effectiveScriptUrl.startsWith('https')) {
        fetch(effectiveScriptUrl, { 
            method: 'POST', 
            body: JSON.stringify(payload), 
            mode: 'no-cors' 
        }).then(() => {
            recordSheetSync();
            if (firebaseId) {
                markInspectionBackupComplete(firebaseId).catch(() => {});
            }
        }).catch(sheetErr => {
            console.warn("[Spreadsheet Sync] Mirror to sheet encountered notice:", sheetErr);
        });
    }

    if (firebaseSuccess && !forceSpreadsheetDirect) {
        setSubmissionStatus('success'); 
        localStorage.removeItem(`sc_draft_${activeModule}`);
        try { 
            const analysis = await analyzeInspection(formData); 
            setAiAnalysisResult(analysis); 
        } catch (aiErr) { 
            setAiAnalysisResult("AI analysis currently unavailable."); 
        }
        fetchHistory(true);
        return;
    }

    // FAILOVER ONLY: Firebase failed or manual mode selected spreadsheet
    console.warn("[Database Failover] Firebase unavailable or manual override active. Writing directly to backup spreadsheet.");

    if (!navigator.onLine) {
        addToQueue(payload); 
        localStorage.removeItem(`sc_draft_${activeModule}`);
        setSubmissionStatus('offline_saved'); 
        setTimeout(() => { setSubmissionStatus('idle'); setViewMode('dashboard'); }, 3500); 
        return;
    }

    if (!effectiveScriptUrl) {
        setSubmissionStatus('idle');
        showToast("Firebase write failed and backup spreadsheet URL is not configured.", "error");
        return;
    }

    try {
        await fetch(effectiveScriptUrl, { method: 'POST', body: JSON.stringify(payload), mode: 'no-cors' });
        recordSheetSync();
        if (firebaseId) {
            markInspectionBackupComplete(firebaseId).catch(() => {});
        }
        setSubmissionStatus('success'); 
        showToast("Saved directly to Backup Spreadsheet (Failover Mode)", "info");
        localStorage.removeItem(`sc_draft_${activeModule}`);
        try { 
            const analysis = await analyzeInspection(formData); 
            setAiAnalysisResult(analysis); 
        } catch (aiErr) { 
            setAiAnalysisResult("AI analysis currently unavailable."); 
        }
        fetchHistory(true); 
    } catch (error) {
        addToQueue(payload); 
        localStorage.removeItem(`sc_draft_${activeModule}`);
        setSubmissionStatus('offline_saved'); 
        setTimeout(() => { setSubmissionStatus('idle'); setViewMode('dashboard'); }, 3500);
    }
  };

  const handleRequestSubmit = async (data: any) => {
      // 1. PRIMARY: Save request to Firebase Firestore first
      const reqPayload = { 
          requester: currentUser?.name || 'Staff', 
          role: currentUser?.role || 'Inspector', 
          ...data 
      };

      try {
          await saveRequestToFirebase(reqPayload);
      } catch (fbErr) {
          console.warn("Firebase request save error:", fbErr);
      }

      // 2. BACKUP: Sync to Google Spreadsheet
      if (effectiveScriptUrl) {
          try { 
              await fetch(effectiveScriptUrl, { 
                  method: 'POST', 
                  body: JSON.stringify({ action: 'request_inspection', ...reqPayload }), 
                  mode: 'no-cors' 
              }); 
          } catch (e) { 
              console.warn("Spreadsheet backup request failed:", e);
          }
      }

      showToast("Inspection request submitted successfully", "success");
  };

  const handleViewReport = (item: InspectionData | null) => {
    if (item) {
        // Mark as read
        const itemId = item.id || item.timestamp + (item.truckNo || '');
        const readIds = JSON.parse(localStorage.getItem('sc_read_inspections') || '[]');
        if (!readIds.includes(itemId)) {
            const updatedReadIds = [...readIds, itemId].slice(-200); // Keep last 200 to avoid bloat
            localStorage.setItem('sc_read_inspections', JSON.stringify(updatedReadIds));
        }
    }
    setSelectedReportData(item);
    setIsReportModalOpen(true);
  };

  const handleOnboardingComplete = (updatedUser: User) => {
      const userWithSetup = { ...updatedUser, needsSetup: false };
      setCurrentUser(userWithSetup);
      localStorage.setItem('safetyCheck_user', JSON.stringify(userWithSetup));
      setActiveModule('overview'); setViewMode('dashboard');
      showToast("Profile verified successfully.", "success"); setShowTour(true);
  };

  if (!currentUser) {
      return (
          <>
            <InstallPwaPrompt />
            <UpdatePrompt />
            <AppBadge notifications={notifications} />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <LoginView onLogin={handleLogin} appScriptUrl={effectiveScriptUrl || appScriptUrl} setAppScriptUrl={setAppScriptUrl} settings={settings} />
          </>
      );
  }

  if (currentUser && currentUser.needsSetup) {
      return <OnboardingWizard user={currentUser} appScriptUrl={effectiveScriptUrl || appScriptUrl} onComplete={handleOnboardingComplete} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 relative">
      <UpdatePrompt />
      <AppBadge notifications={notifications} />
      <WhatsNewModal />
      <SubmissionOverlay 
        status={submissionStatus} 
        onClose={() => { setSubmissionStatus('idle'); setViewMode('dashboard'); }}
        onViewReport={() => lastSubmittedData && handleViewReport(lastSubmittedData)}
        aiAnalysis={aiAnalysisResult}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {showTour && <SystemTour onComplete={() => setShowTour(false)} />}

      <AppModals
        isProfileModalOpen={isProfileModalOpen} isSolutionsOpen={isSolutionsOpen} isRequestModalOpen={isRequestModalOpen}
        isStartModalOpen={isStartModalOpen} isReportModalOpen={isReportModalOpen} currentUser={currentUser}
        settings={settings} appScriptUrl={effectiveScriptUrl || appScriptUrl} validationLists={validationLists} hasExistingDraft={hasExistingDraft}
        pendingModule={pendingModule} activeModule={activeModule} selectedReportData={selectedReportData}
        setIsProfileModalOpen={setIsProfileModalOpen} setIsSolutionsOpen={setIsSolutionsOpen}
        setIsRequestModalOpen={setIsRequestModalOpen} setIsStartModalOpen={setIsStartModalOpen}
        setIsReportModalOpen={setIsReportModalOpen} showToast={showToast} setCurrentUser={setCurrentUser}
        handleLogout={handleLogout} handleNavigate={handleNavigate} handleRequestSubmit={handleRequestSubmit}
        handleDiscardAndStartNew={handleDiscardAndStartNew} handleResumeDraft={handleResumeDraft}
        handleEditRecord={isCurrentUserAdmin ? handleEditRecord : undefined} handleDeleteRecord={isCurrentUserAdmin ? handleDeleteRecord : undefined}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
          <AppHeader 
            settings={settings} currentUser={currentUser} activeModule={activeModule} isAdmin={isCurrentUserAdmin}
            isAtRoot={activeModule === 'overview'}
            notifications={notifications}
            onNavigateHome={() => { setActiveModule('overview'); setViewMode('dashboard'); }}
            handleMarkNotificationRead={handleMarkNotificationRead} handleDismissNotification={handleDismissNotification}
            handleClearAllNotifications={handleClearAllNotifications} handleGlobalAcknowledge={handleGlobalAcknowledge}
            handleNavigate={handleNavigate} setIsProfileModalOpen={setIsProfileModalOpen}
            setActiveModule={setActiveModule}
            setIsSolutionsOpen={setIsSolutionsOpen}
          />

          <main className="flex-1 p-2 sm:p-4 md:p-6 w-full max-w-7xl mx-auto no-print overflow-x-hidden">
              <AppContent 
                viewMode={viewMode} activeModule={activeModule} currentUser={currentUser} settings={settings}
                appScriptUrl={effectiveScriptUrl || appScriptUrl} historyList={historyList} isLoadingHistory={isLoadingHistory}
                validationLists={validationLists} stats={stats} notifications={notifications}
                isSystemLocked={isSystemLocked} formInitialData={formInitialData}
                submissionStatus={submissionStatus} supportPrefill={supportPrefill}
                handleOpenInspectionFlow={handleOpenInspectionFlow} handleSaveDraft={handleSaveDraft}
                handleExitForm={handleExitForm} handleGoogleSheetSubmit={handleGoogleSheetSubmit}
                handleViewReport={handleViewReport} handleEditRecord={isCurrentUserAdmin ? handleEditRecord : undefined} handleDeleteRecord={isCurrentUserAdmin ? handleDeleteRecord : undefined} handleNavigate={handleNavigate}
                handleSaveSettings={handleSaveSettings} isSavingSettings={isSavingSettings}
                setSettings={setSettings} setAppScriptUrl={setAppScriptUrl} showToast={showToast}
                fetchHistory={fetchHistory}
                searchDatabase={searchDatabase}
                setIsRequestModalOpen={setIsRequestModalOpen} setSupportPrefill={setSupportPrefill}
              />
          </main>

          <AppFooter />
          <VersionTag />
      </div>
    </div>
  );
};

export default App;
