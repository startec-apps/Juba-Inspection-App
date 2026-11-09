import React from 'react';
import { User, SystemSettings, AppNotification } from '../../types';
import NotificationCenter from '../ui/NotificationCenter';

interface AppHeaderProps {
    settings: SystemSettings;
    currentUser: User;
    activeModule: string;
    isAtRoot: boolean;
    isAdmin: boolean;
    notifications: AppNotification[];
    onNavigateHome: () => void;
    handleMarkNotificationRead: (id: string, navigate: any) => void;
    handleDismissNotification: (id: string) => void;
    handleClearAllNotifications: () => void;
    handleGlobalAcknowledge: (id: string) => void;
    handleNavigate: (module: string) => void;
    setIsProfileModalOpen: (open: boolean) => void;
    setActiveModule: (module: string) => void;
    setIsSolutionsOpen: (open: boolean) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    settings, currentUser, activeModule, isAtRoot, isAdmin,
    notifications, onNavigateHome, 
    handleMarkNotificationRead, handleDismissNotification, handleClearAllNotifications,
    handleGlobalAcknowledge, handleNavigate, setIsProfileModalOpen, setActiveModule,
    setIsSolutionsOpen
}) => {
    return (
        <div className="no-print">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-2 flex items-center justify-between h-14">
                <div className="flex items-center gap-2">
                    {!isAtRoot && (
                        <button onClick={onNavigateHome} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all flex items-center group">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
                            <span className="text-[10px] font-black ml-1 hidden sm:inline uppercase tracking-widest">Dashboard</span>
                        </button>
                    )}
                </div>
                <button onClick={onNavigateHome} className="flex flex-col items-center hover:opacity-80 transition-opacity absolute left-1/2 -translate-x-1/2">
                    <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tighter leading-none uppercase">{settings.companyName || 'SAFETYCHECK PRO'}</h1>
                </button>
                <div className="flex items-center gap-1 sm:gap-2">
                    <button 
                        onClick={() => setIsSolutionsOpen(true)}
                        className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-600 transition-colors relative group"
                        title="Enterprise Solutions"
                    >
                        <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        <span className="absolute top-1 right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500 border border-white"></span>
                        </span>
                    </button>
                    <NotificationCenter id="notification-bell" notifications={notifications} onMarkAsRead={(id) => handleMarkNotificationRead(id, handleNavigate)} onDismiss={handleDismissNotification} onClearAll={handleClearAllNotifications} onAcknowledge={handleGlobalAcknowledge} canAcknowledge={isAdmin} />
                    <button id="profile-trigger" onClick={() => setIsProfileModalOpen(true)} className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    </button>
                </div>
            </header>
        </div>
    );
};

export default AppHeader;
