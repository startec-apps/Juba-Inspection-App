
import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types';

const IDLE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days persistence
const MAX_SESSION_MS = 30 * 24 * 60 * 60 * 1000; 

export const useAuth = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('safetyCheck_user');
        if (savedUser) {
            try {
                const u = JSON.parse(savedUser);
                if (u.isActive === false) return null;
                const rawRole = u.role ? String(u.role).trim().toLowerCase() : '';
                if (rawRole === 'admin') u.role = 'Admin';
                else if (rawRole === 'superadmin') u.role = 'SuperAdmin';
                else if (rawRole === 'inspector') u.role = 'Inspector';
                else u.role = u.role || 'Inspector';
                
                u.needsSetup = !u.name || u.needsSetup === true;
                return u;
            } catch (e) { return null; }
        }
        return null;
    });

    const [sessionExpired, setSessionExpired] = useState<'idle' | 'max_duration' | null>(null);
    const lastActivityRef = useRef<number>(Date.now());
    const sessionStartRef = useRef<number>(Date.now());
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (currentUser) {
            const savedStart = localStorage.getItem('safetyCheck_session_start');
            if (savedStart) sessionStartRef.current = parseInt(savedStart, 10);
            else localStorage.setItem('safetyCheck_session_start', Date.now().toString());
            startActivityListeners();

            // Check if user status has been deactivated by an administrator
            if (currentUser.username && currentUser.username.toLowerCase() !== 'admin') {
                import('../services/firebase').then(({ getUserFromFirebase }) => {
                    getUserFromFirebase(currentUser.username).then(fbUser => {
                        if (fbUser && fbUser.isActive === false) {
                            handleLogout('idle');
                        }
                    }).catch(() => {});
                }).catch(() => {});
            }
        }
        return () => stopActivityListeners();
    }, [currentUser]);

    const updateActivity = useCallback(() => {
        if (!currentUser) return;
        lastActivityRef.current = Date.now();
        localStorage.setItem('safetyCheck_last_activity', lastActivityRef.current.toString());
    }, [currentUser]);

    const startActivityListeners = () => {
        window.addEventListener('mousemove', updateActivity);
        window.addEventListener('keydown', updateActivity);
        window.addEventListener('click', updateActivity);
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(checkSessionStatus, 60000);
    };

    const stopActivityListeners = () => {
        window.removeEventListener('mousemove', updateActivity);
        window.removeEventListener('keydown', updateActivity);
        window.removeEventListener('click', updateActivity);
        if (timerRef.current) window.clearInterval(timerRef.current);
    };

    const checkSessionStatus = () => {
        const now = Date.now();
        if (now - lastActivityRef.current > IDLE_TIMEOUT_MS) handleLogout('idle');
        else if (now - sessionStartRef.current > MAX_SESSION_MS) handleLogout('max_duration');
    };

    const handleLogin = (user: User) => {
        const userToStore = { ...user, needsSetup: !user.name || user.needsSetup === true };
        setCurrentUser(userToStore);
        localStorage.setItem('safetyCheck_user', JSON.stringify(userToStore));
        localStorage.setItem('safetyCheck_session_start', Date.now().toString());
        localStorage.setItem('safetyCheck_last_activity', Date.now().toString());
        setSessionExpired(null);
    };

    const handleLogout = (reason?: 'idle' | 'max_duration') => {
        stopActivityListeners();
        setCurrentUser(null);
        if (reason) setSessionExpired(reason);
        ['safetyCheck_user', 'safetyCheck_session_start', 'safetyCheck_last_activity', 'sc_remembered_creds'].forEach(k => localStorage.removeItem(k));
    };

    return { currentUser, setCurrentUser, handleLogin, handleLogout, sessionExpired, setSessionExpired };
};
