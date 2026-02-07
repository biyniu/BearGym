
import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { storage } from '../services/storage';
import { Exercise } from '../types';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const SuccessModal = ({ onClose }: { onClose: () => void }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 animate-fade-in p-4">
            <div className="bg-[#1e1e1e] border border-green-600 rounded-xl shadow-2xl p-6 max-w-sm w-full text-center relative">
                <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-500">
                    <i className="fas fa-check text-2xl text-white"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Sukces!</h3>
                <p className="text-gray-300 mb-6">Gratulacje, twój trening został zapisany w chmurze.</p>
                <button 
                    onClick={onClose}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition transform active:scale-95"
                >
                    OK
                </button>
            </div>
        </div>
    );
};

export default function ActiveWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workouts, syncData, workoutStartTime, setWorkoutStartTime, stopRestTimer } = useContext(AppContext);
  const workoutData = id ? workouts[id] : null;
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Custom Discard Modal
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [customDate, setCustomDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });

  // Logika resetowania "ptaszków" w kolejnym dniu
  useEffect(() => {
    if (!id || !workoutData) return;

    const today = new Date().toISOString().split('T')[0];
    const lastDateKey = `last_active_date_${id}`;
    const lastDate = localStorage.getItem(lastDateKey);

    if (lastDate !== today) {
      // Resetujemy status ukończenia wszystkich ćwiczeń w tym treningu
      workoutData.exercises.forEach(ex => {
        localStorage.removeItem(`completed_${id}_${ex.id}`);
      });
      localStorage.setItem(lastDateKey, today);
    }
    setIsReady(true);
  }, [id, workoutData]);

  useEffect(() => {
    if (!workoutStartTime && isReady) {
      setWorkoutStartTime(Date.now());
    }
    
    const updateTime = () => {
      const start = sessionStorage.getItem('workout_start_time');
      if (start) {
        setElapsedTime(Math.floor((Date.now() - parseInt(start)) / 1000));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [workoutStartTime, setWorkoutStartTime, isReady]);

  if (!workoutData || !id) return <div className="text-center p-10 text-red-500">Nie znaleziono treningu.</div>;
  if (!isReady) return null; // Czekamy na proces resetowania daty

  const handleFinish = async () => {
    let hasData = false;
    workoutData.exercises.forEach(ex => {
      for(let i=1; i<=ex.sets; i++) {
        if(storage.getTempInput(`input_${id}_${ex.id}_s${i}_kg`) || storage.getTempInput(`input_${id}_${ex.id}_s${i}_reps`)) hasData = true;
      }
    });

    if(!hasData && !showEmptyWarning) {
        setShowEmptyWarning(true);
        return;
    }
    
    await performFinish();
  };

  const performFinish = async () => {
    const d = new Date(customDate);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    let sessionResults: { [key: string]: string } = {};

    workoutData.exercises.forEach(ex => {
      let summaryParts: string[] = [];
      const rawType = ex.type || 'standard';
      const normalizedType = (rawType === 'reps' || rawType === 'reps_only') ? 'reps_only' : rawType;
      
      for(let i=1; i<=ex.sets; i++) {
        const uid = `input_${id}_${ex.id}_s${i}`;
        const kg = storage.getTempInput(`${uid}_kg`);
        const reps = storage.getTempInput(`${uid}_reps`);
        const time = storage.getTempInput(`${uid}_time`);

        if (normalizedType === 'standard') {
            if (kg && reps) summaryParts.push(`${kg}kg x ${reps}`);
            else if (reps) summaryParts.push(`${reps}p`);
        } else if (normalizedType === 'reps_only') {
            if (reps) summaryParts.push(`${reps}p`);
        } else if (normalizedType === 'time') {
            if (time && time !== '0') summaryParts.push(`${time}s`);
        }
      }
      
      const note = storage.getTempInput(`note_${id}_${ex.id}`);
      
      if(summaryParts.length > 0) {
        let resStr = summaryParts.join(' | ');
        if(note) resStr += ` [Note: ${note}]`;
        sessionResults[ex.id] = resStr;
      }
    });

    const timeStr = formatTime(elapsedTime);
    const finalDateStr = `${dateStr} (${timeStr})`;
    const history = storage.getHistory(id);
    
    const newEntry = {
      date: finalDateStr,
      timestamp: d.getTime(),
      results: sessionResults
    };

    history.unshift(newEntry);
    history.sort((a: any, b: any) => b.timestamp - a.timestamp);
    
    storage.saveHistory(id, history);
    await syncData('history', history);
    
    storage.clearTempInputs(id, workoutData.exercises);
    setWorkoutStartTime(null);
    stopRestTimer();
    setShowEmptyWarning(false);
    setShowSuccessModal(true);
  };

  const handleDiscard = () => {
    setShowDiscardModal(true);
  };

  const performDiscard = () => {
    stopRestTimer();
    setWorkoutStartTime(null);
    sessionStorage.removeItem('workout_start_time');
    storage.clearTempInputs(id, workoutData.exercises);
    navigate('/', { replace: true });
  };

  return (
    <div className="animate-fade-in pb-10 relative">
      {showSuccessModal && <SuccessModal onClose={() => navigate('/')} />}

      <div className="flex flex-col mb-6 space-y-4">
        <div className="flex justify-between items-center bg-gray-900/50 p-2 rounded-xl border border-gray-800">
            <div className="flex items-center space-x-2">
                <i className="fas fa-stopwatch text-red-500 animate-pulse"></i>
                <span className="font-mono text-lg font-bold text-white">{formatTime(elapsedTime)}</span>
            </div>
            <div className="flex items-center text-gray-400 text-[10px] font-bold">
                <i className="fas fa-calendar-alt mr-2 text-blue-500"></i>
                <input 
                    type="datetime-local" 
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="bg-transparent text-white border-none outline-none font-bold"
                />
            </div>
        </div>
      </div>

      <div className="bg-[#1e1e1e] rounded-xl shadow-md p-4 mb-8 border-l-4 border-yellow-500">
        <h3 className="font-bold text-yellow-500 mb-2 uppercase text-sm">Rozgrzewka / Aktywacja</h3>
        <ul className="space-y-2">
          {workoutData.warmup.map((item, idx) => (
            <li key={idx} className="flex justify-between text-sm items-center border-b border-gray-700 py-1 last:border-0">
              <span><span className="text-gray-500 mr-1">{idx+1}.</span> {item.pl}</span>
              <div className="flex items-center space-x-3">
                <span className="text-gray-400 text-xs">{item.reps}</span>
                {item.link && (
                  <a href={item.link} target="_blank" rel="noreferrer" className="text-red-500 hover:text-red-400">
                    <i className="fab fa-youtube"></i>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-6">
        {workoutData.exercises.map((ex, idx) => (
          <ExerciseCard 
            key={ex.id} 
            exercise={ex} 
            workoutId={id} 
            index={idx+1} 
          />
        ))}
      </div>

      <div className="mt-12 mb-8 px-4 flex flex-col space-y-6 relative">
        <button 
          type="button"
          onClick={handleFinish} 
          className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-2xl shadow-[0_10px_30px_rgba(22,163,74,0.3)] transition transform active:scale-95 flex items-center justify-center text-xl uppercase italic tracking-tighter"
        >
          <i className="fas fa-check-circle mr-3"></i> Zakończ i zapisz trening
        </button>
        
        <div className="flex justify-center">
            <button 
                type="button"
                onClick={handleDiscard} 
                className="bg-red-900/10 hover:bg-red-600/20 text-red-500/60 hover:text-red-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase italic transition-all flex items-center border border-red-900/20 hover:border-red-500/40"
            >
                <i className="fas fa-times-circle mr-2"></i> Nie zapisuj i odrzuć trening
            </button>
        </div>
      </div>

      {showDiscardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-fade-in">
              <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-red-900/20 p-4 border-b border-red-900/30 flex items-center justify-center">
                      <i className="fas fa-trash-alt text-red-500 text-3xl"></i>
                  </div>
                  <div className="p-6 text-center">
                      <h3 className="text-xl font-black text-white italic uppercase mb-2">Anulować Trening?</h3>
                      <p className="text-gray-400 text-sm">Czy na pewno chcesz wyjść bez zapisywania? Wszystkie wprowadzone dane zostaną utracone.</p>
                  </div>
                  <div className="flex border-t border-gray-800">
                      <button 
                          onClick={() => setShowDiscardModal(false)}
                          className="flex-1 py-4 text-gray-400 font-bold hover:bg-gray-800 transition text-xs uppercase"
                      >
                          Wróć
                      </button>
                      <button 
                          onClick={performDiscard}
                          className="flex-1 py-4 text-red-500 font-bold hover:bg-red-900/20 transition text-xs uppercase border-l border-gray-800"
                      >
                          Anuluj Trening
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showEmptyWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-fade-in">
              <div className="bg-[#1e1e1e] border border-yellow-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-yellow-900/20 p-4 border-b border-yellow-900/30 flex items-center justify-center">
                      <i className="fas fa-exclamation-circle text-yellow-500 text-3xl"></i>
                  </div>
                  <div className="p-6 text-center">
                      <h3 className="text-xl font-black text-white italic uppercase mb-2">Pusty trening</h3>
                      <p className="text-gray-400 text-sm">Nie wprowadzono żadnych wyników. Czy mimo to chcesz zakończyć i zapisać sesję?</p>
                  </div>
                  <div className="flex border-t border-gray-800">
                      <button 
                          onClick={() => setShowEmptyWarning(false)}
                          className="flex-1 py-4 text-gray-400 font-bold hover:bg-gray-800 transition text-xs uppercase"
                      >
                          Wróć
                      </button>
                      <button 
                          onClick={performFinish}
                          className="flex-1 py-4 text-yellow-500 font-bold hover:bg-yellow-900/20 transition text-xs uppercase border-l border-gray-800"
                      >
                          Zakończ
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

const ExerciseCard = React.memo(({ exercise, workoutId, index }: { exercise: Exercise, workoutId: string, index: number }) => {
  const { settings, startRestTimer } = useContext(AppContext);
  
  const history = useMemo(() => storage.getHistory(workoutId), [workoutId]);
  const lastResult = useMemo(() => {
    if (!history || history.length === 0) return '';
    return history[0].results[exercise.id] || '';
  }, [history, exercise.id]);

  const previousSets = useMemo(() => {
    if(!lastResult) return [];
    const cleanResult = lastResult.replace(/\[Note:.*?\]/g, ''); 
    const sets = cleanResult.split('|');
    return sets.map(s => {
        const kgMatch = s.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
        const repsMatch = s.match(/(?:x\s*|(\d+)\s*p)(\d+)?/i); 
        const timeMatch = s.match(/(\d+)\s*s/i);

        return {
            kg: kgMatch ? kgMatch[1] : '',
            reps: repsMatch ? (repsMatch[2] || repsMatch[1]) : '',
            time: timeMatch ? timeMatch[1] : ''
        };
    });
  }, [lastResult]);

  const [note, setNote] = useState(() => {
    const temp = storage.getTempInput(`note_${workoutId}_${exercise.id}`);
    if (temp) return temp;
    return storage.getStickyNote(workoutId, exercise.id);
  });

  const [completedSets, setCompletedSets] = useState<Record<number, boolean>>(() => {
    const saved = localStorage.getItem(`completed_${workoutId}_${exercise.id}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const newValues: Record<string, string> = {};
    for(let i=1; i<=exercise.sets; i++) {
      const uidKg = `input_${workoutId}_${exercise.id}_s${i}_kg`;
      const uidReps = `input_${workoutId}_${exercise.id}_s${i}_reps`;
      const uidTime = `input_${workoutId}_${exercise.id}_s${i}_time`;
      
      let savedKg = storage.getTempInput(uidKg);
      let savedReps = storage.getTempInput(uidReps);
      let savedTime = storage.getTempInput(uidTime);

      const prevSet = previousSets[i-1];
      
      if (!savedKg && prevSet?.kg) {
          savedKg = prevSet.kg;
          storage.saveTempInput(uidKg, savedKg);
      }
      if (!savedReps && prevSet?.reps) {
          savedReps = prevSet.reps;
          storage.saveTempInput(uidReps, savedReps);
      }
      if (!savedTime && prevSet?.time) {
          savedTime = prevSet.time;
          storage.saveTempInput(uidTime, savedTime);
      }

      newValues[uidKg] = savedKg;
      newValues[uidReps] = savedReps;
      newValues[uidTime] = savedTime;
    }
    setInputValues(prev => ({ ...prev, ...newValues }));
  }, [workoutId, exercise.id, exercise.sets, previousSets]);

  const handleInputChange = (uid: string, value: string) => {
    storage.saveTempInput(uid, value);
    setInputValues(prev => ({ ...prev, [uid]: value }));
  };
  
  const handleNoteChange = (val: string) => {
      setNote(val);
      storage.saveTempInput(`note_${workoutId}_${exercise.id}`, val);
      storage.saveStickyNote(workoutId, exercise.id, val);
  };

  const toggleSet = (sNum: number) => {
    const newState = { ...completedSets, [sNum]: !completedSets[sNum] };
    setCompletedSets(newState);
    localStorage.setItem(`completed_${workoutId}_${exercise.id}`, JSON.stringify(newState));
    
    if (newState[sNum] && settings.autoRestTimer) {
      startRestTimer(exercise.rest);
    }
  };

  const effectiveType = (exercise.type || 'standard').toLowerCase();

  return (
    <div className="bg-[#1e1e1e] rounded-xl shadow-md p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <span className="text-red-500 font-bold text-xs uppercase">Ćwiczenie {index}</span>
          <h3 className="font-bold text-lg text-white">{exercise.name}</h3>
          <p className="text-gray-400 text-sm italic mb-2">{exercise.pl}</p>
        </div>
        {exercise.link && (
          <a href={exercise.link} target="_blank" rel="noreferrer" className="text-red-600 hover:text-red-500 p-2">
            <i className="fab fa-youtube fa-2x"></i>
          </a>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1 text-[10px] text-center mb-4 bg-black bg-opacity-20 p-2 rounded">
        <div><div className="text-gray-500 uppercase">Tempo</div><div className="text-blue-400 font-mono">{exercise.tempo}</div></div>
        <div><div className="text-gray-500 uppercase">Rir</div><div className="text-blue-400 font-mono">{exercise.rir}</div></div>
        <div><div className="text-gray-500 uppercase">Zakres</div><div className="text-green-400 font-mono">{exercise.reps}</div></div>
        <div><div className="text-gray-500 uppercase">Przerwa</div><div className="text-white font-mono">{exercise.rest}s</div></div>
      </div>

      <div className="bg-gray-900 bg-opacity-50 p-2 rounded text-[10px] mb-3 border border-gray-800">
        <span className="text-red-400 font-bold">OSTATNIO:</span> <span className="text-gray-400">{lastResult || 'Brak danych'}</span>
      </div>

      <div className="space-y-1">
        {Array.from({ length: exercise.sets }).map((_, sIdx) => {
          const setNum = sIdx + 1;
          const uId = `input_${workoutId}_${exercise.id}_s${setNum}`;
          const isDone = completedSets[setNum];
          
          return (
            <div key={setNum} className={`flex items-center py-2 space-x-2 border-b border-gray-800 last:border-0 transition-opacity ${isDone ? 'opacity-40' : 'opacity-100'}`}>
              <span className="text-gray-500 text-xs w-6 font-bold pt-1">S{setNum}</span>
              <div className={`flex-grow grid ${(effectiveType === 'standard' || effectiveType === 'reps') ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                {(effectiveType === 'standard' || effectiveType === 'reps') && (
                  <>
                     <SavedInput 
                        value={inputValues[`${uId}_kg`] || ''} 
                        onChange={(v) => handleInputChange(`${uId}_kg`, v)} 
                        placeholder="kg" 
                      />
                     <SavedInput 
                        value={inputValues[`${uId}_reps`] || ''} 
                        onChange={(v) => handleInputChange(`${uId}_reps`, v)} 
                        placeholder="powt" 
                      />
                  </>
                )}
                {effectiveType === 'reps_only' && (
                  <SavedInput 
                    value={inputValues[`${uId}_reps`] || ''} 
                    onChange={(v) => handleInputChange(`${uId}_reps`, v)} 
                    placeholder="powtórzenia" 
                  />
                )}
                {effectiveType === 'time' && (
                  <Stopwatch 
                    id={`${uId}_time`} 
                    initialValue={storage.getTempInput(`${uId}_time`)} 
                    onChange={(val) => handleInputChange(`${uId}_time`, val)} 
                  />
                )}
              </div>
              <button 
                onClick={() => toggleSet(setNum)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all border ${isDone ? 'bg-green-600 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-gray-800 border-gray-700 text-gray-600'}`}
              >
                <i className={`fas fa-check ${isDone ? 'scale-110' : 'scale-100'}`}></i>
              </button>
            </div>
          );
        })}
      </div>
      <textarea 
        value={note}
        onChange={(e) => handleNoteChange(e.target.value)}
        className="w-full mt-3 bg-[#2d2d2d] text-gray-300 text-xs p-2 rounded border border-gray-700 focus:border-red-500 outline-none transition-colors" 
        placeholder="Stała notatka (zapisuje się na przyszłość)..." 
        rows={1} 
      />
    </div>
  );
});

const SavedInput: React.FC<{ value: string, onChange: (v: string) => void, placeholder: string }> = ({ value, onChange, placeholder }) => {
  return (
    <input 
      type="text" 
      inputMode="decimal"
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} 
      className="bg-[#2d2d2d] border border-[#404040] text-white text-center w-full p-3 rounded text-lg font-bold focus:outline-none focus:border-red-500 transition-colors placeholder-gray-600" 
    />
  );
};

const Stopwatch = ({ id, onChange, initialValue }: { id: string, onChange: (val: string) => void, initialValue: string }) => {
  const [time, setTime] = useState<number>(parseInt(initialValue) || 0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const toggle = () => {
    if (isRunning) {
      setIsRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setIsRunning(true);
      intervalRef.current = window.setInterval(() => {
        setTime(t => {
          const nv = t + 1;
          onChange(nv.toString());
          return nv;
        });
      }, 1000);
    }
  };

  return (
    <div className="flex space-x-2 w-full">
      <input 
        type="number" 
        value={time === 0 ? '' : time}
        onChange={(e) => { setTime(parseInt(e.target.value) || 0); onChange(e.target.value); }}
        placeholder="sek" 
        className="bg-[#2d2d2d] border border-[#404040] text-white text-center w-full p-3 rounded text-lg font-bold outline-none" 
      />
      <button onClick={toggle} className={`w-12 rounded flex items-center justify-center text-white transition-colors ${isRunning ? 'bg-red-600 animate-pulse' : 'bg-gray-700'}`}>
        <i className={`fas ${isRunning ? 'fa-stop' : 'fa-stopwatch'}`}></i>
      </button>
    </div>
  );
};
