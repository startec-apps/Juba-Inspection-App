
import React from 'react';
import { SystemSettings, User } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule: string;
  onSelectModule: (m: string) => void;
  settings: SystemSettings;
  user?: User; 
  onLogout?: () => void;
  onEditProfile?: () => void; 
  onRequestInspection?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, onClose, activeModule, onSelectModule, settings, user, onLogout, onEditProfile, onRequestInspection 
}) => {
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

  const NavItem = ({ id, label, isRestricted = false }: { id: string, label: string, isRestricted?: boolean }) => {
    const isActive = activeModule === id;
    
    return (
      <button 
        id={id}
        onClick={() => { onSelectModule(id); onClose(); }}
        className={`w-full flex items-center gap-4 px-6 py-3.5 transition-all duration-300 relative group
          ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
        `}
      >
        {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>}
        <span className="text-[10px] font-black uppercase tracking-widest transition-opacity whitespace-nowrap">
          {label}
        </span>
        {isRestricted && (
            <div className="absolute right-4 text-slate-300">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3.2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Overlay for mobile and desktop when open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[50] animate-fadeIn"
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 bottom-0 z-[60] bg-white border-r border-slate-100 transition-all duration-500 flex flex-col shadow-2xl
        ${isOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full'}
      `}>
        {/* Header */}
        <div className="h-14 border-b border-slate-50 flex items-center px-6 shrink-0 overflow-hidden">
          <div className="flex items-center gap-3">
             <span className="text-slate-900 font-black uppercase tracking-tighter text-xs whitespace-nowrap">
               SafetyPro <span className="text-indigo-600">Portal</span>
             </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-6">
          <div className="space-y-0.5">
            <NavItem id="overview" label="Dashboard" />
            <NavItem id="analytics" label="Analytics" />
            <NavItem id="fleet_wall" label="Live Wall" />
            <NavItem id="library" label="Resources" />

            <div className="px-6 pt-8 pb-2 text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Audits</div>
            
            <NavItem id="general" label="Inspection" />
            <NavItem id="petroleum_v2" label="Petro V2" />
            <NavItem id="acid" label="Acid Check" />
            
            <div className="px-6 pt-8 pb-2 text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Workflow</div>
            <NavItem id="track_requests" label="Requests" />
            
            {isAdmin && (
                <>
                    <div className="px-6 pt-8 pb-2 text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Admin</div>
                    <NavItem id="users" label="Staff List" />
                    <NavItem id="settings" label="Settings" />
                </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-50 p-4 shrink-0 overflow-hidden bg-slate-50/50">
            <button 
              id="support"
              onClick={() => { onSelectModule('support'); onClose(); }}
              className={`w-full flex items-center justify-center px-3 py-3 rounded-xl transition-all duration-300
                ${activeModule === 'support' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}
              `}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">
                Support Center
              </span>
            </button>
            <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center px-3 py-3 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all mt-1"
            >
                <span className="text-[10px] font-black uppercase tracking-widest">
                    Log Out
                </span>
            </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
