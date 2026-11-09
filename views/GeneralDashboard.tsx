import React from 'react';
import { InspectionData } from '../types';
import DashboardTemplate from '../components/dashboard/DashboardTemplate';

interface GeneralDashboardProps {
    stats: { total: number, passRate: number | string };
    startNewInspection: () => void;
    fetchHistory: (force?: boolean) => void;
    searchDatabase?: (term: string) => Promise<InspectionData[]>;
    isLoadingHistory: boolean;
    historyList: InspectionData[];
    onViewReport: (item: InspectionData) => void;
    onEditRecord?: (item: InspectionData) => void;
    onDeleteRecord?: (item: InspectionData) => Promise<void> | void;
    onPrint: (item: InspectionData) => void;
    userRole?: string;
    isLocked?: boolean;
}

const GeneralDashboard: React.FC<GeneralDashboardProps> = (props) => {
    return (
        <DashboardTemplate 
            {...props}
            title="General Vehicle Inspection"
            description="Fleet roadworthiness, mechanical safety & driver compliance checklist"
            icon={<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            colorTheme="slate"
            titlePrefix="VEHICLE INSPECTION"
            docNo="MNT-F-015"
            moduleKey="general"
        />
    );
};

export default GeneralDashboard;