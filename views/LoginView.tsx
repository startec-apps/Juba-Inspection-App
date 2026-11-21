import React, { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { getUserFromFirebase, saveUserToFirebase } from '../services/firebase';

export const MASTER_ADMIN_USER: User = {
  username: 'admin',
  name: 'System Administrator',
  role: 'SuperAdmin',
  position: 'Fleet & Safety Operations Director',
  isActive: true,
  needsSetup: false,
  preferences: {
    emailNotifications: true,
    notifyGeneral: true,
    notifyPetroleumV2: true,
    notifyAcid: true,
    hasCompletedTour: true,
    mustChangePassword: false,
    isEmailVerified: true
  }
};

interface LoginViewProps {
  onLogin: (user: User) => void;
  appScriptUrl: string;
  setAppScriptUrl: (url: string) => void;
  settings: SystemSettings;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, appScriptUrl, setAppScriptUrl, settings }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [settings.companyLogo]);

  useEffect(() => {
    const saved = localStorage.getItem('sc_remembered_creds');
    if (saved) {
      try {
        const { u, p } = JSON.parse(atob(saved));
        setUsername(u || '');
        setPassword(p || '');
        setRememberMe(true);
      } catch (e) {
        localStorage.removeItem('sc_remembered_creds');
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedUser = username.trim().toLowerCase();
    if (!normalizedUser) {
      setError("Please enter your email or username.");
      return;
    }

    const isMasterAdmin = (normalizedUser === 'admin' || normalizedUser === 'admin@safetycheck.pro' || normalizedUser === 'admin@scbcnet.com') && password === 'admin';

    // 1. Direct Instant Master Admin Authentication
    if (isMasterAdmin) {
      setError('');
      setIsLoading(true);
      setLoadingMessage('Authenticating...');

      if (!localStorage.getItem('sc_admin_synced')) {
        saveUserToFirebase(MASTER_ADMIN_USER).then(() => localStorage.setItem('sc_admin_synced', 'true')).catch(() => {});
      }

      if (rememberMe) {
        const creds = btoa(JSON.stringify({ u: 'admin', p: 'admin' }));
        localStorage.setItem('sc_remembered_creds', creds);
      } else {
        localStorage.removeItem('sc_remembered_creds');
      }

      if (appScriptUrl && appScriptUrl.startsWith('https://script.google.com')) {
        try {
          fetch(appScriptUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', username: 'admin', password: 'admin' }),
            mode: 'cors'
          }).catch(() => {});
        } catch (e) { /* background fail-safe */ }
      }

      setTimeout(() => {
        setIsLoading(false);
        onLogin(MASTER_ADMIN_USER);
      }, 400);
      return;
    }

    setError('');
    setIsLoading(true);
    setLoadingMessage(isRegistering ? 'Registering...' : 'Authenticating...');

    try {
      // If registering new account
      if (isRegistering) {
        const newAdminUser: User = {
          username: normalizedUser,
          name: fullName || normalizedUser,
          position: position || '',
          role: 'SuperAdmin',
          password: password,
          isActive: true,
          needsSetup: false
        };

        // 1. PRIMARY: Save user in Firebase Firestore
        await saveUserToFirebase(newAdminUser);

        // 2. BACKUP: Sync to Google Spreadsheet if configured
        if (appScriptUrl && appScriptUrl.startsWith('https://script.google.com')) {
          try {
            await fetch(appScriptUrl, {
              method: 'POST',
              body: JSON.stringify({ action: 'register_user', username: normalizedUser, password, name: fullName, position: position, role: 'SuperAdmin' })
            });
          } catch (e) {
            console.warn("Spreadsheet backup registration delayed:", e);
          }
        }

        setError("Account created. Please sign in.");
        setIsRegistering(false);
        setFullName('');
        setPosition('');
        setPassword('');
        setIsLoading(false);
        return;
      }

      // 1. PRIMARY: Authenticate against Firebase Firestore first
      const fbUser = await getUserFromFirebase(normalizedUser);
      if (fbUser) {
        if (fbUser.password && fbUser.password !== password) {
          setError("Authentication failed. Incorrect password.");
          setIsLoading(false);
          return;
        }
        if (fbUser.isActive === false) {
          setError("Account is deactivated. Contact system administrator.");
          setIsLoading(false);
          return;
        }

        if (rememberMe && password) {
          localStorage.setItem('sc_remembered_creds', btoa(JSON.stringify({ u: username, p: password })));
        } else {
          localStorage.removeItem('sc_remembered_creds');
        }

        onLogin({
          ...fbUser,
          role: fbUser.role || 'Inspector',
          position: fbUser.position || '',
          needsSetup: !fbUser.name
        });
        setIsLoading(false);
        return;
      }

      // 2. BACKUP: Check Google Apps Script / Sheet if user was not in Firebase
      if (appScriptUrl && appScriptUrl.startsWith('https://script.google.com')) {
        const payload = { action: 'login', username: normalizedUser, password };
        const response = await fetch(appScriptUrl, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        
        const result = await response.json();

        if (result.status === 'success') {
            const rawUser = result.user;
            if (rawUser.isActive === false) {
              setError("Account is deactivated. Contact system administrator.");
              setIsLoading(false);
              return;
            }
            
            // Seed user into Firebase Firestore
            saveUserToFirebase({
              ...rawUser,
              password
            }).catch(() => {});

            if (rememberMe && password) {
              const creds = btoa(JSON.stringify({ u: username, p: password }));
              localStorage.setItem('sc_remembered_creds', creds);
            } else {
              localStorage.removeItem('sc_remembered_creds');
            }

            let safeRole: User['role'] = 'Inspector';
            const rawRole = rawUser.role ? String(rawUser.role).trim().toLowerCase() : '';
            if (rawRole === 'superadmin') safeRole = 'SuperAdmin';
            else if (rawRole === 'admin') safeRole = 'Admin';
            else if (rawRole === 'operations') safeRole = 'Operations';
            else if (rawRole === 'maintenance') safeRole = 'Maintenance';
            else if (rawRole === 'other') safeRole = 'Other';
            
            onLogin({ 
              ...rawUser, 
              role: safeRole, 
              position: rawUser.position || '',
              needsSetup: !rawUser.name
            });
            setIsLoading(false);
            return;
        } else if (result.code === 'ACCOUNT_DISABLED') {
            setError("Account is deactivated. Contact system administrator.");
            setIsLoading(false);
            return;
        } else if (result.code === 'NO_USERS') {
            setError("Initial setup detected: Create administrator account.");
            setIsRegistering(true);
            setIsLoading(false);
            return;
        } else if (result.code === 'WRONG_PASSWORD') {
            setError("Authentication failed. Incorrect password.");
            setIsLoading(false);
            return;
        }
      }

      setError("User account not found. Please verify your credentials or contact your administrator.");
    } catch (err) {
      setError("Cannot reach database. Please check your internet connection.");
    } finally {
      setIsLoading(false); 
    }
  };

  const canSubmit = !isLoading && username.trim().length > 0;
  const validCompanyLogo =
    typeof settings.companyLogo === 'string' &&
    settings.companyLogo.trim().length > 10 &&
    !settings.companyLogo.includes('Firebase') &&
    (settings.companyLogo.startsWith('data:image/') ||
      settings.companyLogo.startsWith('http://') ||
      settings.companyLogo.startsWith('https://') ||
      settings.companyLogo.startsWith('/'))
      ? settings.companyLogo
      : null;

  return (
    <div className="h-[100dvh] w-full bg-gradient-to-b from-slate-100/80 via-slate-50 to-slate-100/80 flex flex-col font-sans text-slate-800 overflow-y-auto px-4 py-4 sm:p-6">
      <main className="w-full max-w-[410px] mx-auto my-auto flex flex-col items-center">
        {/* Centered Unified Brand Header */}
        <header className="flex flex-col items-center text-center mb-4 sm:mb-6">
          <div className="bg-slate-200/70 border border-slate-300/60 px-3.5 py-2 rounded-xl inline-flex items-center justify-center shadow-2xs">
            {validCompanyLogo && !logoError ? (
              <img
                src={validCompanyLogo}
                alt="Company Logo"
                referrerPolicy="no-referrer"
                className="h-8 sm:h-10 w-auto object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="flex items-center gap-1.5 px-1">
                <svg className="w-6 h-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="font-bold text-slate-900 text-lg tracking-tight">Scbc</span>
              </div>
            )}
          </div>

          <h1 className="mt-2.5 sm:mt-3 text-lg sm:text-xl font-bold text-slate-900 leading-tight tracking-tight">
            {settings.companyName || 'Fleet Portal'}
          </h1>
          <p className="text-slate-500 font-medium tracking-wider uppercase text-[10px] sm:text-[11px] mt-0.5">
            Fleet Inspection System
          </p>
        </header>

        {/* Centered Sign-In Card */}
        <div className="w-full bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 sm:p-7">
          <div className="mb-4 sm:mb-5 text-center">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {isRegistering ? 'Setup Admin' : 'Sign In'}
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              {isRegistering ? 'Create your master account.' : 'Access your inspection portal.'}
            </p>
          </div>

            {error && (
              <div role="alert" className={`mb-3 sm:mb-5 px-3.5 py-2.5 rounded-xl text-xs font-medium border animate-fadeIn
                ${error.includes("created") ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              {isRegistering && (
                <div className="space-y-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <input 
                    type="text" 
                    required 
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-300 placeholder:font-normal" 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    placeholder="Full Name" 
                  />
                  <input 
                    type="text" 
                    required 
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-300 placeholder:font-normal" 
                    value={position} 
                    onChange={e => setPosition(e.target.value)} 
                    placeholder="Job Title" 
                  />
                </div>
              )}

              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email or Username
                </label>
                <input 
                  id="login-username"
                  type="text" 
                  required 
                  autoComplete="username"
                  autoCapitalize="none"
                  className="w-full px-3.5 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none font-medium text-sm transition-all text-slate-900 placeholder:text-slate-300 placeholder:font-normal" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  placeholder="name@company.com" 
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input 
                    id="login-password"
                    type={showPassword ? 'text' : 'password'} 
                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
                    className="w-full px-3.5 py-2.5 sm:py-3 pr-11 bg-white border border-slate-200 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none font-medium text-sm transition-all text-slate-900 placeholder:text-slate-300 placeholder:font-normal" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Enter your password" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400" 
                        checked={rememberMe} 
                        onChange={e => setRememberMe(e.target.checked)} 
                      />
                      <span className="text-xs text-slate-600 font-medium">Keep me signed in</span>
                  </label>
                  
                  <button 
                      type="button" 
                      onClick={async () => {
                          if (!username) {
                              setError("Please enter your email first.");
                              return;
                          }
                          if (!appScriptUrl || !appScriptUrl.startsWith('https://script.google.com')) {
                              setError("Connection error. Please contact your administrator.");
                              return;
                          }
                          setIsLoading(true);
                          try {
                              const response = await fetch(appScriptUrl, {
                                  method: 'POST',
                                  body: JSON.stringify({ action: 'request_password_reset', username })
                              });
                              const result = await response.json();
                              if (result.status === 'success') {
                                  setError("Reset request sent. Please contact your administrator.");
                              } else {
                                  setError(result.message || "Email not recognized. Verify or contact your Admin.");
                              }
                          } catch (e) {
                              setError("Network error. Could not notify administrator.");
                          } finally {
                              setIsLoading(false);
                          }
                      }}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors min-h-[36px] px-1"
                  >
                      Forgot Password?
                  </button>
              </div>

              <div className="pt-1 sm:pt-2">
                <button 
                  type="submit" 
                  disabled={!canSubmit} 
                  className="w-full py-3 sm:py-3.5 rounded-xl font-semibold text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.99] transition-all text-sm disabled:bg-slate-200 disabled:text-slate-400 shadow-xs flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>{loadingMessage}</span>
                    </>
                  ) : isRegistering ? (
                    'Register Admin'
                  ) : (
                    'Sign In'
                  )}
                </button>
              </div>
              
              {!isRegistering && (
                  <p className="text-center text-[11px] text-slate-500 font-medium pt-1">
                      First time login? Enter email and leave password blank.
                  </p>
              )}
            </form>
        </div>

        <footer className="mt-4 text-center">
          <span className="text-[11px] text-slate-400 tracking-wide">© Scbc 2026</span>
        </footer>
      </main>
    </div>
  );
};

export default LoginView;