import React from 'react';
import { InspectionData } from '../types';
import DashboardTemplate from '../components/dashboard/DashboardTemplate';

interface PetroleumV2DashboardProps {
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

const PetroleumV2Dashboard: React.FC<PetroleumV2DashboardProps> = (props) => {
    return (
        <DashboardTemplate 
            {...props}
            title="Petroleum Tanker"
            description="Hazardous fuels, tank integrity, manifold bonding & emergency shutoff"
            icon={<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>}
            colorTheme="orange"
            titlePrefix="PETROLEUM INSPECTION"
            docNo="MNT-F-002"
            moduleKey="petroleum_v2"
        />
    );
};

export default PetroleumV2Dashboard;