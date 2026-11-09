import React from 'react';
import { User, SystemSettings, InspectionData, ValidationLists } from '../../types';

// UI Components
import ProfileModal from '../ui/ProfileModal';
import SolutionsDrawer from '../ui/SolutionsDrawer';
import RequestInspectionModal from '../ui/RequestInspectionModal';
import InspectionStartModal from '../ui/InspectionStartModal';
import ReportViewerModal from '../ui/ReportViewerModal';

// Report Components
import PrintableGeneralReport from '../reports/PrintableGeneralReport';
import PrintablePetroleumV2Report from '../reports/PrintablePetroleumV2Report';
import PrintableAcidReport from '../reports/PrintableAcidReport';

import { INSPECTION_ITEMS, PETROLEUM_V2_ITEMS, ACID_INSPECTION_ITEMS } from '../../constants';

interface AppModalsProps {
    isProfileModalOpen: boolean;
    isSolutionsOpen: boolean;
    isRequestModalOpen: boolean;
    isStartModalOpen: boolean;
    isReportModalOpen: boolean;
    currentUser: User;
    settings: SystemSettings;
    appScriptUrl: string;
    validationLists: ValidationLists;
    hasExistingDraft: boolean;
    pendingModule: string | null;
    activeModule: string;
    selectedReportData: InspectionData | null;
    
    setIsProfileModalOpen: (open: boolean) => void;
    setIsSolutionsOpen: (open: boolean) => void;
    setIsRequestModalOpen: (open: boolean) => void;
    setIsStartModalOpen: (open: boolean) => void;
    setIsReportModalOpen: (open: boolean) => void;
    
    showToast: any;
    setCurrentUser: (user: User) => void;
    handleLogout: () => void;
    handleNavigate: (module: string) => void;
    handleRequestSubmit: (data: any) => void;
    handleDiscardAndStartNew: () => void;
    handleResumeDraft: () => void;
    handleEditRecord?: (item: InspectionData) => void;
    handleDeleteRecord?: (item: InspectionData) => void;
}

const AppModals: React.FC<AppModalsProps> = ({
    isProfileModalOpen, isSolutionsOpen, isRequestModalOpen, isStartModalOpen, isReportModalOpen,
    currentUser, settings, appScriptUrl, validationLists, hasExistingDraft, pendingModule, activeModule, selectedReportData,
    setIsProfileModalOpen, setIsSolutionsOpen, setIsRequestModalOpen, setIsStartModalOpen, setIsReportModalOpen,
    showToast, setCurrentUser, handleLogout, handleNavigate, handleRequestSubmit, handleDiscardAndStartNew, handleResumeDraft,
    handleEditRecord, handleDeleteRecord
}) => {
    
    // Robust template detection based on data payload instead of UI state
    const renderReportTemplate = (data: InspectionData) => {
        if (data.petro2_1 !== undefined) {
            return <PrintablePetroleumV2Report data={data} settings={settings} />;
        }
        if (data.acid_1 !== undefined) {
            return <PrintableAcidReport data={data} settings={settings} />;
        }
        return <PrintableGeneralReport data={data} settings={settings} />;
    };

    const getReportTitle = (data: InspectionData) => {
        if (data.petro2_1 !== undefined) return 'Petroleum_V2';
        if (data.acid_1 !== undefined) return 'Acid_Tanker';
        return 'General_Vehicle';
    };

    const getReportPayload = (data: InspectionData) => {
        let title = "General Vehicle Inspection";
        let activeItems = INSPECTION_ITEMS;
        
        if (data.petro2_1 !== undefined) {
            title = "Petroleum Tanker Inspection";
            activeItems = PETROLEUM_V2_ITEMS;
        } else if (data.acid_1 !== undefined) {
            title = "Acid Tanker Inspection";
            activeItems = ACID_INSPECTION_ITEMS;
        }

        return {
            title: title, 
            timestamp: data.timestamp || new Date().toISOString(), 
            truckNo: data.truckNo || 'N/A', 
            trailerNo: data.trailerNo || 'N/A', 
            jobCard: data.jobCard || '',
            location: data.location || 'N/A', 
            odometer: data.odometer || '0', 
            inspectedBy: data.inspectedBy || currentUser?.name || 'Inspector', 
            driverName: data.driverName || 'N/A',
            remarks: data.remarks || '', 
            rate: data.rate || 0, 
            safeToLoad: data.safeToLoad || 'Not Specified', 
            signatures: { 
                inspector: data.inspectorSignature || null, 
                driver: data.driverSignature || null 
            },
            photos: { 
                front: data.photoFront || null, 
                ls: data.photoLS || null, 
                rs: data.photoRS || null, 
                back: data.photoBack || null, 
                damage: data.photoDamage || null 
            },
            items: activeItems.map(item => ({ 
                label: item.label, 
                category: item.category, 
                status: data[item.id] || 'N/A' 
            })),
            companyName: settings.companyName || 'Fleet Portal', 
            companyLogo: settings.companyLogo || null
        };
    };

    return (
        <>
            {isProfileModalOpen && (
                <ProfileModal 
                    user={currentUser} 
                    settings={settings} 
                    appScriptUrl={appScriptUrl} 
                    onClose={() => setIsProfileModalOpen(false)} 
                    showToast={showToast} 
                    onUpdateSuccess={(u) => setCurrentUser(u)} 
                    onLogout={() => { setIsProfileModalOpen(false); handleLogout(); }} 
                />
            )}

            {isSolutionsOpen && (
                <SolutionsDrawer isOpen={isSolutionsOpen} onClose={() => setIsSolutionsOpen(false)} onAction={handleNavigate} />
            )}

            <RequestInspectionModal 
                isOpen={isRequestModalOpen} 
                onClose={() => setIsRequestModalOpen(false)} 
                onSubmit={handleRequestSubmit} 
                validationLists={validationLists} 
                currentUserRole={currentUser.role} 
            />

            <InspectionStartModal 
                isOpen={isStartModalOpen} 
                onClose={() => setIsStartModalOpen(false)} 
                onStartNew={handleDiscardAndStartNew} 
                onResume={handleResumeDraft} 
                hasDraft={hasExistingDraft} 
                moduleName={pendingModule === 'petroleum_v2' ? 'Petroleum Tanker' : pendingModule === 'acid' ? 'Acid Tanker' : pendingModule === 'general' ? 'General' : (pendingModule || '')} 
            />

            {isReportModalOpen && selectedReportData && (() => {
                const cleanRole = String(currentUser?.role || '').trim().toLowerCase();
                const isUserAdmin = cleanRole === 'admin' || cleanRole === 'superadmin' || cleanRole === 'super admin';
                return (
                    <ReportViewerModal 
                        onClose={() => setIsReportModalOpen(false)} 
                        onPrint={() => window.print()} 
                        title={`${getReportTitle(selectedReportData)}_${selectedReportData.truckNo || 'Unit'}`}
                        appScriptUrl={appScriptUrl}
                        reportPayload={getReportPayload(selectedReportData)}
                        isAdmin={isUserAdmin}
                        onEdit={isUserAdmin && handleEditRecord ? () => handleEditRecord(selectedReportData) : undefined}
                        onDelete={isUserAdmin && handleDeleteRecord ? () => handleDeleteRecord(selectedReportData) : undefined}
                    >
                        {renderReportTemplate(selectedReportData)}
                    </ReportViewerModal>
                );
            })()}
        </>
    );
};

export default AppModals;