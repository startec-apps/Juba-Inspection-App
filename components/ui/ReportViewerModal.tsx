import React, { useState, useRef, useEffect } from 'react';

interface ReportViewerModalProps {
    onClose: () => void;
    onPrint: () => void;
    children: React.ReactNode;
    title: string;
    appScriptUrl?: string;
    reportPayload?: any;
    isAdmin?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
}

const ReportViewerModal: React.FC<ReportViewerModalProps> = ({ 
    onClose, 
    children, 
    title,
    appScriptUrl,
    reportPayload,
    isAdmin = false,
    onEdit,
    onDelete
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [genMessage, setGenMessage] = useState('Print / Save PDF');
    const menuRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /**
     * Professional Enterprise Cloud Rendering
     * Sends data to Google Apps Script to generate a guaranteed high-fidelity PDF.
     */
    const handleDownloadPdf = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (isGenerating || !appScriptUrl || !reportPayload) return;
        
        setIsGenerating(true);
        setShowMenu(false);
        setGenMessage('Cloud Rendering...');

        try {
            const response = await fetch(appScriptUrl, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'generate_report_pdf',
                    reportData: reportPayload
                })
            });

            const result = await response.json();

            if (result.status === 'success' && result.base64) {
                setGenMessage('Preparing Download...');
                
                const linkSource = `data:application/pdf;base64,${result.base64}`;
                const downloadLink = document.createElement("a");
                const fileName = result.filename || `${title}.pdf`;

                downloadLink.href = linkSource;
                downloadLink.download = fileName;
                downloadLink.click();
                
                setGenMessage('Complete');
            } else {
                // Check if error is due to missing backend logic
                if (result.message && result.message.includes('handleGenerateReportPDF')) {
                    throw new Error("OUTDATED_BACKEND");
                }
                throw new Error(result.message || "Failed to render PDF in the cloud.");
            }
        } catch (err: any) {
            console.error("Professional Render Failed:", err);
            
            if (err.message === "OUTDATED_BACKEND") {
                setGenMessage('Backend Update Required');
                alert("CRITICAL ERROR: Your Google Sheet backend script is outdated. \n\nPlease go to Settings > Cloud Backend, copy the FULL script, and update your Google Apps Script project to enable PDF downloads.");
            } else {
                setGenMessage('Cloud Error');
                alert("The rendering service encountered an issue. Please try 'System Print' as a fallback or ensure your internet connection is stable.");
            }
        } finally {
            setTimeout(() => {
                setIsGenerating(false);
                setGenMessage('Print / Save PDF');
            }, 2500);
        }
    };

    const handlePrintSystem = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!contentRef.current) return;
        setShowMenu(false);

        const reportHtml = contentRef.current.innerHTML;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '100vw';
        iframe.style.bottom = '100vh';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        
        document.body.appendChild(iframe);
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;

        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <meta charset="UTF-8" />
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4; margin: 0; }
                    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; font-family: 'Inter', sans-serif !important; }
                    img { max-width: 100%; height: auto; display: block; }
                    .print-wrap { width: 210mm; margin: 0 auto; }
                </style>
            </head>
            <body>
                <div class="print-wrap">${reportHtml}</div>
            </body>
            </html>
        `);
        iframeDoc.close();
        
        const checkReady = setInterval(() => {
            if (iframeDoc.readyState === 'complete') {
                clearInterval(checkReady);
                const images = Array.from(iframeDoc.getElementsByTagName('img'));
                Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(res => img.onload = res))).then(() => {
                    setTimeout(() => {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        setTimeout(() => document.body.removeChild(iframe), 2000);
                    }, 500);
                });
            }
        }, 100);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md animate-fadeIn no-print">
            {/* Generation Progress Overlay */}
            {isGenerating && (
                <div className="absolute inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
                    <div className="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-slate-100 animate-fadeIn max-w-sm">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">{genMessage}</p>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Contacting Cloud Infrastructure</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white w-full max-w-5xl h-[94vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-white border-slate-100 shrink-0">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="text-[10px] font-black text-slate-400 hover:text-slate-900 transition-all uppercase tracking-[0.2em] flex items-center gap-2 px-4 py-2 hover:bg-slate-50 rounded-xl"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M15 19l-7-7 7-7" /></svg>
                        Close Preview
                    </button>

                    <div className="flex items-center gap-2">
                        {Boolean(isAdmin) && (Boolean(onEdit) || Boolean(onDelete)) && (
                            <div className="flex items-center gap-1.5 mr-1 sm:mr-3">
                                {Boolean(onEdit) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onEdit?.();
                                        }}
                                        className="px-3 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-[10px] font-black text-amber-800 bg-amber-50 hover:bg-amber-600 hover:text-white rounded-xl border border-amber-200 transition-all uppercase tracking-wider flex items-center gap-1.5 active:scale-95 shadow-2xs"
                                        title="Edit this record (Admin rank)"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        <span className="hidden sm:inline">Edit</span>
                                    </button>
                                )}
                                {Boolean(onDelete) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onDelete?.();
                                        }}
                                        className="px-3 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-[10px] font-black text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl border border-rose-200 transition-all uppercase tracking-wider flex items-center gap-1.5 active:scale-95 shadow-2xs"
                                        title="Delete this record (Admin rank)"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        <span className="hidden sm:inline">Delete</span>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="relative" ref={menuRef}>
                        <button 
                            type="button"
                            onClick={() => !isGenerating && setShowMenu(!showMenu)}
                            disabled={isGenerating}
                            className={`px-8 py-3.5 text-[10px] font-black text-white rounded-2xl shadow-xl flex items-center gap-3 transition-all active:scale-95 border-t border-white/10 uppercase tracking-[0.2em] ${isGenerating ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            {genMessage}
                            {!isGenerating && <svg className={`w-3 h-3 transition-transform duration-300 ${showMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M19 9l-7 7-7-7" /></svg>}
                        </button>

                        {showMenu && (
                            <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 py-2.5 z-[70] animate-fadeIn origin-top-right ring-1 ring-black/5">
                                <button type="button" onClick={handleDownloadPdf} className="w-full px-5 py-4 text-left flex items-center gap-4 hover:bg-slate-50 transition-colors group">
                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Cloud Render (PDF)</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Reliable High-Res Logic</p>
                                    </div>
                                </button>
                                <div className="h-px bg-slate-100 mx-4 my-1" />
                                <button type="button" onClick={handlePrintSystem} className="w-full px-5 py-4 text-left flex items-center gap-4 hover:bg-slate-50 transition-colors group">
                                    <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">System Print</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Standard Browser Dialog</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

                <div className="flex-1 overflow-auto bg-slate-100 p-4 sm:p-10 flex justify-center scrollbar-hide">
                    <div className="origin-top transform scale-[0.6] xs:scale-[0.75] sm:scale-[0.85] lg:scale-100 transition-transform duration-500">
                         <div ref={contentRef} className="bg-white shadow-2xl min-h-[297mm] relative z-10 w-[210mm] print:shadow-none box-border mb-20">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportViewerModal;