
import { useState, useEffect } from 'react';
import { saveInspectionToFirebase, markInspectionBackupComplete } from '../services/firebase';

// Fix: Updated showToast type signature to include 'warning'
export const useOfflineSync = (appScriptUrl: string, showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void, onSyncComplete: () => void) => {
    const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'offline_saved'>('idle');
    const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isPoorConnection, setIsPoorConnection] = useState(false);

    useEffect(() => {
        const savedQueue = localStorage.getItem('safetycheck_offline_queue');
        if (savedQueue) {
            try { setOfflineQueue(JSON.parse(savedQueue)); } catch(e) {}
        }

        const handleOnline = () => {
            setIsPoorConnection(false);
            showToast("Connection restored. Attempting background sync...", 'info');
            syncOfflineQueue();
        };

        const handleOffline = () => {
            setIsPoorConnection(false); // Reset this as we are definitely offline now
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const syncOfflineQueue = async () => {
        if (isSyncing) return;
        
        const trimmedUrl = (appScriptUrl || '').trim();

        // Re-read latest from local storage just in case
        const queue = JSON.parse(localStorage.getItem('safetycheck_offline_queue') || '[]');
        if (queue.length === 0) return;
  
        setIsSyncing(true);
        setIsPoorConnection(false);
        
        let successCount = 0;
        let currentQueue = [...queue];
  
        try {
            // Process queue one by one to ensure order
            while (currentQueue.length > 0) {
                const item = currentQueue[0];
                try {
                    // 1. PRIMARY: Write to Firebase Firestore first
                    let fbInspectionId = '';
                    if (item.reportData) {
                        let modKey = 'general';
                        if (item.sheet === 'Petroleum_V2') modKey = 'petroleum_v2';
                        else if (item.sheet === 'Acid') modKey = 'acid';
                        const fbRes = await saveInspectionToFirebase(item.reportData, modKey);
                        if (fbRes.success) fbInspectionId = fbRes.id;
                    }

                    // 2. BACKUP: Sync to Google Spreadsheet backup
                    if (trimmedUrl) {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

                        const sanitizedItem = {
                            ...item,
                            row: Array.isArray(item.row) ? item.row.map((r: any) => {
                                if (typeof r === 'string' && (r.startsWith('data:image/') || r.length > 250)) {
                                    return '[Attached in Firebase]';
                                }
                                return r;
                            }) : item.row
                        };

                        await fetch(trimmedUrl, {
                            method: 'POST',
                            body: JSON.stringify(sanitizedItem),
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'text/plain' },
                            signal: controller.signal
                        });
                        
                        clearTimeout(timeoutId);
                        if (fbInspectionId) {
                            markInspectionBackupComplete(fbInspectionId).catch(() => {});
                        }
                    }
                    
                    currentQueue.shift(); // Remove successful item
                    successCount++;
                    
                    // Update State & Storage immediately
                    setOfflineQueue([...currentQueue]);
                    localStorage.setItem('safetycheck_offline_queue', JSON.stringify(currentQueue));
                    
                    // Small delay between requests to not overwhelm a poor connection
                    await new Promise(r => setTimeout(r, 1000));

                } catch (error: any) {
                    console.error("Sync failed for item", error);
                    if (error.name === 'AbortError' || error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                        setIsPoorConnection(true);
                        // Stop processing the queue if connection is bad, try again later
                        break; 
                    }
                    // If it's a logic error, we might want to skip it, but for now we break to be safe
                    break;
                }
            }
        } finally {
            setIsSyncing(false);
            if (successCount > 0) {
                if (currentQueue.length === 0) {
                    showToast(`All ${successCount} offline records synced successfully!`, 'success');
                    onSyncComplete();
                } else {
                    showToast(`Synced ${successCount} items. ${currentQueue.length} remaining.`, 'info');
                }
            } else if (isPoorConnection && queue.length > 0) {
                // Toast handled by UI component usually, but good to log
            }
        }
    };

    const addToQueue = (payload: any) => {
        const newQueue = [...offlineQueue, payload];
        setOfflineQueue(newQueue);
        localStorage.setItem('safetycheck_offline_queue', JSON.stringify(newQueue));
    };

    return {
        submissionStatus,
        setSubmissionStatus,
        offlineQueue,
        isSyncing,
        isPoorConnection,
        syncOfflineQueue,
        addToQueue
    };
};