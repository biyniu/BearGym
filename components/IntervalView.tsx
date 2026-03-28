import React, { useState, useEffect, useContext, useRef } from 'react';
import { AppContext } from '../App';
import { storage } from '../services/storage';

type Phase = 'idle' | 'run' | 'walk' | 'finished';

export default function IntervalView() {
  const { playAlarm, syncData } = useContext(AppContext);
  
  const [runTime, setRunTime] = useState<number>(45);
  const [walkTime, setWalkTime] = useState<number>(60);
  const [rounds, setRounds] = useState<number>(10);
  
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showSavedModal, setShowSavedModal] = useState<boolean>(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  const totalTime = (runTime + walkTime) * rounds;
  
  // Calculate remaining total time
  const calculateRemainingTotalTime = () => {
    if (phase === 'idle') return totalTime;
    if (phase === 'finished') return 0;
    
    let remainingRounds = rounds - currentRound;
    let timeInCurrentRound = 0;
    
    if (phase === 'run') {
      timeInCurrentRound = timeLeft + walkTime;
    } else if (phase === 'walk') {
      timeInCurrentRound = timeLeft;
    }
    
    return (remainingRounds * (runTime + walkTime)) + timeInCurrentRound;
  };

  const remainingTotalTime = calculateRemainingTotalTime();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const saveSession = async (elapsedSeconds: number) => {
    if (elapsedSeconds < 5) return; // Don't save if less than 5 seconds

    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const newSession = {
      id: Date.now().toString(),
      date: dateStr,
      type: 'interval',
      duration: durationMinutes,
      calories: 0,
      distance: 0,
      notes: `Interwał: ${rounds} rund (${runTime}s bieg / ${walkTime}s chód)`
    };

    const currentSessions = storage.getCardioSessions();
    const updated = [newSession, ...currentSessions].sort((a,b) => b.date.localeCompare(a.date));
    
    storage.saveCardioSessions(updated);
    
    try {
      const cleanForFirebase = (data: any) => {
        return JSON.parse(JSON.stringify(data, (key, value) => {
          return value === undefined ? null : value;
        }));
      };
      
      await syncData('extras', {
        measurements: cleanForFirebase(storage.getMeasurements()),
        cardio: cleanForFirebase(updated)
      });
    } catch (e) {
      console.error("Błąd synchronizacji cardio z Firebase:", e);
    }

    setShowSavedModal(true);
    setTimeout(() => setShowSavedModal(false), 3000);
  };

  const startTimer = () => {
    if (phase === 'idle' || phase === 'finished') {
      setCurrentRound(1);
      setPhase('run');
      setTimeLeft(runTime);
    }
    lastTickRef.current = Date.now();
    setIsRunning(true);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const stopTimer = () => {
    setIsRunning(false);
    const elapsedSeconds = totalTime - remainingTotalTime;
    if (phase !== 'idle' && phase !== 'finished' && elapsedSeconds > 0) {
      saveSession(elapsedSeconds);
    }
    setPhase('idle');
    setCurrentRound(1);
    setTimeLeft(0);
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = Math.floor((now - lastTickRef.current) / 1000);
        
        if (delta >= 1) {
          lastTickRef.current += delta * 1000;
          
          if (timeLeft - delta <= 0) {
            // Phase ended
            playAlarm();
            const overflow = Math.abs(timeLeft - delta);
            
            if (phase === 'run') {
              setPhase('walk');
              setTimeLeft(Math.max(0, walkTime - overflow));
            } else if (phase === 'walk') {
              if (currentRound >= rounds) {
                setPhase('finished');
                setIsRunning(false);
                saveSession(totalTime);
                setTimeLeft(0);
              } else {
                setCurrentRound((r) => r + 1);
                setPhase('run');
                setTimeLeft(Math.max(0, runTime - overflow));
              }
            }
          } else {
            setTimeLeft(timeLeft - delta);
          }
        }
      }, 200); // Check more frequently to catch up if throttled
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, phase, currentRound, rounds, runTime, walkTime, playAlarm, totalTime, timeLeft]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Interwał</h2>
        <i className="fas fa-stopwatch text-orange-500 text-3xl"></i>
      </div>

      {/* Settings */}
      {phase === 'idle' && (
        <div className="bg-[#1e1e1e] rounded-2xl p-6 border border-gray-800 shadow-lg space-y-4">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Ustawienia</h3>
          
          <div className="flex items-center justify-between">
            <label className="text-white font-bold uppercase text-sm flex items-center">
              <i className="fas fa-running text-red-500 mr-2 w-5 text-center"></i> Bieg (sek)
            </label>
            <input 
              type="number" 
              value={runTime} 
              onChange={(e) => setRunTime(Math.max(1, parseInt(e.target.value) || 0))}
              className="bg-black border border-gray-700 rounded-lg text-white font-bold text-center w-20 p-2 focus:border-red-500 outline-none"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-white font-bold uppercase text-sm flex items-center">
              <i className="fas fa-walking text-green-500 mr-2 w-5 text-center"></i> Chód (sek)
            </label>
            <input 
              type="number" 
              value={walkTime} 
              onChange={(e) => setWalkTime(Math.max(1, parseInt(e.target.value) || 0))}
              className="bg-black border border-gray-700 rounded-lg text-white font-bold text-center w-20 p-2 focus:border-green-500 outline-none"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-white font-bold uppercase text-sm flex items-center">
              <i className="fas fa-redo text-blue-500 mr-2 w-5 text-center"></i> Rundy
            </label>
            <input 
              type="number" 
              value={rounds} 
              onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 0))}
              className="bg-black border border-gray-700 rounded-lg text-white font-bold text-center w-20 p-2 focus:border-blue-500 outline-none"
            />
          </div>
          
          <div className="pt-4 mt-4 border-t border-gray-800 flex justify-between items-center">
            <span className="text-gray-400 text-xs font-bold uppercase">Łączny czas:</span>
            <span className="text-orange-400 font-black text-xl">{formatTime(totalTime)}</span>
          </div>
        </div>
      )}

      {/* Active Timer Display */}
      {phase !== 'idle' && (
        <div className={`rounded-3xl p-8 flex flex-col items-center justify-center border-4 transition-colors duration-500 shadow-2xl ${
          phase === 'run' ? 'bg-red-900/20 border-red-600 shadow-red-900/50' : 
          phase === 'walk' ? 'bg-green-900/20 border-green-600 shadow-green-900/50' : 
          'bg-gray-900 border-gray-700'
        }`}>
          <div className="text-center mb-2">
            <span className="text-gray-400 font-bold uppercase tracking-widest text-sm">
              Runda {currentRound} / {rounds}
            </span>
          </div>
          
          <div className="text-center mb-6">
            <h3 className={`text-4xl font-black italic uppercase tracking-tighter ${
              phase === 'run' ? 'text-red-500' : 
              phase === 'walk' ? 'text-green-500' : 
              'text-white'
            }`}>
              {phase === 'run' ? 'BIEG' : phase === 'walk' ? 'CHÓD' : 'KONIEC'}
            </h3>
          </div>
          
          <div className="text-7xl font-black text-white font-mono tracking-tighter mb-8 drop-shadow-lg">
            {formatTime(timeLeft)}
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-gray-500 text-xs font-bold uppercase mb-1">Pozostały czas całkowity</span>
            <span className="text-gray-300 font-mono text-xl">{formatTime(remainingTotalTime)}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-2 gap-4">
        {!isRunning ? (
          <button 
            onClick={startTimer}
            className={`${phase === 'idle' ? 'col-span-2' : 'col-span-1'} bg-orange-600 hover:bg-orange-700 text-white font-black uppercase italic tracking-widest py-4 rounded-xl shadow-lg transition transform active:scale-95 flex items-center justify-center text-lg`}
          >
            <i className="fas fa-play mr-2"></i> {phase === 'idle' ? 'Start' : phase === 'finished' ? 'Od nowa' : 'Wznów'}
          </button>
        ) : (
          <button 
            onClick={pauseTimer}
            className="col-span-1 bg-yellow-600 hover:bg-yellow-700 text-white font-black uppercase italic tracking-widest py-4 rounded-xl shadow-lg transition transform active:scale-95 flex items-center justify-center text-lg"
          >
            <i className="fas fa-pause mr-2"></i> Pauza
          </button>
        )}
        
        {phase !== 'idle' && (
          <button 
            onClick={stopTimer}
            className="col-span-1 bg-gray-800 hover:bg-gray-700 text-white font-black uppercase italic tracking-widest py-4 rounded-xl shadow-lg transition transform active:scale-95 flex items-center justify-center border border-gray-700"
          >
            <i className="fas fa-stop mr-2"></i> Zakończ
          </button>
        )}
      </div>

      {showSavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-[#1e1e1e] p-8 rounded-3xl border border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.2)] text-center max-w-sm w-full animate-slide-up">
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-check text-4xl text-orange-500"></i>
            </div>
            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Zapisano!</h3>
            <p className="text-gray-400 text-sm font-medium">Trening interwałowy został dodany do historii cardio.</p>
          </div>
        </div>
      )}
    </div>
  );
}
