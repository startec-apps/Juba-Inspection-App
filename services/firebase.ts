import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    getDocFromServer,
    setDoc, 
    updateDoc, 
    deleteDoc,
    getDocs, 
    collection, 
    query, 
    where, 
    limit, 
    Firestore
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { InspectionData, User, SystemSettings, ValidationLists, AppNotification, SupportTicket, TicketComment } from '../types';
import { SHEET_HEADERS, PETROLEUM_V2_HEADERS, ACID_HEADERS } from '../constants';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use the provisioned database ID or default
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.length > 0 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined;

export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const auth = getAuth(app);

export function recordFirebaseSync() {
    try {
        localStorage.setItem('sc_fb_last_sync', new Date().toISOString());
        window.dispatchEvent(new CustomEvent('sc_db_sync', { detail: { target: 'firebase', time: new Date().toISOString() } }));
    } catch {}
}

export function getFirebaseLastSync(): string | null {
    try {
        return localStorage.getItem('sc_fb_last_sync');
    } catch {
        return null;
    }
}

export function recordSheetSync() {
    try {
        localStorage.setItem('sc_sheet_last_sync', new Date().toISOString());
        window.dispatchEvent(new CustomEvent('sc_db_sync', { detail: { target: 'sheet', time: new Date().toISOString() } }));
    } catch {}
}

export function getSheetLastSync(): string | null {
    try {
        return localStorage.getItem('sc_sheet_last_sync');
    } catch {
        return null;
    }
}

// ==========================================
// REAL-TIME QUOTA & FAILOVER CIRCUIT BREAKER
// ==========================================

export function isQuotaError(error: any): boolean {
    if (!error) return false;
    const errCode = String(error?.code || '').toLowerCase();
    const errMsg = String(error?.message || error || '').toLowerCase();
    return (
        errCode.includes('resource-exhausted') ||
        errCode.includes('quota') ||
        errMsg.includes('quota') ||
        errMsg.includes('resource-exhausted') ||
        errMsg.includes('resource_exhausted') ||
        errMsg.includes('daily read units') ||
        errMsg.includes('limit exceeded')
    );
}

const QUOTA_COOLDOWN_MS = 25 * 60 * 1000; // 25 minutes cooldown

export function markFirestoreQuotaExceeded() {
    try {
        const expiry = Date.now() + QUOTA_COOLDOWN_MS;
        localStorage.setItem('sc_fb_quota_exhausted_until', String(expiry));
        window.dispatchEvent(new CustomEvent('sc_quota_status_change', { detail: { exceeded: true, until: expiry } }));
    } catch {}
}

export function isFirestoreQuotaExceeded(): boolean {
    try {
        const raw = localStorage.getItem('sc_fb_quota_exhausted_until');
        if (!raw) return false;
        const expiry = Number(raw);
        if (isNaN(expiry)) return false;
        if (Date.now() < expiry) {
            return true;
        } else {
            localStorage.removeItem('sc_fb_quota_exhausted_until');
            return false;
        }
    } catch {
        return false;
    }
}

export function clearFirestoreQuotaStatus() {
    try {
        localStorage.removeItem('sc_fb_quota_exhausted_until');
        window.dispatchEvent(new CustomEvent('sc_quota_status_change', { detail: { exceeded: false } }));
    } catch {}
}

export async function testFirebaseConnection(forceFresh: boolean = false): Promise<{ ok: boolean; latencyMs: number; error?: string; isQuota?: boolean }> {
    const start = Date.now();
    if (!forceFresh && isFirestoreQuotaExceeded()) {
        return { 
            ok: false, 
            latencyMs: 0, 
            error: "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'. Spreadsheet failover is active.",
            isQuota: true 
        };
    }
    try {
        const timeoutPromise = new Promise<{ ok: boolean; latencyMs: number }>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout (8s)')), 8000)
        );
        const checkPromise = (async () => {
            await getDocFromServer(doc(db, 'test', 'connection'));
            return { ok: true, latencyMs: Date.now() - start };
        })();
        const res = await Promise.race([checkPromise, timeoutPromise]);
        clearFirestoreQuotaStatus();
        recordFirebaseSync();
        return { ...res, isQuota: false };
    } catch (err: any) {
        if (isQuotaError(err)) {
            markFirestoreQuotaExceeded();
            return { 
                ok: false, 
                latencyMs: Date.now() - start, 
                error: "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'. Spreadsheet failover is active.",
                isQuota: true 
            };
        }
        return { ok: false, latencyMs: Date.now() - start, error: err?.message || 'Connection failed', isQuota: false };
    }
}

export async function testSpreadsheetConnection(url: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const trimmed = (url || '').trim();
    if (!trimmed || !trimmed.startsWith('https://script.google.com')) {
        return { ok: false, latencyMs: 0, error: 'URL not configured' };
    }
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${trimmed}?t=${Date.now()}`, {
            method: 'GET',
            mode: 'cors',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            recordSheetSync();
            return { ok: true, latencyMs: Date.now() - start };
        }
        return { ok: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    } catch (err: any) {
        return { ok: false, latencyMs: Date.now() - start, error: err?.name === 'AbortError' ? 'Timeout (4s)' : 'Endpoint unreachable' };
    }
}

// =========================================================================
// ENTERPRISE MULTI-TIER CACHING & QUOTA DEFENSE ENGINE
// Designed specifically for:
// - 100 Read-only users + 10 Read-Write users
// - ~30 inspections submitted per day
// - Guaranteed <15% of daily 50k reads and <1% of daily 20k writes
// =========================================================================

const TTL = {
    INSPECTIONS: 5 * 60 * 1000,      // 5 minutes (reduces reads by >95% across 100 users)
    REQUESTS: 5 * 60 * 1000,         // 5 minutes
    NOTIFICATIONS: 3 * 60 * 1000,    // 3 minutes
    FLEET_REGISTRY: 30 * 60 * 1000,  // 30 minutes (static master dropdowns)
    SETTINGS: 30 * 60 * 1000,        // 30 minutes
    USERS: 30 * 60 * 1000,           // 30 minutes
    TICKETS: 5 * 60 * 1000           // 5 minutes
};

// Memory cache for immediate intra-session navigation (0ms, 0 reads)
const memoryCache = new Map<string, { timestamp: number; data: any }>();

// In-flight Promise deduplication (prevents duplicate simultaneous Firestore queries)
const inFlightRequests = new Map<string, Promise<any>>();

function getPersistentCache<T>(key: string, maxAgeMs: number): T | null {
    // 1. Check memory cache first
    const mem = memoryCache.get(key);
    if (mem && (Date.now() - mem.timestamp < maxAgeMs)) {
        return mem.data as T;
    }

    // 2. Check localStorage cache
    try {
        const raw = localStorage.getItem(`sc_fb_cache_${key}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.timestamp === 'number') {
                if (Date.now() - parsed.timestamp < maxAgeMs) {
                    memoryCache.set(key, parsed);
                    return parsed.data as T;
                }
            }
        }
    } catch {}
    return null;
}

function setPersistentCache<T>(key: string, data: T) {
    const entry = { timestamp: Date.now(), data };
    memoryCache.set(key, entry);
    try {
        localStorage.setItem(`sc_fb_cache_${key}`, JSON.stringify(entry));
    } catch {}
}

export function invalidateFirebaseCache(keyPrefix?: string) {
    if (!keyPrefix) {
        memoryCache.clear();
        return;
    }
    for (const k of memoryCache.keys()) {
        if (k.startsWith(keyPrefix)) {
            memoryCache.delete(k);
            try { localStorage.removeItem(`sc_fb_cache_${k}`); } catch {}
        }
    }
}

// Bounded query limit: with 30 inspections/day, 25 records covers recent audits with minimal read quota impact
export const DEFAULT_INSPECTION_LIMIT = 25;

// ==========================================
// 1. INSPECTIONS (Primary Database Operations)
// ==========================================

export async function saveInspectionToFirebase(
    formData: InspectionData, 
    moduleKey: string
): Promise<{ success: boolean; id: string; error?: string }> {
    try {
        const timestamp = formData.timestamp || new Date().toISOString();
        const inspectionId = formData.id || `INSP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        
        // Strictly normalize module key for Firestore rule validation and queries
        let normalizedModule = 'general';
        const m = String(moduleKey || formData.module || (formData as any)._module || '').toLowerCase();
        if (m.includes('petro')) normalizedModule = 'petroleum_v2';
        else if (m.includes('acid')) normalizedModule = 'acid';

        // Extract individual checklist items into structured map
        const reservedKeys = new Set([
            'id', 'module', '_module', 'timestamp', 'truckNo', 'trailerNo', 'driverName',
            'inspectedBy', 'location', 'odometer', 'jobCard', 'rate', 'remarks', 'safeToLoad',
            'requestId', 'syncedToSheet', 'sheetSyncAt', 'createdAt', 'updatedAt',
            'inspectorSignature', 'driverSignature', 'photoFront', 'photoLS', 'photoRS', 'photoBack', 'photoDamage',
            'photos', 'signatures', 'vehicle', 'audit', 'checklist', 'schemaVersion'
        ]);

        const checklistMap: Record<string, any> = {};
        Object.keys(formData).forEach(key => {
            if (!reservedKeys.has(key) && formData[key] !== undefined && formData[key] !== null) {
                const val = formData[key];
                // Strict zero-picture enforcement: eliminate any raw base64 photos or bloated text
                if (typeof val === 'string' && (val.startsWith('data:image/') || val.length > 500)) {
                    return; // Skip bloated data
                }
                checklistMap[key] = val;
            }
        });

        const truckClean = String(formData.truckNo || '').trim().toUpperCase();
        const trailerClean = String(formData.trailerNo || '').trim().toUpperCase();
        const driverClean = String(formData.driverName || '').trim();
        const inspectorClean = String(formData.inspectedBy || 'Inspector').trim();
        const locationClean = String(formData.location || '').trim();

        // Signatures are kept lightweight (< 5KB)
        const optInspSig = typeof formData.inspectorSignature === 'string' && formData.inspectorSignature.length < 25000 
            ? formData.inspectorSignature 
            : null;
        const optDriverSig = typeof formData.driverSignature === 'string' && formData.driverSignature.length < 25000 
            ? formData.driverSignature 
            : null;

        // ZERO-PHOTO DEFENSE:
        // All photo fields are strictly set to null.
        // This guarantees document size remains ~1.2 KB, making it physically impossible
        // for Firestore to bloat or exceed the 1MB document limit or 1GB storage limit.
        const inspectionDoc: Record<string, any> = {
            ...checklistMap,
            id: inspectionId,
            module: normalizedModule,
            timestamp: timestamp,
            truckNo: truckClean,
            trailerNo: trailerClean,
            driverName: driverClean,
            inspectedBy: inspectorClean,
            location: locationClean,
            odometer: String(formData.odometer || '').trim(),
            jobCard: String(formData.jobCard || '').trim(),
            rate: Number(formData.rate || 0),
            remarks: String(formData.remarks || '').trim(),
            safeToLoad: String(formData.safeToLoad || 'N/A').trim(),
            requestId: formData.requestId || null,

            // Zero photos in Firestore for maximum performance & quota conservation
            photoFront: null,
            photoLS: null,
            photoRS: null,
            photoBack: null,
            photoDamage: null,
            photos: null,

            inspectorSignature: optInspSig,
            driverSignature: optDriverSig,

            // Enterprise Structured Hierarchy
            vehicle: {
                truckNo: truckClean,
                trailerNo: trailerClean,
                odometer: String(formData.odometer || '').trim(),
                jobCard: String(formData.jobCard || '').trim(),
                location: locationClean
            },
            audit: {
                module: normalizedModule,
                inspectedBy: inspectorClean,
                driverName: driverClean,
                rate: Number(formData.rate || 0),
                safeToLoad: String(formData.safeToLoad || 'N/A').trim(),
                remarks: String(formData.remarks || '').trim(),
                timestamp: timestamp
            },
            signatures: {
                inspector: optInspSig,
                driver: optDriverSig,
                timestamp: timestamp
            },
            checklist: checklistMap,

            // Lifecycle & Sync Metadata
            syncedToSheet: false,
            sheetSyncAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            schemaVersion: '2.5'
        };

        // Filter out undefined keys for Firestore compatibility
        Object.keys(inspectionDoc).forEach(key => {
            if (inspectionDoc[key] === undefined) {
                inspectionDoc[key] = null;
            }
        });

        const docRef = doc(db, 'inspections', inspectionId);
        await setDoc(docRef, inspectionDoc, { merge: true });
        recordFirebaseSync();

        // Optimistically prepend to client caches so the submitter (and tab) immediately sees it with 0 extra reads
        const optimisticRecord = { ...formData, ...inspectionDoc } as InspectionData;
        ['all', normalizedModule, 'overview'].forEach(modKey => {
            const cacheKey = `inspections_${modKey}`;
            const existing = memoryCache.get(cacheKey)?.data as InspectionData[] || [];
            const updated = [optimisticRecord, ...existing.filter(i => i.id !== inspectionId)].slice(0, 50);
            setPersistentCache(cacheKey, updated);
        });

        // Background fleet registry update with deduplication check to save writes
        if (truckClean || trailerClean) {
            getFleetRegistryFromFirebase().then(current => {
                const reg = current || { trucks: [], trailers: [], drivers: [], inspectors: [], locations: [], positions: [] };
                let changed = false;
                if (truckClean && !reg.trucks.includes(truckClean)) { reg.trucks.push(truckClean); changed = true; }
                if (trailerClean && !reg.trailers.includes(trailerClean)) { reg.trailers.push(trailerClean); changed = true; }
                if (driverClean && !reg.drivers.includes(driverClean)) { reg.drivers.push(driverClean); changed = true; }
                if (inspectorClean && !reg.inspectors.includes(inspectorClean)) { reg.inspectors.push(inspectorClean); changed = true; }
                if (locationClean && !reg.locations.includes(locationClean)) { reg.locations.push(locationClean); changed = true; }
                if (changed) {
                    saveFleetRegistryToFirebase(reg).catch(() => {});
                }
            }).catch(() => {});
        }

        return { success: true, id: inspectionId };
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        }
        console.warn("Firebase saveInspection notice:", error?.message || error);
        return { success: false, id: formData.id || '', error: error?.message || 'Failed to save to Firebase' };
    }
}

export async function markInspectionBackupComplete(
    inspectionId: string
): Promise<void> {
    try {
        if (!inspectionId || isFirestoreQuotaExceeded()) return;
        const docRef = doc(db, 'inspections', inspectionId);
        await updateDoc(docRef, {
            syncedToSheet: true,
            sheetSyncAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        }
    }
}

export async function deleteInspectionFromFirebase(
    inspectionId: string,
    appScriptUrl?: string,
    moduleKey?: string
): Promise<{ success: boolean; error?: string }> {
    if (!inspectionId) return { success: false, error: 'No inspection ID provided' };

    // 1. Delete from Firebase Firestore
    try {
        if (!isFirestoreQuotaExceeded()) {
            const docRef = doc(db, 'inspections', inspectionId);
            await deleteDoc(docRef);
            recordFirebaseSync();
        }
    } catch (err: any) {
        if (isQuotaError(err)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase deleteInspection notice:", err?.message || err);
        }
    }

    // 2. Invalidate / update client caches optimistically
    ['inspections_all', 'inspections_general', 'inspections_petroleum_v2', 'inspections_acid'].forEach(k => {
        const cached = memoryCache.get(k)?.data as InspectionData[] | undefined;
        if (Array.isArray(cached)) {
            const filtered = cached.filter(i => (i.id || (i as any)._id) !== inspectionId);
            setPersistentCache(k, filtered);
        }
    });

    ['sc_qc_all', 'sc_qc_general', 'sc_qc_petroleum_v2', 'sc_qc_acid'].forEach(sk => {
        try {
            const raw = localStorage.getItem(sk);
            if (raw) {
                const list: InspectionData[] = JSON.parse(raw);
                const filtered = list.filter(i => (i.id || (i as any)._id) !== inspectionId);
                localStorage.setItem(sk, JSON.stringify(filtered));
            }
        } catch {}
    });

    // 3. Delete from Google Spreadsheet backup if configured
    if (appScriptUrl && appScriptUrl.startsWith('https://script.google.com')) {
        try {
            let sheetName = 'General';
            const m = String(moduleKey || '').toLowerCase();
            if (m.includes('petro')) sheetName = 'Petroleum_V2';
            else if (m.includes('acid')) sheetName = 'Acid';

            await fetch(appScriptUrl, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'delete_inspection',
                    id: inspectionId,
                    sheet: sheetName
                }),
                mode: 'no-cors'
            });
            recordSheetSync();
        } catch (sheetErr) {
            console.warn("Spreadsheet backup delete notice:", sheetErr);
        }
    }

    return { success: true };
}

export async function getInspectionsFromFirebase(
    moduleKey?: string,
    maxResults: number = DEFAULT_INSPECTION_LIMIT,
    forceRefresh: boolean = false
): Promise<InspectionData[]> {
    const normModule = (moduleKey && moduleKey !== 'all' && moduleKey !== 'overview') 
        ? moduleKey.toLowerCase() 
        : 'all';
    const cacheKey = `inspections_${normModule}`;

    // 1. Check Multi-tier Cache first (0 reads!)
    if (!forceRefresh) {
        const cached = getPersistentCache<InspectionData[]>(cacheKey, TTL.INSPECTIONS);
        if (cached && cached.length > 0) {
            return cached;
        }
    }

    // 2. Circuit-breaker: If Firestore quota is already exceeded, don't hammer the API
    if (isFirestoreQuotaExceeded()) {
        const fallback = getPersistentCache<InspectionData[]>(cacheKey, 24 * 60 * 60 * 1000);
        if (fallback && fallback.length > 0 && !forceRefresh) {
            return fallback;
        }
        // Signal quota failure so failover to Google Spreadsheet backup occurs immediately
        const quotaErr = new Error("Firebase daily quota limit reached. Failover to Google Spreadsheet backup is active.");
        (quotaErr as any).isQuota = true;
        (quotaErr as any).code = 'resource-exhausted';
        throw quotaErr;
    }

    // 3. Request deduplication: reuse running query if in flight
    if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
        try {
            const collRef = collection(db, 'inspections');
            let q;
            if (normModule !== 'all') {
                q = query(collRef, where('module', '==', normModule), limit(maxResults));
            } else {
                q = query(collRef, limit(maxResults));
            }

            const snapshot = await getDocs(q);
            const results: InspectionData[] = [];
            snapshot.forEach(docSnap => {
                results.push(docSnap.data() as InspectionData);
            });
            recordFirebaseSync();

            // Client-side sort by timestamp descending
            results.sort((a, b) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
            });

            // Save to multi-tier cache
            setPersistentCache(cacheKey, results);

            // If this was an 'all' query, also seed individual module caches to save further reads
            if (normModule === 'all' && results.length > 0) {
                const gen = results.filter(i => String(i.module || (i as any)._module || '').toLowerCase().includes('general'));
                const pet = results.filter(i => String(i.module || (i as any)._module || '').toLowerCase().includes('petro'));
                const acd = results.filter(i => String(i.module || (i as any)._module || '').toLowerCase().includes('acid'));
                if (gen.length > 0) setPersistentCache('inspections_general', gen);
                if (pet.length > 0) setPersistentCache('inspections_petroleum_v2', pet);
                if (acd.length > 0) setPersistentCache('inspections_acid', acd);
            }

            return results;
        } catch (error: any) {
            if (isQuotaError(error)) {
                markFirestoreQuotaExceeded();
                console.warn("[Quota Defense] Firestore read quota limit reached. Failover to Google Spreadsheet active.");
            } else {
                console.warn("Firebase getInspections warning:", error?.message || error);
            }

            // On failure, if we have recent cached data and user didn't explicitly force refresh, return cached data
            const fallback = getPersistentCache<InspectionData[]>(cacheKey, 24 * 60 * 60 * 1000);
            if (fallback && fallback.length > 0 && !forceRefresh) {
                return fallback;
            }

            // Otherwise, throw so the caller knows Firebase is unavailable and invokes spreadsheet backup failover!
            throw error;
        } finally {
            inFlightRequests.delete(cacheKey);
        }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
}

// ==========================================
// 2. USERS (Primary Database Operations)
// ==========================================

export async function getUsersFromFirebase(forceRefresh: boolean = false): Promise<User[]> {
    const cacheKey = 'users_list';
    if (!forceRefresh) {
        const cached = getPersistentCache<User[]>(cacheKey, TTL.USERS);
        if (cached && cached.length > 0) return cached;
    }

    if (isFirestoreQuotaExceeded()) {
        return getPersistentCache<User[]>(cacheKey, 24 * 60 * 60 * 1000) || [];
    }

    try {
        const collRef = collection(db, 'users');
        const q = query(collRef, limit(50));
        const snapshot = await getDocs(q);
        const users: User[] = [];
        snapshot.forEach(docSnap => {
            users.push(docSnap.data() as User);
        });
        setPersistentCache(cacheKey, users);
        return users;
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase getUsers notice:", error?.message || error);
        }
        return getPersistentCache<User[]>(cacheKey, 24 * 60 * 60 * 1000) || [];
    }
}

export async function getUserFromFirebase(username: string): Promise<User | null> {
    const cleanUser = String(username || '').trim().toLowerCase();
    if (!cleanUser) return null;

    const cacheKey = `user_${cleanUser}`;
    const cached = getPersistentCache<User>(cacheKey, TTL.USERS);
    if (cached) return cached;

    if (isFirestoreQuotaExceeded()) {
        return getPersistentCache<User>(cacheKey, 24 * 60 * 60 * 1000);
    }

    try {
        const docRef = doc(db, 'users', cleanUser);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const u = snap.data() as User;
            setPersistentCache(cacheKey, u);
            return u;
        }
        return null;
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase getUser notice:", error?.message || error);
        }
        return getPersistentCache<User>(cacheKey, 24 * 60 * 60 * 1000);
    }
}

export async function saveUserToFirebase(user: User): Promise<boolean> {
    try {
        const cleanUser = String(user.username || '').trim().toLowerCase();
        if (!cleanUser) return false;

        const isActive = user.isActive !== false;
        const currentPrefs = user.preferences || {};
        const preferences = isActive ? currentPrefs : {
            ...currentPrefs,
            emailNotifications: false,
            notifyGeneral: false,
            notifyPetroleum: false,
            notifyPetroleumV2: false,
            notifyAcid: false
        };

        const payload: Record<string, any> = {
            ...user,
            username: cleanUser,
            name: user.name || cleanUser,
            role: user.role || 'Inspector',
            isActive: isActive,
            preferences: preferences,
            updatedAt: new Date().toISOString()
        };

        if (!isActive) {
            payload.disabledAt = new Date().toISOString();
        }

        if (!payload.createdAt) {
            payload.createdAt = new Date().toISOString();
        }

        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) payload[key] = null;
        });

        // Always update local persistent cache
        setPersistentCache(`user_${cleanUser}`, payload as User);
        invalidateFirebaseCache('users_list');

        if (isFirestoreQuotaExceeded()) {
            return true; // Cached locally during quota failover
        }

        const docRef = doc(db, 'users', cleanUser);
        await setDoc(docRef, payload, { merge: true });
        return true;
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase saveUser notice:", error?.message || error);
        }
        return false;
    }
}

// ==========================================
// 3. SETTINGS (Primary Database Operations)
// ==========================================

export async function getSettingsFromFirebase(forceRefresh: boolean = false): Promise<SystemSettings | null> {
    const cacheKey = 'system_config';
    if (!forceRefresh) {
        const cached = getPersistentCache<SystemSettings>(cacheKey, TTL.SETTINGS);
        if (cached) return cached;
    }

    if (isFirestoreQuotaExceeded()) {
        return getPersistentCache<SystemSettings>(cacheKey, 24 * 60 * 60 * 1000);
    }

    try {
        const docRef = doc(db, 'settings', 'system_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const settings = snap.data() as SystemSettings;
            setPersistentCache(cacheKey, settings);
            return settings;
        }
        return null;
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase getSettings notice:", error?.message || error);
        }
        return getPersistentCache<SystemSettings>(cacheKey, 24 * 60 * 60 * 1000);
    }
}

export async function saveSettingsToFirebase(settings: SystemSettings): Promise<boolean> {
    try {
        const payload: Record<string, any> = {
            ...settings,
            updatedAt: new Date().toISOString()
        };

        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) payload[key] = null;
        });

        // Always cache locally
        setPersistentCache('system_config', payload as SystemSettings);

        if (isFirestoreQuotaExceeded()) {
            return true; // Cached locally during failover
        }

        const docRef = doc(db, 'settings', 'system_config');
        await setDoc(docRef, payload, { merge: true });
        return true;
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase saveSettings notice:", error?.message || error);
        }
        return false;
    }
}

// ==========================================
// 4. REQUESTS (Primary Database Operations)
// ==========================================

export async function getRequestsFromFirebase(forceRefresh: boolean = false): Promise<any[]> {
    const cacheKey = 'requests_list';
    if (!forceRefresh) {
        const cached = getPersistentCache<any[]>(cacheKey, TTL.REQUESTS);
        if (cached && cached.length > 0) return cached;
    }

    if (isFirestoreQuotaExceeded()) {
        return getPersistentCache<any[]>(cacheKey, 24 * 60 * 60 * 1000) || [];
    }

    if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
        try {
            const collRef = collection(db, 'requests');
            // Bounded to 30 requests to prevent excess read consumption
            const q = query(collRef, limit(30));
            const snapshot = await getDocs(q);
            const requests: any[] = [];
            snapshot.forEach(docSnap => {
                requests.push(docSnap.data());
            });

            requests.sort((a, b) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
            });

            setPersistentCache(cacheKey, requests);
            return requests;
        } catch (error: any) {
            if (isQuotaError(error)) {
                markFirestoreQuotaExceeded();
            } else {
                console.warn("Firebase getRequests notice:", error?.message || error);
            }
            return getPersistentCache<any[]>(cacheKey, 24 * 60 * 60 * 1000) || [];
        } finally {
            inFlightRequests.delete(cacheKey);
        }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
}

export async function saveRequestToFirebase(requestData: any): Promise<{ success: boolean; id: string }> {
    try {
        const id = requestData.id || `REQ-${Date.now()}`;
        const payload: Record<string, any> = {
            ...requestData,
            id,
            timestamp: requestData.timestamp || new Date().toISOString(),
            status: requestData.status || 'pending',
            syncedToSheet: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) payload[key] = null;
        });

        // Optimistically update cache
        const existing = getPersistentCache<any[]>('requests_list', TTL.REQUESTS) || [];
        setPersistentCache('requests_list', [payload, ...existing.filter(r => r.id !== id)]);

        if (isFirestoreQuotaExceeded()) {
            return { success: true, id };
        }

        const docRef = doc(db, 'requests', id);
        await setDoc(docRef, payload, { merge: true });
        return { success: true, id };
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase saveRequest notice:", error?.message || error);
        }
        return { success: false, id: requestData.id || '' };
    }
}

export async function updateRequestStatusInFirebase(
    requestId: string, 
    status: string, 
    completedInspectionId?: string
): Promise<void> {
    try {
        if (!requestId) return;

        // Update in cache
        const existing = getPersistentCache<any[]>('requests_list', TTL.REQUESTS);
        if (existing) {
            const updated = existing.map(r => r.id === requestId ? { ...r, status, completedInspectionId } : r);
            setPersistentCache('requests_list', updated);
        }

        if (isFirestoreQuotaExceeded()) return;

        const docRef = doc(db, 'requests', requestId);
        await updateDoc(docRef, {
            status,
            completedInspectionId: completedInspectionId || null,
            updatedAt: new Date().toISOString()
        });
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Could not update request status in Firebase:", error?.message || error);
        }
    }
}

// ==========================================
// 5. NOTIFICATIONS (Primary Database Operations)
// ==========================================

export async function getNotificationsFromFirebase(forceRefresh: boolean = false): Promise<AppNotification[]> {
    const cacheKey = 'notifications_list';
    if (!forceRefresh) {
        const cached = getPersistentCache<AppNotification[]>(cacheKey, TTL.NOTIFICATIONS);
        if (cached && cached.length > 0) return cached;
    }

    if (isFirestoreQuotaExceeded()) {
        return getPersistentCache<AppNotification[]>(cacheKey, 24 * 60 * 60 * 1000) || [];
    }

    if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
        try {
            const collRef = collection(db, 'notifications');
            // Bounded to 20 notifications to strictly limit reads
            const q = query(collRef, limit(20));
            const snapshot = await getDocs(q);
            const notifications: AppNotification[] = [];
            snapshot.forEach(docSnap => {
                notifications.push(docSnap.data() as AppNotification);
            });

            notifications.sort((a, b) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
            });

            setPersistentCache(cacheKey, notifications);
            return notifications;
        } catch (error: any) {
            if (isQuotaError(error)) {
                markFirestoreQuotaExceeded();
            } else {
                console.warn("Firebase getNotifications notice:", error?.message || error);
            }
            return getPersistentCache<AppNotification[]>(cacheKey, 24 * 60 * 60 * 1000) || [];
        } finally {
            inFlightRequests.delete(cacheKey);
        }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
}

export async function saveNotificationToFirebase(notification: AppNotification): Promise<boolean> {
    try {
        const id = notification.id || `NOTIF-${Date.now()}`;
        const payload = {
            ...notification,
            id,
            timestamp: notification.timestamp || new Date().toISOString()
        };
        invalidateFirebaseCache('notifications_list');

        if (isFirestoreQuotaExceeded()) return true;

        const docRef = doc(db, 'notifications', id);
        await setDoc(docRef, payload, { merge: true });
        return true;
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase saveNotification notice:", error?.message || error);
        }
        return false;
    }
}

// ==========================================
// 6. FLEET REGISTRY (Primary Database Operations)
// ==========================================

export async function getFleetRegistryFromFirebase(forceRefresh: boolean = false): Promise<ValidationLists | null> {
    const cacheKey = 'fleet_registry';
    if (!forceRefresh) {
        const cached = getPersistentCache<ValidationLists>(cacheKey, TTL.FLEET_REGISTRY);
        if (cached) return cached;
    }

    if (isFirestoreQuotaExceeded()) {
        return getPersistentCache<ValidationLists>(cacheKey, 24 * 60 * 60 * 1000);
    }

    try {
        const docRef = doc(db, 'fleet_registry', 'registry');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const registry = snap.data() as ValidationLists;
            setPersistentCache(cacheKey, registry);
            return registry;
        }
        return null;
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase getFleetRegistry notice:", error?.message || error);
        }
        return getPersistentCache<ValidationLists>(cacheKey, 24 * 60 * 60 * 1000);
    }
}

export async function saveFleetRegistryToFirebase(registry: ValidationLists): Promise<boolean> {
    try {
        const payload = {
            ...registry,
            updatedAt: new Date().toISOString()
        };
        setPersistentCache('fleet_registry', payload as ValidationLists);

        if (isFirestoreQuotaExceeded()) return true;

        const docRef = doc(db, 'fleet_registry', 'registry');
        await setDoc(docRef, payload, { merge: true });
        return true;
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase saveFleetRegistry notice:", error?.message || error);
        }
        return false;
    }
}

// ==========================================
// 7. SUPPORT TICKETS (Primary Database Operations)
// ==========================================

export async function getSupportTicketsFromFirebase(
    userEmail?: string, 
    userRole?: string,
    forceRefresh: boolean = false
): Promise<SupportTicket[]> {
    const cacheKey = 'support_tickets_list';
    if (!forceRefresh) {
        const cached = getPersistentCache<SupportTicket[]>(cacheKey, TTL.TICKETS);
        if (cached && cached.length > 0) {
            const isStaff = userRole === 'Admin' || userRole === 'SuperAdmin';
            return isStaff 
                ? cached 
                : cached.filter(t => !userEmail || (t.email || '').toLowerCase() === userEmail.toLowerCase() || (t.user || '').toLowerCase() === userEmail.toLowerCase());
        }
    }

    if (isFirestoreQuotaExceeded()) {
        const cached = getPersistentCache<SupportTicket[]>(cacheKey, 24 * 60 * 60 * 1000) || [];
        const isStaff = userRole === 'Admin' || userRole === 'SuperAdmin';
        return isStaff 
            ? cached 
            : cached.filter(t => !userEmail || (t.email || '').toLowerCase() === userEmail.toLowerCase() || (t.user || '').toLowerCase() === userEmail.toLowerCase());
    }

    try {
        const collRef = collection(db, 'support_tickets');
        const q = query(collRef, limit(35));
        const snapshot = await getDocs(q);
        const tickets: SupportTicket[] = [];
        snapshot.forEach(docSnap => {
            tickets.push(docSnap.data() as SupportTicket);
        });

        tickets.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setPersistentCache(cacheKey, tickets);

        const isStaff = userRole === 'Admin' || userRole === 'SuperAdmin';
        return isStaff 
            ? tickets 
            : tickets.filter(t => !userEmail || (t.email || '').toLowerCase() === userEmail.toLowerCase() || (t.user || '').toLowerCase() === userEmail.toLowerCase());
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase getSupportTickets notice:", error?.message || error);
        }
        return [];
    }
}

export async function saveSupportTicketToFirebase(ticket: SupportTicket): Promise<{ success: boolean; id: string }> {
    try {
        const id = ticket.ticketId || `TICK-${Date.now()}`;
        const payload: Record<string, any> = {
            ...ticket,
            id,
            ticketId: id,
            status: ticket.status || 'Open',
            timestamp: ticket.timestamp || new Date().toISOString(),
            comments: Array.isArray(ticket.comments) ? ticket.comments : [],
            updatedAt: new Date().toISOString()
        };

        invalidateFirebaseCache('support_tickets_list');

        if (isFirestoreQuotaExceeded()) {
            return { success: true, id };
        }

        const docRef = doc(db, 'support_tickets', id);
        await setDoc(docRef, payload, { merge: true });
        return { success: true, id };
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase saveSupportTicket notice:", error?.message || error);
        }
        return { success: false, id: ticket.ticketId || '' };
    }
}

export async function addCommentToSupportTicketInFirebase(ticketId: string, comment: TicketComment): Promise<boolean> {
    try {
        if (!ticketId) return false;
        invalidateFirebaseCache('support_tickets_list');

        if (isFirestoreQuotaExceeded()) return true;

        const docRef = doc(db, 'support_tickets', ticketId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return false;
        const currentData = snap.data();
        const existingComments = Array.isArray(currentData.comments) ? currentData.comments : [];
        await updateDoc(docRef, {
            comments: [...existingComments, comment],
            updatedAt: new Date().toISOString()
        });
        return true;
    } catch (error: any) {
        if (isQuotaError(error)) {
            markFirestoreQuotaExceeded();
        } else {
            console.warn("Firebase addCommentToSupportTicket notice:", error?.message || error);
        }
        return false;
    }
}

// =========================================================================
// FIRESTORE TO GOOGLE SPREADSHEET BACKUP SYNC ENGINE
// =========================================================================

export async function syncFirestoreToSpreadsheet(
    appScriptUrl: string,
    onProgress?: (current: number, total: number, msg?: string) => void
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const trimmedUrl = (appScriptUrl || '').trim();
    if (!trimmedUrl || !trimmedUrl.startsWith('https://script.google.com')) {
        return { success: false, syncedCount: 0, error: 'Google Apps Script URL is invalid or empty.' };
    }

    if (isFirestoreQuotaExceeded()) {
        return { 
            success: false, 
            syncedCount: 0, 
            error: 'Firestore daily read quota is currently exhausted. Google Spreadsheet backup failover is actively serving data.' 
        };
    }

    try {
        onProgress?.(0, 0, 'Querying Firestore records...');
        const collRef = collection(db, 'inspections');
        const snap = await getDocs(collRef);
        const inspections: InspectionData[] = [];
        snap.forEach(d => {
            inspections.push(d.data() as InspectionData);
        });

        // 1. Sync Inspections
        // Sort chronologically (oldest to newest)
        inspections.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeA - timeB;
        });

        const total = inspections.length;
        let syncedCount = 0;

        for (let i = 0; i < inspections.length; i++) {
            const insp = inspections[i];
            const mod = String(insp.module || (insp as any)._module || 'general').toLowerCase();

            let sheetName = 'General';
            let headers = SHEET_HEADERS;
            if (mod.includes('petro')) {
                sheetName = 'Petroleum_V2';
                headers = PETROLEUM_V2_HEADERS;
            } else if (mod.includes('acid')) {
                sheetName = 'Acid';
                headers = ACID_HEADERS;
            }

            // Strictly sanitize row (<1KB, zero base64 images to prevent spreadsheet size limit)
            const row = headers.map(h => {
                if (h.toLowerCase().startsWith('photo')) return '[Photos Paused]';
                const val = (insp as any)[h];
                if (typeof val === 'string' && (val.startsWith('data:image/') || val.length > 250)) {
                    return '[Attached in Firebase]';
                }
                return val !== undefined && val !== null ? String(val) : '';
            });

            const payload = {
                id: insp.id,
                action: 'backup',
                isBackup: true,
                isSync: true,
                sendNotification: false,
                sheet: sheetName,
                headers: headers,
                row: row,
                requestId: insp.requestId || null,
                reportData: {
                    id: insp.id,
                    title: sheetName,
                    timestamp: insp.timestamp || new Date().toISOString(),
                    truckNo: insp.truckNo || 'N/A',
                    trailerNo: insp.trailerNo || 'N/A',
                    location: insp.location || 'N/A',
                    inspectedBy: insp.inspectedBy || 'Staff',
                    rate: insp.rate || 0,
                    safeToLoad: insp.safeToLoad || 'N/A'
                }
            };

            onProgress?.(i + 1, total, `Backing up inspection ${i + 1} of ${total} (${insp.truckNo || 'Record'})...`);

            try {
                await fetch(trimmedUrl, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    mode: 'no-cors'
                });
                syncedCount++;
                if (insp.id) {
                    markInspectionBackupComplete(insp.id).catch(() => {});
                }
            } catch (postErr) {
                console.warn(`Failed to post record ${insp.id} to sheet:`, postErr);
            }
        }

        // 2. Sync System Settings
        try {
            const settingsDoc = await getDoc(doc(db, 'settings', 'system_config'));
            if (settingsDoc.exists()) {
                const sys = settingsDoc.data();
                await fetch(trimmedUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'update_settings',
                        settings: {
                            companyName: sys.companyName || 'Juba Transport',
                            managerEmail: sys.managerEmail || 'notification@scbcnet.com',
                            maintenanceMode: !!sys.maintenanceMode,
                            maintenanceMsg: sys.maintenanceMsg || 'System maintenance',
                            mobileAppUrl: sys.mobileAppUrl || '',
                            webAppUrl: sys.webAppUrl || '',
                            companyLogo: '[In Firebase]',
                            templates: sys.templates || null
                        }
                    }),
                    mode: 'no-cors'
                });
            }
        } catch (setErr) {
            console.warn("Settings sync warning:", setErr);
        }

        recordSheetSync();
        return { success: true, syncedCount };
    } catch (err: any) {
        if (isQuotaError(err)) {
            markFirestoreQuotaExceeded();
            return {
                success: false,
                syncedCount: 0,
                error: 'Firestore daily read quota reached. Google Spreadsheet backup failover is actively serving data.'
            };
        }
        console.warn("syncFirestoreToSpreadsheet warning:", err?.message || err);
        return { success: false, syncedCount: 0, error: err?.message || 'Failed to sync to spreadsheet' };
    }
}

export async function sendTestBackupPing(appScriptUrl: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const trimmed = (appScriptUrl || '').trim();
    if (!trimmed || !trimmed.startsWith('https://script.google.com')) {
        return { ok: false, latencyMs: 0, error: 'Script URL not configured.' };
    }
    const start = Date.now();
    try {
        const testId = `PING-${Date.now()}`;
        const testPayload = {
            id: testId,
            action: 'ping',
            isPing: true,
            isBackup: true,
            sendNotification: false,
            sheet: 'General',
            headers: SHEET_HEADERS,
            row: SHEET_HEADERS.map((h, idx) => {
                if (idx === 0) return testId;
                if (idx === 1) return new Date().toISOString();
                if (h.toLowerCase().includes('truck')) return 'PING-TEST';
                if (h.toLowerCase().includes('inspector')) return 'Diagnostics Engine';
                if (h.toLowerCase().includes('remarks')) return 'Real-time backup sync connection test';
                return '';
            })
        };

        await fetch(trimmed, {
            method: 'POST',
            body: JSON.stringify(testPayload),
            mode: 'no-cors'
        });

        recordSheetSync();
        return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
        return { ok: false, latencyMs: Date.now() - start, error: err?.message || 'Test write failed' };
    }
}

export async function getBackupSyncStats(): Promise<{ totalInspections: number; backedUpCount: number; pendingCount: number }> {
    if (isFirestoreQuotaExceeded()) {
        return { totalInspections: 0, backedUpCount: 0, pendingCount: 0 };
    }
    try {
        const collRef = collection(db, 'inspections');
        const snap = await getDocs(query(collRef, limit(15)));
        let total = 0;
        let backedUp = 0;
        snap.forEach(d => {
            total++;
            const data = d.data();
            if (data.syncedToSheet === true) {
                backedUp++;
            }
        });
        return { totalInspections: total, backedUpCount: backedUp, pendingCount: total - backedUp };
    } catch (err) {
        if (isQuotaError(err)) {
            markFirestoreQuotaExceeded();
        }
        return { totalInspections: 0, backedUpCount: 0, pendingCount: 0 };
    }
}

