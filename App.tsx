import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ActiveWorkout from './components/ActiveWorkout';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import ProgressView from './components/ProgressView';
import MeasurementsView from './components/MeasurementsView';
import CardioView from './components/CardioView';
import AuthView from './components/AuthView';
import CoachDashboard from './components/CoachDashboard';
import InstallPrompt from './components/InstallPrompt';
import AICoachWidget from './components/AICoachWidget';
import { localStorageCache, remoteStorage, storage } from './services/storage';
import { WorkoutsMap, AppSettings } from './types';
import { CLIENT_CONFIG, DEFAULT_SETTINGS } from './constants';

interface AppContextType {
  clientCode: string | null;
  clientName: string;
  workouts: WorkoutsMap;
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
  updateWorkouts: (w: WorkoutsMap) => void;
  logo: string;
  updateLogo: (s: string) => void;
  playAlarm: () => void;
  syncData: (type: 'history' | 'extras' | 'plan', data: any) => void;
  workoutStartTime: number | null;
  setWorkoutStartTime: (t: number | null) => void;
  restTimer: { timeLeft: number | null, duration: number };
  startRestTimer: (duration: number) => void;
  stopRestTimer: () => void;
}

export const AppContext = React.createContext<AppContextType>({} as AppContextType);

// Komponent zarządzający inteligentnym przekierowaniem na podstawie roli
const ViewRedirector = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Zapamiętujemy rolę na podstawie aktualnej ścieżki
    if (location.pathname === '/coach-admin') {
      localStorage.setItem('bear_gym_role_pref', 'coach');
    } else if (location.pathname === '/') {
      localStorage.setItem('bear_gym_role_pref', 'client');
    }
  }, [location.pathname]);

  useEffect(() => {
    // Jednorazowe sprawdzenie przy starcie aplikacji (np. otwarcie z pulpitu)
    const pref = localStorage.getItem('bear_gym_role_pref');
    const isRoot = window.location.hash === '#/' || window.location.hash === '';
    
    // Używamy sessionStorage, aby przekierowanie działo się tylko przy nowym "uruchomieniu" apki
    const sessionRedirectDone = sessionStorage.getItem('init_redirect_done');

    if (isRoot && pref === 'coach' && !sessionRedirectDone) {
      sessionStorage.setItem('init_redirect_done', 'true');
      navigate('/coach-admin', { replace: true });
    }
  }, [navigate]);

  return null;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logo, clientCode, workouts, restTimer, stopRestTimer } = useContext(AppContext);
  
  const isHome = location.pathname === '/';
  const isWorkout = location.pathname.startsWith('/workout/');
  const workoutId = isWorkout ? location.pathname.split('/').pop() : null;
  const workoutTitle = workoutId && workouts[workoutId] ? workouts[workoutId].title : "BEAR GYM";

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative bg-[#121212] text-[#e0e0e0] font-sans">
      <header className="fixed top-0 left-0 right-0 max-w-md mx-auto p-4 flex justify-between items-center border-b border-gray-700 bg-neutral-900 z-50 shadow-md h-16">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-red-600 bg-gray-800 shrink-0 shadow-lg">
             <img 
               src={logo || 'https://lh3.googleusercontent.com/u/0/d/1GZ-QR4EyK6Ho9czlpTocORhwiHW4FGnP'} 
               alt="Logo" 
               className="w-full h-full object-cover"
               onError={(e) => { (e.target as HTMLImageElement).src='https://lh3.googleusercontent.com/u/0/d/1GZ-QR4EyK6Ho9czlpTocORhwiHW4FGnP'; }} 
             />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-black text-white tracking-tight leading-none truncate uppercase">
              {isWorkout ? workoutTitle : "BEAR GYM"}
            </h1>
            {!isWorkout && <span className="text-[10px] text-red-500 font-bold tracking-widest uppercase block truncate">ID: {clientCode}</span>}
          </div>
        </div>

        {isWorkout && restTimer.timeLeft !== null && (
          <div className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-pulse cursor-pointer" onClick={stopRestTimer}>
             <span className="text-[8px] font-bold text-gray-500 uppercase">PRZERWA</span>
             <span className="text-xl font-black text-red-500 font-mono leading-none">{restTimer.timeLeft}s</span>
          </div>
        )}

        {!isHome && (
          <div className="flex items-center space-x-2">
            {isWorkout && (
               <button onClick={() => navigate('/settings')} className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-lg border border-gray-700">
                <i className="fas fa-cog text-sm"></i>
              </button>
            )}
            <button onClick={() => navigate('/')} className="text-gray-300 hover:text-white bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-600 flex items-center text-xs font-bold">
              <i className="fas fa-arrow-left mr-1"></i> WRÓĆ
            </button>
          </div>
        )}
      </header>

      <div className="p-3 space-y-4 flex-grow pb-24 pt-20">
        {children}
      </div>

      {clientCode && <AICoachWidget />}

      {isHome && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-slow">
           <button onClick={() => navigate('/settings')} className="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-xl transition transform hover:scale-110 active:scale-90">
            <i className="fas fa-cog"></i>
          </button>
        </div>
      )}
    </div>
  );
};

const ClientRouteGuard: React.FC<{ 
  children: React.ReactNode, 
  clientCode: string | null, 
  syncError: string | null, 
  isReady: boolean, 
  handleLogin: (code: string, userData: any) => void 
}> = ({ children, clientCode, syncError, isReady, handleLogin }) => {
  const location = useLocation();
  const isCoachRoute = location.pathname === '/coach-admin';

  if (isCoachRoute) return <>{children}</>;
  if (!clientCode) return <AuthView onLogin={handleLogin} />;
  if (syncError) return <div className="p-10 text-center text-red-500">{syncError}</div>;
  if (!isReady) return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center">
      <i className="fas fa-spinner fa-spin text-red-600 text-4xl"></i>
    </div>
  );

  return <Layout>{children}</Layout>;
};

export default function App() {
  const [clientCode, setClientCode] = useState<string | null>(localStorage.getItem('bear_gym_client_code'));
  const [clientName, setClientName] = useState<string>(localStorage.getItem('bear_gym_client_name') || '');
  const [workouts, setWorkouts] = useState<WorkoutsMap>(() => {
    const local = localStorage.getItem(`${CLIENT_CONFIG.storageKey}_workouts`);
    return local ? JSON.parse(local) : {};
  });
  const [settings, setSettings] = useState<AppSettings>(localStorageCache.get('app_settings') || DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const [logo, setLogo] = useState<string>(localStorage.getItem('app_logo') || 'https://lh3.googleusercontent.com/u/0/d/1GZ-QR4EyK6Ho9czlpTocORhwiHW4FGnP');
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [workoutStartTime, setWorkoutStartTimeState] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('workout_start_time');
    return saved ? parseInt(saved) : null;
  });
  const [restTimer, setRestTimer] = useState<{ timeLeft: number | null, duration: number }>({ timeLeft: null, duration: 0 });
  const restEndTimeRef = useRef<number | null>(null);
  const restIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
  }, []);

  const setWorkoutStartTime = (t: number | null) => {
    if (t) sessionStorage.setItem('workout_start_time', t.toString());
    else sessionStorage.removeItem('workout_start_time');
    setWorkoutStartTimeState(t);
  };

  const playSoundNote = (ctx: AudioContext, freq: number, startTime: number, vol: number, duration: number = 1.2, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.1);
  };

  const playAlarm = useCallback(() => {
    const currentSettings = settingsRef.current;
    const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (CtxClass) {
      let ctx = audioCtx || new CtxClass();
      if (!audioCtx) setAudioCtx(ctx);
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const vol = currentSettings.volume !== undefined ? currentSettings.volume : 0.5;
      
      switch (currentSettings.soundType) {
        case 'siren': {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1500, now + 0.5);
            osc.frequency.linearRampToValueAtTime(600, now + 1.0);
            osc.frequency.linearRampToValueAtTime(1500, now + 1.5);
            osc.frequency.linearRampToValueAtTime(600, now + 2.0);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 2.5);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.linearRampToValueAtTime(0, now + 2.5);
            break;
        }
        case 'school_bell': {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1200, now);
            lfo.type = 'square';
            lfo.frequency.setValueAtTime(25, now);
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);
            lfoGain.gain.value = vol;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            lfo.start(now);
            osc.stop(now + 2.5);
            lfo.stop(now + 2.5);
            gain.gain.setValueAtTime(vol * 0.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 2.5);
            break;
        }
        case 'bell': playSoundNote(ctx, 523.25, now, vol, 2.0); break;
        case 'double_bell': 
            playSoundNote(ctx, 523.25, now, vol, 1.5);
            playSoundNote(ctx, 523.25, now + 0.3, vol, 2.0);
            break;
        case 'chord': 
            playSoundNote(ctx, 523.25, now, vol * 0.5, 2.0);
            playSoundNote(ctx, 659.25, now + 0.1, vol * 0.5, 2.0);
            playSoundNote(ctx, 783.99, now + 0.2, vol * 0.5, 2.5);
            break;
        case 'cosmic': 
            playSoundNote(ctx, 880.00, now, vol * 0.4, 2.0);
            playSoundNote(ctx, 1108.73, now + 0.15, vol * 0.4, 2.5);
            break;
        case 'gong': 
            playSoundNote(ctx, 196.00, now, vol * 0.8, 3.0);
            playSoundNote(ctx, 392.00, now, vol * 0.4, 2.5);
            break;
        case 'victory': 
            playSoundNote(ctx, 523.25, now, vol * 0.4, 0.5);
            playSoundNote(ctx, 659.25, now + 0.15, vol * 0.4, 0.5);
            playSoundNote(ctx, 783.99, now + 0.30, vol * 0.4, 0.5);
            playSoundNote(ctx, 1046.50, now + 0.45, vol * 0.4, 2.0);
            break;
        default: playSoundNote(ctx, 523.25, now, vol, 2.0); break;
      }
    }
  }, [audioCtx]);

  const triggerBackgroundNotification = useCallback(() => {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("KONIEC PRZERWY!", {
            body: "Wracaj do treningu!",
            icon: logo || 'https://lh3.googleusercontent.com/u/0/d/1GZ-QR4EyK6Ho9czlpTocORhwiHW4FGnP',
            silent: false
        });
    }
  }, [logo]);

  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && restEndTimeRef.current !== null) {
            const now = Date.now();
            if (now >= restEndTimeRef.current) {
                stopRestTimer();
                playAlarm();
            }
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [playAlarm]);

  const startRestTimer = (duration: number) => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    const endTime = Date.now() + (duration * 1000);
    restEndTimeRef.current = endTime;
    setRestTimer({ timeLeft: duration, duration });
    restIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const timeLeft = Math.max(0, Math.round((endTime - now) / 1000));
      if (timeLeft <= 0) {
        stopRestTimer();
        playAlarm();
        if (document.visibilityState !== 'visible') {
            triggerBackgroundNotification();
        }
      } else {
        setRestTimer(prev => ({ ...prev, timeLeft }));
      }
    }, 1000);
  };

  const stopRestTimer = () => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restIntervalRef.current = null;
    restEndTimeRef.current = null;
    setRestTimer({ timeLeft: null, duration: 0 });
  };

  const initData = useCallback(async (code: string) => {
    if (localStorage.getItem('is_syncing')) return;
    setSyncError(null);
    try {
      const result = await remoteStorage.fetchUserData(code);
      if (result.success) {
        if (result.plan) {
          setWorkouts(result.plan);
          storage.saveWorkouts(result.plan);
        }
        if (result.name) {
          setClientName(result.name);
          localStorage.setItem('bear_gym_client_name', result.name);
        }
        if (result.history) {
          Object.entries(result.history).forEach(([id, h]) => {
            storage.saveHistory(id, h as any[]);
          });
        }
        if (result.extras) {
          storage.saveMeasurements(result.extras.measurements || []);
          storage.saveCardioSessions(result.extras.cardio || []);
        }
        setIsReady(true);
      } else {
        const localWorkouts = localStorage.getItem(`${CLIENT_CONFIG.storageKey}_workouts`);
        if (localWorkouts) setIsReady(true);
        else if (result.error?.includes("Nie znaleziono") || result.error?.includes("Nieprawidłowy")) {
            setClientCode(null);
            localStorage.removeItem('bear_gym_client_code');
        } else { setSyncError(result.error); }
      }
    } catch (e) {
      const localWorkouts = localStorage.getItem(`${CLIENT_CONFIG.storageKey}_workouts`);
      if (localWorkouts) setIsReady(true);
      else setSyncError("Błąd ładowania danych.");
    }
  }, []);

  useEffect(() => {
    if (clientCode) initData(clientCode);
    else setIsReady(true);
  }, [clientCode, initData]);

  const handleLogin = (code: string, userData: any) => {
    localStorage.setItem('bear_gym_client_code', code);
    setClientCode(code);
    if (userData.name) {
      setClientName(userData.name);
      localStorage.setItem('bear_gym_client_name', userData.name);
    }
    setWorkouts(userData.plan || {});
    storage.saveWorkouts(userData.plan || {});
    setIsReady(true);
  };

  const syncData = async (type: 'history' | 'extras' | 'plan', data: any) => {
    if (clientCode) {
      let payload = data;
      if (type === 'history') {
        const allHistory: Record<string, any[]> = {};
        const prefix = `${CLIENT_CONFIG.storageKey}_history_`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const workoutId = key.replace(prefix, '');
            try { allHistory[workoutId] = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
          }
        }
        payload = allHistory;
      }
      await remoteStorage.saveToCloud(clientCode, type, payload);
    }
  };

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorageCache.save('app_settings', newSettings);
  };

  const updateWorkouts = (newWorkouts: WorkoutsMap) => {
    setWorkouts(newWorkouts);
    storage.saveWorkouts(newWorkouts);
    syncData('plan', newWorkouts);
  };

  const updateLogo = (newLogo: string) => {
    setLogo(newLogo);
    localStorage.setItem('app_logo', newLogo);
  };

  return (
    <AppContext.Provider value={{ 
      clientCode, clientName, workouts, settings, updateSettings, updateWorkouts, logo, updateLogo, playAlarm, syncData,
      workoutStartTime, setWorkoutStartTime, restTimer, startRestTimer, stopRestTimer
    }}>
      <InstallPrompt />
      <HashRouter>
        <ViewRedirector />
        <ClientRouteGuard clientCode={clientCode} syncError={syncError} isReady={isReady} handleLogin={handleLogin}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workout/:id" element={<ActiveWorkout />} />
            <Route path="/history" element={<HistoryView />} />
            <Route path="/progress" element={<ProgressView />} />
            <Route path="/measurements" element={<MeasurementsView />} />
            <Route path="/cardio" element={<CardioView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/coach-admin" element={<CoachDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ClientRouteGuard>
      </HashRouter>
    </AppContext.Provider>
  );
}