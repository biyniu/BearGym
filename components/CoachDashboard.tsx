
import React, { useState, useEffect } from 'react';
import { remoteStorage, parseDateStr, storage } from '../services/storage';
import { Exercise, WarmupExercise, ExerciseType } from '../types';

type CoachTab = 'plan' | 'history' | 'calendar' | 'cardio' | 'measurements' | 'progress' | 'training';

export default function CoachDashboard() {
  const [authCode, setAuthCode] = useState('');
  const [userRole, setUserRole] = useState<'super-admin' | 'coach' | null>(null);
  const [currentCoachName, setCurrentCoachName] = useState('');
  
  const [coaches, setCoaches] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<CoachTab>('plan');
  
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editedPlan, setEditedPlan] = useState<any>(null);

  const [activeTraining, setActiveTraining] = useState<{workoutId: string, results: any} | null>(null);
  const [modalType, setModalType] = useState<'add-coach' | 'add-client' | null>(null);
  const [form, setForm] = useState({ name: '', code: '' });

  const handleLogin = async () => {
    setLoading(true);
    const res = await remoteStorage.checkCoachAuth(authCode);
    if (res.success) {
      setUserRole(res.role as any);
      setCurrentCoachName(res.name || 'Super Admin');
      if (res.role === 'super-admin') {
        const list = await remoteStorage.fetchAllCoaches();
        setCoaches(list);
      } else {
        const list = await remoteStorage.fetchClients(authCode);
        setClients(list);
      }
    } else alert(res.error);
    setLoading(false);
  };

  const handleSelectCoach = async (id: string) => {
    setSelectedCoachId(id);
    setLoading(true);
    const list = await remoteStorage.fetchClients(id);
    setClients(list);
    setSelectedClient(null);
    setLoading(false);
  };

  const loadClientDetail = async (id: string) => {
    setLoading(true);
    const res = await remoteStorage.fetchUserData(id);
    if (res.success) {
      setSelectedClient(res);
      setEditedPlan(res.plan || {});
      setActiveTab('plan');
      setActiveTraining(null);
      setIsEditingPlan(false);
    }
    setLoading(false);
  };

  const handleSavePlan = async () => {
    if (!selectedClient || !editedPlan) return;
    setLoading(true);
    const success = await remoteStorage.saveToCloud(selectedClient.code, 'plan', editedPlan);
    if (success) {
        alert("Plan zapisany pomyślnie w chmurze!");
        setIsEditingPlan(false);
        loadClientDetail(selectedClient.code);
    } else alert("Błąd zapisu planu.");
    setLoading(false);
  };

  const addWorkoutDay = () => {
    const title = window.prompt("Podaj nazwę dnia (np. Góra, Dół, FBW):");
    if(!title) return;
    const id = `w_${Date.now()}`;
    setEditedPlan({ ...editedPlan, [id]: { title, exercises: [], warmup: [] } });
  };

  const addWarmupEx = (wId: string) => {
    const updated = { ...editedPlan };
    if(!updated[wId].warmup) updated[wId].warmup = [];
    updated[wId].warmup.push({ name: 'Nowe ćwiczenie', reps: '15', link: '', pl: '' });
    setEditedPlan(updated);
  };

  const addExercise = (wId: string) => {
    const newEx: Exercise = { 
        id: `ex_${Date.now()}`, 
        name: "Nowe ćwiczenie", 
        pl: "", 
        sets: 4, 
        reps: "8-12", 
        tempo: "2011", 
        rir: "2", 
        rest: 90, 
        link: "", 
        type: "standard" 
    };
    const updated = { ...editedPlan };
    if (!updated[wId].exercises) updated[wId].exercises = [];
    updated[wId].exercises.push(newEx);
    setEditedPlan(updated);
  };

  const updateExField = (wId: string, exIdx: number, field: keyof Exercise, val: any) => {
    const updated = { ...editedPlan };
    updated[wId].exercises[exIdx] = { ...updated[wId].exercises[exIdx], [field]: val };
    setEditedPlan(updated);
  };

  const updateWarmupField = (wId: string, idx: number, field: keyof WarmupExercise, val: any) => {
    const updated = { ...editedPlan };
    updated[wId].warmup[idx] = { ...updated[wId].warmup[idx], [field]: val };
    setEditedPlan(updated);
  };

  const updateLiveResult = (exId: string, sIdx: number, val: string) => {
    if (!activeTraining) return;
    const updatedResults = { ...activeTraining.results };
    if (!updatedResults[exId]) updatedResults[exId] = [];
    updatedResults[exId][sIdx] = val;
    setActiveTraining({ ...activeTraining, results: updatedResults });
  };

  // Fixed Error: Added missing startLiveTraining function
  const startLiveTraining = (workoutId: string) => {
    setActiveTraining({ workoutId, results: {} });
  };

  const finishLiveTraining = async () => {
    if(!activeTraining || !selectedClient) return;
    if(!window.confirm("Czy zakończyć i zapisać sesję?")) return;
    const d = new Date();
    const dateStr = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} (Trener: ${currentCoachName})`;
    const sessionResults: any = {};
    Object.entries(activeTraining.results).forEach(([exId, sets]: any) => {
        const filteredSets = sets.filter((s: string) => s && s.trim() !== "");
        if (filteredSets.length > 0) sessionResults[exId] = filteredSets.join(' | ');
    });
    const newHistory = [{ date: dateStr, timestamp: d.getTime(), results: sessionResults, workoutId: activeTraining.workoutId }, ...(selectedClient.history || [])];
    setLoading(true);
    await remoteStorage.saveToCloud(selectedClient.code, 'history', newHistory);
    alert("Trening zapisany!");
    loadClientDetail(selectedClient.code);
    setLoading(false);
  };

  if (!userRole) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#161616] p-10 rounded-3xl border border-gray-800 shadow-2xl text-center">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-900/20">
            <i className="fas fa-user-shield text-3xl text-white"></i>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 italic uppercase">Bear Gym Admin</h1>
          <p className="text-gray-600 text-[10px] mb-8 uppercase font-bold tracking-widest">Panel Zarządzania</p>
          <input 
            type="password" 
            placeholder="KOD DOSTĘPU"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
            className="w-full bg-black border border-gray-700 text-white p-4 rounded-xl text-center mb-4 focus:border-red-500 outline-none font-mono tracking-widest text-lg"
          />
          <button onClick={handleLogin} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl transition shadow-lg uppercase italic tracking-widest">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : "ZALOGUJ SIĘ"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex text-gray-300 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#111] border-r border-gray-800 flex flex-col h-screen sticky top-0 z-20">
        <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-black italic shadow-lg">B</div>
          <h2 className="text-[10px] font-black text-white italic uppercase tracking-widest">{userRole === 'super-admin' ? 'Super Admin' : 'Trener'}</h2>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-6">
          {userRole === 'super-admin' && (
            <div>
              <div className="flex justify-between items-center mb-3 px-2">
                <span className="text-[9px] font-bold text-gray-600 uppercase">Trenerzy</span>
                <button onClick={() => setModalType('add-coach')} className="text-blue-500 text-[10px] font-black">+</button>
              </div>
              {coaches.map(c => (
                <button key={c.id} onClick={() => handleSelectCoach(c.id)} className={`w-full text-left p-3 rounded-xl transition mb-1 border ${selectedCoachId === c.id ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-transparent border-transparent hover:bg-gray-800 text-gray-500'}`}>
                    <span className="font-bold text-[10px] uppercase italic">{c.name}</span>
                </button>
              ))}
            </div>
          )}
          <div>
            <div className="flex justify-between items-center mb-3 px-2">
              <span className="text-[9px] font-bold text-gray-600 uppercase">Podopieczni</span>
              {(userRole === 'coach' || selectedCoachId) && <button onClick={() => setModalType('add-client')} className="text-green-500 text-[10px] font-black">+</button>}
            </div>
            {clients.map(c => (
              <button key={c.code} onClick={() => loadClientDetail(c.code)} className={`w-full text-left p-3 rounded-xl transition mb-1 border ${selectedClient?.code === c.code ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-transparent border-transparent hover:bg-gray-800 text-gray-400'}`}>
                   <div className="font-bold text-[10px] uppercase italic">{c.name}</div>
                   <div className="text-[8px] font-mono opacity-40">{c.code}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-gray-800 bg-black/20">
           <div className="text-center text-[9px] text-gray-600 font-bold mb-2 uppercase">{currentCoachName}</div>
           <button onClick={() => window.location.reload()} className="w-full py-2.5 bg-black/40 rounded-xl text-red-500 text-[9px] font-black uppercase italic hover:bg-red-600/10 transition border border-red-900/20">Wyloguj</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-grow p-8 overflow-y-auto">
        {selectedClient ? (
          <div className="max-w-6xl mx-auto animate-fade-in">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-6 border-b border-gray-800 pb-8">
              <div>
                <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">{selectedClient.name}</h1>
                <p className="text-gray-500 font-mono text-xs flex items-center">
                  <span className="bg-gray-800 px-2 py-0.5 rounded mr-2 text-white">ID: {selectedClient.code}</span>
                  Trener: {selectedClient.coachId}
                </p>
              </div>
              
              {/* NAWIGACJA ZGODNIE ZE ZDJĘCIEM */}
              <nav className="flex bg-[#161616] p-1 rounded-2xl border border-gray-800 shadow-2xl overflow-x-auto">
                <TabBtn active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} label="PLAN" icon="fa-dumbbell" />
                <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="HISTORIA" icon="fa-history" />
                <TabBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} label="KALENDARZ" icon="fa-calendar-alt" />
                <TabBtn active={activeTab === 'cardio'} onClick={() => setActiveTab('cardio')} label="CARDIO/MOB" icon="fa-running" />
                <TabBtn active={activeTab === 'measurements'} onClick={() => setActiveTab('measurements')} label="POMIARY" icon="fa-ruler" />
                <TabBtn active={activeTab === 'progress'} onClick={() => setActiveTab('progress')} label="PROGRES" icon="fa-chart-line" />
                <div className="w-px bg-gray-800 mx-1"></div>
                <TabBtn active={activeTab === 'training'} onClick={() => setActiveTab('training')} label="PROWADŹ" icon="fa-tablet-alt" color="text-yellow-500" />
              </nav>
            </header>

            {/* TAB: PLAN */}
            {activeTab === 'plan' && (
              <div className="space-y-10">
                <div className="flex justify-end space-x-3 sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur py-4">
                   {!isEditingPlan ? (
                     <button onClick={() => setIsEditingPlan(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs shadow-xl transition active:scale-95">EDYTUJ PLAN</button>
                   ) : (
                     <>
                        <button onClick={handleSavePlan} className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs shadow-xl transition active:scale-95">ZAPISZ W CHMURZE</button>
                        <button onClick={() => { setIsEditingPlan(false); setEditedPlan(selectedClient.plan); }} className="bg-gray-800 text-gray-500 px-8 py-4 rounded-2xl font-bold uppercase text-xs">ANULUJ</button>
                     </>
                   )}
                </div>

                {Object.entries(editedPlan || {}).map(([wId, workout]: any) => (
                  <div key={wId} className="bg-[#161616] rounded-3xl border border-gray-800 p-8 shadow-2xl space-y-8 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-6">
                        <div className="flex items-center space-x-4">
                           <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg"><i className="fas fa-calendar-alt"></i></div>
                           <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">{workout.title}</h3>
                        </div>
                        {isEditingPlan && (
                          <button onClick={() => { delete editedPlan[wId]; setEditedPlan({...editedPlan}); }} className="text-red-900 hover:text-red-500 transition p-3 bg-red-900/10 rounded-xl">
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                    </div>

                    {/* ROZGRZEWKA */}
                    <div className="bg-black/20 p-6 rounded-2xl border border-gray-800/50">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-lg font-black text-red-500 italic uppercase flex items-center"><i className="fas fa-fire-alt mr-2"></i> ROZGRZEWKA / AKTYWACJA</h4>
                            {isEditingPlan && <button onClick={() => addWarmupEx(wId)} className="text-[10px] font-black text-blue-500 uppercase">+ DODAJ</button>}
                        </div>
                        <div className="space-y-3">
                            {workout.warmup?.map((wex: any, widx: number) => (
                                <div key={widx} className="grid grid-cols-12 gap-3 items-center bg-black/40 p-4 rounded-xl border border-gray-800">
                                    <div className="col-span-6">
                                        {isEditingPlan ? (
                                            <input value={wex.name} onChange={e => updateWarmupField(wId, widx, 'name', e.target.value)} placeholder="Nazwa" className="w-full bg-black border border-gray-800 text-white p-2 rounded text-xs font-bold" />
                                        ) : <span className="text-xs font-bold text-gray-300 uppercase italic">{wex.name}</span>}
                                    </div>
                                    <div className="col-span-2 text-center">
                                        {isEditingPlan ? (
                                            <input value={wex.reps} onChange={e => updateWarmupField(wId, widx, 'reps', e.target.value)} placeholder="Reps" className="w-full bg-black border border-gray-800 text-white p-2 rounded text-xs text-center font-bold" />
                                        ) : <span className="text-xs text-gray-500 font-mono">{wex.reps}</span>}
                                    </div>
                                    <div className="col-span-3">
                                        {isEditingPlan ? (
                                            <input value={wex.link} onChange={e => updateWarmupField(wId, widx, 'link', e.target.value)} placeholder="YouTube" className="w-full bg-black border border-gray-800 text-blue-400 p-2 rounded text-[10px]" />
                                        ) : (wex.link && <a href={wex.link} target="_blank" className="text-red-600 text-xs"><i className="fab fa-youtube mr-1"></i> WIDEO</a>)}
                                    </div>
                                    <div className="col-span-1 text-right">
                                        {isEditingPlan && <button onClick={() => { workout.warmup.splice(widx,1); setEditedPlan({...editedPlan}); }} className="text-red-900"><i className="fas fa-times"></i></button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* LISTA ĆWICZEŃ - UKŁAD TABELARYCZNY ZGODNY ZE ZDJĘCIEM */}
                    <div className="space-y-2 overflow-x-auto">
                        <div className="grid grid-cols-12 gap-2 px-4 mb-2 text-[10px] font-black text-gray-600 uppercase italic tracking-widest min-w-[800px]">
                            <div className="col-span-1">#</div>
                            <div className="col-span-4">Ćwiczenie</div>
                            <div className="col-span-1 text-center">S</div>
                            <div className="col-span-1 text-center">Reps</div>
                            <div className="col-span-1 text-center">Tempo</div>
                            <div className="col-span-1 text-center">RIR</div>
                            <div className="col-span-1 text-center">Rest</div>
                            <div className="col-span-1 text-center">Typ</div>
                            <div className="col-span-1 text-right">Link/Usuń</div>
                        </div>

                        {workout.exercises?.map((ex: any, idx: number) => (
                        <div key={ex.id} className="grid grid-cols-12 gap-2 items-center bg-black/40 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition min-w-[800px]">
                           <div className="col-span-1 font-black text-blue-600 italic text-sm">{idx + 1}</div>
                           <div className="col-span-4">
                              {isEditingPlan ? (
                                <div className="space-y-1">
                                  <input value={ex.name} onChange={e => updateExField(wId, idx, 'name', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-2 rounded text-xs font-black uppercase italic" />
                                  <input value={ex.pl} onChange={e => updateExField(wId, idx, 'pl', e.target.value)} className="w-full bg-black border border-gray-900 text-gray-500 p-2 rounded text-[9px]" placeholder="Opis" />
                                </div>
                              ) : (
                                <div>
                                    <div className="font-black text-white text-xs uppercase italic truncate">{ex.name}</div>
                                    <div className="text-[9px] text-gray-600 italic truncate">{ex.pl}</div>
                                </div>
                              )}
                           </div>
                           <div className="col-span-1"><input disabled={!isEditingPlan} type="number" value={ex.sets} onChange={e => updateExField(wId, idx, 'sets', parseInt(e.target.value))} className="w-full bg-black border border-gray-800 text-white p-2.5 rounded text-center text-xs font-black" /></div>
                           <div className="col-span-1"><input disabled={!isEditingPlan} value={ex.reps} onChange={e => updateExField(wId, idx, 'reps', e.target.value)} className="w-full bg-black border border-gray-800 text-green-500 p-2.5 rounded text-center text-xs font-black" /></div>
                           <div className="col-span-1"><input disabled={!isEditingPlan} value={ex.tempo} onChange={e => updateExField(wId, idx, 'tempo', e.target.value)} className="w-full bg-black border border-gray-800 text-blue-500 p-2.5 rounded text-center text-xs font-black" /></div>
                           <div className="col-span-1"><input disabled={!isEditingPlan} value={ex.rir} onChange={e => updateExField(wId, idx, 'rir', e.target.value)} className="w-full bg-black border border-gray-800 text-red-500 p-2.5 rounded text-center text-xs font-black" /></div>
                           <div className="col-span-1"><input disabled={!isEditingPlan} type="number" value={ex.rest} onChange={e => updateExField(wId, idx, 'rest', parseInt(e.target.value))} className="w-full bg-black border border-gray-800 text-white p-2.5 rounded text-center text-xs font-black" /></div>
                           <div className="col-span-1">
                               <select disabled={!isEditingPlan} value={ex.type} onChange={e => updateExField(wId, idx, 'type', e.target.value)} className="w-full bg-black border border-gray-800 text-gray-400 p-2 rounded text-[9px] font-black uppercase text-center outline-none">
                                   <option value="standard">STD</option>
                                   <option value="reps_only">REPS</option>
                                   <option value="time">TIME</option>
                               </select>
                           </div>
                           <div className="col-span-1 flex justify-end items-center space-x-3">
                                {isEditingPlan ? (
                                    <>
                                        <input value={ex.link} onChange={e => updateExField(wId, idx, 'link', e.target.value)} placeholder="YT" className="w-full bg-black border border-gray-800 text-blue-500 p-2 rounded text-[8px]" />
                                        <button onClick={() => { workout.exercises.splice(idx,1); setEditedPlan({...editedPlan}); }} className="text-red-900"><i className="fas fa-trash text-xs"></i></button>
                                    </>
                                ) : (
                                    ex.link && <a href={ex.link} target="_blank" className="text-red-600 opacity-60 hover:opacity-100 transition"><i className="fab fa-youtube"></i></a>
                                )}
                           </div>
                        </div>
                      ))}
                      {isEditingPlan && (
                        <button onClick={() => addExercise(wId)} className="w-full py-4 bg-gray-800/20 rounded-2xl border border-dashed border-gray-700 text-gray-600 text-[10px] font-black uppercase hover:bg-gray-800/40 transition">
                          + Dodaj Ćwiczenie Główne
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isEditingPlan && (
                  <button onClick={addWorkoutDay} className="w-full py-8 bg-red-600/5 rounded-3xl border-2 border-dashed border-red-600/30 text-red-500 font-black uppercase italic hover:bg-red-600/10 transition flex flex-col items-center justify-center">
                    <i className="fas fa-calendar-plus text-3xl mb-3"></i>
                    <span>DODAJ NOWY DZIEŃ TRENINGOWY</span>
                  </button>
                )}
              </div>
            )}

            {/* TAB: KALENDARZ */}
            {activeTab === 'calendar' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    {selectedClient.history?.map((h: any, i: number) => (
                        <div key={i} className="bg-[#161616] p-6 rounded-2xl border border-gray-800 shadow-xl border-l-4 border-blue-600">
                            <div className="text-blue-500 font-black text-xs uppercase mb-3 italic tracking-widest">{h.date}</div>
                            <div className="text-white font-black text-lg uppercase italic tracking-tighter mb-4">{selectedClient.plan?.[h.workoutId]?.title || 'Trening'}</div>
                            <div className="grid grid-cols-1 gap-2 opacity-60">
                                {Object.keys(h.results).slice(0, 3).map(exId => (
                                    <div key={exId} className="text-[10px] truncate border-b border-gray-800 pb-1 last:border-0">• {selectedClient.plan?.[h.workoutId]?.exercises.find((e:any)=>e.id===exId)?.name || 'Ćwiczenie'}</div>
                                ))}
                                {Object.keys(h.results).length > 3 && <div className="text-[9px] italic">... i {Object.keys(h.results).length - 3} więcej</div>}
                            </div>
                        </div>
                    ))}
                    {(!selectedClient.history || selectedClient.history.length === 0) && <p className="col-span-full text-center opacity-20 py-20 uppercase font-black italic">Brak historii sesji</p>}
                </div>
            )}

            {/* TAB: CARDIO */}
            {activeTab === 'cardio' && (
                <div className="space-y-4 animate-fade-in">
                    {selectedClient.extras?.cardio?.map((c: any, i: number) => (
                        <div key={i} className="bg-[#161616] p-6 rounded-2xl border border-gray-800 flex justify-between items-center shadow-xl border-l-4 border-red-600">
                            <div>
                                <div className="text-[10px] font-black uppercase italic text-red-500 tracking-widest">{c.date}</div>
                                <div className="text-white font-black text-xl uppercase italic tracking-tighter">{c.type}</div>
                                {c.notes && <div className="text-[10px] text-gray-500 italic mt-1">{c.notes}</div>}
                            </div>
                            <div className="text-3xl font-black text-white italic">{c.duration}</div>
                        </div>
                    ))}
                    {(!selectedClient.extras?.cardio || selectedClient.extras.cardio.length === 0) && <p className="text-center opacity-20 py-20 uppercase font-black italic">Brak aktywności dodatkowej</p>}
                </div>
            )}

            {/* TAB: POMIARY */}
            {activeTab === 'measurements' && (
                <div className="overflow-x-auto bg-[#161616] rounded-3xl border border-gray-800 p-6 animate-fade-in shadow-2xl">
                    <table className="w-full text-left text-xs font-bold">
                        <thead>
                            <tr className="text-gray-600 uppercase italic border-b border-gray-800">
                                <th className="p-4">Data</th>
                                <th className="p-4">Waga</th>
                                <th className="p-4">Pas</th>
                                <th className="p-4">Klatka</th>
                                <th className="p-4">Biceps</th>
                                <th className="p-4">Udo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedClient.extras?.measurements?.map((m: any, i: number) => (
                                <tr key={i} className="border-b border-gray-800/50 text-white hover:bg-gray-800/30 transition">
                                    <td className="p-4 text-blue-500 font-mono">{m.date}</td>
                                    <td className="p-4 font-black italic text-lg">{m.weight} kg</td>
                                    <td className="p-4">{m.waist} cm</td>
                                    <td className="p-4">{m.chest} cm</td>
                                    <td className="p-4 text-red-500">{m.biceps} cm</td>
                                    <td className="p-4">{m.thigh} cm</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB: PROWADŹ (TABLET) */}
            {activeTab === 'training' && (
                <div className="space-y-6 animate-fade-in">
                    {!activeTraining ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(selectedClient.plan || {}).map(([id, w]: any) => (
                                <button key={id} onClick={() => startLiveTraining(id)} className="bg-[#161616] p-10 rounded-3xl border border-gray-800 hover:border-yellow-500 text-center shadow-2xl group transition transform active:scale-95">
                                    <i className="fas fa-play text-4xl text-gray-700 group-hover:text-yellow-500 mb-6 block transition"></i>
                                    <span className="text-white font-black italic uppercase tracking-widest text-lg">{w.title}</span>
                                    <div className="text-[9px] text-gray-600 font-bold uppercase mt-4 opacity-0 group-hover:opacity-100 transition">Rozpocznij sesję treningową</div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-[#111] p-10 rounded-3xl border border-yellow-600/50 shadow-2xl relative overflow-hidden">
                            <div className="flex justify-between items-center mb-12 relative z-10">
                                <div>
                                    <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">{selectedClient.plan[activeTraining.workoutId].title}</h3>
                                    <p className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mt-1">SESJA NA ŻYWO Z TRENEREM</p>
                                </div>
                                <button onClick={finishLiveTraining} className="bg-green-600 hover:bg-green-700 px-10 py-5 rounded-2xl font-black text-white uppercase italic shadow-2xl transition transform active:scale-95">ZAPISZ SESJĘ KLIENTA</button>
                            </div>
                            <div className="space-y-6 relative z-10">
                                {selectedClient.plan[activeTraining.workoutId].exercises.map((ex: any) => (
                                    <div key={ex.id} className="bg-black/40 p-8 rounded-2xl border border-gray-800 hover:border-gray-700 transition group">
                                        <div className="flex justify-between items-center mb-8">
                                            <span className="text-2xl font-black text-white uppercase italic tracking-tight group-hover:text-yellow-500 transition">{ex.name}</span>
                                            <span className="bg-gray-800 px-4 py-2 rounded-full text-[10px] text-gray-400 font-bold uppercase tracking-widest">{ex.reps}p | {ex.tempo} | RIR {ex.rir}</span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                            {Array.from({length: ex.sets}).map((_, sIdx) => (
                                                <div key={sIdx} className="space-y-2">
                                                    <span className="text-[9px] font-black text-gray-700 uppercase ml-2 tracking-widest">Seria {sIdx+1}</span>
                                                    <input 
                                                        placeholder="kg x powt" 
                                                        onChange={(e) => updateLiveResult(ex.id, sIdx, e.target.value)} 
                                                        className="w-full bg-black border border-gray-700 text-white p-4 rounded-2xl text-center font-black text-sm focus:border-yellow-500 outline-none placeholder:text-gray-900 transition" 
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-5 text-center py-20">
            <i className="fas fa-bear-tracking text-[200px] mb-8"></i>
            <h2 className="text-6xl font-black italic uppercase tracking-tighter">BEAR GYM SYSTEM</h2>
            <p className="mt-4 text-2xl font-bold uppercase tracking-[0.4em]">Wybierz podopiecznego, aby kontynuować</p>
          </div>
        )}
      </main>

      {/* MODALE */}
      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-[#161616] border border-gray-800 rounded-3xl p-10 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 ${modalType === 'add-coach' ? 'bg-blue-600' : 'bg-green-600'}`}></div>
            <h3 className="text-2xl font-black text-white italic uppercase mb-8 tracking-tight flex items-center">
              <i className={`fas ${modalType === 'add-coach' ? 'fa-user-tie text-blue-500' : 'fa-user-plus text-green-500'} mr-3`}></i>
              {modalType === 'add-coach' ? 'Nowy Trener' : 'Nowy Klient'}
            </h3>
            <div className="space-y-5">
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Imię i Nazwisko" className="w-full bg-black border border-gray-800 p-5 rounded-2xl outline-none text-white text-sm font-bold focus:border-red-600 transition" />
              <input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="UNIKALNY KOD / HASŁO" className="w-full bg-black border border-gray-800 p-5 rounded-2xl outline-none text-white text-sm font-mono tracking-widest focus:border-red-600 transition" />
              <button onClick={async () => {
                 setLoading(true);
                 if(modalType === 'add-coach') await remoteStorage.createNewCoach(form.code, form.name);
                 else await remoteStorage.createNewClient(form.code, form.name, userRole === 'super-admin' ? selectedCoachId! : authCode);
                 setModalType(null); setForm({name:'', code:''}); handleLogin();
                 setLoading(false);
              }} className="w-full bg-red-600 hover:bg-red-700 py-5 rounded-2xl font-black uppercase italic text-white shadow-2xl transition transform active:scale-95">UTWÓRZ PROFIL TERAZ</button>
              <button onClick={() => setModalType(null)} className="w-full text-gray-600 text-[10px] font-black uppercase py-2 hover:text-gray-400 transition">Zamknij okno</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label, icon, color = 'text-gray-500' }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase italic transition flex items-center space-x-2 shrink-0 ${active ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : `${color} hover:text-white hover:bg-white/5`}`}
    >
      <i className={`fas ${icon}`}></i>
      <span>{label}</span>
    </button>
  );
}
