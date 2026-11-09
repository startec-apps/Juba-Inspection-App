import { useState, useMemo, useEffect, useRef } from 'react';
import { InspectionData, ValidationLists, User, SystemSettings } from '../types';
import { CACHE_TTL, SHEET_HEADERS, PETROLEUM_V2_HEADERS, ACID_HEADERS, PRE_CONFIGURED_SCRIPT_URL } from '../constants';
import { dbService } from '../lib/db';
import { getInspectionsFromFirebase, saveInspectionToFirebase, getFleetRegistryFromFirebase, DEFAULT_INSPECTION_LIMIT, recordSheetSync, isFirestoreQuotaExceeded } from '../services/firebase';

// Professional constraints to prevent server overload
const MIN_MANUAL_REFRESH_INTERVAL = 15000; // 15 seconds minimum between network calls for manual clicks

// Global memory cache across module switches for instantaneous navigation
const inMemoryHistoryCache = new Map<string, InspectionData[]>();

// Synchronous local cache reader for 0ms initial render
const getSyncCachedHistory = (mod: string): InspectionData[] => {
    const mem = inMemoryHistoryCache.get(mod);
    if (mem && mem.length > 0) return mem;
    try {
        const raw = localStorage.getItem(`sc_qc_${mod}`) || localStorage.getItem('sc_qc_all');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                if (mod === 'overview' || mod === 'all') {
                    inMemoryHistoryCache.set(mod, parsed);
                    return parsed;
                }
                const filtered = parsed.filter(item => {
                    const m = String(item.module || item._module || '').toLowerCase();
                    return m === mod.toLowerCase() || m.includes(mod.toLowerCase());
                });
                const finalData = filtered.length > 0 ? filtered : parsed;
                inMemoryHistoryCache.set(mod, finalData);
                return finalData;
            }
        }
    } catch {}
    return [];
};

export const useHistory = (appScriptUrl: string, activeModule: string, currentUser: User | null, settings?: SystemSettings) => {
    // Immediate 0ms synchronous hydration - no spinner on load!
    const [historyList, setHistoryList] = useState<InspectionData[]>(() => {
        return getSyncCachedHistory(activeModule);
    });
    const [isLoadingHistory, setIsLoadingHistory] = useState(() => {
        return getSyncCachedHistory(activeModule).length === 0;
    });
    const [isBackgroundFetching, setIsBackgroundFetching] = useState(false);
    
    // Ref to track the last time we actually hit the network
    const lastNetworkRequestRef = useRef<number>(0);
    // Ref to track the current active module for async response guarding
    const currentModuleRef = useRef<string>(activeModule);
    // Global request tracker to prevent redundant API calls from different instances 
    const pendingRequestRef = useRef<Record<string, Promise<any> | undefined>>({});

    const [validationLists, setValidationLists] = useState<ValidationLists>(() => {
        try {
            const raw = localStorage.getItem('sc_qc_validation_lists');
            if (raw) return JSON.parse(raw);
        } catch {}
        return {
            trucks: [],
            trailers: [],
            drivers: [],
            inspectors: [],
            locations: [],
            positions: []
        };
    });

    // Sync ref with prop and instant 0ms switch
    useEffect(() => {
        currentModuleRef.current = activeModule;
        const cached = getSyncCachedHistory(activeModule);
        if (cached && cached.length > 0) {
            setHistoryList(cached);
            setIsLoadingHistory(false);
        }
    }, [activeModule]);

    // Auto-fetch data on module or user change
    useEffect(() => {
        if (currentUser) {
            fetchHistory(false); 
        }
    }, [activeModule, appScriptUrl, currentUser?.username]);

    // Hydrate fleet registry from Firebase on mount
    useEffect(() => {
        let mounted = true;
        getFleetRegistryFromFirebase().then(registry => {
            if (mounted && registry) {
                setValidationLists(prev => ({
                    trucks: Array.from(new Set([...(prev.trucks || []), ...(registry.trucks || [])])).sort(),
                    trailers: Array.from(new Set([...(prev.trailers || []), ...(registry.trailers || [])])).sort(),
                    drivers: Array.from(new Set([...(prev.drivers || []), ...(registry.drivers || [])])).sort(),
                    inspectors: Array.from(new Set([...(prev.inspectors || []), ...(registry.inspectors || [])])).sort(),
                    locations: Array.from(new Set([...(prev.locations || []), ...(registry.locations || [])])).sort(),
                    positions: Array.from(new Set([...(prev.positions || []), ...(registry.positions || [])])).sort()
                }));
            }
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);

    // Listen for real-time quota status transitions
    useEffect(() => {
        const onQuotaChange = (e: any) => {
            if (e.detail?.exceeded) {
                fetchHistory(false);
            }
        };
        window.addEventListener('sc_quota_status_change', onQuotaChange);
        return () => window.removeEventListener('sc_quota_status_change', onQuotaChange);
    }, [activeModule, appScriptUrl]);

    // Internal helper to clean up junk data from Google Sheets source
    const sanitizeList = (list: any[], type: 'reg' | 'text') => {
        if (!Array.isArray(list)) return [];
        const unique = new Set<string>();
        
        list.forEach(item => {
            const str = String(item).trim();
            if (!str || str === "" || str === "N/A" || str === "null" || str === "undefined" || str === "0") return;
            if (str.startsWith('[BROADCAST]') || str.startsWith('HB-') || str === 'HB' || str === 'Presence' || str === 'Typing' || str.includes('sent to')) return;
            
            if (type === 'reg') {
                if (str.includes('@') || str.split(' ').length > 4 || str.length > 20 || str.length < 2) return;
                if (['SuperAdmin', 'Admin', 'System', 'Inspector', 'Manager', 'User'].includes(str)) return;
                if (/^\d$/.test(str)) return;
            } else {
                if (/^[1-5]$/.test(str)) return;
                if (str.length < 2) return;
                if (str.startsWith('ID-') || str.startsWith('REQ-')) return;
            }
            
            unique.add(str);
        });

        return Array.from(unique).sort();
    };

    const updateValidationFromInspections = (inspections: InspectionData[]) => {
        const extractedTrucks = sanitizeList(inspections.map(i => i.truckNo), 'reg');
        const extractedTrailers = sanitizeList(inspections.map(i => i.trailerNo), 'reg');
        const extractedDrivers = sanitizeList(inspections.map(i => i.driverName), 'text');
        const extractedInspectors = sanitizeList(inspections.map(i => i.inspectedBy), 'text');
        const extractedLocations = sanitizeList(inspections.map(i => i.location), 'text');

        setValidationLists(prev => ({
            trucks: Array.from(new Set([...prev.trucks, ...extractedTrucks])),
            trailers: Array.from(new Set([...prev.trailers, ...extractedTrailers])),
            drivers: Array.from(new Set([...prev.drivers, ...extractedDrivers])),
            inspectors: Array.from(new Set([...prev.inspectors, ...extractedInspectors])),
            locations: Array.from(new Set([...prev.locations, ...extractedLocations])),
            positions: prev.positions
        }));
    };

    const fetchHistory = async (forceRefresh: boolean | any = false) => {
        const requestModule = activeModule;
        const isManualForced = forceRefresh === true;
        
        const now = Date.now();
        const urlHash = appScriptUrl ? btoa(appScriptUrl.trim()).substring(0, 8) : 'fb';
        const userPrefix = currentUser ? `${currentUser.username}_` : 'anon_';
        const cacheKey = `sc_history_${urlHash}_${userPrefix}${activeModule}`;
        const listCacheKey = `sc_val_lists_${urlHash}`;
        
        const memoryHit = inMemoryHistoryCache.get(requestModule);
        const hasMemory = memoryHit && memoryHit.length > 0;
        
        if (hasMemory && !isManualForced) {
            setHistoryList(memoryHit);
        }

        // Only show spinner if we literally have zero cached data
        if (!hasMemory && historyList.length === 0) {
            setIsLoadingHistory(true);
        } else {
            setIsBackgroundFetching(true);
        }

        const routingMode = settings?.databaseRoutingMode || 'smart';
        const manualTarget = settings?.manualTarget || 'firebase';
        const forceSpreadsheetDirect = routingMode === 'manual' && manualTarget === 'spreadsheet';
        const effectiveScriptUrl = (PRE_CONFIGURED_SCRIPT_URL || appScriptUrl || settings?.backupSpreadsheetUrl || '').trim();

        let firebaseFailed = isFirestoreQuotaExceeded();

        // 1. PRIMARY: Query Firebase Firestore first (unless manual switch forces spreadsheet direct)
        if (!forceSpreadsheetDirect && !firebaseFailed) {
            try {
                const moduleFilter = activeModule === 'overview' ? 'all' : activeModule;
                
                // Wrap Firebase in a 3.5s timeout so offline/hanging network immediately fails over
                const fbPromise = getInspectionsFromFirebase(moduleFilter, DEFAULT_INSPECTION_LIMIT, isManualForced);
                const timeoutPromise = new Promise<InspectionData[]>((_, reject) => 
                    setTimeout(() => reject(new Error("Firebase query timed out (offline)")), 3500)
                );
                
                const fbRecords = await Promise.race([fbPromise, timeoutPromise]);
                
                if (fbRecords && fbRecords.length > 0) {
                    if (currentModuleRef.current === requestModule) {
                        setHistoryList(fbRecords);
                        inMemoryHistoryCache.set(requestModule, fbRecords);
                        updateValidationFromInspections(fbRecords);
                        await dbService.set(cacheKey, fbRecords);
                    }

                    // Synchronously cache for 0ms loads across sessions
                    try {
                        localStorage.setItem(`sc_qc_${requestModule}`, JSON.stringify(fbRecords.slice(0, 100)));
                        if (requestModule === 'overview' || moduleFilter === 'all') {
                            localStorage.setItem('sc_qc_all', JSON.stringify(fbRecords.slice(0, 100)));
                            const gen = fbRecords.filter(i => String(i.module || (i as any)._module || '').toLowerCase().includes('general'));
                            const pet = fbRecords.filter(i => String(i.module || (i as any)._module || '').toLowerCase().includes('petro'));
                            const acd = fbRecords.filter(i => String(i.module || (i as any)._module || '').toLowerCase().includes('acid'));
                            if (gen.length) { inMemoryHistoryCache.set('general', gen); localStorage.setItem('sc_qc_general', JSON.stringify(gen.slice(0, 100))); }
                            if (pet.length) { inMemoryHistoryCache.set('petroleum_v2', pet); localStorage.setItem('sc_qc_petroleum_v2', JSON.stringify(pet.slice(0, 100))); }
                            if (acd.length) { inMemoryHistoryCache.set('acid', acd); localStorage.setItem('sc_qc_acid', JSON.stringify(acd.slice(0, 100))); }
                        }
                    } catch {}

                    setIsLoadingHistory(false);
                    setIsBackgroundFetching(false);
                    return; // Firebase succeeded! Do NOT read from spreadsheet backup.
                } else {
                    // Firebase returned empty or 0 records -> trigger failover to spreadsheet to load data
                    firebaseFailed = true;
                }
            } catch (fbErr) {
                console.warn("Firebase inspection fetch error or offline timeout:", fbErr);
                firebaseFailed = true;
            }
        }

        // In Smart Auto mode: if Firebase was reached without error and returned data, it already returned above.
        // If Firebase is offline, timed out, erroring, or has 0 records, failover to Google Spreadsheet backup automatically!
        const trimmedUrl = effectiveScriptUrl;
        if (!trimmedUrl || typeof trimmedUrl !== 'string' || !trimmedUrl.startsWith('https://script.google.com')) {
            setIsLoadingHistory(false);
            setIsBackgroundFetching(false);
            return;
        }

        const requestSignature = `${cacheKey}_${activeModule}_${isManualForced}`;
        if (pendingRequestRef.current[requestSignature]) {
            try { await pendingRequestRef.current[requestSignature]; return; } catch (e) { return; }
        }

        if (isManualForced && (now - lastNetworkRequestRef.current < 5000)) {
            setIsBackgroundFetching(false);
            return;
        }

        if (!navigator.onLine) {
            setIsBackgroundFetching(false);
            return;
        }

        const fetchJob = (async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                console.time(`fetchHistory_${activeModule}`);
                lastNetworkRequestRef.current = now; 
                
                // Determine if we need to refresh validation lists (Trucks/Drivers suggestions)
                const cachedLists = localStorage.getItem(listCacheKey);
                const needsValidation = isManualForced || !cachedLists;

                // Determine sheet param
                let sheetParam = "";
                if (activeModule === 'petroleum_v2') sheetParam = "Petroleum_V2";
                else if (activeModule === 'acid') sheetParam = "Acid";
                else if (activeModule === 'general') sheetParam = "General";
                else if (activeModule === 'overview') sheetParam = "overview";

                // USE POST INSTEAD OF GET TO AVOID GAS REDIRECTS (MUCH FASTER)
                const response = await fetch(trimmedUrl, {
                    method: 'POST',
                    mode: 'cors',
                    credentials: 'omit',
                    body: JSON.stringify({
                        action: 'fetch_history',
                        sheet: sheetParam,
                        validation: needsValidation ? 'true' : 'false',
                        t: now // cache buster
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                console.timeEnd(`fetchHistory_${activeModule}`);
                if (!response.ok) throw new Error("Offline or Server Error");
                const json = await response.json();
                if (json.status === 'error') throw new Error(json.message || "Server error");
                return json.data || json; // Handle both wrapped and unwrapped responses
            } catch(e) {
                console.timeEnd(`fetchHistory_${activeModule}`);
                throw e;
            } finally {
                clearTimeout(timeoutId);
                delete pendingRequestRef.current[requestSignature];
            }
        })();

        pendingRequestRef.current[requestSignature] = fetchJob;

        try {
            const json = await fetchJob;
            if (currentModuleRef.current !== requestModule) return;

            const validationData = json['Validation_Data'];
            if (validationData) {
                const newLists = {
                    trucks: sanitizeList(validationData['Truck_Reg_No'] || [], 'reg'),
                    trailers: sanitizeList(validationData['Trailer_Reg_No'] || [], 'reg'),
                    drivers: sanitizeList(validationData['Driver_Name'] || [], 'text'),
                    inspectors: sanitizeList(validationData['Inspector_Name'] || [], 'text'),
                    locations: sanitizeList(validationData['Location'] || [], 'text'),
                    positions: sanitizeList(validationData['Position'] || [], 'text')
                };
                setValidationLists(newLists);
                await dbService.set(listCacheKey, newLists);
            }
            
            const isEnabled = (modId: string) => {
                if (!settings?.enabledModules) return true;
                return settings.enabledModules[modId] !== false;
            };

            const targetSheets = [];
            if (isEnabled('general')) targetSheets.push('General');
            if (isEnabled('petroleum_v2')) targetSheets.push('Petroleum_V2');
            if (isEnabled('acid')) targetSheets.push('Acid');

            let historyData: InspectionData[] = [];

            // Helper to find sheet with variations
            const findSheetData = (sheets: string[]) => {
                for (const s of sheets) {
                    const norm = s.toLowerCase().replace(/[\s_]/g, '');
                    const key = Object.keys(json).find(k => k.toLowerCase().replace(/[\s_]/g, '').includes(norm));
                    if (key && json[key]) return { data: json[key], name: key };
                }
                return null;
            };

            if (activeModule === 'overview') {
                targetSheets.forEach(sheetName => {
                    const sheetResult = findSheetData([sheetName]);
                    if (!sheetResult) return;
                    
                    const { data: rawRows, name: actualName } = sheetResult;
                    let headers = SHEET_HEADERS;
                    if (actualName.toLowerCase().includes('petroleum_v2')) headers = PETROLEUM_V2_HEADERS;
                    else if (actualName.toLowerCase().includes('acid')) headers = ACID_HEADERS;

                    if (Array.isArray(rawRows) && rawRows.length > 1) {
                        const sheetData = rawRows.slice(1).map((row: any[]) => {
                            const item: any = { _module: sheetName };
                            headers.forEach((h, idx) => { item[h] = row[idx] !== undefined ? row[idx] : null; });
                            return item as InspectionData;
                        });
                        historyData = [...historyData, ...sheetData];
                    }
                });
                historyData.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
                historyData = historyData.slice(0, 100);
            } else {
                let targetSheet = 'General';
                let targetHeaders = SHEET_HEADERS;

                if (activeModule === 'petroleum_v2') { targetSheet = 'Petroleum_V2'; targetHeaders = PETROLEUM_V2_HEADERS; }
                else if (activeModule === 'acid') { targetSheet = 'Acid'; targetHeaders = ACID_HEADERS; }
                
                const sheetResult = findSheetData([targetSheet]);
                if (sheetResult) {
                    const { data: rawRows } = sheetResult;
                    if (Array.isArray(rawRows) && rawRows.length > 1) {
                        const processed = rawRows.slice(1).map((row: any[]) => {
                            const item: any = { _module: targetSheet };
                            targetHeaders.forEach((h, idx) => { item[h] = row[idx] !== undefined ? row[idx] : null; });
                            return item as InspectionData;
                        });
                        processed.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
                        historyData = processed.slice(0, 300); // More for focused view
                    }
                }
            }

            setHistoryList(historyData);
            inMemoryHistoryCache.set(requestModule, historyData);
            try {
                localStorage.setItem(`sc_qc_${requestModule}`, JSON.stringify(historyData.slice(0, 100)));
            } catch {}
            await dbService.set(cacheKey, historyData);
            updateValidationFromInspections(historyData);
            recordSheetSync();
        } catch (error) {
        } finally {
            setIsLoadingHistory(false);
            setIsBackgroundFetching(false);
        }
    };

    const stats = useMemo(() => {
        if (!historyList.length) return { total: 0, avgRate: 0, passRate: 0 };
        const total = historyList.length;
        const goodInspections = historyList.filter(i => Number(i.rate) >= 4).length;
        const passRate = ((goodInspections / total) * 100).toFixed(0);
        return { total, avgRate: 0, passRate };
    }, [historyList]);

    const isEnabled = (modId: string) => {
        if (!settings?.enabledModules) return true;
        return settings.enabledModules[modId] !== false;
    };

    const searchDatabase = async (searchTerm: string) => {
        const cleanTerm = (searchTerm || '').trim().toLowerCase();
        if (!cleanTerm) return [];
        setIsLoadingHistory(true);
        
        try {
            // 1. PRIMARY: Instant search in Firebase records
            const localMatches = historyList.filter(item => {
                const matchesTruck = (item.truckNo || '').toLowerCase().includes(cleanTerm);
                const matchesTrailer = (item.trailerNo || '').toLowerCase().includes(cleanTerm);
                const matchesDriver = (item.driverName || '').toLowerCase().includes(cleanTerm);
                const matchesInspector = (item.inspectedBy || '').toLowerCase().includes(cleanTerm);
                const matchesLocation = (item.location || '').toLowerCase().includes(cleanTerm);
                const matchesJob = (item.jobCard || '').toLowerCase().includes(cleanTerm);
                const matchesRemarks = (item.remarks || '').toLowerCase().includes(cleanTerm);
                return matchesTruck || matchesTrailer || matchesDriver || matchesInspector || matchesLocation || matchesJob || matchesRemarks;
            });

            if (localMatches.length > 0) {
                return localMatches;
            }

            // 2. BACKUP: If no local matches, search Google Spreadsheet backup
            const trimmedUrl = (PRE_CONFIGURED_SCRIPT_URL || appScriptUrl || settings?.backupSpreadsheetUrl || '').trim();
            if (trimmedUrl && trimmedUrl.startsWith('https')) {
                let targetSheet = 'General';
                if (activeModule === 'petroleum_v2') targetSheet = 'Petroleum_V2';
                else if (activeModule === 'acid') targetSheet = 'Acid';

                const response = await fetch(trimmedUrl, {
                    method: 'POST',
                    mode: 'cors',
                    credentials: 'omit',
                    body: JSON.stringify({
                        action: 'search_history',
                        sheet: targetSheet,
                        searchTerm: searchTerm
                    })
                });
                const res = await response.json();
                if (res.status === 'success' && Array.isArray(res.data)) {
                    return res.data as InspectionData[];
                }
            }
            return [];
        } catch (e) {
            console.error("Search failed", e);
            return [];
        } finally {
            setIsLoadingHistory(false);
        }
    };

    return { 
        historyList, 
        isLoadingHistory, 
        isBackgroundFetching, 
        validationLists, 
        stats, 
        fetchHistory,
        searchDatabase
    };
};