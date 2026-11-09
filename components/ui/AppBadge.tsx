import React from 'react';

const AppBadge: React.FC<{ notifications: any[] }> = ({ notifications }) => {
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount === 0) return null;
    
    return (
        <div className="fixed bottom-6 right-6 z-[100] pointer-events-none">
            <div className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg animate-bounce border-2 border-white">
                {unreadCount} NEW
            </div>
        </div>
    );
};

export default AppBadge;
