import { useState, useEffect, useRef } from 'react';
import { AppNotification, User } from '../types';
import { getNotificationsFromFirebase } from '../services/firebase';

const MAX_NOTIFICATIONS = 50; 
const POLLING_INTERVAL = 240000; // 4 minutes - throttled to preserve Firestore free tier quota
const ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 Hours - Keep it fresh

export const useNotifications = (appScriptUrl: string, currentUser: User | null, showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
    const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
    const [notifiedIds, setNotifiedIds] = useState<string[]>([]); 
    
    // Use Refs to handle the true dismissal state during async polling
    const dismissedRef = useRef<string[]>([]);
    const readRef = useRef<string[]>([]);
    const notifiedRef = useRef<string[]>([]);
    const pollingRef = useRef<number | null>(null);

    // Synchronize state with refs for background logic
    useEffect(() => { dismissedRef.current = dismissedNotificationIds; }, [dismissedNotificationIds]);
    useEffect(() => { readRef.current = readNotificationIds; }, [readNotificationIds]);
    useEffect(() => { notifiedRef.current = notifiedIds; }, [notifiedIds]);

    useEffect(() => {
        if (!currentUser) {
            if (pollingRef.current) window.clearInterval(pollingRef.current);
            return;
        }

        const userPrefix = currentUser.username.replace(/[^a-z0-9]/gi, '_') + '_';
        const savedRead = localStorage.getItem(`sc_read_notifications_${userPrefix}`);
        const savedDismissed = localStorage.getItem(`sc_dismissed_notifications_${userPrefix}`);
        const savedNotified = localStorage.getItem(`sc_pop_history_${userPrefix}`);
        
        const initialRead = savedRead ? JSON.parse(savedRead) : [];
        const initialDismissed = savedDismissed ? JSON.parse(savedDismissed) : [];
        const initialNotified = savedNotified ? JSON.parse(savedNotified) : [];
        
        setReadNotificationIds(initialRead);
        setDismissedNotificationIds(initialDismissed);
        setNotifiedIds(initialNotified);
        
        fetchNotifications();
        pollingRef.current = window.setInterval(fetchNotifications, POLLING_INTERVAL);

        return () => {
            if (pollingRef.current) window.clearInterval(pollingRef.current);
        };
    }, [currentUser, appScriptUrl]);

    const saveState = (type: 'read' | 'dismissed' | 'notified', ids: string[]) => {
        if (!currentUser) return;
        const userPrefix = currentUser.username.replace(/[^a-z0-9]/gi, '_') + '_';
        const key = type === 'read' ? `sc_read_notifications_${userPrefix}` : 
                    type === 'dismissed' ? `sc_dismissed_notifications_${userPrefix}` : 
                    `sc_pop_history_${userPrefix}`;
        localStorage.setItem(key, JSON.stringify(ids));
        
        if (type === 'read') setReadNotificationIds(ids);
        else if (type === 'dismissed') setDismissedNotificationIds(ids);
        else if (type === 'notified') setNotifiedIds(ids);
    };

    const fetchNotifications = async () => {
        if (!navigator.onLine || !currentUser) return;
        // Do not poll when the tab is hidden / in background to prevent quota depletion across 100 users
        if (typeof document !== 'undefined' && document.hidden) return;

        let allAlerts: AppNotification[] = [];
        const isDismissed = (id: string) => dismissedRef.current.includes(id);
        const isRead = (id: string) => readRef.current.includes(id);

        // 1. PRIMARY: Fetch from Firebase Firestore
        try {
            const fbNotifs = await getNotificationsFromFirebase();
            if (fbNotifs && fbNotifs.length > 0) {
                fbNotifs.forEach(n => {
                    if (!isDismissed(n.id)) {
                        allAlerts.push({
                            ...n,
                            read: isRead(n.id)
                        });
                    }
                });
            }
        } catch (e) {
            console.warn("Firebase notification fetch error:", e);
        }

        const trimmedUrl = (appScriptUrl || '').trim();
        if (!trimmedUrl || !trimmedUrl.startsWith('https://script.google.com')) {
            if (allAlerts.length > 0) {
                allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setNotifications(allAlerts.slice(0, MAX_NOTIFICATIONS));
            }
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const cacheBuster = `t=${Date.now()}`;
            const finalUrl = `${trimmedUrl}${trimmedUrl.includes('?') ? '&' : '?'}${cacheBuster}`;
            
            const response = await fetch(finalUrl, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                redirect: 'follow',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) return;

            const text = await response.text();
            if (!text || text.trim().startsWith('<')) return;

            const json = JSON.parse(text);
            const serverAcknowledgements = (json['Acknowledgements'] || []).map((id: any) => String(id));
            const now = Date.now();

            const isItemDismissed = (id: string) => isDismissed(id) || serverAcknowledgements.includes(id);

            const processRows = (rows: any[], moduleName: string): AppNotification[] => {
                if (!Array.isArray(rows) || rows.length <= 1) return [];
                const rateIndex = moduleName === 'General' ? 8 : 9;
                const truckIndex = 2;
                
                return rows.slice(Math.max(1, rows.length - 50)).map((row: any[]) => {
                    const tsRaw = String(row[1]); 
                    const tsParsed = Date.parse(tsRaw);
                    const truck = String(row[truckIndex] || 'UNIT').trim().toUpperCase();
                    const rate = Number(row[rateIndex]);

                    // Generate a truly immutable ID
                    const alertId = `V_${moduleName}_${tsParsed}_${truck}`.replace(/\s+/g, '');

                    if (isItemDismissed(alertId) || isNaN(tsParsed) || (now - tsParsed > ALERT_MAX_AGE_MS)) {
                        return null;
                    }

                    if (rate <= 3) {
                        return {
                            id: alertId,
                            title: rate <= 2 ? `CRITICAL: ${truck}` : `WARNING: ${truck}`,
                            message: `${moduleName} Audit: Rated ${rate}/5`,
                            type: rate <= 2 ? 'critical' : 'warning',
                            timestamp: tsRaw,
                            read: isRead(alertId),
                            module: moduleName
                        };
                    }
                    return null;
                }).filter(n => n !== null) as AppNotification[];
            };

            // Process sheets
            ['General', 'Petroleum', 'Petroleum_V2', 'Acid'].forEach(sheet => {
                if (json[sheet]) allAlerts = [...allAlerts, ...processRows(json[sheet], sheet)];
            });

            // Process System Notifications
            const systemRows = json['SystemNotification'] || [];
            if (Array.isArray(systemRows) && systemRows.length > 1) {
                const userEmail = currentUser.username.toLowerCase().trim();
                const userRole = currentUser.role.toLowerCase().trim();
                
                systemRows.forEach((row: any[]) => {
                    const notifId = String(row[0]);
                    const recipient = String(row[1]).trim().toLowerCase();
                    const isReadOnServer = String(row[5]).toUpperCase() === 'TRUE';
                    
                    if (isItemDismissed(notifId) || isReadOnServer) return;

                    if (recipient === userEmail || recipient === userRole || recipient === 'all') {
                        allAlerts.push({
                            id: notifId,
                            title: 'SYSTEM ALERT',
                            message: String(row[3]),
                            type: String(row[2]).toLowerCase() as any || 'info',
                            timestamp: row[4],
                            read: isRead(notifId),
                            actionLink: row[6],
                            isServerEvent: true
                        });
                    }
                });
            }

            allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const finalAlerts = allAlerts.slice(0, MAX_NOTIFICATIONS);

            // Filter out items that have already been cleared/dismissed to stop popups
            const newForToast = finalAlerts.filter(a => 
                !notifiedRef.current.includes(a.id) && 
                !a.read && 
                !dismissedRef.current.includes(a.id)
            );

            if (newForToast.length > 0) {
                const latest = newForToast[0];
                showToast(latest.message, latest.type === 'critical' ? 'error' : 'info');
                const updatedNotified = [...new Set([...notifiedRef.current, ...newForToast.map(a => a.id)])];
                saveState('notified', updatedNotified);
            }

            setNotifications(finalAlerts);
        } catch (e) {
            console.warn("Notification sync delayed.");
        } finally {
            clearTimeout(timeoutId);
        }
    };

    const handleMarkNotificationRead = async (id: string, onNavigate?: (module: string) => void) => {
        setNotifications(prev => prev.map(n => n.id === id ? {...n, read: true} : n));
        saveState('read', [...new Set([...readRef.current, id])]);
        
        const target = notifications.find(n => n.id === id);
        if (target?.actionLink && onNavigate) onNavigate(target.actionLink);
    };

    const handleDismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        saveState('dismissed', [...new Set([...dismissedRef.current, id])]);
        saveState('notified', [...new Set([...notifiedRef.current, id])]);
    };

    const handleClearAllNotifications = () => {
        const allIds = notifications.map(n => n.id);
        const nextDismissed = [...new Set([...dismissedRef.current, ...allIds])];
        const nextNotified = [...new Set([...notifiedRef.current, ...allIds])];
        
        saveState('dismissed', nextDismissed);
        saveState('notified', nextNotified);
        setNotifications([]);
    };

    const handleGlobalAcknowledge = async (id: string) => {
        const trimmedUrl = (appScriptUrl || '').trim();
        if (!trimmedUrl || !currentUser) return;
        handleDismissNotification(id);
        try {
            await fetch(trimmedUrl, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'acknowledge_notification',
                    notificationId: id,
                    user: currentUser.username
                }),
                mode: 'no-cors'
            });
            showToast("Global acknowledgement synced.", "success");
        } catch (e) {
            console.warn("Server acknowledgement failed.");
        }
    };

    return {
        notifications,
        handleMarkNotificationRead,
        handleDismissNotification,
        handleClearAllNotifications,
        handleGlobalAcknowledge,
        fetchNotifications
    };
};