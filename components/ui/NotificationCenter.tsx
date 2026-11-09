// Add React to imports to fix 'Cannot find namespace React' error
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppNotification } from '../../types';

interface NotificationCenterProps {
    id?: string;
    notifications: AppNotification[];
    onMarkAsRead: (id: string) => void;
    onDismiss: (id: string) => void;
    onClearAll: () => void;
    onAcknowledge?: (id: string) => void; 
    canAcknowledge?: boolean;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
    id,
    notifications, 
    onMarkAsRead, 
    onDismiss, 
    onClearAll,
    onAcknowledge, // Fix: Added missing prop destructuring
    canAcknowledge // Fix: Added missing prop destructuring
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'critical'>('all');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const unreadCount = notifications.filter(n => !n.read).length;
    const criticalCount = notifications.filter(n => !n.read && n.type === 'critical').length;

    const filteredNotifications = useMemo(() => {
        let filtered = [...notifications];
        if (activeFilter === 'unread') filtered = filtered.filter(n => !n.read);
        else if (activeFilter === 'critical') filtered = filtered.filter(n => n.type === 'critical');
        return filtered;
    }, [notifications, activeFilter]);

    const getRelativeTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getIcon = (type: string) => {
        const iconClasses = "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-all";
        switch(type) {
            case 'critical': 
                return <div className={`${iconClasses} bg-rose-50 text-rose-600 border-rose-100`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>;
            case 'success':
                return <div className={`${iconClasses} bg-emerald-50 text-emerald-600 border-emerald-100`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg></div>;
            default:
                return <div className={`${iconClasses} bg-indigo-50 text-indigo-600 border-indigo-100`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>;
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button 
                id={id}
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-xl transition-all duration-300 group
                    ${isOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}
                `}
            >
                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${criticalCount > 0 ? 'bg-rose-400' : 'bg-indigo-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-4 w-4 text-[8px] font-bold text-white items-center justify-center border-2 border-white shadow-sm ${criticalCount > 0 ? 'bg-rose-600' : 'bg-indigo-600'}`}>
                            {unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed inset-x-4 bottom-4 top-20 sm:top-auto sm:bottom-auto sm:absolute sm:right-0 sm:inset-x-auto sm:mt-4 w-auto sm:w-[400px] bg-white rounded-[2rem] sm:rounded-2xl shadow-2xl ring-1 ring-black/5 z-[100] flex flex-col overflow-hidden animate-slideUp origin-bottom sm:origin-top-right">
                    
                    {/* Header */}
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Notifications</h3>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Fleet Activity Monitor</p>
                        </div>
                        <button 
                            onClick={onClearAll} 
                            className="px-4 py-2 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest border border-slate-100"
                        >
                            Clear All
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-slate-50/50 p-1 border-b border-slate-50 shrink-0">
                        {['all', 'unread', 'critical'].map(f => (
                            <button 
                                key={f} 
                                onClick={() => setActiveFilter(f as any)}
                                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg
                                    ${activeFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}
                                `}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {/* List Area - Zero Scroll container logic */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide bg-white divide-y divide-slate-50 max-h-[50vh] sm:max-h-[400px]">
                        {filteredNotifications.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 text-slate-200">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" /></svg>
                                </div>
                                <p className="text-xs font-medium text-slate-400">Your archive is clear</p>
                            </div>
                        ) : (
                            filteredNotifications.map(n => (
                                <div 
                                    key={n.id} 
                                    className={`p-4 sm:p-5 transition-all relative group cursor-pointer hover:bg-slate-50/50
                                        ${!n.read ? 'bg-indigo-50/10' : 'bg-white'}
                                    `}
                                    onClick={() => onMarkAsRead(n.id)}
                                >
                                    <div className="flex gap-4">
                                        {getIcon(n.type)}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-0.5">
                                                <h4 className={`text-xs font-bold truncate pr-6 ${n.type === 'critical' ? 'text-rose-600' : 'text-slate-900'}`}>
                                                    {n.title}
                                                </h4>
                                                <span className="text-[9px] font-medium text-slate-400 whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {getRelativeTime(n.timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-500 leading-relaxed line-clamp-2">
                                                {n.message}
                                            </p>
                                            
                                            {/* Fix: Display Acknowledge button for Admins on critical alerts */}
                                            {canAcknowledge && n.type === 'critical' && onAcknowledge && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onAcknowledge(n.id); }}
                                                    className="mt-3 px-3 py-1.5 bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-black transition-all shadow-sm"
                                                >
                                                    Acknowledge Global
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                                        className="absolute top-4 right-4 p-1.5 text-slate-200 hover:text-rose-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-3 bg-slate-50 border-t border-slate-100 shrink-0 text-center">
                         <p className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em]">Automated Intelligence Suite v4.0</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;