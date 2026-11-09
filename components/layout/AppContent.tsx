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
    validationLists, stats, notifications, isSystemLocked, formInitialData,
    submissionStatus, supportPrefill,
    handleOpenInspectionFlow, handleSaveDraft, handleExitForm, handleGoogleSheetSubmit,
    handleViewReport, handleEditRecord, handleDeleteRecord, handleNavigate, handleSaveSettings, isSavingSettings,
    setSettings, setAppScriptUrl, showToast, fetchHistory,
    searchDatabase, setIsRequestModalOpen, setSupportPrefill
}) => {
    const cleanRole = String(currentUser?.role || '').trim().toLowerCase();
    const isAdmin = cleanRole === 'admin' || cleanRole === 'superadmin' || cleanRole === 'super admin';

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
            {activeModule === 'overview' && <OverviewDashboard appScriptUrl={appScriptUrl} onNavigate={handleNavigate} userRole={currentUser.role} historyList={historyList} isLoading={isLoadingHistory} onViewReport={handleViewReport} pendingAlertsCount={notifications.filter(n => !n.read && n.type === 'critical').length} isLocked={isSystemLocked} settings={settings} />}
            {activeModule === 'analytics' && <AnalyticsDashboard historyList={historyList} isLoading={isLoadingHistory} />}
            {activeModule === 'fleet_wall' && <FleetWallView historyList={historyList} isLoading={isLoadingHistory} onClose={() => handleNavigate('overview')} />}
            {activeModule === 'library' && <LibraryView />}
            {(activeModule === 'settings' && isAdmin) && <SettingsView settings={settings} setSettings={setSettings} appScriptUrl={appScriptUrl} setAppScriptUrl={setAppScriptUrl} handleSaveSettings={handleSaveSettings} isSavingSettings={isSavingSettings} showToast={showToast} user={currentUser} />}
            {activeModule === 'general' && <GeneralDashboard userRole={currentUser.role} stats={stats} startNewInspection={() => handleOpenInspectionFlow('general')} fetchHistory={fetchHistory} searchDatabase={searchDatabase} isLoadingHistory={isLoadingHistory} historyList={historyList} onViewReport={handleViewReport} onEditRecord={isAdmin ? handleEditRecord : undefined} onDeleteRecord={isAdmin ? handleDeleteRecord : undefined} onPrint={() => {}} isLocked={isSystemLocked} />}
            {activeModule === 'petroleum_v2' && <PetroleumV2Dashboard userRole={currentUser.role} stats={stats} startNewInspection={() => handleOpenInspectionFlow('petroleum_v2')} fetchHistory={fetchHistory} searchDatabase={searchDatabase} isLoadingHistory={isLoadingHistory} historyList={historyList} onViewReport={handleViewReport} onEditRecord={isAdmin ? handleEditRecord : undefined} onDeleteRecord={isAdmin ? handleDeleteRecord : undefined} onPrint={() => {}} isLocked={isSystemLocked} />}
            {activeModule === 'acid' && <AcidDashboard userRole={currentUser.role} stats={stats} startNewInspection={() => handleOpenInspectionFlow('acid')} fetchHistory={fetchHistory} searchDatabase={searchDatabase} isLoadingHistory={isLoadingHistory} historyList={historyList} onViewReport={handleViewReport} onEditRecord={isAdmin ? handleEditRecord : undefined} onDeleteRecord={isAdmin ? handleDeleteRecord : undefined} onPrint={() => {}} isLocked={isSystemLocked} />}
            {(activeModule === 'users' && isAdmin) && <UserManagementView currentUser={currentUser} appScriptUrl={appScriptUrl} showToast={showToast} validationLists={validationLists} settings={settings} />}
            {activeModule === 'support' && <SupportView appScriptUrl={appScriptUrl} currentUser={currentUser} showToast={showToast} settings={settings} validationLists={validationLists} prefillData={supportPrefill} onPrefillConsumed={() => setSupportPrefill(null)} />}
            {activeModule === 'track_requests' && <RequestTrackingView appScriptUrl={appScriptUrl} currentUser={currentUser} showToast={showToast} onRequestNew={() => setIsRequestModalOpen(true)} />}
            {activeModule === 'registry' && <FleetRegistryView appScriptUrl={appScriptUrl} validationLists={validationLists} onRefresh={() => fetchHistory(true)} showToast={showToast} isLocked={isSystemLocked} />}
        </div>
    );
};

export default AppContent;