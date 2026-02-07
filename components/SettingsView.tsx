
import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { storage, remoteStorage } from '../services/storage';
import { CLIENT_CONFIG } from '../constants';
import { Exercise, WorkoutPlan, ExerciseType } from '../types';

export default function SettingsView() {
  const { settings, updateSettings, playAlarm, workouts, updateWorkouts, clientCode, logo } = useContext(AppContext);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>("");
  const [editingExerciseIdx, setEditingExerciseIdx] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  
  // Custom Modals
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; action: () => void } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updatePlanExercises = (workoutId: string, newExercises: Exercise[]) => {
    const newWorkouts = { ...workouts };
    newWorkouts[workoutId] = {
        ...newWorkouts[workoutId],
        exercises: newExercises
    };
    updateWorkouts(newWorkouts);
  };

  const handleEditSave = (updatedEx: Exercise) => {
    if (!selectedWorkoutId || editingExerciseIdx === null) return;
    const currentExercises = [...workouts[selectedWorkoutId].exercises];
    currentExercises[editingExerciseIdx] = updatedEx;
    updatePlanExercises(selectedWorkoutId, currentExercises);
    setEditingExerciseIdx(null);
  };

  const handleDeleteExerciseRequest = (idx: number) => {
      setConfirmModal({
          isOpen: true,
          message: "Czy na pewno chcesz usunąć to ćwiczenie z planu?",
          action: () => performDeleteExercise(idx)
      });
  };

  const performDeleteExercise = (idx: number) => {
    const currentExercises = [...workouts[selectedWorkoutId].exercises];
    currentExercises.splice(idx, 1);
    updatePlanExercises(selectedWorkoutId, currentExercises);
    setEditingExerciseIdx(null);
    setConfirmModal(null);
  };

  const handleAddExercise = () => {
    if (!selectedWorkoutId) return;
    const newEx: Exercise = { 
      id: `custom_${Date.now()}`, 
      name: "Nowe ćwiczenie", 
      pl: "Opis...", 
      sets: 3, 
      reps: "10", 
      tempo: "2011", 
      rir: "1", 
      rest: 90, 
      link: "", 
      type: "standard" 
    };
    const currentExercises = [...workouts[selectedWorkoutId].exercises];
    currentExercises.push(newEx);
    updatePlanExercises(selectedWorkoutId, currentExercises);
    setEditingExerciseIdx(currentExercises.length - 1);
  };

  const handleAddWorkoutDay = () => {
    const title = window.prompt("Podaj nazwę nowego planu (np. Trening C):");
    if (!title) return;
    const id = title.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const newWorkouts = { ...workouts };
    newWorkouts[id] = {
      title,
      warmup: [],
      exercises: []
    };
    updateWorkouts(newWorkouts);
    setSelectedWorkoutId(id);
  };

  const handleDeleteWorkoutRequest = () => {
    if (!selectedWorkoutId) return;
    setConfirmModal({
        isOpen: true,
        message: `Czy na pewno chcesz usunąć cały plan "${workouts[selectedWorkoutId].title}"?`,
        action: performDeleteWorkout
    });
  };

  const performDeleteWorkout = () => {
    const newWorkouts = { ...workouts };
    delete newWorkouts[selectedWorkoutId];
    updateWorkouts(newWorkouts);
    setSelectedWorkoutId("");
    setConfirmModal(null);
  };

  const handleMove = (idx: number, dir: number) => {
    if (!selectedWorkoutId) return;
    const exercises = [...workouts[selectedWorkoutId].exercises];
    const newIdx = idx + dir;
    if (newIdx >= 0 && newIdx < exercises.length) {
        [exercises[idx], exercises[newIdx]] = [exercises[newIdx], exercises[idx]];
        updatePlanExercises(selectedWorkoutId, exercises);
    }
  };

  const handleExport = () => {
    const data: any = {};
    for(let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if(key && (key.startsWith(CLIENT_CONFIG.storageKey) || key === 'app_settings' || key === 'bear_gym_client_code' || key === 'bear_gym_client_name' || key === 'app_logo')) {
            data[key] = localStorage.getItem(key);
        }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_bear_gym_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportRequest = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      
      setConfirmModal({
          isOpen: true,
          message: "UWAGA! Import zastąpi wszystkie obecne dane danymi z pliku. Czy kontynuować?",
          action: () => performImport(file)
      });
  };

  const performImport = (file: File) => {
    setIsImporting(true);
    setConfirmModal(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            Object.keys(data).forEach(key => localStorage.setItem(key, data[key]));
            window.location.reload();
        } catch(err) { 
            alert("Błąd importu pliku."); 
            setIsImporting(false);
        }
    };
    reader.readAsText(file);
  };

  const confirmProfileSave = () => {
    // Ta funkcja służy tylko UX, bo updateSettings zapisuje na bieżąco.
    // Daje użytkownikowi poczucie, że "zatwierdził" zmiany.
    setSaveStatus("Zapisano pomyślnie!");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="animate-fade-in pb-10 relative">
      <h2 className="text-2xl font-black text-white mb-6 text-center italic uppercase tracking-tighter">Ustawienia</h2>

      {/* SEKCJA PROFILU */}
      <div className="bg-[#1e1e1e] rounded-2xl shadow-md p-5 mb-6 border-l-4 border-yellow-500">
        <h3 className="text-sm font-black text-white mb-4 flex items-center uppercase italic">
          <i className="fas fa-user-circle text-yellow-500 mr-2"></i>Twój Profil i Cele
        </h3>
        <div className="space-y-4">
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Główny Cel (np. Redukcja 10kg, Masa):</label>
                <textarea 
                    value={settings.userGoal || ''}
                    onChange={(e) => updateSettings({ ...settings, userGoal: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-xs outline-none focus:border-yellow-500"
                    placeholder="Opisz swój cel..."
                    rows={2}
                />
            </div>
            
            {/* NOWA SEKCJA WAGOWA */}
            <div className="grid grid-cols-3 gap-3 bg-gray-900/50 p-3 rounded-xl border border-gray-800">
                <div>
                    <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1 text-center">Waga Start</label>
                    <input 
                        type="number"
                        step="0.1"
                        placeholder="kg"
                        value={settings.userInitialWeight || ''}
                        onChange={(e) => updateSettings({ ...settings, userInitialWeight: e.target.value })}
                        className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white text-center font-bold text-xs focus:border-yellow-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[9px] font-bold text-yellow-500 uppercase block mb-1 text-center">Waga Teraz</label>
                    <input 
                        type="number"
                        step="0.1"
                        placeholder="kg"
                        value={settings.userCurrentWeight || ''}
                        onChange={(e) => updateSettings({ ...settings, userCurrentWeight: e.target.value })}
                        className="w-full bg-black border border-gray-700 rounded-lg p-2 text-yellow-400 text-center font-bold text-xs focus:border-yellow-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[9px] font-bold text-green-500 uppercase block mb-1 text-center">Waga Cel</label>
                    <input 
                        type="number"
                        step="0.1"
                        placeholder="kg"
                        value={settings.userTargetWeight || ''}
                        onChange={(e) => updateSettings({ ...settings, userTargetWeight: e.target.value })}
                        className="w-full bg-black border border-gray-700 rounded-lg p-2 text-green-400 text-center font-bold text-xs focus:border-yellow-500 outline-none"
                    />
                </div>
            </div>

            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Twoje Trudności / Słabości (np. słodycze, brak czasu):</label>
                <textarea 
                    value={settings.userDifficulties || ''}
                    onChange={(e) => updateSettings({ ...settings, userDifficulties: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-xs outline-none focus:border-yellow-500"
                    placeholder="Z czym masz największy problem?"
                    rows={2}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cel: Treningi / Tydz.</label>
                    <input 
                        type="number"
                        value={settings.targetWorkoutsPerWeek ?? ''}
                        onChange={(e) => updateSettings({ ...settings, targetWorkoutsPerWeek: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                        placeholder="3"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-center font-bold focus:border-yellow-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cel: Cardio / Tydz.</label>
                    <input 
                        type="number"
                        value={settings.targetCardioPerWeek ?? ''}
                        onChange={(e) => updateSettings({ ...settings, targetCardioPerWeek: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                        placeholder="3"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-center font-bold focus:border-yellow-500 outline-none"
                    />
                </div>
            </div>
            
            <button 
                onClick={confirmProfileSave}
                className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-black py-3 rounded-xl shadow-lg transition transform active:scale-95 uppercase italic text-xs tracking-widest flex items-center justify-center"
            >
                {saveStatus ? <><i className="fas fa-check mr-2"></i> {saveStatus}</> : "ZATWIERDŹ CELE I PROFIL"}
            </button>
        </div>
      </div>

      <div className="bg-[#1e1e1e] rounded-2xl shadow-md p-5 mb-6 border-l-4 border-red-600">
        <h3 className="text-sm font-black text-white mb-4 flex items-center uppercase italic">
          <i className="fas fa-magic text-red-500 mr-2"></i>Automatyzacja i Dźwięki
        </h3>
        <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-900 rounded-xl border border-gray-800">
                <div>
                <div className="text-[11px] font-black text-white uppercase italic tracking-widest">Automatyczna przerwa</div>
                <div className="text-[9px] text-gray-500 font-bold uppercase">Stoper po odhaczeniu serii</div>
                </div>
                <button 
                onClick={() => updateSettings({ ...settings, autoRestTimer: !settings.autoRestTimer })}
                className={`w-12 h-6 rounded-full transition-all relative shadow-inner ${settings.autoRestTimer ? 'bg-red-600' : 'bg-gray-700'}`}
                >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.autoRestTimer ? 'left-7' : 'left-1'}`}></div>
                </button>
            </div>

            <div className="p-3 bg-gray-900 rounded-xl border border-gray-800">
               <div className="mb-2">
                 <div>
                    <div className="text-[11px] font-black text-white uppercase italic tracking-widest mb-2">Rodzaj Dźwięku</div>
                 </div>
                 <div className="flex items-center space-x-2">
                    <select 
                        value={settings.soundType} 
                        onChange={(e) => {
                            updateSettings({ ...settings, soundType: e.target.value as any });
                        }}
                        className="flex-grow bg-black text-white text-[10px] font-bold p-2.5 rounded border border-gray-700 outline-none uppercase"
                    >
                        <option value="bell">1. Classic Bell</option>
                        <option value="double_bell">2. Double Bell</option>
                        <option value="chord">3. Soft Chord</option>
                        <option value="cosmic">4. Cosmic Tone</option>
                        <option value="gong">5. Deep Gong</option>
                        <option value="victory">6. Victory Up</option>
                        <option value="siren">7. Syrena (Głośna)</option>
                        <option value="school_bell">8. Dzwonek Szkolny</option>
                    </select>
                    <button 
                        onClick={playAlarm}
                        className="bg-gray-800 hover:bg-gray-700 text-white p-2.5 rounded border border-gray-700"
                    >
                        <i className="fas fa-play text-xs"></i>
                    </button>
                 </div>
               </div>
               
               {/* Volume Slider */}
               <div className="flex items-center space-x-3 mt-4 pt-2 border-t border-gray-800">
                   <i className="fas fa-volume-down text-gray-500 text-xs"></i>
                   <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={settings.volume !== undefined ? settings.volume : 0.5} 
                    onChange={(e) => {
                        updateSettings({ ...settings, volume: parseFloat(e.target.value) });
                    }}
                    onMouseUp={() => playAlarm()}
                    onTouchEnd={() => playAlarm()}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600"
                   />
                   <i className="fas fa-volume-up text-gray-500 text-xs"></i>
               </div>
            </div>

             <button 
                onClick={confirmProfileSave}
                className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl shadow-lg transition transform active:scale-95 uppercase italic text-xs tracking-widest flex items-center justify-center"
            >
                {saveStatus ? <><i className="fas fa-check mr-2"></i> {saveStatus}</> : "ZATWIERDŹ USTAWIENIA DŹWIĘKU"}
            </button>
        </div>
      </div>

      <div className="bg-[#1e1e1e] rounded-2xl shadow-md p-5 mb-6 border-l-4 border-blue-600">
        <h3 className="text-sm font-black text-white mb-4 flex items-center uppercase italic">
          <i className="fas fa-save text-blue-500 mr-2"></i>Kopia zapasowa
        </h3>
        <div className="grid grid-cols-2 gap-4">
            <button onClick={handleExport} className="bg-gray-900 hover:bg-gray-800 text-white p-4 rounded-xl flex flex-col items-center justify-center transition border border-gray-800 active:scale-95">
                <i className="fas fa-file-download text-xl mb-2 text-blue-500"></i>
                <span className="text-[10px] font-black uppercase italic">Eksportuj</span>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isImporting}
              className="bg-gray-900 hover:bg-gray-800 text-white p-4 rounded-xl flex flex-col items-center justify-center transition border border-gray-800 active:scale-95 disabled:opacity-50"
            >
                {isImporting ? <i className="fas fa-spinner fa-spin text-xl mb-2 text-blue-500"></i> : <i className="fas fa-file-upload text-xl mb-2 text-blue-500"></i>}
                <span className="text-[10px] font-black uppercase italic">{isImporting ? 'Czekaj...' : 'Importuj'}</span>
            </button>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportRequest} />
      </div>

      <div className="bg-[#1e1e1e] rounded-2xl shadow-md p-5">
        <div className="flex justify-between items-center mb-6">
           <h3 className="text-sm font-black text-white flex items-center uppercase italic"><i className="fas fa-dumbbell text-red-500 mr-2"></i>Edytor Treningu</h3>
           <button 
            onClick={handleAddWorkoutDay} 
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase italic transition flex items-center shadow-lg active:scale-95"
          >
             <i className="fas fa-calendar-plus mr-1.5"></i> Dodaj Dzień
           </button>
        </div>
        
        <div className="flex items-center space-x-2 mb-4">
          <select 
            className="flex-grow bg-gray-900 text-white p-4 rounded-xl border border-gray-800 text-sm font-bold outline-none focus:border-red-500 transition-all italic" 
            value={selectedWorkoutId} 
            onChange={e => { setSelectedWorkoutId(e.target.value); setEditingExerciseIdx(null); }}
          >
            <option value="">-- WYBIERZ DZIEŃ --</option>
            {(Object.entries(workouts) as [string, WorkoutPlan][]).map(([id, data]) => (<option key={id} value={id}>{data.title.toUpperCase()}</option>))}
          </select>
          {selectedWorkoutId && (
            <button onClick={handleDeleteWorkoutRequest} className="bg-red-900/20 text-red-500 p-4 rounded-xl border border-red-900/30 hover:bg-red-600 hover:text-white transition active:scale-95">
              <i className="fas fa-trash-alt"></i>
            </button>
          )}
        </div>

        {selectedWorkoutId && (
          <div className="border-t border-gray-800 pt-5">
             {editingExerciseIdx !== null ? (
               <ExerciseForm 
                 exercise={workouts[selectedWorkoutId].exercises[editingExerciseIdx]} 
                 onSave={handleEditSave} 
                 onCancel={() => setEditingExerciseIdx(null)} 
                 onDelete={() => handleDeleteExerciseRequest(editingExerciseIdx)} 
               />
             ) : (
               <>
                 <div className="space-y-3">
                   {workouts[selectedWorkoutId].exercises.map((ex, idx) => (
                     <div key={idx} className="bg-gray-900 p-4 rounded-2xl flex justify-between items-center border border-gray-800 shadow-sm active:bg-gray-800 transition">
                       <div className="flex-1 cursor-pointer" onClick={() => setEditingExerciseIdx(idx)}>
                          <div className="font-black text-xs text-white italic uppercase tracking-tighter">{idx+1}. {ex.name}</div>
                          <div className="text-[9px] text-gray-600 font-bold uppercase mt-0.5">{ex.sets}s | {ex.reps}p | {ex.rest}s | {ex.type}</div>
                       </div>
                       <div className="flex space-x-2 ml-2">
                         <div className="flex flex-col space-y-1">
                           {idx > 0 && <button onClick={() => handleMove(idx, -1)} className="text-gray-600 hover:text-white p-1.5 text-[10px]"><i className="fas fa-arrow-up"></i></button>}
                           {idx < workouts[selectedWorkoutId].exercises.length - 1 && <button onClick={() => handleMove(idx, 1)} className="text-gray-600 hover:text-white p-1.5 text-[10px]"><i className="fas fa-arrow-down"></i></button>}
                         </div>
                         <button onClick={(e) => { e.stopPropagation(); handleDeleteExerciseRequest(idx); }} className="text-red-900 hover:text-red-500 p-2 transition"><i className="fas fa-times-circle"></i></button>
                       </div>
                     </div>
                   ))}
                 </div>
                 <button onClick={handleAddExercise} className="mt-6 w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-4 rounded-2xl border border-red-500/30 font-black uppercase italic tracking-widest text-xs transition shadow-lg active:scale-95">
                   Dodaj ćwiczenie
                 </button>
               </>
             )}
          </div>
        )}
      </div>

      {/* CONFIRM MODAL */}
      {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-fade-in">
              <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-red-900/20 p-4 border-b border-red-900/30 flex items-center justify-center">
                      <i className="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                  </div>
                  <div className="p-6 text-center">
                      <h3 className="text-xl font-black text-white italic uppercase mb-2">Potwierdź</h3>
                      <p className="text-gray-400 text-sm font-medium">{confirmModal.message}</p>
                  </div>
                  <div className="flex border-t border-gray-800">
                      <button 
                          onClick={() => setConfirmModal(null)}
                          className="flex-1 py-4 text-gray-400 font-bold hover:bg-gray-800 transition text-xs uppercase"
                      >
                          Anuluj
                      </button>
                      <button 
                          onClick={confirmModal.action}
                          className="flex-1 py-4 text-red-500 font-bold hover:bg-red-900/20 transition text-xs uppercase border-l border-gray-800"
                      >
                          Wykonaj
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

const ExerciseForm = ({ exercise, onSave, onCancel, onDelete }: { exercise: Exercise, onSave: (e: Exercise) => void, onCancel: () => void, onDelete: () => void }) => {
  const [formData, setFormData] = useState<Exercise>({ ...exercise });
  const handleChange = (field: keyof Exercise, value: any) => setFormData(prev => ({ ...prev, [field]: value }));
  
  return (
    <div className="bg-gray-900 p-5 rounded-3xl border-2 border-red-600 animate-fade-in shadow-2xl relative z-30">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-black text-white text-base uppercase italic tracking-tighter">Edycja ćwiczenia</h4>
        <button onClick={onDelete} className="bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase italic transition flex items-center border border-red-500/30"><i className="fas fa-trash-alt mr-1.5"></i> Usuń</button>
      </div>
      <div className="space-y-4 text-xs font-bold">
        <div>
          <label className="text-[9px] text-gray-600 font-black uppercase italic mb-1.5 block tracking-widest">Nazwa ćwiczenia</label>
          <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-3.5 rounded-xl outline-none focus:border-red-600 transition" />
        </div>
        <div>
          <label className="text-[9px] text-gray-600 font-black uppercase italic mb-1.5 block tracking-widest">Opis / Skos / Uwagi (PL)</label>
          <input type="text" value={formData.pl} onChange={e => handleChange('pl', e.target.value)} className="w-full bg-black border border-gray-800 text-gray-400 p-3.5 rounded-xl outline-none focus:border-red-600 transition" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] text-gray-600 font-black uppercase italic mb-1.5 block tracking-widest">Logowanie</label>
            <select value={formData.type} onChange={e => handleChange('type', e.target.value as ExerciseType)} className="w-full bg-black border border-gray-800 text-white p-3.5 rounded-xl outline-none focus:border-red-600 transition font-bold uppercase">
              <option value="standard">KG + POWT</option>
              <option value="reps_only">TYLKO POWT</option>
              <option value="time">CZAS (SEK)</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 font-black uppercase italic mb-1.5 block tracking-widest">Serie</label>
            <input type="number" value={formData.sets} onChange={e => handleChange('sets', parseInt(e.target.value))} className="w-full bg-black border border-gray-800 text-white p-3.5 rounded-xl text-center" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] text-gray-600 font-black uppercase italic mb-1.5 block tracking-widest">Zakres powt.</label>
            <input type="text" value={formData.reps} onChange={e => handleChange('reps', e.target.value)} className="w-full bg-black border border-gray-800 text-green-500 p-3.5 rounded-xl text-center" placeholder="8-10" />
          </div>
          <div>
            <label className="text-[9px] text-gray-600 font-black uppercase italic mb-1.5 block tracking-widest">Przerwa (s)</label>
            <input type="number" value={formData.rest} onChange={e => handleChange('rest', parseInt(e.target.value))} className="w-full bg-black border border-gray-800 text-white p-3.5 rounded-xl text-center" placeholder="90" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] text-gray-600 font-black uppercase italic mb-1.5 block tracking-widest">Tempo</label>
            <input type="text" value={formData.tempo} onChange={e => handleChange('tempo', e.target.value)} className="w-full bg-black border border-gray-800 text-blue-500 p-3.5 rounded-xl text-center" placeholder="2011" />
          </div>
          <div>
            <label className="text-[9px] text-gray-600 font-black uppercase italic mb-1.5 block tracking-widest">RIR</label>
            <input type="text" value={formData.rir} onChange={e => handleChange('rir', e.target.value)} className="w-full bg-black border border-gray-800 text-red-500 p-3.5 rounded-xl text-center" placeholder="1" />
          </div>
        </div>

        <div>
          <label className="text-[9px] text-gray-600 font-black uppercase italic mb-1.5 block tracking-widest">Link YouTube</label>
          <input type="text" value={formData.link} onChange={e => handleChange('link', e.target.value)} className="w-full bg-black border border-gray-800 text-blue-400 p-3.5 rounded-xl outline-none focus:border-red-600 transition" placeholder="https://..." />
        </div>
      </div>
      <div className="flex space-x-3 mt-8">
        <button onClick={() => onSave(formData)} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black uppercase italic tracking-widest text-xs shadow-xl active:scale-95 transition">Zapisz</button>
        <button onClick={onCancel} className="flex-1 bg-gray-800 text-gray-400 py-4 rounded-2xl font-black uppercase italic tracking-widest text-xs active:scale-95 transition">Anuluj</button>
      </div>
    </div>
  );
};
