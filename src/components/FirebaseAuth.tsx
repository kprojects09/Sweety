import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, db 
} from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc 
} from 'firebase/firestore';
import { 
  User as UserIcon, LogOut, Key, Mail, Terminal, Shield, Check, AlertTriangle, X 
} from 'lucide-react';

interface FirebaseAuthProps {
  theme: {
    primary: string;
    secondary: string;
    glow: string;
    bgGlow: string;
    border: string;
    button: string;
  };
  currentTheme: string;
  setCurrentTheme: (theme: any) => void;
  settingsState: any;
  setSettingsState: (settings: any) => void;
  systemLogs: string[];
  setSystemLogs: (logs: any) => void;
  messageState: any;
  setMessageState: (messages: any) => void;
  addSystemLog: (log: string) => void;
  onClose?: () => void;
  customAvatarUrl: string | null;
  setCustomAvatarUrl: (url: string | null) => void;
}

export function FirebaseAuth({
  theme,
  currentTheme,
  setCurrentTheme,
  settingsState,
  setSettingsState,
  systemLogs,
  setSystemLogs,
  messageState,
  setMessageState,
  addSystemLog,
  onClose,
  customAvatarUrl,
  setCustomAvatarUrl
}: FirebaseAuthProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      setSuccessMsg("Authorized via Google. Sync active.");
      addSystemLog(`[AUTH] Google authentication successful for ${userCredential.user.email}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Google Authentication failed.");
      addSystemLog(`[AUTH_ERR] Google sign-in failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        addSystemLog(`[AUTH] Operator authenticated as ${currentUser.email}`);
        // Fetch saved profile/state from Firestore
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            addSystemLog(`[CLOUD] Profile data found. Restoring operator configuration...`);
            
            if (data.theme && data.theme !== currentTheme) {
              setCurrentTheme(data.theme);
            }
            if (data.settings) {
              setSettingsState(data.settings);
            }
            if (data.customAvatarUrl) {
              setCustomAvatarUrl(data.customAvatarUrl);
            }
            if (data.systemLogs && Array.isArray(data.systemLogs)) {
              // Combine local logs with cloud logs cleanly, avoiding duplicates
              setSystemLogs((prev: string[]) => {
                const combined = [...new Set([...data.systemLogs, ...prev])];
                return combined.slice(-100); // Keep last 100 logs
              });
            }
            if (data.messageLogs && Array.isArray(data.messageLogs)) {
              setMessageState((prev: any) => ({
                ...prev,
                logs: data.messageLogs
              }));
            }
          } else {
            addSystemLog(`[CLOUD] No prior profile found. Initializing cloud backup partition...`);
            // Save initial defaults to Firestore
            await setDoc(userDocRef, {
              email: currentUser.email,
              theme: currentTheme,
              settings: settingsState,
              systemLogs: systemLogs.slice(-20),
              messageLogs: messageState.logs || [],
              customAvatarUrl: customAvatarUrl || null,
              createdAt: new Date().toISOString()
            });
          }
        } catch (err: any) {
          console.error('Error fetching Firestore data:', err);
          addSystemLog(`[CLOUD_ERROR] Failed to fetch saved state: ${err.message}`);
        }
      } else {
        addSystemLog(`[AUTH] Session terminated. Operating in guest sandbox mode.`);
      }
    });

    return () => unsubscribe();
  }, [customAvatarUrl]);

  // Sync state to Cloud
  const syncToCloud = async (overrideUser?: User | null) => {
    const activeUser = overrideUser !== undefined ? overrideUser : user;
    if (!activeUser) return;

    try {
      const userDocRef = doc(db, 'users', activeUser.uid);
      await setDoc(userDocRef, {
        email: activeUser.email,
        theme: currentTheme,
        settings: settingsState,
        systemLogs: systemLogs.slice(-40), // Keep last 40 for space efficiency
        messageLogs: messageState.logs || [],
        customAvatarUrl: customAvatarUrl || null,
        lastSynced: new Date().toISOString()
      }, { merge: true });
      addSystemLog(`[CLOUD] System state synchronized successfully.`);
    } catch (err: any) {
      console.error('Error syncing data:', err);
      addSystemLog(`[CLOUD_ERROR] Sync failure: ${err.message}`);
    }
  };

  // Perform continuous background/debounced sync when settings, theme, or avatar changes
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        syncToCloud();
      }, 3000); // Debounce sync by 3 seconds
      return () => clearTimeout(timer);
    }
  }, [currentTheme, settingsState, messageState.logs, customAvatarUrl]);

  const handleResetPassword = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMsg('Please enter your email in the email registry field first.');
      return;
    }
    
    if (targetEmail !== 'krishanumajeeff@gmail.com') {
      setErrorMsg('Access Denied: Reset sequence is restricted to the developer partition (\'krishanumajeeff@gmail.com\').');
      return;
    }
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setSuccessMsg('Security key reset email sent to krishanumajeeff@gmail.com. Check inbox.');
      addSystemLog(`[AUTH] Sent password reset email to krishanumajeeff@gmail.com`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Reset failed: ${err.message}`);
      addSystemLog(`[AUTH_ERR] Password reset failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        setSuccessMsg("Operator account provisioned. Initializing kernel...");
        addSystemLog(`[AUTH] Account ${email} registered.`);
        await syncToCloud(userCredential.user);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccessMsg("Session secured. Loading neural core...");
        addSystemLog(`[AUTH] Login successful for ${email}.`);
      }
    } catch (err: any) {
      console.error(err);
      let cleanMsg = err.message;
      if (err.code === 'auth/wrong-password') cleanMsg = 'Invalid security credentials.';
      if (err.code === 'auth/user-not-found') cleanMsg = 'Operator partition not found.';
      if (err.code === 'auth/email-already-in-use') cleanMsg = 'Email registry occupied.';
      if (err.code === 'auth/weak-password') cleanMsg = 'Password must exceed 6 symbols.';
      setErrorMsg(cleanMsg);
      addSystemLog(`[AUTH_ERR] Action failed: ${err.code || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      addSystemLog(`[AUTH] Logging out operator ${user?.email}...`);
      await signOut(auth);
      setSuccessMsg("Operator logged out. Local memory cleared.");
      setUser(null);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full justify-between font-mono text-xs select-none">
      {user ? (
        // Logged in View
        <div className="space-y-4">
          <div className="border p-3 bg-black/60 flex flex-col gap-2 relative overflow-hidden" style={{ borderColor: `${theme.primary}33` }}>
            <div className="absolute top-0 right-0 p-1 text-[8px] opacity-30">SECURE</div>
            <div className="flex items-center gap-2" style={{ color: theme.secondary }}>
              <Shield size={16} className="animate-pulse" />
              <span className="font-bold uppercase tracking-wider text-[10px]">AUTHORIZED USER</span>
            </div>
            
            <div className="text-[10px] space-y-1.5 pt-1">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="opacity-60">ID:</span>
                <span className="font-bold truncate max-w-[140px]">{user.email}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="opacity-60">PARTITION:</span>
                <span className="font-bold text-gray-400">{user.uid.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="opacity-60">SYNC:</span>
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <Check size={10} /> ACTIVE
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                addSystemLog(`[CLOUD] Manual synchronization sequence triggered.`);
                syncToCloud();
              }}
              className="w-full text-center border py-2 hover:bg-white/5 active:bg-white/10 font-bold uppercase cursor-pointer text-[10px]"
              style={{ borderColor: theme.primary, color: theme.primary }}
            >
              Force Sync to Cloud
            </button>
            
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full text-center border py-2 bg-red-950/20 text-red-400 font-bold uppercase hover:bg-red-900/30 active:bg-red-900/40 cursor-pointer text-[10px] flex items-center justify-center gap-1.5"
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              <LogOut size={12} />
              {loading ? 'Clearing...' : 'Terminate Session'}
            </button>
          </div>
        </div>
      ) : (
        // Login / Signup Form
        <form onSubmit={handleAuth} className="space-y-3.5">
          <div className="flex justify-between border-b pb-1.5" style={{ borderColor: `${theme.primary}22` }}>
            <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: theme.primary }}>
              {isSignUp ? 'Operator Registration' : 'Operator Authorization'}
            </span>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[9px] hover:underline uppercase"
              style={{ color: theme.secondary }}
            >
              {isSignUp ? '[Switch to Login]' : '[Switch to Register]'}
            </button>
          </div>

          <div className="space-y-3">
            {/* Email Field */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-wider opacity-60 block">Email registry</label>
              <div className="relative">
                <Mail size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" style={{ color: theme.primary }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@system.io"
                  className="w-full bg-black/60 border pl-8 pr-2.5 py-1.5 text-[11px] placeholder:opacity-30 focus:outline-none font-mono focus:bg-black/80"
                  style={{ borderColor: `${theme.primary}33`, color: theme.primary }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[9px] uppercase tracking-wider opacity-60 block">Passkey sequence</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="text-[9px] uppercase tracking-wider text-red-400 hover:underline cursor-pointer font-bold hover:text-red-300 transition-colors"
                  >
                    Reset Password
                  </button>
                )}
              </div>
              <div className="relative">
                <Key size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" style={{ color: theme.primary }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/60 border pl-8 pr-2.5 py-1.5 text-[11px] placeholder:opacity-30 focus:outline-none font-mono focus:bg-black/80"
                  style={{ borderColor: `${theme.primary}33`, color: theme.primary }}
                />
              </div>
            </div>
          </div>

          {/* Messages */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div 
                key="auth-error-message"
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-2 border bg-red-950/20 text-red-400 text-[10px] flex gap-1.5 items-start font-sans"
                style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
            {successMsg && (
              <motion.div 
                key="auth-success-message"
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-2 border bg-emerald-950/20 text-emerald-400 text-[10px] flex gap-1.5 items-start font-sans"
                style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
              >
                <Check size={12} className="shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-center border py-2 bg-black/80 font-bold uppercase hover:bg-white/5 active:bg-white/10 cursor-pointer text-[10px]"
            style={{ borderColor: theme.primary, color: theme.primary }}
          >
            {loading ? 'Initializing...' : isSignUp ? 'Create Operator File' : 'Secure Login Connection'}
          </button>

          <div className="flex items-center gap-2 my-2">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[8px] opacity-40 uppercase tracking-widest font-mono">OR DIRECT AUTH</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full text-center border py-2 bg-black/80 font-bold uppercase hover:bg-white/5 active:bg-white/10 cursor-pointer text-[10px] flex items-center justify-center gap-2"
            style={{ borderColor: theme.secondary, color: theme.secondary }}
          >
            <svg className="w-3.5 h-3.5 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Google Authentication</span>
          </button>
        </form>
      )}

      {/* Footer info */}
      <div className="text-[8px] text-center opacity-40 pt-4 border-t border-white/5 flex justify-between items-center" style={{ borderColor: `${theme.primary}11` }}>
        <span>DB_ENGINE: FIRESTORE</span>
        <span>STATUS: {user ? 'SYNCED' : 'OFFLINE'}</span>
      </div>
    </div>
  );
}
