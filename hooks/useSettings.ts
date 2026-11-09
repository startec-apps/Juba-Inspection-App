import { useState, useEffect, useRef } from 'react';
import { SystemSettings } from '../types';
import { PRE_CONFIGURED_SCRIPT_URL, TEMPLATE_CONFIGS } from '../constants';
import { getSettingsFromFirebase, saveSettingsToFirebase } from '../services/firebase';

export const useSettings = () => {
    const [appScriptUrl, setAppScriptUrl] = useState<string>(() => {
        const preConfigured = PRE_CONFIGURED_SCRIPT_URL as string;
        if (preConfigured && preConfigured.length > 0) return preConfigured;
        if (typeof window !== 'undefined') return localStorage.getItem('safetyCheck_scriptUrl') || '';
        return '';
    });

    const [settings, setSettings] = useState<SystemSettings>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('safetyCheck_settings');
            if (saved) {
                try { return JSON.parse(saved); } catch (e) { console.error("Failed to parse local settings", e); }
            }
        }
        return { 
            companyName: 'SafetyCheck Pro', 
            managerEmail: 'notification@scbcnet.com',
            groupEmail: 'juba_alerts@googlegroups.com',
            templates: TEMPLATE_CONFIGS
        };
    });

    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const isFetchingRef = useRef(false);
    const isWritingRef = useRef(false);

    useEffect(() => {
        const preConfigured = (PRE_CONFIGURED_SCRIPT_URL as string || '').trim();
        if (preConfigured && preConfigured !== appScriptUrl) {
            setAppScriptUrl(preConfigured);
            if (typeof window !== 'undefined') {
                localStorage.setItem('safetyCheck_scriptUrl', preConfigured);
            }
        }
    }, []);

    useEffect(() => {
        if (appScriptUrl && appScriptUrl.startsWith('https://script.google.com')) {
            fetchSystemSettings(appScriptUrl);

            const intervalId = setInterval(() => {
                if (!isWritingRef.current) {
                    fetchSystemSettings(appScriptUrl);
                }
            }, 30000);

            return () => clearInterval(intervalId);
        }
    }, [appScriptUrl]);

    const fetchSystemSettings = async (url: string, force: boolean = false) => {
        const trimmedUrl = (url || '').trim();
        if (!trimmedUrl || !trimmedUrl.startsWith('https://script.google.com')) return;
        if (!navigator.onLine || (isFetchingRef.current && !force)) return;

        isFetchingRef.current = true;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const cacheBuster = `t=${new Date().getTime()}`;
            const finalUrl = `${trimmedUrl}${trimmedUrl.includes('?') ? '&' : '?'}${cacheBuster}`;
            
            const response = await fetch(finalUrl, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-store',
                redirect: 'follow',
                signal: controller.signal
            });
            
            if (!response.ok) return;
            
            const json = await response.json();
            const settingsRows = json['System_Settings'];

            if (settingsRows && Array.isArray(settingsRows) && settingsRows.length > 1) {
                const latestConfig = settingsRows[1]; 
                
                if (latestConfig && latestConfig.length >= 4) {
                    const rawLogo = latestConfig[4] ? String(latestConfig[4]) : '';
                    const remoteLogo = (rawLogo.length > 50 && !rawLogo.includes('Firebase')) ? rawLogo : undefined;

                    const remoteSettings: SystemSettings = {
                        companyName: latestConfig[0] || 'SafetyCheck Pro',
                        managerEmail: latestConfig[1] || '',
                        groupEmail: latestConfig[9] ? String(latestConfig[9]) : (settings.groupEmail || 'juba_alerts@googlegroups.com'),
                        companyLogo: remoteLogo || settings.companyLogo,
                        mobileApkLink: latestConfig[5] || '', 
                        webAppUrl: latestConfig[6] || '',
                        templates: latestConfig[7] ? JSON.parse(latestConfig[7]) : settings.templates || TEMPLATE_CONFIGS,
                        enabledModules: latestConfig[8] ? JSON.parse(latestConfig[8]) : settings.enabledModules || {}
                    };
                    
                    setSettings(prev => {
                        const hasChanged = JSON.stringify(prev) !== JSON.stringify(remoteSettings);
                        if (hasChanged) {
                            localStorage.setItem('safetyCheck_settings', JSON.stringify(remoteSettings));
                            return remoteSettings;
                        }
                        return prev;
                    });
                }
            }
        } catch (error) {
            // Quiet fail for network
        } finally {
            clearTimeout(timeoutId);
            isFetchingRef.current = false;
        }
    };

    useEffect(() => {
        // Read settings from Firebase Firestore first
        getSettingsFromFirebase().then(remoteFb => {
            if (remoteFb) {
                setSettings(prev => ({
                    ...prev,
                    ...remoteFb,
                    templates: remoteFb.templates || prev.templates || TEMPLATE_CONFIGS
                }));
                localStorage.setItem('safetyCheck_settings', JSON.stringify(remoteFb));
                if (remoteFb.backupSpreadsheetUrl && !appScriptUrl) {
                    setAppScriptUrl(remoteFb.backupSpreadsheetUrl);
                }
            }
        }).catch(err => {
            console.warn("Could not read settings from Firebase:", err);
        });
    }, []);

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        isWritingRef.current = true;
        try {
            localStorage.setItem('safetyCheck_settings', JSON.stringify(settings));
            localStorage.setItem('safetyCheck_scriptUrl', appScriptUrl);

            // 1. PRIMARY: Write to Firebase Firestore first
            await saveSettingsToFirebase({
                ...settings,
                backupSpreadsheetUrl: appScriptUrl
            });

            // 2. BACKUP: Sync to Google Spreadsheet backup
            if (appScriptUrl && appScriptUrl.startsWith('https') && navigator.onLine) {
                 const backupPayload = {
                     ...settings,
                     companyLogo: (typeof settings.companyLogo === 'string' && settings.companyLogo.startsWith('data:image/'))
                         ? '[Company Logo Stored in Firebase]'
                         : (settings.companyLogo || '')
                 };
                 await fetch(appScriptUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'update_settings',
                        ...backupPayload
                    }),
                    mode: 'no-cors' 
                });
            }
        } catch (error) {
            console.error("Save Settings Failed", error);
        } finally {
            setTimeout(() => {
                setIsSavingSettings(false);
                isWritingRef.current = false;
            }, 800);
        }
    };

    return { 
        settings, 
        setSettings, 
        appScriptUrl, 
        setAppScriptUrl, 
        isSavingSettings, 
        handleSaveSettings,
        fetchSystemSettings
    };
};