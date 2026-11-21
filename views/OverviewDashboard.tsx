import React from 'react';
import { InspectionData, SystemSettings } from '../types';

interface OverviewDashboardProps {
    appScriptUrl: string;
    onNavigate: (module: string) => void;
    userRole?: string;
    historyList: InspectionData[];
    isLoading?: boolean;
    onViewReport: (item: InspectionData) => void;
    pendingAlertsCount?: number;
    isLocked?: boolean; 
    settings: SystemSettings;
}

const RefinedIcon = ({ children }: { children?: React.ReactNode }) => (
    <div className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center text-slate-700 transition-all duration-300 group-hover:scale-105">
        {React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<any>, { 
            className: "w-full h-full", 
            strokeWidth: "1.75", 
            strokeLinecap: "round", 
            strokeLinejoin: "round"
        }) : children}
    </div>
);

const GeneralAuditIcon = () => (
    <RefinedIcon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
    </RefinedIcon>
);

const PetroleumAuditIcon = () => (
    <RefinedIcon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2l-4 7c0 1.5 1.5 3 4 3s4-1.5 4-3l-4-7z" />
            <path d="M5 20h14M5 17h14M9 14h6" />
            <rect x="3" y="12" width="18" height="10" rx="2" />
        </svg>
    </RefinedIcon>
);

const AcidAuditIcon = () => (
    <RefinedIcon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M10 2l-7 15h18l-7-15h-4z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M7 22h10" />
        </svg>
    </RefinedIcon>
);

const StaffIcon = () => (
    <RefinedIcon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
    </RefinedIcon>
);

const SettingsIcon = () => (
    <RefinedIcon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
    </RefinedIcon>
);

const RegistryIcon = () => (
    <RefinedIcon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 8h10M7 12h10M7 16h6" />
        </svg>
    </RefinedIcon>
);

const AnalyticsIcon = () => (
    <RefinedIcon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
    </RefinedIcon>
);

const RequestsIcon = () => (
    <RefinedIcon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    </RefinedIcon>
);

const SupportIcon = () => (
    <RefinedIcon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
            <path d="M12 17v-4M12 9h.01" strokeWidth="2" />
        </svg>
    </RefinedIcon>
);

interface LauncherTileProps {
    id: string;
    label: string;
    icon: React.ReactNode;
    isForcedLock?: boolean;
    badgeCount?: number;
    badgeColor?: string;
    isInspectionModule?: boolean;
    isLocked: boolean;
    onNavigate: (module: string) => void;
    isAddon?: boolean;
}

const LauncherTile = ({ 
    id, label, icon, isForcedLock = false, badgeCount = 0, badgeColor = 'bg-slate-800', 
    isInspectionModule = false, isLocked, onNavigate, isAddon = false
}: LauncherTileProps) => {
    const effectiveLock = isForcedLock || (isInspectionModule && isLocked);
    
    return (
        <button 
            type="button"
            onClick={() => !effectiveLock && onNavigate(id)}
            className={`flex flex-col items-center justify-center px-2 py-3.5 sm:p-5 transition-all duration-200 w-[calc(33.333%-0.45rem)] sm:w-[205px] md:w-[225px] min-h-[96px] sm:min-h-[126px] group relative rounded-2xl bg-white border border-slate-200/80 shadow-2xs
                ${effectiveLock ? 'opacity-35 cursor-not-allowed grayscale' : 'hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 active:scale-95'}`}
        >
            <div className="mb-2 sm:mb-3 flex items-center justify-center relative">
                {icon}
                {effectiveLock && (
                    <div className="absolute -top-1 -right-1.5 bg-slate-900 text-white rounded-full p-1 shadow-md ring-2 ring-white">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    </div>
                )}
                {badgeCount > 0 && !effectiveLock && (
                    <div className={`absolute -top-1 -right-1.5 ${badgeColor} text-white text-[9px] font-bold font-mono tabular-nums px-1.5 py-0.5 rounded-full border border-white shadow-sm leading-none`}>
                        {badgeCount}
                    </div>
                )}
                {isAddon && !effectiveLock && (
                    <div className="absolute -top-1 -right-1.5 bg-indigo-600 text-white text-[7px] font-bold px-1 rounded shadow-2xs uppercase tracking-tighter">Pro</div>
                )}
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold text-center leading-tight tracking-tight sm:tracking-normal min-h-[26px] sm:min-h-0 flex items-center justify-center px-0.5 ${effectiveLock ? 'text-slate-400' : 'text-slate-700 group-hover:text-slate-950'}`}>
                {label}
            </span>
        </button>
    );
};

const SectionHeader = ({ label, badge }: { label: string, badge?: React.ReactNode }) => (
    <div className="w-full flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className="h-px flex-1 bg-slate-200/80"></div>
        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-[0.16em] whitespace-nowrap text-center">{label}</span>
        {badge}
        <div className="h-px flex-1 bg-slate-200/80"></div>
    </div>
);

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ 
    onNavigate, userRole, isLocked = false, pendingAlertsCount = 0,
    historyList = [], isLoading = false, onViewReport, settings
}) => {
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';
    const isEnabled = (modId: string) => settings.enabledModules?.[modId] !== false;

    return (
        <div className="max-w-3xl mx-auto py-3 sm:py-6 px-2 sm:px-4 w-full min-h-[calc(100dvh-11rem)] flex flex-col justify-center overflow-x-hidden">
            <div className="space-y-6 sm:space-y-8 w-full">
                {/* 1. Core Inspection Modules */}
                <section id="inspection-forms-section" className="animate-fadeIn">
                    <SectionHeader label="Audit & Inspection Registries" />
                    <div className="flex flex-wrap items-stretch justify-center gap-2.5 sm:gap-4">
                        {isEnabled('general') && <LauncherTile id="general" label="General Inspection" isInspectionModule={true} isLocked={isLocked} onNavigate={onNavigate} icon={<GeneralAuditIcon />} />}
                        {isEnabled('petroleum_v2') && <LauncherTile id="petroleum_v2" label="Petroleum Tanker" isInspectionModule={true} isLocked={isLocked} onNavigate={onNavigate} icon={<PetroleumAuditIcon />} />}
                        {isEnabled('acid') && <LauncherTile id="acid" label="Acid Tanker" isInspectionModule={true} isLocked={isLocked} onNavigate={onNavigate} icon={<AcidAuditIcon />} />}
                    </div>
                </section>

                {/* 2. Operations & Telemetry */}
                <section className="animate-fadeIn" style={{ animationDelay: '80ms' }}>
                    <SectionHeader label="Fleet Operations" />
                    <div className="flex flex-wrap items-stretch justify-center gap-2.5 sm:gap-4">
                        {isEnabled('analytics') && <LauncherTile id="analytics" label="Fleet Analytics" isLocked={isLocked} onNavigate={onNavigate} icon={<AnalyticsIcon />} badgeCount={pendingAlertsCount} badgeColor="bg-rose-600" />}
                        {isEnabled('track_requests') && <LauncherTile id="track_requests" label="Inspection Request" isLocked={isLocked} onNavigate={onNavigate} icon={<RequestsIcon />} />}
                        <LauncherTile id="support" label="Support Desk" isLocked={isLocked} onNavigate={onNavigate} icon={<SupportIcon />} />
                    </div>
                </section>

                {/* 3. Control Center (Admin Governed) */}
                <section id="system-mgmt-section" className="animate-fadeIn" style={{ animationDelay: '140ms' }}>
                    <SectionHeader label="Governance & System" />
                    <div className="flex flex-wrap items-stretch justify-center gap-2.5 sm:gap-4">
                        <LauncherTile id="users" label="User Directory" isLocked={isLocked} isForcedLock={!isAdmin} onNavigate={onNavigate} icon={<StaffIcon />} />
                        {isEnabled('registry') && <LauncherTile id="registry" label="Fleet Registry" isLocked={isLocked} isForcedLock={!isAdmin} onNavigate={onNavigate} icon={<RegistryIcon />} />}
                        <LauncherTile id="settings" label="System Settings" isLocked={isLocked} isForcedLock={!isAdmin} onNavigate={onNavigate} icon={<SettingsIcon />} />
                    </div>
                </section>
            </div>
        </div>
    );
};

export default OverviewDashboard;