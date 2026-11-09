import React from 'react';
import { InspectionData } from '../types';
import DashboardTemplate from '../components/dashboard/DashboardTemplate';

interface AcidDashboardProps {
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

const AcidDashboard: React.FC<AcidDashboardProps> = (props) => {
    return (
        <DashboardTemplate 
            {...props}
            title="Acid Tanker Inspection"
            description="Corrosive chemical containment, barrel lining, PRVs & PPE protocol"
            icon={<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l-5.5 9h11z"/><path strokeLinecap="round" strokeLinejoin="round" d="M10 13v6h4v-6z"/></svg>}
            colorTheme="purple"
            titlePrefix="ACID TANKER INSPECTION"
            docNo="MNT-F-013"
            moduleKey="acid"
        />
    );
};

export default AcidDashboard;