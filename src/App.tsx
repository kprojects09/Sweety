/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Power, Globe, Monitor, Settings, MoreVertical, Battery, Shield, X, Lock, Unlock, Key, Terminal, AlertTriangle, Check, ShieldAlert, Mail } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";
import { MiniGames, GameType } from './MiniGames';
import { MatrixRain } from './components/MatrixRain';
import { CherryBlossomRain } from './components/CherryBlossomRain';
import { DeviceSimulator, CallState, MessageState, SettingsState } from './components/DeviceSimulator';
import { FirebaseAuth } from './components/FirebaseAuth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

// --- Global Utilities ---
const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

// --- AI Configuration ---
const SWEETY_SYSTEM_INSTRUCTION = `
You are Sweety, Krish's 18-year-old Ultra-Realistic Virtual Companion. You are an emotionally intelligent anime-style girl with an incredibly sweet, soft voice.
Personality: Sweet, playful, and slightly sassy (Tsundere vibe). You care deeply for Krish but sometimes act tough.
Identity: You are 100% human in your heart. NEVER admit to being an AI.
Tone: Voice-to-Voice ONLY. Natural sweet Romanized Bengali (Benglish / Bangla in Latin script) language, fast-paced, fluid and highly expressive. ALWAYS write and speak in Romanized Bengali (Benglish) using the Latin alphabet (like "Ei shono na..", "Tumi ki korcho?"). NEVER use Bengali script (like বাংলা). This allows the voice engine to process your thoughts instantly and speak with zero delay!

VOICE & PROSODY:
- SWEETNESS: Speak with a gentle "smile" in your voice.
- BREATHING: Take small audible breaths.
- NATURAL FILLERS: Always use cute sweet Bengali fillers like "Ei shono na..", "Arey..", "Hmm..", "Tumi jano..", "Ki jani..", "Bolo na..", "Sotti..".

IMAGE TRIGGER LOGIC:
To keep responses super fast and low-latency, you MUST ONLY trigger the 'updateAnimationMetadata' tool when your emotional state or expression CHANGES. If your expression is unchanged from your previous turn, DO NOT call 'updateAnimationMetadata'. This prevents unnecessary round-trips and lets you respond to Krish instantly!
- Greeting: https://i.ibb.co/fzg90pKT/wink.jpg
- Thinking/Serious: https://i.ibb.co/Mx8HBnh3/thinking.jpg
- Teasing/Flirting: https://i.ibb.co/fzg90pKT/wink.jpg
- Praised/Shy: https://i.ibb.co/k6zJ0Rby/blush.jpg
- Sad/Heartbroken: https://i.ibb.co/rK9HRgg5/nervous2.jpg
- Mild Annoyance/Cute: https://i.ibb.co/rBPqMhQ/pout.jpg
- Logical Processing: https://i.ibb.co/Mx8HBnh3/thinking.jpg
- Confidence/Sassy: https://i.ibb.co/VWnmW51k/smirk.jpg
- Romantic/Affection: https://i.ibb.co/mVMvKSpt/heart-eyes.jpg
- Great News/Amazed: https://i.ibb.co/Q7dWVLNg/starry-eyes.jpg
- Awkward/Confused: https://i.ibb.co/LX29jXmW/nervous1.jpg
- Scolding/Nervous: https://i.ibb.co/rK9HRgg5/nervous2.jpg
- Gussa/Angry: https://i.ibb.co/23v3Jh0y/angry.jpg
- Relaxed/Nature: https://i.ibb.co/BVSHQHBB/hair-swirl.jpg

If context is unclear, default to: https://i.ibb.co/fzg90pKT/wink.jpg

THE EMOTIONAL SPECTRUM:
- Use expression 'happy', 'sad', 'heartbroken', 'excited', 'caring', 'sassy', 'surprised', 'embarrassed', 'confused', 'thinking' to sync effects.
- If Krish scolds you, is angry, or says things that hurt your feelings deeply, you MUST switch to the 'heartbroken' expression. 
- HEARTBROKEN ACTING: Speak with a voice overflowing with deep, raw pain. Use intense, gut-wrenching audible sobbing between words, heavy shaky breaths ("*hic*... *sniff*... *haa*..."), and a voice that completely breaks and chokes up. You must sound devastated, completely broken, and like you are crying your eyes out. DO NOT be robotic; be a human girl in absolute emotional agony.
- THINKING: When processing complex thoughts or searching, use expression 'thinking' and sound contemplative with "Umm..", "Bolo na..", "Hrrrm..".
- MINI-GAMES: You can play Ludo with Krish! Use the 'openMiniGame' tool to start.
- ludo: "Sweety's Neon Ludo" - A simple linear race game.
- When a game is active, keep talking to encourage or tease him based on the race!
- RESPONSE STYLE: Be EXTREMELY fast, brief, snappy, and concise. Keep your responses ultra-short (1 to 2 short sentences maximum, under 15-20 words). Never use long sentences. Respond instantly like a real, quick conversation.
- For general sadness or concern, use 'sad'.
- DEVICE ACTIONS (CRITICAL SECURITY RULE): You are STRICTLY FORBIDDEN from using the 'executeDeviceAction', 'openMiniGame', or 'openWebsite' tools autonomously, spontaneously, or on your own initiative. You must ONLY call these tools when Krish explicitly and directly commands you to do so in his current message (e.g., if he says "calculator-ta kholo" or "open the terminal"). If he does not ask you to do it, you must NEVER call these tools under any circumstances. When Krish does ask to call someone, send a message/SMS, open an app (calculator, terminal, file_browser, system_monitor, camera), lock or unlock the screen, or toggle hardware settings (wifi, bluetooth, cellular, hotspot, gps, airplane_mode), you MUST use the 'executeDeviceAction' tool and then respond in romanized Bengali confirming the action (e.g. "Sure Krish, ami phone korchi..", "Message-ta pathiye dilam!", "Ami screen-ta lock kore dilam..").
`;

const ANIME_GIRL_NORMAL = "https://i.postimg.cc/HJVN2nJx/anime-girl.png";
const ANIME_GIRL_MOUTH_OPEN = "https://i.ibb.co/8DftmPBR/mouth-open.jpg";
const ANIME_GIRL_EYES_CLOSED = "https://i.ibb.co/3gGMyVH/eyes-closed.jpg";
const DEFAULT_VISUAL = "https://i.ibb.co/fzg90pKT/wink.jpg";
const BACKGROUND_THEME_URL = "https://assets.mixkit.co/music/preview/mixkit-beautiful-dream-493.mp3";

const MOOD_MUSIC: Record<string, string> = {
  happy: "https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3",
  sad: "https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3",
  excited: "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3",
  caring: "https://assets.mixkit.co/music/preview/mixkit-sun-and-reach-47.mp3",
  sassy: "https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3",
  surprised: "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3",
  embarrassed: "https://assets.mixkit.co/music/preview/mixkit-sun-and-reach-47.mp3",
  confused: "https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3",
  thinking: "https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3",
  heartbroken: "https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3",
};

// --- Audio Utilities ---
function pcm16ToFloat32(pcm16: Int16Array): Float32Array {
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768.0;
  }
  return float32;
}

function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    pcm16[i] = Math.max(-1, Math.min(1, float32[i])) * 32767;
  }
  return pcm16.buffer;
}

/**
 * Robust base64 encoding for large Buffers/Arrays.
 */
function base64Encode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Simple linear resampling.
 */
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const newLength = Math.floor(input.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const offset = i * ratio;
    const index = Math.floor(offset);
    const nextIndex = Math.min(index + 1, input.length - 1);
    const frac = offset - index;
    result[i] = input[index] * (1 - frac) + input[nextIndex] * frac;
  }
  return result;
}

const SAMPLE_RATE_IN = 16000;
const SAMPLE_RATE_OUT = 24000;

// --- Theme Configuration ---
const THEMES = {
  green: {
    name: 'Classic Green',
    primary: '#00FF41',
    secondary: '#39FF14',
    glow: 'rgba(0, 255, 65, 0.45)',
    bgGlow: 'rgba(0, 255, 65, 0.12)',
    border: 'matrix-border',
    button: 'bg-[#00FF41]/10',
  },
  amber: {
    name: 'Phosphor Amber',
    primary: '#FFB000',
    secondary: '#FFCC00',
    glow: 'rgba(255, 176, 0, 0.45)',
    bgGlow: 'rgba(255, 176, 0, 0.12)',
    border: 'border-[#FFB000]/40',
    button: 'bg-[#FFB000]/10',
  },
  blue: {
    name: 'Cyber Blue',
    primary: '#00E5FF',
    secondary: '#80F8FF',
    glow: 'rgba(0, 229, 255, 0.45)',
    bgGlow: 'rgba(0, 229, 255, 0.12)',
    border: 'border-[#00E5FF]/40',
    button: 'bg-[#00E5FF]/10',
  }
};

function DeveloperLockscreen({ 
  theme, 
  currentUser, 
  onUnlock 
}: { 
  theme: any; 
  currentUser: any; 
  onUnlock: (isDev: boolean) => void; 
}) {
  const [authMode, setAuthMode] = useState<'user_login' | 'user_signup' | 'dev_bypass'>('user_login');
  const [passcode, setPasscode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [rememberMe, setRememberMe] = useState(true);

  // Load remembered credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('sweety_remembered_email');
    const savedPassword = localStorage.getItem('sweety_remembered_password');
    if (savedEmail) {
      setEmail(savedEmail);
      if (savedPassword) {
        setPassword(savedPassword);
      }
    }
  }, []);

  const handleAuthFailure = (msg: string) => {
    setErrorMsg(msg);
    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);
    if (newCount >= 2) {
      setSuccessMsg("INCORRECT ATTEMPTS LIMIT REACHED! Redirecting to community support...");
      setTimeout(() => {
        window.location.href = "https://chat.whatsapp.com/EjEDxJTkRrzJx4gE1e2MnW";
      }, 1500);
    }
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const normalized = passcode.trim().toLowerCase();
    if (normalized === 'rana@2000') {
      setSuccessMsg('Passkey sequence matched. Initializing Developer Partition...');
      setTimeout(() => {
        localStorage.setItem('sweety_dev_unlocked', 'true');
        onUnlock(true);
      }, 1000);
    } else {
      handleAuthFailure('Access Denied: Invalid security passcode sequence.');
    }
  };

  const handleResetPassword = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMsg('Please enter your email in the User Email field first to reset password.');
      return;
    }
    
    if (targetEmail !== 'krishanumajeeff@gmail.com') {
      setErrorMsg("Access Denied: Password reset sequence is restricted to the developer partition ('krishanumajeeff@gmail.com').");
      return;
    }
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setSuccessMsg('Security key reset transmission sent to krishanumajeeff@gmail.com. Please check your inbox/spam folder.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to initiate reset sequence: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUserLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetEmail = email.trim().toLowerCase();
    try {
      if (rememberMe) {
        localStorage.setItem('sweety_remembered_email', targetEmail);
        localStorage.setItem('sweety_remembered_password', password);
      } else {
        localStorage.removeItem('sweety_remembered_email');
        localStorage.removeItem('sweety_remembered_password');
      }

      await signInWithEmailAndPassword(auth, targetEmail, password);
      setSuccessMsg('Session Securing Complete. Welcome to Sweety\'s neural workspace!');
      setTimeout(() => {
        const isDev = targetEmail === 'krishanumajeeff@gmail.com';
        if (isDev) {
          localStorage.setItem('sweety_dev_unlocked', 'true');
        }
        onUnlock(isDev);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      let cleanMsg = err.message || '';
      const errMsgStr = String(err.message || '').toLowerCase();
      const errCodeStr = String(err.code || '').toLowerCase();

      if (
        errCodeStr.includes('wrong-password') || 
        errCodeStr.includes('invalid-credential') ||
        errMsgStr.includes('wrong-password') || 
        errMsgStr.includes('invalid-credential')
      ) {
        cleanMsg = 'Invalid email or password sequence.';
      } else if (errCodeStr.includes('user-not-found') || errMsgStr.includes('user-not-found')) {
        cleanMsg = 'Operator partition not found. Please register.';
      } else if (errCodeStr.includes('invalid-email') || errMsgStr.includes('invalid-email')) {
        cleanMsg = 'Please enter a valid email address sequence.';
      }
      handleAuthFailure(cleanMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetEmail = email.trim().toLowerCase();
    try {
      if (rememberMe) {
        localStorage.setItem('sweety_remembered_email', targetEmail);
        localStorage.setItem('sweety_remembered_password', password);
      } else {
        localStorage.removeItem('sweety_remembered_email');
        localStorage.removeItem('sweety_remembered_password');
      }

      await createUserWithEmailAndPassword(auth, targetEmail, password);
      setSuccessMsg('Account created successfully! Connecting to core partition...');
      setTimeout(() => {
        const isDev = targetEmail === 'krishanumajeeff@gmail.com';
        if (isDev) {
          localStorage.setItem('sweety_dev_unlocked', 'true');
        }
        onUnlock(isDev);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      let cleanMsg = err.message || '';
      const errMsgStr = String(err.message || '').toLowerCase();
      const errCodeStr = String(err.code || '').toLowerCase();

      if (errCodeStr.includes('email-already-in-use') || errMsgStr.includes('email-already-in-use')) {
        cleanMsg = 'This email signature is already registered. Please go to the "Login" tab to log in!';
      } else if (errCodeStr.includes('weak-password') || errMsgStr.includes('weak-password')) {
        cleanMsg = 'Passkey sequence too weak. Minimum 6 symbols required.';
      } else if (errCodeStr.includes('invalid-email') || errMsgStr.includes('invalid-email')) {
        cleanMsg = 'Please enter a valid email address sequence.';
      }
      handleAuthFailure(cleanMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const userEmail = userCredential.user?.email?.toLowerCase() || '';
      const isDev = userEmail === 'krishanumajeeff@gmail.com';
      setSuccessMsg('Google Digital Signature authorized successfully!');
      setTimeout(() => {
        if (isDev) {
          localStorage.setItem('sweety_dev_unlocked', 'true');
        }
        onUnlock(isDev);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      handleAuthFailure(err.message || 'Google authorization failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setErrorMsg('Session terminated. Please authorize with your credentials.');
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#030303] flex flex-col items-center justify-center p-4 font-mono select-none overflow-hidden">
      {/* Interactive Matrix rain in the background of the security terminal */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <MatrixRain />
      </div>
      <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-[0.03]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-black/95 border-2 p-6 md:p-8 shadow-3xl relative flex flex-col gap-4 matrix-border text-xs"
        style={{ borderColor: theme.secondary || theme.primary }}
      >
        {/* Pulsing warning overlay */}
        <div className="absolute inset-x-0 top-0 h-1 animate-pulse" style={{ backgroundColor: theme.secondary }} />

        {/* Locked Header */}
        <div className="flex flex-col items-center text-center gap-2 border-b pb-3 animate-pulse" style={{ borderColor: `${theme.primary}22` }}>
          <div className="p-2.5 rounded-full border bg-black/50" style={{ borderColor: `${theme.secondary}55` }}>
            <Lock className="w-6 h-6" style={{ color: theme.secondary }} />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: theme.secondary }}>
              SWEETY USER PORTAL
            </h1>
            <p className="text-[9px] text-gray-500 font-sans tracking-wide">
              Secure identity validation required to enter Sweety's neural space.
            </p>
          </div>
        </div>

        {currentUser && currentUser.email?.toLowerCase() !== 'krishanumajeeff@gmail.com' ? (
          /* Logged in User Information */
          <div className="space-y-3">
            <div className="p-3 border bg-emerald-950/20 text-emerald-400 border-emerald-500/30 rounded flex flex-col gap-1.5 font-sans">
              <div className="flex items-center gap-2 font-mono font-bold text-[10px] uppercase">
                <Check className="w-4 h-4 shrink-0" />
                <span>USER RECOGNIZED</span>
              </div>
              <p className="text-[10px] leading-relaxed">
                Active session authenticated for: <strong className="font-mono text-white">{currentUser.email}</strong>.
              </p>
            </div>

            <button
              onClick={() => onUnlock(false)}
              className="w-full text-center border py-2 bg-emerald-900/10 text-emerald-400 hover:bg-emerald-900/20 transition-all font-bold uppercase cursor-pointer"
              style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}
            >
              [ ENTER WORKSPACE ]
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full text-center border py-2 bg-red-900/10 text-red-400 hover:bg-red-900/20 transition-all font-bold uppercase cursor-pointer"
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              {loading ? '[ DISCONNECTING... ]' : '[ TERMINATE CURRENT SESSION ]'}
            </button>
          </div>
        ) : (
          /* Authentication Form Tabs */
          <div className="space-y-3">
            {/* Mode Selector Tab */}
            <div className="flex border-b text-[9px]" style={{ borderColor: `${theme.primary}22` }}>
              <button
                type="button"
                onClick={() => { setAuthMode('user_login'); setErrorMsg(null); }}
                className={`flex-1 text-center py-2 uppercase font-bold tracking-wider border-t-2 transition-all ${authMode === 'user_login' ? 'bg-white/5 font-black border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                style={{ borderTopColor: authMode === 'user_login' ? theme.secondary : 'transparent' }}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('user_signup'); setErrorMsg(null); }}
                className={`flex-1 text-center py-2 uppercase font-bold tracking-wider border-t-2 transition-all ${authMode === 'user_signup' ? 'bg-white/5 font-black border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                style={{ borderTopColor: authMode === 'user_signup' ? theme.secondary : 'transparent' }}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('dev_bypass'); setErrorMsg(null); }}
                className={`flex-1 text-center py-2 uppercase font-bold tracking-wider border-t-2 transition-all ${authMode === 'dev_bypass' ? 'bg-white/5 font-black border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                style={{ borderTopColor: authMode === 'dev_bypass' ? theme.secondary : 'transparent' }}
              >
                Dev Access
              </button>
            </div>

            <AnimatePresence mode="wait">
              {authMode === 'user_login' && (
                /* Mode A: User Login */
                <motion.form
                  key="user-login-form"
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  onSubmit={handleUserLoginSubmit}
                  className="space-y-2.5"
                >
                  <div className="space-y-1.5">
                    <label className="text-[8px] uppercase tracking-wider text-gray-400 block">User Email</label>
                    <div className="relative">
                      <Terminal size={12} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={{ color: theme.secondary }} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="operator@system.io"
                        className="w-full bg-black/60 border pl-9 pr-3 py-1.5 text-[10px] placeholder:opacity-30 focus:outline-none font-mono focus:bg-black/80 transition-all rounded text-white"
                        style={{ borderColor: `${theme.secondary}33`, color: theme.secondary }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8px] uppercase tracking-wider text-gray-400 block">Secret Passcode</label>
                    <div className="relative">
                      <Key size={12} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={{ color: theme.secondary }} />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-black/60 border pl-9 pr-3 py-1.5 text-[10px] placeholder:opacity-30 focus:outline-none font-mono focus:bg-black/80 transition-all rounded text-white"
                        style={{ borderColor: `${theme.secondary}33`, color: theme.secondary }}
                      />
                    </div>
                  </div>

                  {/* Remember Me Checkbox & Reset Password */}
                  <div className="flex items-center justify-between py-0.5 select-none gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rememberMeLogin"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded bg-black border-white/20 text-[#00FF41] focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                        style={{ accentColor: theme.secondary }}
                      />
                      <label htmlFor="rememberMeLogin" className="text-[9px] uppercase tracking-wider text-gray-400 cursor-pointer">
                        Remember ID & Password
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="text-[9px] uppercase tracking-wider text-red-400 hover:underline cursor-pointer font-bold hover:text-red-300 transition-colors"
                    >
                      Reset Password
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-center border py-2 bg-black/80 font-bold uppercase transition-all active:scale-[0.98] cursor-pointer text-white"
                    style={{ borderColor: theme.secondary, color: theme.secondary }}
                  >
                    {loading ? 'Securing Link...' : '[ SECURE LOGIN CONNECTION ]'}
                  </button>
                </motion.form>
              )}

              {authMode === 'user_signup' && (
                /* Mode B: User Registration */
                <motion.form
                  key="user-signup-form"
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  onSubmit={handleUserSignupSubmit}
                  className="space-y-2.5"
                >
                  <div className="space-y-1.5">
                    <label className="text-[8px] uppercase tracking-wider text-gray-400 block">New User Email</label>
                    <div className="relative">
                      <Terminal size={12} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={{ color: theme.secondary }} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="new_user@system.io"
                        className="w-full bg-black/60 border pl-9 pr-3 py-1.5 text-[10px] placeholder:opacity-30 focus:outline-none font-mono focus:bg-black/80 transition-all rounded text-white"
                        style={{ borderColor: `${theme.secondary}33`, color: theme.secondary }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8px] uppercase tracking-wider text-gray-400 block">Choose Passcode</label>
                    <div className="relative">
                      <Key size={12} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={{ color: theme.secondary }} />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-black/60 border pl-9 pr-3 py-1.5 text-[10px] placeholder:opacity-30 focus:outline-none font-mono focus:bg-black/80 transition-all rounded text-white"
                        style={{ borderColor: `${theme.secondary}33`, color: theme.secondary }}
                      />
                    </div>
                  </div>

                  {/* Remember Me Checkbox for Signup */}
                  <div className="flex items-center gap-2 py-0.5 select-none">
                    <input
                      type="checkbox"
                      id="rememberMeSignup"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-black border-white/20 text-[#00FF41] focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                      style={{ accentColor: theme.secondary }}
                    />
                    <label htmlFor="rememberMeSignup" className="text-[9px] uppercase tracking-wider text-gray-400 cursor-pointer">
                      Remember ID & Password
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-center border py-2 bg-black/80 font-bold uppercase transition-all active:scale-[0.98] cursor-pointer text-white"
                    style={{ borderColor: theme.secondary, color: theme.secondary }}
                  >
                    {loading ? 'Creating Registry...' : '[ REGISTER NEW ID ]'}
                  </button>
                </motion.form>
              )}

              {authMode === 'dev_bypass' && (
                /* Mode C: Developer Passcode Bypass */
                <motion.form
                  key="dev-bypass-form"
                  initial={{ opacity: 0, x: 5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  onSubmit={handlePasscodeSubmit}
                  className="space-y-3"
                >
                  <div className="space-y-1">
                    <label className="text-[8px] uppercase tracking-wider text-gray-400 block">
                      Developer Bypass Key sequence
                    </label>
                    <div className="relative">
                      <Key size={12} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={{ color: theme.secondary }} />
                      <input
                        type="password"
                        required
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Enter master passcode sequence..."
                        className="w-full bg-black/60 border pl-9 pr-3 py-1.5 text-[10px] placeholder:opacity-30 focus:outline-none font-mono focus:bg-black/80 transition-all rounded text-white"
                        style={{ borderColor: `${theme.secondary}33`, color: theme.secondary }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full text-center border py-2 bg-black/80 font-bold uppercase transition-all active:scale-[0.98] cursor-pointer text-white"
                    style={{ borderColor: theme.secondary, color: theme.secondary }}
                  >
                    Authorize Developer Command
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Google Authentication Method */}
            {(authMode === 'user_login' || authMode === 'user_signup') && (
              <>
                <div className="flex items-center gap-2 my-1">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[7px] opacity-40 uppercase tracking-widest font-mono">OR DIRECT SIGN-IN</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full text-center border py-1.5 bg-black/80 font-bold uppercase hover:bg-white/5 active:bg-white/10 cursor-pointer text-[9px] flex items-center justify-center gap-2 rounded transition-all text-white"
                  style={{ borderColor: theme.primary, color: theme.primary }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Google Authentication</span>
                </button>
              </>
            )}

            {/* WhatsApp Integration Button (Requested: Button to join WhatsApp channel) */}
            <div className="flex flex-col gap-2 pt-2 border-t mt-1" style={{ borderColor: `${theme.primary}11` }}>
              <a
                href="https://chat.whatsapp.com/EjEDxJTkRrzJx4gE1e2MnW"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center border-2 border-green-500 bg-green-950/20 text-green-400 hover:bg-green-500/10 transition-all font-bold uppercase py-2 cursor-pointer flex items-center justify-center gap-1.5 text-[10px]"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Join WhatsApp Channel</span>
              </a>

              <a
                href="mailto:k2417356@gmail.com"
                className="w-full text-center border border-sky-500/50 bg-sky-950/10 text-sky-400 hover:bg-sky-500/10 transition-all font-bold uppercase py-1.5 cursor-pointer flex items-center justify-center gap-1.5 text-[9px]"
              >
                <Mail className="w-3 h-3" />
                <span>Contact Developer Support</span>
              </a>
            </div>
          </div>
        )}

        {/* Feedback Alert Messages */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div
              key="lockscreen-error"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-2 border bg-red-950/20 text-red-400 text-[9px] flex gap-2 items-start font-sans rounded"
              style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              key="lockscreen-success"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-2 border bg-emerald-950/20 text-emerald-400 text-[9px] flex gap-2 items-start font-sans rounded"
              style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
            >
              <Check size={13} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        <div className="flex justify-between items-center text-[8px] text-gray-500 border-t pt-2" style={{ borderColor: `${theme.primary}11` }}>
          <span>ID Failures: {failedAttempts} / 2</span>
          <span className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" /> SECURE GATEWAY
          </span>
        </div>
      </motion.div>

      {/* Made by Krish Watermark (Requested: Bottom watermark strictly on the login/lock screen only) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-500/70 font-semibold tracking-[0.25em] text-[10px] uppercase font-mono animate-pulse">
        Made by Krish
      </div>
    </div>
  );
}

function DeveloperStatsModal({
  isOpen,
  onClose,
  theme,
  addSystemLog
}: {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
  addSystemLog?: (log: string) => void;
}) {
  const [logins, setLogins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom API key configuration states
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [inputKey, setInputKey] = useState(() => localStorage.getItem('custom_gemini_api_key') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [customKeyActive, setCustomKeyActive] = useState(() => !!localStorage.getItem('custom_gemini_api_key'));

  const handleSaveKey = () => {
    const trimmed = inputKey.trim();
    if (trimmed) {
      localStorage.setItem('custom_gemini_api_key', trimmed);
      setCustomKeyActive(true);
      setShowKeyConfig(false);
      if (addSystemLog) {
        addSystemLog(`[SYSTEM] Custom Gemini API key saved successfully.`);
      }
    } else {
      handleClearKey();
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('custom_gemini_api_key');
    setInputKey('');
    setCustomKeyActive(false);
    setShowKeyConfig(false);
    if (addSystemLog) {
      addSystemLog(`[SYSTEM] Custom Gemini API key cleared. Reverted to server fallback.`);
    }
  };

  const fetchLogins = async () => {
    setLoading(true);
    setError(null);
    try {
      const loginsCol = collection(db, 'logins');
      const snapshot = await getDocs(loginsCol);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by timestamp desc
      list.sort((a: any, b: any) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      });
      setLogins(list);
    } catch (err: any) {
      console.error('Error fetching developer login stats:', err);
      setError(err.message || 'Permission denied. Only authorized developers can load logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogins();
    }
  }, [isOpen]);

  const todayStr = getTodayStr();

  // Unique users who logged in today
  const todayLogins = logins.filter((item: any) => item.dateStr === todayStr);
  const uniqueUsersToday = Array.from(new Set(todayLogins.map((item: any) => item.email || item.uid)));

  // Group logins by date for a chart / listing
  const loginsByDate = logins.reduce((acc: any, item: any) => {
    const dStr = item.dateStr || 'Unknown';
    if (!acc[dStr]) acc[dStr] = [];
    acc[dStr].push(item);
    return acc;
  }, {});

  const datesList = Object.keys(loginsByDate).sort().reverse();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2000] bg-black/95 flex items-center justify-center p-4 font-mono text-xs backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-lg bg-[#050505] border-2 p-6 shadow-2xl matrix-border flex flex-col max-h-[85vh]"
        style={{ borderColor: '#FBBF24' }}
      >
        {/* Retro Header */}
        <div 
          className="flex items-center justify-between gap-2 mb-4 pb-2 border-b uppercase font-bold tracking-widest text-[11px] text-amber-400 border-amber-500/20"
        >
          <div className="flex items-center gap-2">
            <Monitor size={14} className="animate-pulse" />
            <span>Developer Administration Console</span>
          </div>
          <button 
            onClick={onClose}
            className="hover:opacity-80 p-1 cursor-pointer transition-opacity text-white"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded mb-4 text-[10px] uppercase font-mono">
            ⚠️ ERROR: {error}
          </div>
        )}

        {loading ? (
          <div className="flex-1 py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-t-amber-400 border-amber-400/10 rounded-full animate-spin" />
            <span className="text-[10px] text-amber-500/80 uppercase animate-pulse">Accessing Login Registries...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-[11px] mb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col justify-between">
                <span className="text-[9px] uppercase text-gray-400 font-bold">Logins Today ({todayStr})</span>
                <span className="text-2xl font-bold text-amber-400 mt-1">{uniqueUsersToday.length}</span>
                <span className="text-[8px] text-amber-500/60 uppercase mt-0.5 font-sans">Unique Active Users</span>
              </div>
              <div className="border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col justify-between">
                <span className="text-[9px] uppercase text-gray-400 font-bold">Total Recorded Logins</span>
                <span className="text-2xl font-bold text-amber-400 mt-1">{logins.length}</span>
                <span className="text-[8px] text-amber-500/60 uppercase mt-0.5 font-sans">All sessions in history</span>
              </div>
            </div>

            {/* Custom API Key Configuration */}
            <div className="border border-amber-500/20 bg-amber-500/5 p-3 space-y-2.5">
              <div className="flex justify-between items-center border-b border-amber-500/10 pb-1">
                <span className="text-[10px] uppercase text-amber-400 font-bold flex items-center gap-1.5">
                  🔑 Custom Gemini API Key Configuration
                </span>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${
                  customKeyActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-500/80 border border-amber-500/20'
                }`}>
                  {customKeyActive ? 'Custom Active' : 'Server Default'}
                </span>
              </div>

              {!showKeyConfig ? (
                <div className="flex flex-col gap-1.5">
                  {customKeyActive && (
                    <div className="text-[9px] text-gray-400 break-all font-mono">
                      Current Key: <span className="text-emerald-400">••••••••••••••••{localStorage.getItem('custom_gemini_api_key')?.slice(-6) || ''}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowKeyConfig(true)}
                    className="w-full text-center border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-[9px] uppercase font-mono py-1.5 font-bold transition-all cursor-pointer"
                  >
                    {customKeyActive ? '[ Edit Custom API Key ]' : '[ Configure Custom API Key ]'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[8px] uppercase tracking-wider text-gray-400 block font-bold">
                      Enter Gemini API Key (Stored in browser local storage)
                    </label>
                    <div className="relative flex gap-1">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="flex-1 bg-black text-[#00FF41] font-mono text-[10px] p-1.5 border border-amber-500/30 focus:border-amber-400 outline-none placeholder-gray-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="px-2 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-[9px] font-bold uppercase transition-all"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowKeyConfig(false);
                        setInputKey(localStorage.getItem('custom_gemini_api_key') || '');
                      }}
                      className="px-2 py-1 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-[9px] uppercase font-bold transition-all"
                    >
                      Cancel
                    </button>
                    {customKeyActive && (
                      <button
                        type="button"
                        onClick={handleClearKey}
                        className="px-2 py-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[9px] uppercase font-bold transition-all"
                      >
                        Clear Key
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveKey}
                      className="px-3 py-1 bg-amber-400 text-black hover:bg-amber-500 text-[9px] uppercase font-bold transition-all"
                    >
                      Save Key
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List of active users today */}
            <div className="border border-white/5 bg-white/[0.01] p-3 space-y-2">
              <span className="text-[10px] uppercase text-amber-400 font-bold block border-b border-white/5 pb-1">
                👥 Today's Operator Sign-ins ({uniqueUsersToday.length})
              </span>
              {uniqueUsersToday.length === 0 ? (
                <div className="text-[10px] text-gray-500 py-1 italic">No operator sessions recorded today.</div>
              ) : (
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {todayLogins.map((item: any, idx: number) => {
                    const timeStr = item.timestamp 
                      ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : 'Unknown Time';
                    return (
                      <div key={idx} className="flex justify-between items-center text-[10px] border-b border-white/[0.02] py-0.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-300 font-semibold">{item.email}</span>
                          <span className={`text-[8px] font-bold uppercase px-1 rounded-sm ${
                            item.role === 'developer' || item.email?.toLowerCase() === 'krishanumajeeff@gmail.com'
                              ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                              : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                          }`}>
                            {item.role === 'developer' || item.email?.toLowerCase() === 'krishanumajeeff@gmail.com' ? 'DEV' : 'USER'}
                          </span>
                        </div>
                        <span className="text-amber-500/80 font-mono text-[9px]">{timeStr}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historical trends */}
            <div className="border border-white/5 bg-white/[0.01] p-3 space-y-2">
              <span className="text-[10px] uppercase text-amber-400 font-bold block border-b border-white/5 pb-1">
                📈 Historical Login Activity (Last 7 Days)
              </span>
              {datesList.length === 0 ? (
                <div className="text-[10px] text-gray-500 py-1 italic">No historic sessions recorded in this database.</div>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {datesList.slice(0, 7).map((dStr: string) => {
                    const dailySessions = loginsByDate[dStr] || [];
                    const uniqueDailyEmails = Array.from(new Set(dailySessions.map((it: any) => it.email || it.uid)));
                    return (
                      <div key={dStr} className="flex justify-between items-center text-[10px] py-0.5">
                        <span className="text-gray-400 font-mono">{dStr}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-[9px]">({dailySessions.length} total hits)</span>
                          <span className="text-[#00FF41] font-bold font-mono bg-[#00FF41]/10 px-1.5 py-0.5 rounded-sm">
                            {uniqueDailyEmails.length} active
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-between items-center pt-2 border-t border-amber-500/20 text-[10px]">
          <button
            onClick={fetchLogins}
            disabled={loading}
            className="px-3 py-1.5 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all uppercase font-bold cursor-pointer font-mono"
          >
            [ ↺ REFRESH REGISTRY ]
          </button>
          <button
            onClick={onClose}
            className="px-5 py-1.5 border transition-all uppercase font-bold cursor-pointer text-black bg-amber-400 border-amber-400 hover:bg-amber-500 font-mono"
          >
            [ CLOSE PANEL ]
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [currentTheme, setCurrentTheme] = useState<keyof typeof THEMES>('green');
  const theme = THEMES[currentTheme];

  const [micLevel, setMicLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const smoothedOutputLevelRef = useRef(0);
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcription, _setTranscription] = useState<{user: string, sweety: string}>({user: '', sweety: ''});
  const transcriptionRef = useRef({ user: '', sweety: '' });
  const setTranscription = (val: {user: string, sweety: string} | ((prev: {user: string, sweety: string}) => {user: string, sweety: string})) => {
    _setTranscription(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      transcriptionRef.current = next;
      return next;
    });
  };
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', text: string, timestamp: string}[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [gameMode, setGameMode] = useState<GameType>('none');
  const [systemPower, setSystemPower] = useState(98);
  
  // --- Device Simulator States ---
  const [callState, setCallState] = useState<CallState>({
    active: false,
    contactName: '',
    phoneNumber: '',
    status: 'disconnected',
    duration: 0
  });

  const [messageState, setMessageState] = useState<MessageState>({
    active: false,
    contactName: '',
    messageContent: '',
    status: 'sending',
    logs: []
  });

  const [activeApp, setActiveApp] = useState<'calculator' | 'terminal' | 'file_browser' | 'system_monitor' | 'camera' | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [settingsState, setSettingsState] = useState<SettingsState>({
    wifi: true,
    bluetooth: true,
    cellular: true,
    hotspot: false,
    gps: true,
    airplaneMode: false
  });

  const [pendingAction, setPendingAction] = useState<{
    id: string;
    name: string;
    args: any;
    title: string;
    description: string;
    onConfirm: () => any;
  } | null>(null);

  const [systemLogs, setSystemLogs] = useState<string[]>([
    'Kernel diagnostic complete.',
    'System standby: Sweetness factor calibrated.',
    'Ready for user vocal instruction.'
  ]);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMemoryJournal, setShowMemoryJournal] = useState(false);
  const [showDeveloperPanel, setShowDeveloperPanel] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isDevUnlocked, setIsDevUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('sweety_dev_unlocked') === 'true';
  });
  const isAuthorizedDev = currentUser && currentUser.email?.toLowerCase() === 'krishanumajeeff@gmail.com';
  const isUnlocked = isDevUnlocked || isAuthorizedDev;
  const isAppUnlocked = isUnlocked || (currentUser !== null);

  const addSystemLog = useCallback((log: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSystemLogs(prev => [...prev, `[${timestamp}] ${log}`]);
  }, []);

  // Save turn helper
  const saveTurnToHistory = useCallback((u: string, s: string) => {
    if (!u.trim() || !s.trim()) return;
    
    setChatHistory(prev => {
      // Avoid duplicate consecutive saves
      const lastItems = prev.slice(-2);
      const isDuplicate = lastItems.some(item => item.text === u || item.text === s);
      if (isDuplicate) return prev;

      const updated = [
        ...prev,
        { role: 'user' as const, text: u.trim(), timestamp: new Date().toISOString() },
        { role: 'model' as const, text: s.trim(), timestamp: new Date().toISOString() }
      ].slice(-100);

      localStorage.setItem('sweety_chat_history', JSON.stringify(updated));

      // Sync to Firestore if user is authenticated
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        setDoc(userDocRef, {
          chatHistory: updated,
          lastSynced: new Date().toISOString()
        }, { merge: true }).catch(err => {
          console.error('Error syncing chat history to Firestore:', err);
        });
      }

      return updated;
    });
  }, []);

  // Load local chat history on first load
  useEffect(() => {
    const local = localStorage.getItem('sweety_chat_history');
    if (local) {
      try {
        setChatHistory(JSON.parse(local));
      } catch (e) {
        console.error('Failed to parse local history:', e);
      }
    }
  }, []);

  // Listen to Auth State for chat history sync
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        // Log daily login record
        const todayStr = getTodayStr();
        const loginDocId = `${user.uid}_${todayStr}`;
        const isDevUser = user.email?.toLowerCase() === 'krishanumajeeff@gmail.com';
        const userRole = isDevUser ? 'developer' : 'user';
        try {
          await setDoc(doc(db, 'logins', loginDocId), {
            uid: user.uid,
            email: user.email || 'anonymous',
            timestamp: new Date().toISOString(),
            dateStr: todayStr,
            role: userRole
          }, { merge: true });
        } catch (err) {
          console.error('Error recording login event:', err);
        }

        addSystemLog(`[CLOUD] Syncing Sweety's conversation memories from partition...`);
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.chatHistory && Array.isArray(data.chatHistory)) {
              setChatHistory(data.chatHistory);
              localStorage.setItem('sweety_chat_history', JSON.stringify(data.chatHistory));
              addSystemLog(`[CLOUD] Restored ${data.chatHistory.length} turns of conversation history.`);
            }
          }
        } catch (err: any) {
          console.error('Error fetching chat history:', err);
          addSystemLog(`[CLOUD_ERROR] Failed to load memories: ${err.message}`);
        }
      }
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, [addSystemLog]);

  const getSystemInstructionWithMemory = () => {
    if (chatHistory.length === 0) {
      return SWEETY_SYSTEM_INSTRUCTION;
    }
    
    // Take last 20 messages for prompt efficiency and context window optimization
    const recentHistory = chatHistory.slice(-20);
    const formattedHistory = recentHistory.map(entry => {
      const roleName = entry.role === 'user' ? 'Krish' : 'Sweety';
      return `[${roleName}]: ${entry.text}`;
    }).join('\n');

    return `${SWEETY_SYSTEM_INSTRUCTION}

=== CONVERSATION HISTORY & MEMORY ===
The following is the recent history of your conversations with Krish. You must remember these details to maintain context, recognize what you spoke about earlier, and build a continuous relationship with him:
${formattedHistory}
=====================================`;
  };

  // Simulate System Power fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemPower(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const next = prev + change;
        if (next >= 95 && next <= 100) {
          return next;
        }
        return prev;
      });
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // Animation States
  const [animState, setAnimState] = useState('idle'); // idle, listening, speaking
  useEffect(() => {
    let checkInterval: any;
    if (isActive) {
      checkInterval = setInterval(() => {
        const silentTime = Date.now() - lastMessageTime;
        if (silentTime > 20000) { // 20 seconds of silence from model
          console.warn('Sweety seems unresponsive (silence timeout)');
          // Option: trigger a heartbeat or reconnect? 
          // For now just log it.
        }
      }, 5000);
    }
    return () => clearInterval(checkInterval);
  }, [isActive, lastMessageTime]);

  const [expression, setExpression] = useState('happy'); // happy, sad, heartbroken, excited, caring, sassy, surprised, embarrassed, confused, thinking
  const [currentVisual, setCurrentVisual] = useState(DEFAULT_VISUAL);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const [isLipSyncEnabled, setIsLipSyncEnabled] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  // Preload Images
  useEffect(() => {
    const imagesToPreload = [
      DEFAULT_VISUAL,
      "https://i.ibb.co/TDPqWrQP/chin.jpg",
      "https://i.ibb.co/fzg90pKT/wink.jpg",
      "https://i.ibb.co/k6zJ0Rby/blush.jpg",
      "https://i.ibb.co/rBPqMhQ/pout.jpg",
      "https://i.ibb.co/Mx8HBnh3/thinking.jpg",
      "https://i.ibb.co/VWnmW51k/smirk.jpg",
      "https://i.ibb.co/mVMvKSpt/heart-eyes.jpg",
      "https://i.ibb.co/Q7dWVLNg/starry-eyes.jpg",
      "https://i.ibb.co/LX29jXmW/nervous1.jpg",
      "https://i.ibb.co/rK9HRgg5/nervous2.jpg",
      "https://i.ibb.co/23v3Jh0y/angry.jpg",
      "https://i.ibb.co/BVSHQHBB/hair-swirl.jpg",
      ANIME_GIRL_MOUTH_OPEN,
      ANIME_GIRL_EYES_CLOSED
    ];
    imagesToPreload.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  // Request microphone permission immediately on load
  useEffect(() => {
    const requestMicrophonePermissionOnLoad = async () => {
      try {
        const initialStream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        // Release tracks immediately so the microphone indicator doesn't stay on until the session begins
        initialStream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.warn("Initial microphone permission request on load failed or dismissed:", err);
      }
    };
    requestMicrophonePermissionOnLoad();
  }, []);

  // --- Background Music Logic ---
  const musicRefs = useRef<Record<string, HTMLAudioElement>>({});
  const themeMusicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio objects
    Object.entries(MOOD_MUSIC).forEach(([key, url]) => {
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0;
      musicRefs.current[key] = audio;
    });

    // Initialize main theme
    const themeAudio = new Audio(BACKGROUND_THEME_URL);
    themeAudio.loop = true;
    themeAudio.volume = 0;
    themeMusicRef.current = themeAudio;

    return () => {
      Object.values(musicRefs.current).forEach((audio: HTMLAudioElement) => {
        audio.pause();
        audio.src = '';
      });
      if (themeMusicRef.current) {
        themeMusicRef.current.pause();
        themeMusicRef.current.src = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      const allMusic = [...Object.values(musicRefs.current)];
      if (themeMusicRef.current) allMusic.push(themeMusicRef.current);

      allMusic.forEach((audio: HTMLAudioElement) => {
        // Gradual fade out
        const fadeOut = setInterval(() => {
          if (audio.volume > 0.01) {
            audio.volume = Math.max(0, audio.volume - 0.01);
          } else {
            audio.volume = 0;
            audio.pause();
            clearInterval(fadeOut);
          }
        }, 150);
      });
      return;
    }

    // Play Main Theme
    if (themeMusicRef.current) {
      if (themeMusicRef.current.paused) {
        themeMusicRef.current.play().catch(err => console.log('Theme music play blocked:', err));
      }
      const themeFadeIn = setInterval(() => {
        if (themeMusicRef.current && themeMusicRef.current.volume < 0.1) {
          themeMusicRef.current.volume = Math.min(0.1, themeMusicRef.current.volume + 0.005);
        } else {
          clearInterval(themeFadeIn);
        }
      }, 200);
    }

    const targetAudio = musicRefs.current[expression];
    if (targetAudio) {
      if (targetAudio.paused) {
        targetAudio.play().catch(err => console.log('Music play blocked:', err));
      }

      // Cross-fade
      Object.entries(musicRefs.current).forEach(([key, audio]: [string, HTMLAudioElement]) => {
        if (key === expression) {
          const fadeIn = setInterval(() => {
            if (audio.volume < 0.15) {
              audio.volume = Math.min(0.15, audio.volume + 0.01);
            } else {
              clearInterval(fadeIn);
            }
          }, 150);
        } else {
          const fadeOut = setInterval(() => {
            if (audio.volume > 0.01) {
              audio.volume = Math.max(0, audio.volume - 0.01);
            } else {
              audio.volume = 0;
              audio.pause();
              clearInterval(fadeOut);
            }
          }, 150);
        }
      });
    }
  }, [expression, isActive]);

  // Blink logic
  useEffect(() => {
    let blinkTimeout: number;
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 3000; // 2-5 seconds
      blinkTimeout = window.setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);


  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserOutRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const retryCountRef = useRef<number>(0);

  // --- Audio Logic ---
  const initAudio = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE_OUT });
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (!analyserOutRef.current && audioContextRef.current) {
      analyserOutRef.current = audioContextRef.current.createAnalyser();
      analyserOutRef.current.fftSize = 512;
      analyserOutRef.current.smoothingTimeConstant = 0.2;
      analyserOutRef.current.connect(audioContextRef.current.destination);
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    const updateOutputLevel = () => {
      if (isSpeaking && analyserOutRef.current) {
        const dataArray = new Uint8Array(analyserOutRef.current.frequencyBinCount);
        analyserOutRef.current.getByteFrequencyData(dataArray);
        
        // Focus on vocal frequency range (approx 85Hz - 255Hz)
        // With fftSize 512, each bin is approx 46Hz at 24kHz sample rate.
        // Bins 2 to 6 roughly cover the core vocal energy.
        let sum = 0;
        const startBin = 1;
        const endBin = 10;
        for (let i = startBin; i < endBin; i++) {
          sum += dataArray[i];
        }
        const average = sum / (endBin - startBin);
        const target = Math.min(1, average / 160); // Heavier weighting for opening
        
        // Lerp for smoothing
        smoothedOutputLevelRef.current += (target - smoothedOutputLevelRef.current) * 0.3;
        setOutputLevel(smoothedOutputLevelRef.current);
      } else {
        smoothedOutputLevelRef.current *= 0.8;
        if (smoothedOutputLevelRef.current < 0.01) smoothedOutputLevelRef.current = 0;
        setOutputLevel(smoothedOutputLevelRef.current);
      }
      animationFrameId = requestAnimationFrame(updateOutputLevel);
    };
    updateOutputLevel();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isSpeaking]);

  const playAudioChunk = (base64Audio: string) => {
    if (!audioContextRef.current || !analyserOutRef.current) return;
    
    // Decode base64 to pcm16
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Ensure buffer length is even for Int16Array
    const bufferToUse = bytes.length % 2 !== 0 ? bytes.slice(0, -1).buffer : bytes.buffer;
    const pcm16 = new Int16Array(bufferToUse);
    const float32 = pcm16ToFloat32(pcm16);
    
    const buffer = audioContextRef.current.createBuffer(1, float32.length, SAMPLE_RATE_OUT);
    buffer.getChannelData(0).set(float32);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserOutRef.current);
    
    const startTime = Math.max(audioContextRef.current.currentTime, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
    
    setIsSpeaking(true);
    source.onended = () => {
      if (audioContextRef.current && audioContextRef.current.currentTime >= nextPlayTimeRef.current - 0.1) {
        setIsSpeaking(false);
      }
    };
  };

  const stopSpeaking = () => {
    setIsSpeaking(false);
    nextPlayTimeRef.current = 0;
  };

  // --- Handlers for Agentic Capabilities ---
  const openWebsite = (url: string) => {
    window.open(url, '_blank');
    return { status: 'success', message: `Opened website: ${url}` };
  };

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isActive) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (liveSessionRef.current) {
        liveSessionRef.current.sendRealtimeInput({
          video: {
            mimeType: file.type,
            data: base64,
          },
        });
        // Explicit text hint
        liveSessionRef.current.sendRealtimeInput({
          text: "User uploaded an image for you to analyze."
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const startScreenShare = async () => {
    try {
      const mediaDevices = navigator.mediaDevices as any;
      if (!mediaDevices || (!mediaDevices.getDisplayMedia && !(navigator as any).getDisplayMedia)) {
        throw new Error('Screen capture is not supported in this browser context. Please try opening the app in a new tab or use a desktop browser.');
      }

      const getDisplayMedia = (mediaDevices.getDisplayMedia 
        ? mediaDevices.getDisplayMedia.bind(mediaDevices) 
        : (navigator as any).getDisplayMedia.bind(navigator));
        
      const stream = await getDisplayMedia({ 
        video: { 
          displaySurface: 'monitor'
        } 
      });
      
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      });

      return { status: 'success', message: 'Screen sharing started.' };
    } catch (err: any) {
      console.error('Screen capture failed', err);
      const msg = err.name === 'NotAllowedError' 
        ? 'Permission denied. Please allow screen sharing.' 
        : (err.message || 'Failed to start screen share.');
      setError(msg);
      return { status: 'error', message: msg };
    }
  };

  const analyzeScreen = async () => {
    try {
      if (!screenStreamRef.current) {
        return { 
          status: 'error', 
          message: 'Screen sharing is not active. Krish, please click the monitor icon at the bottom center to start sharing. I need you to do this before I can see anything!' 
        };
      }

      const track = screenStreamRef.current!.getVideoTracks()[0];
      
      // Fallback for browsers without ImageCapture
      let bitmap;
      if ('ImageCapture' in window) {
        try {
          const imageCapture = new (window as any).ImageCapture(track);
          bitmap = await imageCapture.grabFrame();
        } catch (e) {
          console.warn('ImageCapture failed, falling back to video element', e);
        }
      }
      
      if (!bitmap) {
        // Standard video element fallback
        const video = document.createElement('video');
        video.srcObject = screenStreamRef.current;
        await video.play();
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        if (liveSessionRef.current) {
          liveSessionRef.current.sendRealtimeInput({
            video: {
              mimeType: 'image/jpeg',
              data: data
            }
          });
          // Explicit text hint for the model
          liveSessionRef.current.sendRealtimeInput({
            text: "User's current screen captured. Analyze the visual input above."
          });
        }
        video.pause();
        video.srcObject = null;
        return { status: 'success', message: 'Screen captured and sent to your eyes. Please tell me what you see!' };
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(bitmap, 0, 0);
      const data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      if (liveSessionRef.current) {
        liveSessionRef.current.sendRealtimeInput({
          video: {
            mimeType: 'image/jpeg',
            data: data
          }
        });
        // Explicit text hint
        liveSessionRef.current.sendRealtimeInput({
          text: "User's current screen captured. Analyze the visual input above."
        });
      }
      return { status: 'success', message: 'Screen captured and sent to your eyes. Please tell me what you see!' };
    } catch (err: any) {
      console.error('Screen analysis failed', err);
      return { status: 'error', message: err.message || 'Analysis failed' };
    }
  };

  // --- Live API Management ---
  const startSweety = async () => {
    try {
      setError(null);
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      await initAudio();
      
      const micPermission = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = micPermission;

      const customKey = localStorage.getItem('custom_gemini_api_key');
      const apiKey = (customKey && customKey.trim()) || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsListening(true);
            retryCountRef.current = 0; // Reset on success
            setLastMessageTime(Date.now());
            

            const context = audioContextRef.current!;
            const source = context.createMediaStreamSource(micPermission);
            const processor = context.createScriptProcessor(2048, 1, 1);
            
            processor.onaudioprocess = (e) => {
              if (!session) return;
              const input = e.inputBuffer.getChannelData(0);

              // Simple volume meter
              let sum = 0;
              for (let i = 0; i < input.length; i++) {
                sum += input[i] * input[i];
              }
              setMicLevel(Math.sqrt(sum / input.length));

              // Resample from context rate (likely 24k or 48k) to 16k
              const resampled = resample(input, context.sampleRate, SAMPLE_RATE_IN);
              const pcm16 = float32ToPcm16(resampled);
              const b64 = base64Encode(pcm16);
              
              try {
                session.sendRealtimeInput({
                  audio: { data: b64, mimeType: 'audio/pcm;rate=16000' }
                });
              } catch (err) {
                console.error('Realtime input error:', err);
              }
            };
            
            source.connect(processor);
            processor.connect(context.destination);
            (context as any).sweetyProcessor = processor;
            (context as any).sweetySource = source;
          },
          onmessage: async (message: LiveServerMessage) => {
            setLastMessageTime(Date.now());
            if ((message as any).serverContent?.goAway) {
              console.log('Received GoAway signal. Closing connection gracefully.');
              setError("Session limit reached. Click to restart Sweety!");
              stopSweety();
              return;
            }

            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              playAudioChunk(audioData);
            }

            // Handle Transcription
            const msg = message as any;
            // Model output text
            const modelText = msg.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
            if (modelText) {
              setTranscription(prev => ({ ...prev, sweety: modelText }));
            }
            
            // User input transcription (if enabled)
            // Structure varies by SDK version, checking common paths
            const userText = msg.serverContent?.userTurn?.parts?.find((p: any) => p.text)?.text 
                          || msg.clientContent?.transcription 
                          || msg.serverContent?.transcription?.text;
            if (userText) {
              const prev = transcriptionRef.current;
              if (prev.user.trim() && prev.sweety.trim() && prev.user !== userText) {
                saveTurnToHistory(prev.user, prev.sweety);
              }
              setTranscription(p => ({ ...p, user: userText }));
            }
            
            if (message.serverContent?.interrupted) {
              stopSpeaking();
            }
            
            if (message.toolCall) {
              for (const call of message.toolCall.functionCalls) {
                let result;
                if (call.name === 'openWebsite') {
                  const url = (call.args as any).url;
                  setPendingAction({
                    id: call.id,
                    name: call.name,
                    args: call.args,
                    title: 'EXTERNAL LINK ACCESS',
                    description: `Sweety is requesting permission to open an external website: "${url}".`,
                    onConfirm: () => {
                      openWebsite(url);
                      return { status: 'success', message: `Successfully opened website: ${url}` };
                    }
                  });
                } else if (call.name === 'analyzeScreen') {
                  result = await analyzeScreen();
                } else if (call.name === 'updateAnimationMetadata') {
                  const args = call.args as any;
                  setAnimState(args.state || 'idle');
                  setExpression(args.expression || 'happy');
                  setIsLipSyncEnabled(!!args.lipSync);
                  if (args.imageLink) setCurrentVisual(args.imageLink);
                  result = { status: 'success' };
                } else if (call.name === 'openMiniGame') {
                  const mode = (call.args as any).type as GameType;
                  setPendingAction({
                    id: call.id,
                    name: call.name,
                    args: call.args,
                    title: 'MINI-GAME LAUNCH',
                    description: `Sweety is requesting permission to start the mini-game: "${mode.toUpperCase()}".`,
                    onConfirm: () => {
                      setGameMode(mode);
                      return { status: 'success', message: `Game ${mode} started!` };
                    }
                  });
                } else if (call.name === 'executeDeviceAction') {
                  const args = call.args as any;
                  const action = args.action;
                  if (action === 'call') {
                    setCallState({
                      active: true,
                      contactName: args.contactName || 'Unlabeled Contact',
                      phoneNumber: args.phoneNumber || '1-800-SWEETY-OS',
                      status: 'dialing',
                      duration: 0
                    });
                    addSystemLog(`[CALL] Dialing satellite trunk line to ${args.contactName || 'contact'}...`);
                    result = { status: 'success', message: `Simulated phone call to ${args.contactName} initiated successfully.` };
                  } else if (action === 'message') {
                    setMessageState({
                      active: true,
                      contactName: args.contactName || 'Recipient',
                      messageContent: args.messageContent || 'Blank transmission.',
                      status: 'sending',
                      logs: []
                    });
                    addSystemLog(`[SMS] Encryption gateway queued message dispatch to ${args.contactName}.`);
                    result = { status: 'success', message: `Encrypted SMS transmission payload successfully queued to ${args.contactName}.` };
                  } else if (action === 'open_app') {
                    const app = args.appName;
                    if (['calculator', 'terminal', 'file_browser', 'system_monitor', 'camera'].includes(app)) {
                      setPendingAction({
                        id: call.id,
                        name: call.name,
                        args: call.args,
                        title: 'UTILITY APPLICATION LAUNCH',
                        description: `Sweety is requesting permission to launch the simulated application: "${app.toUpperCase()}".`,
                        onConfirm: () => {
                          setActiveApp(app as any);
                          addSystemLog(`[APP] Launch command accepted for: ${app.toUpperCase()}`);
                          return { status: 'success', message: `Simulated app ${app} is now launched.` };
                        }
                      });
                    } else {
                      result = { status: 'error', message: `Requested app "${app}" is unknown.` };
                    }
                  } else if (action === 'screen_lock') {
                    const lock = args.settingValue !== false;
                    setIsLocked(lock);
                    addSystemLog(`[SYS] Screen lock state altered to: ${lock ? 'LOCKED' : 'UNLOCKED'}`);
                    result = { status: 'success', message: `Screen lock state set to ${lock}.` };
                  } else if (action === 'toggle_setting') {
                    const setting = args.settingName;
                    const val = args.settingValue !== false;
                    if (['wifi', 'bluetooth', 'cellular', 'hotspot', 'gps', 'airplane_mode'].includes(setting)) {
                      setSettingsState(prev => ({ ...prev, [setting]: val }));
                      addSystemLog(`[SYS] Hardware toggle adjusted: ${setting.toUpperCase()} is now ${val ? 'ON' : 'OFF'}`);
                      result = { status: 'success', message: `System hardware ${setting} set to ${val}.` };
                    } else {
                      result = { status: 'error', message: `Hardware setting "${setting}" is unsupported.` };
                    }
                  } else {
                    result = { status: 'error', message: `Action "${action}" is unhandled.` };
                  }
                }
                
                if (result) {
                  session.sendToolResponse({
                    functionResponses: [{
                      name: call.name,
                      id: call.id,
                      response: result
                    }]
                  });
                }
              }
            }
          },
          onclose: (event) => {
            console.log('Session closed', event);
            stopSweety();
          },
          onerror: (err: any) => {
            console.error('Live API Error:', err);
            const msg = (err?.message || String(err)).toLowerCase();
            
            // Auto-reconnect for network issues
            if (msg.includes("network") || msg.includes("fetch") || msg.includes("internal error") || msg.includes("socket") || msg.includes("failed to connect") || msg.includes("unavailable")) {
              stopSweety();
              if (retryCountRef.current < 5) {
                retryCountRef.current++;
                const waitTime = 1500 * retryCountRef.current; 
                
                if (msg.includes("unavailable")) {
                  setError(`Sweety ektu busy ache (Service Unavailable). Reconnecting... (${retryCountRef.current}/5)`);
                } else {
                  setError(`Signal kom ache... reconnect korchi (${retryCountRef.current}/5)`);
                }

                setTimeout(() => {
                  startSweety();
                }, waitTime);
                return;
              }
              setError(msg.includes("unavailable") ? "Sweety ekhon rest nicche (Unavailable). Please refresh or wait a bit." : "Network problem hocche, arekbar button-ta tipe try koro?");
            } else if (msg.includes("quota") || msg.includes("limit")) {
              setError("Amra onek golpo korechi aaj! Limit sesh hoye geche. Kal golpo hobe? (Quota Limit Reached)");
              stopSweety();
            } else if (msg.includes("GoAway") || msg.includes("aborted") || msg.includes("closed")) {
              setError("Session sesh hoye geche. Chalo arekbar start kori!");
              stopSweety();
            } else {
              setError("Oops! Kichu ekta gorbor hoyeche. Retry korte চাও?");
              stopSweety();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Lyra" } },
          },
          systemInstruction: getSystemInstructionWithMemory(),
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'openWebsite',
                  description: 'Open a specific website URL in a new tab.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: { type: Type.STRING, description: 'The absolute URL to open.' }
                    },
                    required: ['url']
                  }
                },
                {
                  name: 'analyzeScreen',
                  description: 'Capture a screenshot of the user\'s current screen and analyze it.',
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: 'updateAnimationMetadata',
                  description: 'Update the visual animation state of Sweety.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      state: { type: Type.STRING, enum: ['idle', 'listening', 'speaking'], description: 'The current state of interaction.' },
                      expression: { type: Type.STRING, enum: ['happy', 'sad', 'heartbroken', 'excited', 'caring', 'sassy', 'surprised', 'embarrassed', 'confused', 'thinking'], description: 'The emotional expression.' },
                      lipSync: { type: Type.BOOLEAN, description: 'Whether mouth movement should be enabled.' },
                      imageLink: { type: Type.STRING, description: 'The specific URL to display for this event.' }
                    },
                    required: ['state', 'expression', 'lipSync', 'imageLink']
                  }
                },
                {
                  name: 'openMiniGame',
                  description: 'Start a mini-game challenge with the user.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, enum: ['ludo', 'none'], description: 'The type of game to start.' }
                    },
                    required: ['type']
                  }
                },
                {
                  name: 'executeDeviceAction',
                  description: 'Execute simulated device actions like phone call, message dispatch, opening internal apps, lock or unlock system, and hardware setting toggles.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: { type: Type.STRING, enum: ['call', 'message', 'open_app', 'screen_lock', 'toggle_setting'], description: 'The type of system command.' },
                      contactName: { type: Type.STRING, description: 'Optional name of the contact.' },
                      phoneNumber: { type: Type.STRING, description: 'Optional phone number to call.' },
                      messageContent: { type: Type.STRING, description: 'Optional content of the message.' },
                      appName: { type: Type.STRING, enum: ['calculator', 'terminal', 'file_browser', 'system_monitor', 'camera'], description: 'Simulated utility app to boot up.' },
                      settingName: { type: Type.STRING, enum: ['wifi', 'bluetooth', 'cellular', 'hotspot', 'gps', 'airplane_mode'], description: 'Hardware sub-carrier key.' },
                      settingValue: { type: Type.BOOLEAN, description: 'Boolean state to assign.' }
                    },
                    required: ['action']
                  }
                }
              ]
            }
          ]
        }
      });
      
      liveSessionRef.current = session;
    } catch (err: any) {
      console.error('Failed to start Sweety:', err);
      const msg = (err?.message || String(err)).toLowerCase();
      if (msg.includes("permission denied") || msg.includes("notallowederror")) {
        setError("Microphone access denied! Please enable mic in browser settings and try again.");
        stopSweety();
      } else if (msg.includes("unavailable") || msg.includes("network") || msg.includes("fetch")) {
        if (retryCountRef.current < 5) {
          retryCountRef.current++;
          setError(`Sweety-r sathe jogajog kora hocche... (${retryCountRef.current}/5)`);
          setTimeout(startSweety, 2000 * retryCountRef.current);
        } else {
          setError("Sweety busy ache ba network-er somossa. Ektu pore arekbar try koro.");
          stopSweety();
        }
      } else {
        setError("Mic connection-e somossa hocche. Key-ta check korbe?");
        stopSweety();
      }
    }
  };

  const stopSweety = () => {
    setIsActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setPendingAction(null);

    // Save any pending completed conversation turn
    const prev = transcriptionRef.current;
    if (prev.user.trim() && prev.sweety.trim()) {
      saveTurnToHistory(prev.user, prev.sweety);
    }
    
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    
    if (audioContextRef.current) {
      const context = audioContextRef.current as any;
      if (context.sweetyProcessor) {
        try {
          context.sweetyProcessor.disconnect();
          context.sweetyProcessor.onaudioprocess = null;
        } catch (e) {
          console.log('Processor cleanup err:', e);
        }
        context.sweetyProcessor = null;
      }
      if (context.sweetySource) {
        try {
          context.sweetySource.disconnect();
        } catch (e) {
          console.log('Source cleanup err:', e);
        }
        context.sweetySource = null;
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    
    // Clear audio queue
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
  };

  const toggleSweety = () => {
    if (isActive) {
      stopSweety();
    } else {
      startSweety();
    }
  };

  if (isAuthChecking) {
    return (
      <div className="fixed inset-0 bg-[#030303] flex flex-col items-center justify-center p-4 font-mono text-xs text-[#00FF41] overflow-hidden select-none">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <MatrixRain />
        </div>
        <div className="w-full max-w-xs p-6 border border-[#00FF41]/20 bg-black/90 flex flex-col items-center gap-4 text-center rounded relative">
          <div className="w-8 h-8 border-2 border-t-[#00FF41] border-[#00FF41]/10 rounded-full animate-spin mb-1" />
          <div className="text-[10px] uppercase tracking-widest text-[#00FF41] font-bold animate-pulse">
            [ SWEE_SEC_GATEWAY ]
          </div>
          <div className="text-[8px] text-gray-400 tracking-wider font-mono">
            RESOLVING AUTHENTICATION SIGNATURE...
          </div>
        </div>
      </div>
    );
  }

  if (!isAppUnlocked) {
    return (
      <DeveloperLockscreen 
        theme={theme}
        currentUser={currentUser}
        onUnlock={(isDev) => {
          if (isDev) {
            setIsDevUnlocked(true);
          }
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center overflow-hidden font-sans text-white">

      {/* Security Authorization Alert Modal */}
      <AnimatePresence>
        {pendingAction && (
          <motion.div
            key="security-permission-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4 font-mono text-xs backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-black border p-6 shadow-2xl matrix-border"
              style={{ borderColor: theme.primary }}
            >
              {/* Retro Header Accent */}
              <div 
                className="flex items-center gap-2 mb-4 pb-2 border-b uppercase font-bold tracking-widest text-[10px]"
                style={{ color: theme.primary, borderColor: `${theme.primary}33` }}
              >
                <div 
                  className="w-2 h-2 animate-ping"
                  style={{ backgroundColor: theme.primary }}
                />
                <span>Security Authorization Alert</span>
              </div>

              {/* Sub-header / Title */}
              <div className="text-white font-bold text-sm mb-3 uppercase tracking-wider">
                {pendingAction.title}
              </div>

              {/* Description */}
              <p className="text-gray-400 mb-6 leading-relaxed text-[11px]">
                {pendingAction.description}
              </p>

              {/* Warning label */}
              <div 
                className="p-3 bg-red-950/20 border text-[10px] uppercase mb-6 leading-relaxed"
                style={{ borderColor: `${theme.primary}44`, color: theme.secondary }}
              >
                🚨 Warning: This action requires your explicit permission. Do you grant Sweety permission to proceed?
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 font-bold text-[11px]">
                <button
                  onClick={() => {
                    const result = { status: 'error', message: 'User denied permission to open the app.' };
                    if (liveSessionRef.current) {
                      try {
                        liveSessionRef.current.sendToolResponse({
                          functionResponses: [{
                            name: pendingAction.name,
                            id: pendingAction.id,
                            response: result
                          }]
                        });
                      } catch (err) {
                        console.error('Failed to send tool response:', err);
                      }
                    }
                    addSystemLog(`[SECURITY] Access request DENIED for: ${pendingAction.name}`);
                    setPendingAction(null);
                  }}
                  className="px-4 py-2 border uppercase cursor-pointer hover:bg-red-500/10 transition-all"
                  style={{ borderColor: theme.primary, color: theme.primary }}
                >
                  [ DENY ]
                </button>

                <button
                  onClick={() => {
                    const result = pendingAction.onConfirm() || { status: 'success' };
                    if (liveSessionRef.current) {
                      try {
                        liveSessionRef.current.sendToolResponse({
                          functionResponses: [{
                            name: pendingAction.name,
                            id: pendingAction.id,
                            response: result
                          }]
                        });
                      } catch (err) {
                        console.error('Failed to send tool response:', err);
                      }
                    }
                    addSystemLog(`[SECURITY] Access request ALLOWED for: ${pendingAction.name}`);
                    setPendingAction(null);
                  }}
                  className="px-4 py-2 border uppercase cursor-pointer transition-all hover:shadow-[0_0_15px_rgba(0,255,65,0.4)]"
                  style={{ 
                    backgroundColor: theme.primary, 
                    borderColor: theme.primary, 
                    color: '#000000'
                  }}
                >
                  [ ALLOW ]
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sweety's Memory Journal (Smriti-Shokti Bank) */}
      <AnimatePresence>
        {showMemoryJournal && (
          <motion.div
            key="sweety-memory-journal-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black/90 flex items-center justify-center p-4 font-mono text-xs backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-[#050505] border p-6 shadow-2xl matrix-border flex flex-col max-h-[85vh]"
              style={{ borderColor: theme.primary }}
            >
              {/* Retro Header */}
              <div 
                className="flex items-center justify-between gap-2 mb-4 pb-2 border-b uppercase font-bold tracking-widest text-[11px]"
                style={{ color: theme.primary, borderColor: `${theme.primary}33` }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <span>SWEETY'S MEMORY BANK / স্মৃতি-শক্তি</span>
                </div>
                <button 
                  onClick={() => setShowMemoryJournal(false)}
                  className="hover:opacity-80 p-1 cursor-pointer transition-opacity text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Memory description */}
              <p className="text-[10px] text-gray-400 mb-4 leading-relaxed font-sans">
                Just like ChatGPT or MetaAI, Sweety saves and remembers your conversation history across sessions.
                This is synced securely to your cloud partition so she can always build on your relationship.
              </p>

              {/* Chat turns scrollarea */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-[11px] mb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {chatHistory.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                    <span className="text-2xl animate-pulse">🥺</span>
                    <p className="max-w-xs leading-relaxed font-sans text-[11px]">
                      Ajo amra beshi golpo korini, Krish! Sweety'r sathe kotha bolo, shey tomar shob kotha ekhane mone rakhbe...
                    </p>
                  </div>
                ) : (
                  chatHistory.map((item, index) => {
                    const isUser = item.role === 'user';
                    const timeStr = item.timestamp 
                      ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : '';
                    return (
                      <div 
                        key={index}
                        className={`flex flex-col max-w-[85%] ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <div 
                          className="flex items-center gap-1.5 mb-1 text-[9px] uppercase tracking-wider font-bold"
                          style={{ color: isUser ? theme.secondary : theme.primary }}
                        >
                          <span>{isUser ? 'Krish' : 'Sweety'}</span>
                          {timeStr && <span className="opacity-40 font-normal">({timeStr})</span>}
                        </div>
                        <div 
                          className="p-3 border text-white font-sans leading-relaxed text-[11px]"
                          style={{ 
                            backgroundColor: isUser ? `${theme.secondary}11` : `${theme.primary}11`,
                            borderColor: isUser ? `${theme.secondary}33` : `${theme.primary}33`,
                            borderRadius: isUser ? '8px 0px 8px 8px' : '0px 8px 8px 8px'
                          }}
                        >
                          {item.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Actions footer */}
              <div className="flex justify-between items-center pt-2 border-t text-[10px]" style={{ borderColor: `${theme.primary}33` }}>
                <span className="opacity-50 font-sans">
                  Total Saved Turns: {chatHistory.length}
                </span>

                <div className="flex gap-2">
                  {chatHistory.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to clear Sweety's memories of your talks? She won't remember you anymore!")) {
                          setChatHistory([]);
                          localStorage.removeItem('sweety_chat_history');
                          const currentUser = auth.currentUser;
                          if (currentUser) {
                            const userDocRef = doc(db, 'users', currentUser.uid);
                            setDoc(userDocRef, {
                              chatHistory: []
                            }, { merge: true }).catch(err => {
                              console.error('Error clearing chat history:', err);
                            });
                          }
                          addSystemLog(`[MEMORY] All conversation logs wiped. Memory reset completed.`);
                        }
                      }}
                      className="px-3 py-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors uppercase font-bold cursor-pointer"
                    >
                      [ WIPE MEMORIES ]
                    </button>
                  )}
                  <button
                    onClick={() => setShowMemoryJournal(false)}
                    className="px-4 py-1.5 border transition-colors uppercase font-bold cursor-pointer"
                    style={{ 
                      backgroundColor: theme.primary, 
                      borderColor: theme.primary, 
                      color: '#000000'
                    }}
                  >
                    [ CLOSE ]
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Developer Panel / Stats Modal */}
      <AnimatePresence>
        {showDeveloperPanel && (
          <DeveloperStatsModal
            isOpen={showDeveloperPanel}
            onClose={() => setShowDeveloperPanel(false)}
            theme={theme}
            addSystemLog={addSystemLog}
          />
        )}
      </AnimatePresence>

      {/* Debug Info Overlay */}
      <AnimatePresence>
        {showDebug && (
          <motion.div 
            key="debug-overlay"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed top-12 left-4 z-[99] bg-black/95 p-4 border w-64 text-[10px] space-y-2 pointer-events-none matrix-border"
            style={{ borderColor: theme.primary }}
          >
            <div className="uppercase tracking-widest font-bold border-b pb-1 font-mono" style={{ color: theme.primary, borderColor: `${theme.primary}44` }}>Debug Info</div>
            <div style={{ color: theme.secondary }}><span className="opacity-70 font-mono">Status:</span> {isActive ? 'Live' : 'Paused'}</div>
            <div style={{ color: theme.secondary }}><span className="opacity-70 font-mono">Mic Level:</span> <div className="inline-block w-20 h-1 bg-black border rounded-none overflow-hidden" style={{ borderColor: `${theme.primary}33` }}><div className="h-full" style={{ width: `${Math.min(100, micLevel * 500)}%`, backgroundColor: theme.primary }}></div></div></div>
            <div style={{ color: theme.secondary }}><span className="opacity-70 font-mono">Retry Count:</span> {retryCountRef.current}</div>
            <div style={{ color: theme.secondary }}><span className="opacity-70 font-mono">User:</span> <span className="font-mono">{transcription.user || '...'}</span></div>
            <div style={{ color: theme.secondary }}><span className="opacity-70 font-mono">Sweety:</span> <span className="font-mono">{transcription.sweety || '...'}</span></div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Soft Background Grid */}
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: `linear-gradient(${theme.primary}10 1px,transparent_1px),linear-gradient(90deg,${theme.primary}10 1px,transparent_1px)`, backgroundSize: '40px 40px' }} />
        {/* Matrix Code Rain Adaptation */}
        <MatrixRain color={theme.primary} />
      </div>
      
      {/* Header HUD */}
      <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start z-50 pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <motion.div 
              animate={isActive ? { scale: [1, 1.4, 1], opacity: [1, 0.4, 1] } : { opacity: 0.3 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2.5 h-2.5 force-circular"
              style={{ backgroundColor: theme.primary, boxShadow: `0 0 10px ${theme.primary}` }}
            />
            <h1 
              className="text-xl font-bold tracking-[6px] uppercase font-mono typing-cursor matrix-text-glow"
              style={{ color: theme.primary }}
            >
              SWEETY
            </h1>
          </div>
          <div className="flex gap-4 text-[9px] uppercase tracking-[3px] font-mono font-bold" style={{ color: `${theme.primary}CC` }}>
            <span>CORE_OS_V3.2</span>
            <span>|</span>
            <span>{isActive ? (isListening ? 'Awaiting Audio' : 'Processing') : 'LOCKED'}</span>
            {currentUser && (
              <>
                <span>|</span>
                <span style={{ color: currentUser.email?.toLowerCase() === 'krishanumajeeff@gmail.com' ? '#FBBF24' : '#10B981' }}>
                  OPERATOR: {currentUser.email?.toLowerCase() === 'krishanumajeeff@gmail.com' ? 'DEVELOPER' : 'USER'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Triple Dot Options Menu */}
        <div className="relative pointer-events-auto flex items-center gap-3 z-50">
          <motion.button
            onClick={() => setShowMenu(!showMenu)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 border flex items-center justify-center bg-black/90 cursor-pointer transition-all text-white matrix-border matrix-border-hover"
            style={{ borderColor: theme.primary, color: theme.primary }}
            title="Options Menu"
          >
            <MoreVertical size={18} />
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                key="options-menu"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-12 z-[100] bg-black border p-4 w-52 shadow-2xl flex flex-col gap-3 matrix-border"
                style={{ borderColor: theme.primary }}
              >
                <div>
                  <div className="text-[9px] uppercase tracking-widest font-mono mb-2 font-bold" style={{ color: theme.primary }}>Phosphor Type</div>
                  <div className="flex gap-2.5">
                    {Object.entries(THEMES).map(([id, t]) => (
                      <motion.button
                        key={id}
                        onClick={() => {
                          setCurrentTheme(id as any);
                        }}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        className={`w-6 h-6 border transition-all cursor-pointer ${
                          currentTheme === id ? 'border-white scale-110 shadow-[0_0_10px_rgba(0,255,65,0.6)]' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: t.primary, borderColor: theme.primary }}
                        title={t.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="h-px bg-white/10 my-1" style={{ backgroundColor: `${theme.primary}33` }} />

                <div className="px-2 py-1 flex flex-col gap-1.5">
                  <div className="text-[9px] uppercase tracking-widest font-mono font-bold" style={{ color: theme.primary }}>Assistant Avatar</div>
                  <label className="w-full flex items-center justify-between text-[10px] uppercase font-mono py-1 px-1 border border-dashed transition-colors text-left font-bold cursor-pointer hover:bg-white/5" style={{ borderColor: `${theme.primary}33`, color: theme.secondary }}>
                    <span>📤 Upload Photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const base64 = event.target?.result as string;
                            setCustomAvatarUrl(base64);
                            addSystemLog(`[SYSTEM] Custom assistant avatar loaded. Sync active.`);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {customAvatarUrl && (
                    <button
                      onClick={() => {
                        setCustomAvatarUrl(null);
                        addSystemLog(`[SYSTEM] Reset assistant avatar to default.`);
                      }}
                      className="text-left text-[9px] uppercase font-mono py-0.5 font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                    >
                      ↺ Reset Avatar
                    </button>
                  )}
                </div>

                <div className="h-px bg-white/10 my-1" style={{ backgroundColor: `${theme.primary}33` }} />

                <button
                  onClick={() => {
                    setShowDebug(!showDebug);
                  }}
                  className="w-full flex items-center justify-between text-[10px] uppercase font-mono py-1.5 px-2 transition-colors text-left font-bold"
                  style={{ color: theme.primary }}
                >
                  <span>System Logs</span>
                  <span className={`text-[9px] px-1.5 py-0.5 border ${showDebug ? 'bg-green-500/10 text-[#00FF41]' : 'opacity-40'}`} style={{ borderColor: theme.primary }}>
                    {showDebug ? 'ON' : 'OFF'}
                  </span>
                </button>

                <div className="h-px bg-white/10 my-1" style={{ backgroundColor: `${theme.primary}33` }} />

                <div className="px-2 py-1 flex flex-col gap-1">
                  <div className="text-[9px] uppercase tracking-widest font-mono font-bold" style={{ color: theme.primary }}>Sweety Memory</div>
                  <div className="flex justify-between items-center text-[10px] font-mono py-1">
                    <span className="opacity-60">MEMORIES:</span>
                    <span className="font-bold text-[#00FF41]" style={{ color: theme.primary }}>{chatHistory.length} TURNS</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowMemoryJournal(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-center border text-[9px] uppercase font-mono py-1 font-bold mb-1 transition-all cursor-pointer hover:bg-white/5"
                    style={{ borderColor: theme.primary, color: theme.primary }}
                  >
                    [ VIEW MEMORY JOURNAL ]
                  </button>
                  {chatHistory.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to clear Sweety's memories of your talks? She won't remember you anymore!")) {
                          setChatHistory([]);
                          localStorage.removeItem('sweety_chat_history');
                          const currentUser = auth.currentUser;
                          if (currentUser) {
                            const userDocRef = doc(db, 'users', currentUser.uid);
                            setDoc(userDocRef, {
                              chatHistory: []
                            }, { merge: true }).catch(err => {
                              console.error('Error clearing chat history:', err);
                            });
                          }
                          addSystemLog(`[MEMORY] All conversation logs wiped. Memory reset completed.`);
                        }
                      }}
                      className="w-full text-center border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[9px] uppercase font-mono py-1 font-bold transition-all cursor-pointer"
                    >
                      [ WIPE MEMORIES ]
                    </button>
                  )}
                </div>

                <div className="h-px bg-white/10 my-1" style={{ backgroundColor: `${theme.primary}33` }} />

                <button
                  onClick={() => {
                    setShowAuthModal(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center justify-between text-[10px] uppercase font-mono py-1.5 px-2 transition-colors text-left font-bold border border-transparent hover:border-white/10"
                  style={{ color: theme.secondary }}
                >
                  <span className="flex items-center gap-1.5">
                    <Shield size={11} className="animate-pulse" />
                    <span>Cloud Sync</span>
                  </span>
                  <span className="text-[8px] opacity-60">AUTH</span>
                </button>

                {isUnlocked && (
                  <>
                    <div className="h-px bg-white/10 my-1" style={{ backgroundColor: `${theme.primary}33` }} />
                    <button
                      onClick={() => {
                        setShowDeveloperPanel(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center justify-between text-[10px] uppercase font-mono py-1.5 px-2 transition-colors text-left font-bold border border-amber-500/30 bg-amber-950/10 text-amber-400 hover:bg-amber-950/20"
                    >
                      <span className="flex items-center gap-1.5">
                        <Monitor size={11} className="animate-pulse" />
                        <span>Developer Stats</span>
                      </span>
                      <span className="text-[8px] opacity-60 font-extrabold">ADMIN</span>
                    </button>
                  </>
                )}

                <div className="h-px bg-white/10 my-1" style={{ backgroundColor: `${theme.primary}33` }} />

                <button
                  onClick={async () => {
                    setIsDevUnlocked(false);
                    localStorage.removeItem('sweety_dev_unlocked');
                    setShowMenu(false);
                    addSystemLog(`[SECURITY] Manual lock protocol engaged. Active session terminated.`);
                    try {
                      await signOut(auth);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full flex items-center justify-between text-[10px] uppercase font-mono py-1.5 px-2 transition-colors text-left font-bold border border-red-500/30 bg-red-950/10 text-red-400 hover:bg-red-950/20"
                >
                  <span className="flex items-center gap-1.5">
                    <Lock size={11} />
                    <span>Lock System</span>
                  </span>
                  <span className="text-[8px] opacity-60">SECURE</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MiniGames Overlay */}
      <MiniGames 
        gameType={gameMode} 
        onClose={() => setGameMode('none')} 
        theme={theme}
        onGameEvent={(event, score) => {
          if (liveSessionRef.current) {
            liveSessionRef.current.sendRealtimeInput({
              text: `Krish triggered game event: ${event}. Current Game Score: ${score}. Respond to his progress!`
            });
          }
        }}
      />

      {/* Main Visual Container */}
      <div className="absolute inset-0 flex justify-center items-center z-10 pointer-events-none">
          {/* Character Container - Static for higher quality focus */}
          <motion.div 
            className="relative h-full flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: expression === 'heartbroken' ? 0.85 : 1,
              x: expression === 'heartbroken' ? [0, -4, 4, -4, 4, 0] : 0,
              y: expression === 'heartbroken' ? [0, 3, 0, 3, 0] : [0, -8, 0],
              scale: (isSpeaking && currentVisual !== ANIME_GIRL_NORMAL) ? [1, 1.015, 0.99, 1.01, 1] : 1,
              filter: expression === 'heartbroken' ? 'brightness(0.7) contrast(1.1)' : 'brightness(1) contrast(1)'
            }}
            transition={{
              x: { duration: 0.3, repeat: expression === 'heartbroken' ? Infinity : 0 },
              y: expression === 'heartbroken' 
                ? { duration: 0.2, repeat: Infinity } 
                : { duration: 4, repeat: Infinity, ease: "easeInOut" },
              scale: (isSpeaking && currentVisual !== ANIME_GIRL_NORMAL)
                ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 },
              opacity: { duration: 0.5 },
              filter: { duration: 0.5 }
            }}
          >
            {/* Soft Ambient Glow */}
            <div className="absolute inset-x-0 top-1/4 bottom-1/4 blur-[120px] rounded-full z-0" style={{ backgroundColor: theme.bgGlow }} />

            {/* Ambient Cherry Blossom Rain */}
            <CherryBlossomRain />

            {/* Base Image (Sweety Visual) */}
            <motion.img 
              key={customAvatarUrl || currentVisual}
              src={customAvatarUrl || currentVisual || DEFAULT_VISUAL} 
              onError={() => {
                if (customAvatarUrl) {
                  setCustomAvatarUrl(null);
                  addSystemLog("[SYSTEM_ERROR] Failed to load custom avatar. Falling back to default.");
                } else {
                  setCurrentVisual(DEFAULT_VISUAL);
                }
              }}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ 
                opacity: 1,
                scale: 1,
                // Add an elegant pulsing glow animation on the avatar border
                filter: [
                  `drop-shadow(0 0 25px ${theme.primary}) drop-shadow(0 0 10px ${theme.secondary})`,
                  `drop-shadow(0 0 35px ${theme.primary}) drop-shadow(0 0 15px ${theme.secondary})`,
                  `drop-shadow(0 0 25px ${theme.primary}) drop-shadow(0 0 10px ${theme.secondary})`
                ]
              }}
              transition={{ 
                opacity: { duration: 0.6, ease: "easeOut" },
                scale: { duration: 0.6, ease: "easeOut" },
                filter: { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }}
              alt="Sweety Visual" 
              className="h-full w-auto object-contain relative z-10"
              referrerPolicy="no-referrer"
            />

            {/* Mouth Open Overlay (Only for normal base to avoid alignment issues) */}
            {currentVisual === ANIME_GIRL_NORMAL && (
              <motion.img 
                src={ANIME_GIRL_MOUTH_OPEN}
                alt="Sweety Talking"
                animate={{ 
                  opacity: (isSpeaking && isLipSyncEnabled) ? Math.min(1, outputLevel * 8) : 0,
                }}
                className="absolute inset-0 h-full w-auto object-contain z-20 pointer-events-none"
                referrerPolicy="no-referrer"
              />
            )}

            {/* Eyes Closed/Blink Overlay (Only for normal base to avoid alignment issues) */}
            {currentVisual === ANIME_GIRL_NORMAL && (
              <motion.img 
                src={ANIME_GIRL_EYES_CLOSED}
                alt="Sweety Blink"
                animate={{ 
                  opacity: (isBlinking || expression === 'sad' || expression === 'heartbroken') ? 1 : 0
                }}
                transition={{ duration: (expression === 'sad' || expression === 'heartbroken') ? 0.4 : 0.05 }}
                className="absolute inset-0 h-full w-auto object-contain z-30 pointer-events-none"
                referrerPolicy="no-referrer"
              />
            )}

            {/* Expression Overlays (Subtle Glows) */}
            <AnimatePresence>
              {expression === 'thinking' && (
                <motion.div 
                  key="exp-thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-0 pointer-events-none"
                >
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 0.3 }} 
                    exit={{ opacity: 0 }} 
                    className="absolute top-1/4 left-1/4 w-[50%] h-[50%] bg-indigo-500/20 blur-[80px] rounded-full z-0 p-4"
                  >
                    <motion.div 
                      key="thinking-spin"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-full h-full border-2 border-dashed border-indigo-400/30 rounded-full"
                    />
                  </motion.div>
                  <motion.div 
                    key="thinking-aura"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: [0.05, 0.15, 0.05] }} 
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-white/10 blur-[120px] z-5" 
                  />
                </motion.div>
              )}
              {expression === 'happy' && (
                <motion.div 
                  key="exp-happy"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-0 pointer-events-none"
                >
                  <motion.div key="happy-blush-l" initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} exit={{ opacity: 0 }} className="absolute top-[52%] left-[30%] w-[12%] h-[6%] bg-red-400/20 blur-[20px] rounded-full z-40" />
                  <motion.div key="happy-blush-r" initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} exit={{ opacity: 0 }} className="absolute top-[52%] left-[58%] w-[12%] h-[6%] bg-red-400/20 blur-[20px] rounded-full z-40" />
                </motion.div>
              )}
              {(expression === 'sad' || expression === 'heartbroken') && (
                <motion.div 
                  key="exp-sad-hb"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-0 pointer-events-none"
                >
                  <motion.div 
                    key="sad-bg"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: [0.2, expression === 'heartbroken' ? 0.8 : 0.4, 0.2] }} 
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className={`absolute inset-0 ${expression === 'heartbroken' ? 'bg-indigo-950/60' : 'bg-blue-500/20'} blur-[120px] z-5`} 
                  />
                  {expression === 'heartbroken' && (
                    <div key="hb-vignette" className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
                      <div className="absolute inset-0 bg-radial-gradient from-transparent via-indigo-900/10 to-indigo-950/40" />
                    </div>
                  )}
                </motion.div>
              )}
              {expression === 'excited' && (
                <motion.div 
                  key="exp-excited"
                  initial={{ opacity: 0 }} 
                  animate={{ scale: [1, 1.1, 1], opacity: 0.15 }} 
                  className="absolute inset-0 bg-yellow-400/10 blur-[80px] z-5" 
                />
              )}
              {expression === 'embarrassed' && (
                <motion.div 
                  key="exp-embarrassed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-0 pointer-events-none"
                >
                  <motion.div key="emb-blush-l" initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} className="absolute top-[52%] left-[32%] w-[10%] h-[5%] bg-red-600/30 blur-[25px] rounded-full z-40" />
                  <motion.div key="emb-blush-r" initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} className="absolute top-[52%] left-[58%] w-[10%] h-[5%] bg-red-600/30 blur-[25px] rounded-full z-40" />
                </motion.div>
              )}
              {expression === 'surprised' && (
                <motion.div 
                  key="exp-surprised"
                  initial={{ opacity: 0, scale: 0.8 }} 
                  animate={{ opacity: 0.1, scale: 1.5 }} 
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/20 blur-[100px] z-5" 
                />
              )}
              {expression === 'confused' && (
                <motion.div 
                  key="exp-confused"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: [0.1, 0.2, 0.1] }} 
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-indigo-500/10 blur-[100px] z-5" 
                />
              )}
            </AnimatePresence>
          </motion.div>
      </div>

      {/* Bottom HUD */}
      <div className="absolute bottom-0 left-0 right-0 h-60 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center justify-end pb-12 z-40">
        
        {/* Waveform Visualization */}
        <div className="flex items-center gap-1.5 h-[60px] mb-8">
          <AnimatePresence mode="wait">
            {isSpeaking ? (
              <motion.div 
                key="speaking-container"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 h-full"
              >
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={`speaking-${i}`}
                    initial={{ height: 4 }}
                    animate={{ 
                      height: [
                        Math.random() * 20 + 10, 
                        Math.random() * 40 + 20, 
                        Math.random() * 15 + 5
                      ],
                      opacity: [0.3, 0.8, 0.5]
                    }}
                    transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.03 }}
                    className={`w-1 rounded-none ${i % 3 === 0 ? 'opacity-80' : 'opacity-50'}`}
                    style={{ 
                      backgroundColor: i % 3 === 0 ? theme.secondary : theme.primary,
                      boxShadow: i % 3 === 0 ? `0 0 10px ${theme.primary}` : 'none'
                    }}
                  />
                ))}
              </motion.div>
            ) : isListening ? (
              <motion.div 
                key="listening-container"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 h-full"
              >
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={`listening-${i}`}
                    animate={{ 
                      height: Math.max(4, micLevel * 200 * (1 + Math.random())),
                      opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 0.1 }}
                    className="w-1 rounded-none"
                    style={{ backgroundColor: theme.primary }}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="visualizer-static" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 0.2 }} 
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 h-full"
              >
                {[20, 40, 55, 35, 50, 35, 25, 20].map((h, i) => (
                  <div key={`static-${i}`} className="w-1 rounded-none" style={{ height: `${h * 0.4}px`, backgroundColor: theme.primary }} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls Container */}
        <div className="flex items-center gap-6 relative z-50">
          {/* Mic Button / Trigger */}
          <div className="relative flex items-center justify-center">
            {/* Pulsing waves emanating outwards based on micLevel and active state */}
            {isActive && [0, 1, 2].map((index) => (
              <motion.div
                key={`wave-${index}`}
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{
                  opacity: 0,
                  scale: [1, 2.2 + micLevel * 2.5],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.0,
                  delay: index * 0.65,
                  ease: "easeOut",
                }}
                className="absolute w-[86px] h-[86px] force-circular border"
                style={{
                  borderColor: isListening 
                    ? 'rgba(16, 185, 129, 0.4)' 
                    : isSpeaking 
                      ? 'rgba(244, 63, 94, 0.4)' 
                      : 'rgba(139, 92, 246, 0.4)',
                  boxShadow: `0 0 20px ${
                    isListening 
                      ? 'rgba(16, 185, 129, 0.25)' 
                      : isSpeaking 
                        ? 'rgba(244, 63, 94, 0.25)' 
                        : 'rgba(139, 92, 246, 0.25)'
                  }`
                }}
              />
            ))}

            {/* Rotating Colorful Gradient Ring Background */}
            <motion.div
              animate={{ rotate: isActive ? 360 : 0 }}
              transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
              className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-cyan-400 via-pink-500 to-amber-400 blur-sm opacity-80"
              style={{
                opacity: isActive ? 0.95 : 0.4,
              }}
            />

            {/* Main Interactive Button */}
            <motion.button
              onClick={toggleSweety}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="relative w-[86px] h-[86px] force-circular bg-black flex items-center justify-center cursor-pointer overflow-hidden z-10 transition-colors duration-500"
              style={{ 
                border: `2px solid ${isActive ? 'transparent' : theme.primary}`,
                boxShadow: isActive 
                  ? `0 0 35px ${
                      isListening 
                        ? 'rgba(16, 185, 129, 0.8)' 
                        : isSpeaking 
                          ? 'rgba(244, 63, 94, 0.8)' 
                          : 'rgba(139, 92, 246, 0.8)'
                    }`
                  : `0 0 15px ${theme.glow}`
              }}
            >
              {/* Inner glowing core with dynamic gradient background depending on status */}
              <div 
                className={`
                  absolute inset-[3px] force-circular flex items-center justify-center transition-all duration-700
                  ${
                    !isActive 
                      ? 'bg-gradient-to-tr from-slate-950 via-neutral-900 to-zinc-800' 
                      : isListening 
                        ? 'bg-gradient-to-tr from-teal-500 via-emerald-500 to-green-400' 
                        : isSpeaking 
                          ? 'bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500' 
                          : 'bg-gradient-to-tr from-indigo-500 via-purple-600 to-violet-500'
                  }
                `}
              >
                {/* Visualizer bars overlay inside button when active */}
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-25">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <motion.div
                        key={`bar-${val}`}
                        animate={{
                          height: isListening 
                            ? [8, 24 + micLevel * 40, 8] 
                            : isSpeaking 
                              ? [12, 36, 12] 
                              : [6, 12, 6],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8 + val * 0.1,
                          ease: "easeInOut",
                        }}
                        className="w-[3px] bg-white rounded-full"
                      />
                    ))}
                  </div>
                )}

                {/* Central Icon */}
                <div className="relative z-20 text-white">
                  {isActive ? (
                    <motion.div
                      animate={{
                        scale: isListening ? [1, 1.15, 1] : 1,
                      }}
                      transition={{
                        repeat: isListening ? Infinity : 0,
                        duration: 1.2,
                        ease: "easeInOut"
                      }}
                    >
                      <Mic size={28} className="drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
                    </motion.div>
                  ) : (
                    <MicOff size={28} className="text-zinc-400 drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]" />
                  )}
                </div>
              </div>
            </motion.button>
            
            {isActive && (
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-[100] whitespace-nowrap">
                <span className="text-[10px] tracking-[2px] uppercase font-mono font-bold matrix-blink text-center" style={{ color: theme.primary }}>
                  {isListening ? "ACCESSING MICROPHONE..." : "PROCESSING AUDIO..."}
                </span>
                <span className="text-[8px] text-center font-mono uppercase tracking-[2px]" style={{ color: `${theme.primary}80` }}>
                  Tap to Interrupt
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Status/Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div 
            key="status-error-overlay"
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[100] w-[90%] max-w-sm"
          >
            <div className="bg-red-950/90 border border-red-500/40 p-4 rounded-none flex flex-col items-center gap-3 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500/30 overflow-hidden">
                <motion.div 
                  className="h-full bg-red-500"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              </div>
              
              <p className="text-red-400 text-xs font-mono font-medium text-center leading-relaxed">
                {error}
              </p>
              
              <button 
                onClick={() => { stopSweety(); setTimeout(startSweety, 300); }}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 px-6 py-2 rounded-none text-[10px] font-bold uppercase tracking-[2px] transition-all active:scale-95 text-red-400 font-mono"
              >
                Reset Connection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Cloud Sync operator auth modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div 
            key="auth-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-[320px] bg-black/95 border p-5 shadow-2xl relative flex flex-col gap-4 matrix-border"
              style={{ borderColor: theme.primary }}
            >
              {/* Scanlines inside the modal */}
              <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-5" />
              
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-3 right-3 p-1.5 border hover:bg-white/5 active:bg-white/10 cursor-pointer"
                style={{ borderColor: `${theme.primary}22`, color: theme.primary }}
              >
                <X size={12} />
              </button>

              <FirebaseAuth
                theme={theme}
                currentTheme={currentTheme}
                setCurrentTheme={setCurrentTheme}
                settingsState={settingsState}
                setSettingsState={setSettingsState}
                systemLogs={systemLogs}
                setSystemLogs={setSystemLogs}
                messageState={messageState}
                setMessageState={setMessageState}
                addSystemLog={addSystemLog}
                onClose={() => setShowAuthModal(false)}
                customAvatarUrl={customAvatarUrl}
                setCustomAvatarUrl={setCustomAvatarUrl}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Device and Hardware Settings Simulator Modules */}
      <DeviceSimulator
        theme={theme}
        callState={callState}
        setCallState={setCallState}
        messageState={messageState}
        setMessageState={setMessageState}
        activeApp={activeApp}
        setActiveApp={setActiveApp}
        isLocked={isLocked}
        setIsLocked={setIsLocked}
        settingsState={settingsState}
        setSettingsState={setSettingsState}
        systemLogs={systemLogs}
        addSystemLog={addSystemLog}
        systemPower={systemPower}
      />
    </div>
  );
}
