import React from 'react';
import { InspectionData, User, SystemSettings, ValidationLists } from '../../types';

// Views
import OverviewDashboard from '../../views/OverviewDashboard';
import AnalyticsDashboard from '../../views/AnalyticsDashboard';
import FleetWallView from '../../views/FleetWallView';
import LibraryView from '../../views/LibraryView';
import SettingsView from '../../views/SettingsView';
import GeneralDashboard from '../../views/GeneralDashboard';
import PetroleumV2Dashboard from '../../views/PetroleumV2Dashboard';
import AcidDashboard from '../../views/AcidDashboard';
import UserManagementView from '../../views/UserManagementView';
import SupportView from '../../views/SupportView';
import RequestTrackingView from '../../views/RequestTrackingView';
import FleetRegistryView from '../../views/FleetRegistryView';
import InspectionFormView from '../../views/InspectionFormView';

interface AppContentProps {
    viewMode: 'dashboard' | 'form';
    activeModule: string;
    currentUser: User;
    settings: SystemSettings;
    appScriptUrl: string;
    historyList: InspectionData[];
    isLoadingHistory: boolean;
    validationLists: ValidationLists;
    stats: any;
    notifications: any[];
    isSystemLocked: boolean;
    hasPaidInvoice?: boolean;
    invoicesLoaded?: boolean;
    settingsInitialTab?: 'app' | 'invoicing' | 'backend';
    onOpenInvoicing?: () => void;
    formInitialData: InspectionData;
    submissionStatus: any;
    supportPrefill: any;
    handleOpenInspectionFlow: (module: string) => void;
    handleSaveDraft: (data: InspectionData) => void;
    handleExitForm: () => void;
    handleGoogleSheetSubmit: (data: InspectionData) => void;
    handleViewReport: (data: InspectionData) => void;
    handleEditRecord?: (data: InspectionData) => void;
    handleDeleteRecord?: (data: InspectionData) => Promise<void> | void;
    handleNavigate: (module: string) => void;
    handleSaveSettings: () => void;
    isSavingSettings: boolean;
    setSettings: any;
    setAppScriptUrl: any;
    showToast: any;
    fetchHistory: (force?: boolean) => void;
    searchDatabase: (term: string) => Promise<InspectionData[]>;
    setIsRequestModalOpen: (open: boolean) => void;
    setSupportPrefill: (data: any) => void;
}

const AppContent: React.FC<AppContentProps> = ({
    viewMode, activeModule, currentUser, settings, appScriptUrl, historyList, isLoadingHistory,
    validationLists, stats, notifications, isSystemLocked, hasPaidInvoice = false, invoicesLoaded = true,
    settingsInitialTab = 'app', onOpenInvoicing, formInitialData,
    submissionStatus, supportPrefill,
    handleOpenInspectionFlow, handleSaveDraft, handleExitForm, handleGoogleSheetSubmit,
    handleViewReport, handleEditRecord, handleDeleteRecord, handleNavigate, handleSaveSettings, isSavingSettings,
    setSettings, setAppScriptUrl, showToast, fetchHistory,
    searchDatabase, setIsRequestModalOpen, setSupportPrefill
}) => {
    const cleanRole = String(currentUser?.role || '').trim().toLowerCase();
    const isSuperAdmin = cleanRole === 'superadmin' || cleanRole === 'super admin';
    const isAdmin = isSuperAdmin || cleanRole === 'admin';

    const isEnabled = (modId: string) => settings.enabledModules?.[modId] !== false;

    // Direct access gate for governed modules
    const governedModules = ['general', 'petroleum_v2', 'acid', 'registry', 'analytics', 'track_requests'];
    if (governedModules.includes(activeModule) && !isEnabled(activeModule)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 animate-fadeIn">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                </div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Module Deactivated</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-xs leading-loose">
                    This feature has been administratively disabled for this organization. 
                    Contact your SuperAdmin for provisioning access.
                </p>
                <button 
                    onClick={() => handleNavigate('overview')}
                    className="mt-8 px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all"
                >
                    Return to Hub
                </button>
            </div>
        );
    }

    if (viewMode === 'form') {
        if (!hasPaidInvoice && !formInitialData?.id) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[55vh] text-center p-4 sm:p-6 animate-fadeIn">
                    <div className="bg-white border border-amber-200 rounded-2xl p-5 sm:p-7 max-w-md w-full shadow-2xs space-y-4">
                        <div className="w-12 h-12 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <div className="space-y-1.5">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900">Account Payment Due — Creation Paused</h2>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                {isSuperAdmin
                                    ? 'No active paid rental invoice covers today. Review or mark a client invoice Paid in Invoicing to restore inspection creation.'
                                    : isAdmin
                                      ? 'No active paid rental invoice is on file. Issue a client invoice with a validity period in Invoicing for SuperAdmin payment verification.'
                                      : 'New inspection creation is temporarily paused pending rental invoice settlement. Existing inspection history remains accessible; contact your Administrator.'}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                            {isAdmin && onOpenInvoicing && (
                                <button
                                    type="button"
                                    onClick={onOpenInvoicing}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all"
                                >
                                    {isSuperAdmin ? 'Review & Mark Paid' : 'Open Invoicing'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleExitForm}
                                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <InspectionFormView 
                initialData={formInitialData} 
                activeModule={activeModule} 
                validationLists={validationLists} 
                settings={settings} 
                onSaveDraft={handleSaveDraft} 
                onExit={handleExitForm} 
                onSubmit={handleGoogleSheetSubmit} 
                submissionStatus={submissionStatus} 
                onViewReport={handleViewReport} 
            />
        );
    }

    return (
        <div className="animate-fadeIn">
            {activeModule === 'overview' && <OverviewDashboard appScriptUrl={appScriptUrl} onNavigate={handleNavigate} userRole={currentUser.role} historyList={historyList} isLoading={isLoadingHistory} onViewReport={handleViewReport} pendingAlertsCount={notifications.filter(n => !n.read && n.type === 'critical').length} isLocked={isSystemLocked} hasPaidInvoice={hasPaidInvoice} invoicesLoaded={invoicesLoaded} onOpenInvoicing={onOpenInvoicing} settings={settings} />}
            {activeModule === 'analytics' && <AnalyticsDashboard historyList={historyList} isLoading={isLoadingHistory} />}
            {activeModule === 'fleet_wall' && <FleetWallView historyList={historyList} isLoading={isLoadingHistory} onClose={() => handleNavigate('overview')} />}
            {activeModule === 'library' && <LibraryView />}
            {activeModule === 'settings' && (
                isAdmin ? (
                    <SettingsView settings={settings} setSettings={setSettings} appScriptUrl={appScriptUrl} setAppScriptUrl={setAppScriptUrl} handleSaveSettings={handleSaveSettings} isSavingSettings={isSavingSettings} showToast={showToast} user={currentUser} initialTab={settingsInitialTab} />
                ) : (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-3">
                            <h2 className="text-base font-bold text-slate-900">Administrator Access Required</h2>
                            <p className="text-xs text-slate-500">System settings and client invoicing are restricted to Administrator accounts.</p>
                            <button type="button" onClick={() => handleNavigate('overview')} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
                                Back to Overview
                            </button>
                        </div>
                    </div>
                )
            )}
            {activeModule === 'general' && <GeneralDashboard userRole={currentUser.role} stats={stats} startNewInspection={() => handleOpenInspectionFlow('general')} fetchHistory={fetchHistory} searchDatabase={searchDatabase} isLoadingHistory={isLoadingHistory} historyList={historyList} onViewReport={handleViewReport} onEditRecord={isAdmin ? handleEditRecord : undefined} onDeleteRecord={isAdmin ? handleDeleteRecord : undefined} onPrint={() => {}} isLocked={isSystemLocked} onOpenInvoicing={isAdmin ? onOpenInvoicing : undefined} />}
            {activeModule === 'petroleum_v2' && <PetroleumV2Dashboard userRole={currentUser.role} stats={stats} startNewInspection={() => handleOpenInspectionFlow('petroleum_v2')} fetchHistory={fetchHistory} searchDatabase={searchDatabase} isLoadingHistory={isLoadingHistory} historyList={historyList} onViewReport={handleViewReport} onEditRecord={isAdmin ? handleEditRecord : undefined} onDeleteRecord={isAdmin ? handleDeleteRecord : undefined} onPrint={() => {}} isLocked={isSystemLocked} onOpenInvoicing={isAdmin ? onOpenInvoicing : undefined} />}
            {activeModule === 'acid' && <AcidDashboard userRole={currentUser.role} stats={stats} startNewInspection={() => handleOpenInspectionFlow('acid')} fetchHistory={fetchHistory} searchDatabase={searchDatabase} isLoadingHistory={isLoadingHistory} historyList={historyList} onViewReport={handleViewReport} onEditRecord={isAdmin ? handleEditRecord : undefined} onDeleteRecord={isAdmin ? handleDeleteRecord : undefined} onPrint={() => {}} isLocked={isSystemLocked} onOpenInvoicing={isAdmin ? onOpenInvoicing : undefined} />}
            {(activeModule === 'users' && isAdmin) && <UserManagementView currentUser={currentUser} appScriptUrl={appScriptUrl} showToast={showToast} validationLists={validationLists} settings={settings} />}
            {activeModule === 'support' && <SupportView appScriptUrl={appScriptUrl} currentUser={currentUser} showToast={showToast} settings={settings} validationLists={validationLists} prefillData={supportPrefill} onPrefillConsumed={() => setSupportPrefill(null)} />}
            {activeModule === 'track_requests' && <RequestTrackingView appScriptUrl={appScriptUrl} currentUser={currentUser} showToast={showToast} onRequestNew={() => setIsRequestModalOpen(true)} />}
            {activeModule === 'registry' && <FleetRegistryView appScriptUrl={appScriptUrl} validationLists={validationLists} onRefresh={() => fetchHistory(true)} showToast={showToast} isLocked={false} />}
        </div>
    );
};

export default AppContent;