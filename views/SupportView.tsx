import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, SystemSettings, SupportTicket, TicketComment, ValidationLists } from '../types';
import { getSupportTicketsFromFirebase, saveSupportTicketToFirebase, addCommentToSupportTicketInFirebase } from '../services/firebase';

interface SupportViewProps {
    appScriptUrl: string;
    currentUser: User | null;
    showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    settings?: SystemSettings;
    validationLists?: ValidationLists;
    prefillData?: { subject: string, description: string } | null;
    onPrefillConsumed?: () => void;
}

const TicketList: React.FC<{
    tickets: SupportTicket[]; isLoading: boolean; onRefresh: () => void; onSelect: (t: SupportTicket) => void; isAdmin: boolean; filterStatus: string;
}> = ({ tickets, isLoading, onRefresh, onSelect, filterStatus }) => {
    const filtered = useMemo(() => {
        if (filterStatus === 'OPEN') return tickets.filter(t => t.status === 'Open' || t.status === 'In Progress');
        if (filterStatus === 'CLOSED') return tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');
        return tickets;
    }, [tickets, filterStatus]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[300px]">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <span className="font-semibold text-sm text-slate-700">Recent Requests ({filtered.length})</span>
                <button onClick={onRefresh} className="text-[10px] text-indigo-600 font-bold uppercase tracking-wide bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">Refresh</button>
            </div>
            <div className="divide-y divide-slate-100">
                {isLoading ? <div className="p-12 text-center text-slate-400 text-xs">Checking for updates...</div> :
                 filtered.length === 0 ? <div className="p-16 text-center text-slate-400 italic text-xs">No active support requests.</div> :
                 filtered.map(t => (
                    <div key={t.ticketId} onClick={() => onSelect(t)} className="p-4 sm:p-5 hover:bg-slate-50 cursor-pointer transition-colors group">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-2">
                            <span className="font-semibold text-sm text-slate-800 group-hover:text-indigo-600 line-clamp-1">#{t.ticketId}: {t.subject}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border self-start ${
                                t.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                            }`}>
                                {t.status}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{t.description}</p>
                        <div className="flex items-center gap-2 overflow-hidden">
                             <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(t.timestamp).toLocaleDateString()}</span>
                             <span className="text-[10px] text-slate-300">•</span>
                             <span className="text-[10px] text-slate-400 truncate">{t.user}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TicketDetail: React.FC<{
    ticket: SupportTicket; currentUser: User | null; isAdmin: boolean; onClose: () => void; onReply: (msg: string) => void; isSendingReply: boolean; isLocked?: boolean;
}> = ({ ticket, currentUser, isAdmin, onClose, onReply, isSendingReply, isLocked }) => {
    const [replyText, setReplyText] = useState('');
    const handleSend = () => { if(!replyText.trim() || isLocked) return; onReply(replyText); setReplyText(''); };
    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[500px] sm:h-[600px] animate-fadeIn">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                <button onClick={onClose} className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
                    Back
                </button>
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-800 text-sm truncate max-w-[120px] sm:max-w-[200px]">{ticket.subject}</span>
                    {isLocked && <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">View Only</span>}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
                <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-slate-700 leading-relaxed break-words">{ticket.description}</p>
                </div>

                {ticket.comments?.map((c, i) => {
                    const roleLower = c.role?.toLowerCase() || '';
                    const isStaff = roleLower === 'admin' || roleLower === 'superadmin';
                    const displayIdentity = isStaff ? 'Support' : c.user;

                    return (
                        <div key={i} className={`p-3 rounded-xl border ${c.user === currentUser?.name ? 'bg-indigo-600 text-white ml-auto border-indigo-500' : 'bg-white text-slate-700 mr-auto border-slate-100'} max-w-[90%] sm:max-w-[85%]`}>
                            <div className="flex justify-between items-center mb-1 gap-4">
                                <p className="text-[10px] font-semibold opacity-70 truncate">
                                    {displayIdentity}
                                </p>
                                <p className="text-[9px] opacity-50 whitespace-nowrap">{new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                            <p className="text-sm break-words">{c.message}</p>
                        </div>
                    );
                })}
            </div>
            {!isLocked && (
                <div className="p-3 border-t bg-white flex gap-2 items-center">
                    <input className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all" placeholder="Type a message..." value={replyText} onChange={e => setReplyText(e.target.value)} />
                    <button onClick={handleSend} disabled={isSendingReply || !replyText.trim()} className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all disabled:bg-slate-300">
                        {isSendingReply ? '...' : 'Send'}
                    </button>
                </div>
            )}
        </div>
    );
};

const SupportView: React.FC<SupportViewProps> = ({ appScriptUrl, currentUser, showToast, settings, prefillData, onPrefillConsumed }) => {
    const isLocked = false; // Support remains unrestricted for operational continuity
    const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [formData, setFormData] = useState({ subject: '', description: '', priority: 'Medium' });

    useEffect(() => {
        if (prefillData) {
            setFormData({ subject: prefillData.subject, description: prefillData.description, priority: 'Medium' });
            setActiveTab('create');
            if (onPrefillConsumed) onPrefillConsumed();
        }
    }, [prefillData]);

    const fetchTickets = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            // 1. PRIMARY: Query Firebase Firestore first
            const fbTickets = await getSupportTicketsFromFirebase(currentUser.username, currentUser.role);
            if (fbTickets && fbTickets.length > 0) {
                setTickets(fbTickets);
            }

            // 2. BACKUP: If Google Apps Script URL exists, sync with spreadsheet
            if (appScriptUrl) {
                try {
                    const resp = await fetch(appScriptUrl, { 
                        method: 'POST', 
                        body: JSON.stringify({ action: 'get_tickets', email: currentUser.username, role: currentUser.role }) 
                    });
                    const res = await resp.json();
                    if (res.status === 'success' && Array.isArray(res.tickets)) {
                        // Merge or populate Firebase if empty
                        if (fbTickets.length === 0 && res.tickets.length > 0) {
                            res.tickets.forEach((t: SupportTicket) => saveSupportTicketToFirebase(t).catch(() => {}));
                            setTickets(res.tickets);
                        }
                    }
                } catch (e) {
                    // Fail silently as Firebase already rendered tickets
                }
            }
        } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchTickets(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLocked) { showToast("System is in view-only mode.", "error"); return; }
        setIsSubmitting(true);
        try {
            const ticketId = `TICK-${Date.now()}`;
            const newTicket: SupportTicket = {
                ticketId,
                type: 'Issue',
                subject: formData.subject,
                description: formData.description,
                priority: formData.priority,
                user: currentUser?.name || 'Staff',
                email: currentUser?.username || 'user',
                role: currentUser?.role || 'Inspector',
                timestamp: new Date().toISOString(),
                status: 'Open',
                comments: []
            };

            // 1. PRIMARY: Save to Firebase Firestore first
            await saveSupportTicketToFirebase(newTicket);

            // 2. BACKUP: Sync to Google Spreadsheet
            if (appScriptUrl) {
                try {
                    const payload = { action: 'submit_support_ticket', ...newTicket };
                    await fetch(appScriptUrl, { method: 'POST', body: JSON.stringify(payload), mode: 'no-cors' });
                } catch (e) {
                    console.warn("Spreadsheet support backup warning:", e);
                }
            }

            showToast("Request submitted to database successfully.", "success");
            setFormData({ subject: '', description: '', priority: 'Medium' });
            setActiveTab('list');
            fetchTickets();
        } catch (e) { 
            showToast("Failed to send request.", "error"); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const handleReply = async (message: string) => {
        if (!selectedTicket || isLocked) return;
        setIsSendingReply(true);
        try {
            const comment: TicketComment = { 
                user: currentUser?.name || 'User', 
                role: currentUser?.role || 'User', 
                message, 
                timestamp: new Date().toISOString() 
            };

            // 1. PRIMARY: Save comment to Firebase Firestore
            await addCommentToSupportTicketInFirebase(selectedTicket.ticketId, comment);

            // 2. BACKUP: Sync comment to Google Spreadsheet
            if (appScriptUrl) {
                try {
                    await fetch(appScriptUrl, { 
                        method: 'POST', 
                        body: JSON.stringify({ action: 'update_ticket', ticketId: selectedTicket.ticketId, comment }), 
                        mode: 'no-cors' 
                    });
                } catch (e) {
                    console.warn("Spreadsheet ticket comment backup warning:", e);
                }
            }

            const updated = { ...selectedTicket, comments: [...selectedTicket.comments, comment] };
            setSelectedTicket(updated);
            setTickets(ts => ts.map(t => t.ticketId === updated.ticketId ? updated : t));
            showToast("Reply saved.", "success");
        } finally { 
            setIsSendingReply(false); 
        }
    };

    const handleShareApp = async () => {
        if (!settings) return;
        
        const company = settings.companyName || 'Fleet Portal';
        const rawWebUrl = (settings.webAppUrl || window.location.href).trim();
        const appUrl = settings.mobileApkLink;

        // URL Validation Helper: Ensure absolute URL for Navigator.share
        const getValidUrl = (urlStr: string) => {
            try {
                if (!urlStr) return null;
                // If it doesn't start with a protocol, assume https
                const protocolRegex = /^[a-z]+:\/\//i;
                const formattedUrl = protocolRegex.test(urlStr) ? urlStr : `https://${urlStr}`;
                const url = new URL(formattedUrl);
                return url.toString();
            } catch (e) {
                return null;
            }
        };

        const webUrl = getValidUrl(rawWebUrl);

        let shareMessage = `*${company.toUpperCase()} ACCESS LINKS*\n\n💻 Web Portal: ${webUrl || rawWebUrl}`;
        if (appUrl) {
            shareMessage += `\n\n📱 Android App: ${appUrl}`;
        }

        // Construct share data object carefully
        const shareData: any = {
            title: company,
            text: shareMessage
        };

        // Only include URL if it passed strict browser validation
        if (webUrl) {
            shareData.url = webUrl;
        }

        try {
            if (navigator.share) {
                // Using timeout to ensure clean execution context (iOS fix)
                setTimeout(async () => {
                    try {
                        await navigator.share(shareData);
                    } catch (shareErr) {
                        // Handle dismissal or browser specific fails
                        if (shareErr instanceof Error && shareErr.name !== 'AbortError') {
                            copyToClipboard(shareMessage);
                        }
                    }
                }, 100);
            } else {
                copyToClipboard(shareMessage);
            }
        } catch (err) {
            copyToClipboard(shareMessage);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => showToast("Links copied to clipboard.", "info"))
            .catch(() => showToast("Failed to copy links.", "error"));
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-20 px-2 sm:px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800 tracking-tight uppercase">Support Center</h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">Get assistance or report issues</p>
                </div>
                {isLocked && <span className="px-4 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold uppercase tracking-wide">View-Only</span>}
            </div>

            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200">
                <button onClick={() => !isLocked && setActiveTab('create')} disabled={isLocked} className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'create' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'} ${isLocked && 'opacity-30'}`}>New Ticket</button>
                <button onClick={() => setActiveTab('list')} className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>My History</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    {activeTab === 'create' ? (
                        <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn">
                            <h3 className="text-lg font-semibold text-slate-800 mb-6">Submit a Request</h3>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">Subject</label>
                                    <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="e.g. Odometer sync issue" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">Details</label>
                                    <textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm h-32 outline-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none" placeholder="Describe your problem..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
                                </div>
                                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all shadow active:scale-[0.98] text-sm flex items-center justify-center gap-2">
                                    {isSubmitting ? 'Sending...' : 'Submit Request'}
                                </button>
                            </form>
                        </div>
                    ) : selectedTicket ? (
                        <TicketDetail ticket={selectedTicket} currentUser={currentUser} isAdmin={currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin'} onClose={() => setSelectedTicket(null)} onReply={handleReply} isSendingReply={isSendingReply} isLocked={isLocked} />
                    ) : (
                        <TicketList tickets={tickets} isLoading={isLoading} onRefresh={fetchTickets} onSelect={setSelectedTicket} isAdmin={currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin'} filterStatus="ALL" />
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-tight mb-2">Share Application</h3>
                        <p className="text-xs text-slate-500 leading-relaxed mb-4">Share access links for the web portal and mobile application with your team.</p>
                        <button onClick={handleShareApp} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                            Generate Access links
                        </button>
                    </div>

                    <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Service Hours</h4>
                        <div className="space-y-2 text-xs text-slate-600 font-medium">
                            <div className="flex justify-between"><span>Mon - Fri</span><span>08:00 - 17:00</span></div>
                            <div className="flex justify-between"><span>Sat</span><span>09:00 - 13:00</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportView;