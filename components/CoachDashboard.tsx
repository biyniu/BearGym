
import React, { useState, useEffect } from 'react';
import { remoteStorage, parseDateStr, storage } from '../services/storage';
import { Exercise } from '../types';

export default function CoachDashboard() {
  const [authCode, setAuthCode] = useState('');
  const [userRole, setUserRole] = useState<'super-admin' | 'coach' | null>(null);
  const [currentCoachName, setCurrentCoachName] = useState('');
  
  const [coaches, setCoaches] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'history' | 'training' | 'progress'>('plan');
  
  // Edytor Planu
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editedPlan, setEditedPlan] = useState<any>(null);

  // Moduł Treningowy (Tablet)
  const [activeTraining, setActiveTraining] = useState<{workoutId: string, results: any} | null>(null);

  // Modale
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
        alert("Plan został pomyślnie zapisany w chmurze!");
        setIsEditingPlan(false);
        // Odśwież dane klienta
        loadClientDetail(selectedClient.code);
    } else {
        alert("Błąd zapisu planu.");
    }
    setLoading(false);
  };

  const addWorkoutDay = () => {
    const title = window.prompt("Podaj nazwę dnia treningowego (np. Trening A, Push, Pull):");
    if(!title) return;
    const id = `w_${Date.now()}`;
    setEditedPlan({ ...editedPlan, [id]: { title, exercises: [], warmup: [] } });
  };

  const addExercise = (wId: string) => {
    const newEx: Exercise = {
      id: `ex_${Date.now()}`,
      name: "Nowe ćwiczenie",
      pl: "Dodaj opis lub uwagi...",
      sets: 3, 
      reps: "10-12", 
      tempo: "2011", 
      rir: "1", 
      rest: 90, 
      link: "", 
      type: "standard"
    };
    const updated = { ...editedPlan };
    if (!updated[wId].exercises) updated[wId].exercises = [];
    updated[wId].exercises.push(newEx);
    setEditedPlan(updated);
  };

  const deleteWorkoutDay = (wId: string) => {
    if(!window.confirm("Czy na pewno usunąć cały ten dzień treningowy?")) return;
    const updated = { ...editedPlan };
    delete updated[wId];
    setEditedPlan(updated);
  };

  const updateExField = (wId: string, exIdx: number, field: keyof Exercise, val: any) => {
    const updated = { ...editedPlan };
    updated[wId].exercises[exIdx] = { ...updated[wId].exercises[exIdx], [field]: val };
    setEditedPlan(updated);
  };

  // Prowadzenie Treningu (Tablet)
  const startLiveTraining = (wId: string) => {
    setActiveTraining({ workoutId: wId, results: {} });
    setActiveTab('training');
  };

  const updateLiveResult = (exId: string, setIdx: number, val: string) => {
    const updated = { ...activeTraining };
    if(!updated!.results[exId]) updated!.results[exId] = [];
    updated!.results[exId][setIdx] = val;
    setActiveTraining(updated as any);
  };

  const finishLiveTraining = async () => {
    if(!activeTraining || !selectedClient) return;
    if(!window.confirm("Czy zakończyć trening i zapisać wyniki?")) return;

    const d = new Date();
    const dateStr = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} (Trener: ${currentCoachName})`;
    
    const sessionResults: any = {};
    Object.entries(activeTraining.results).forEach(([exId, sets]: any) => {
        const filteredSets = sets.filter((s: string) => s && s.trim() !== "");
        if (filteredSets.length > 0) {
            sessionResults[exId] = filteredSets.join(' | ');
        }
    });

    const newHistory = [
        { date: dateStr, timestamp: d.getTime(), results: sessionResults },
        ...(selectedClient.history || [])
    ];

    setLoading(true);
    const success = await remoteStorage.saveToCloud(selectedClient.code, 'history', newHistory);
    if (success) {
        alert("Trening zapisany w historii podopiecznego!");
        loadClientDetail(selectedClient.code);
    } else {
        alert("Błąd zapisu treningu.");
    }
    setLoading(false);
  };

  if (!userRole) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#161616] p-10 rounded-3xl border border-gray-800 shadow-2xl text-center">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-900/20">
            <i className="fas fa-user-shield text-3xl text-white"></i>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 italic uppercase tracking-tighter">Bear Gym Admin</h1>
          <p className="text-gray-500 text-xs mb-8">Zarządzaj trenerami i planami</p>
          <input 
            type="password" 
            placeholder="KOD DOSTĘPU"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
            className="w-full bg-black border border-gray-700 text-white p-4 rounded-xl text-center mb-4 focus:border-red-500 outline-none font-mono tracking-[0.5em] text-lg"
          />
          <button onClick={handleLogin} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl transition shadow-lg uppercase italic tracking-widest">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : "ZALOGUJ"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex text-gray-300 font-sans">
      {/* SIDEBAR */}
      <aside className="w-72 bg-[#161616] border-r border-gray-800 flex flex-col h-screen sticky top-0 shadow-2xl z-20">
        <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center text-white font-black italic shadow-lg">B</div>
          <h2 className="text-sm font-black text-white italic uppercase tracking-tighter">
            {userRole === 'super-admin' ? 'Super Admin' : 'Panel Trenera'}
          </h2>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-6">
          {userRole === 'super-admin' && (
            <div>
              <div className="flex justify-between items-center mb-3 px-2">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Twoi Trenerzy</span>
                <button onClick={() => setModalType('add-coach')} className="text-blue-500 text-[10px] font-black uppercase hover:text-blue-400 transition">+ Dodaj</button>
              </div>
              <div className="space-y-1">
                {coaches.map(c => (
                  <button key={c.id} onClick={() => handleSelectCoach(c.id)} className={`w-full text-left p-3 rounded-xl transition flex items-center justify-between border ${selectedCoachId === c.id ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-900/10' : 'bg-transparent border-transparent hover:bg-gray-800 text-gray-500'}`}>
                    <span className="font-bold text-xs uppercase italic">{c.name}</span>
                    <i className="fas fa-chevron-right text-[8px]"></i>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-3 px-2">
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Podopieczni</span>
              {(userRole === 'coach' || selectedCoachId) && (
                 <button onClick={() => setModalType('add-client')} className="text-green-500 text-[10px] font-black uppercase hover:text-green-400 transition">+ Nowy</button>
              )}
            </div>
            <div className="space-y-1">
              {clients.length > 0 ? clients.map(c => (
                <button key={c.code} onClick={() => loadClientDetail(c.code)} className={`w-full text-left p-3 rounded-xl transition border ${selectedClient?.code === c.code ? 'bg-red-600/20 border-red-500 text-white shadow-lg shadow-red-900/10' : 'bg-transparent border-transparent hover:bg-gray-800 text-gray-400'}`}>
                   <div className="font-bold text-xs uppercase italic">{c.name}</div>
                   <div className="text-[9px] font-mono opacity-40">{c.code}</div>
                </button>
              )) : <div className="text-[10px] text-gray-700 italic px-2">Brak klientów...</div>}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 bg-black/20">
           <div className="text-center text-[10px] text-gray-600 font-bold mb-2 uppercase tracking-widest">{currentCoachName}</div>
           <button onClick={() => window.location.reload()} className="w-full py-3 bg-black/40 rounded-xl text-red-500 text-[10px] font-black uppercase italic hover:bg-red-600/10 transition border border-red-900/20">Wyloguj</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-grow p-10 overflow-y-auto bg-[#0a0a0a]">
        {selectedClient ? (
          <div className="max-w-5xl mx-auto animate-fade-in">
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between border-b border-gray-800 pb-8 gap-6">
              <div>
                <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">{selectedClient.name}</h1>
                <p className="text-gray-500 font-mono text-xs flex items-center">
                  <span className="bg-gray-800 px-2 py-0.5 rounded mr-2 text-white">ID: {selectedClient.code}</span>
                  Trener: {selectedClient.coachId}
                </p>
              </div>
              <div className="flex bg-[#161616] p-1 rounded-2xl border border-gray-800 shadow-xl self-start md:self-auto">
                <TabBtn active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} label="PLAN" icon="fa-dumbbell" />
                <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="HISTORIA" icon="fa-history" />
                <TabBtn active={activeTab === 'training'} onClick={() => setActiveTab('training')} label="PROWADŹ" icon="fa-tablet-alt" color="text-yellow-500" />
              </div>
            </header>

            {/* EDYTOR PLANU */}
            {activeTab === 'plan' && (
              <div className="space-y-6">
                <div className="flex justify-end space-x-3 sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur pb-4">
                   {!isEditingPlan ? (
                     <button onClick={() => setIsEditingPlan(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs shadow-xl transition transform active:scale-95">EDYTUJ PLAN</button>
                   ) : (
                     <>
                        <button onClick={handleSavePlan} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs shadow-xl transition transform active:scale-95 flex items-center">
                          {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>} ZAPISZ ZMIANY W CHMURZE
                        </button>
                        <button onClick={() => { setIsEditingPlan(false); setEditedPlan(selectedClient.plan); }} className="bg-gray-800 text-gray-500 px-8 py-4 rounded-2xl font-bold uppercase text-xs hover:bg-gray-700 transition">ANULUJ</button>
                     </>
                   )}
                </div>

                <div className="space-y-8">
                {Object.entries(editedPlan || {}).length > 0 ? Object.entries(editedPlan || {}).map(([wId, workout]: any) => (
                  <div key={wId} className="bg-[#161616] rounded-3xl border border-gray-800 p-8 shadow-2xl animate-fade-in">
                    <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                        <div className="flex items-center space-x-4">
                           <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white"><i className="fas fa-calendar-day"></i></div>
                           <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{workout.title}</h3>
                        </div>
                        {isEditingPlan && (
                          <button onClick={() => deleteWorkoutDay(wId)} className="text-red-900 hover:text-red-500 transition p-2 bg-red-900/10 rounded-lg">
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                    </div>
                    <div className="space-y-4">
                      {workout.exercises?.map((ex: any, idx: number) => (
                        <div key={ex.id} className="grid grid-cols-12 gap-4 items-center bg-black/40 p-5 rounded-2xl border border-gray-800/50 hover:border-gray-700 transition">
                           <div className="col-span-12 lg:col-span-5">
                              {isEditingPlan ? (
                                <div className="space-y-2">
                                  <input 
                                    value={ex.name} 
                                    onChange={e => updateExField(wId, idx, 'name', e.target.value)} 
                                    placeholder="Nazwa ćwiczenia"
                                    className="w-full bg-black border border-gray-700 text-white p-3 rounded-xl text-xs font-bold focus:border-red-500 outline-none" 
                                  />
                                  <input 
                                    value={ex.pl} 
                                    onChange={e => updateExField(wId, idx, 'pl', e.target.value)} 
                                    placeholder="Opis / Uwagi"
                                    className="w-full bg-black border border-gray-800 text-gray-500 p-3 rounded-xl text-[10px] outline-none" 
                                  />
                                </div>
                              ) : (
                                <div>
                                  <div className="font-bold text-white text-sm uppercase italic mb-1">{ex.name}</div>
                                  <div className="text-[10px] text-gray-500 italic">{ex.pl}</div>
                                </div>
                              )}
                           </div>
                           <div className="col-span-12 lg:col-span-6 grid grid-cols-4 gap-3">
                               <SmallInput label="SERIE" val={ex.sets} disabled={!isEditingPlan} onChange={(v:any) => updateExField(wId, idx, 'sets', parseInt(v) || 0)} />
                               <SmallInput label="REPS" val={ex.reps} disabled={!isEditingPlan} onChange={(v:any) => updateExField(wId, idx, 'reps', v)} />
                               <SmallInput label="TEMPO" val={ex.tempo} disabled={!isEditingPlan} onChange={(v:any) => updateExField(wId, idx, 'tempo', v)} />
                               <SmallInput label="RIR" val={ex.rir} disabled={!isEditingPlan} onChange={(v:any) => updateExField(wId, idx, 'rir', v)} />
                           </div>
                           <div className="col-span-12 lg:col-span-1 flex justify-end">
                                {isEditingPlan ? (
                                   <button onClick={() => { workout.exercises.splice(idx,1); setEditedPlan({...editedPlan}); }} className="text-red-600 hover:text-red-400 p-2"><i className="fas fa-times"></i></button>
                                ) : (
                                   <button onClick={() => startLiveTraining(wId)} className="bg-yellow-600/20 text-yellow-500 p-3 rounded-xl border border-yellow-600/30 hover:bg-yellow-600 hover:text-white transition shadow-lg active:scale-95"><i className="fas fa-play text-xs"></i></button>
                                )}
                           </div>
                        </div>
                      ))}
                      {isEditingPlan && (
                        <button onClick={() => addExercise(wId)} className="w-full py-5 bg-gray-800/30 rounded-2xl border border-dashed border-gray-700 text-gray-500 text-[10px] font-black uppercase hover:bg-gray-800 hover:text-gray-300 transition flex items-center justify-center space-x-2">
                          <i className="fas fa-plus-circle"></i>
                          <span>Dodaj ćwiczenie do tego dnia</span>
                        </button>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="py-20 text-center bg-[#161616] rounded-3xl border border-dashed border-gray-800">
                    <i className="fas fa-clipboard-list text-6xl text-gray-800 mb-4"></i>
                    <p className="text-gray-600 font-bold uppercase italic text-sm">Brak zdefiniowanych dni treningowych</p>
                  </div>
                )}
                </div>

                {isEditingPlan && (
                  <button onClick={addWorkoutDay} className="w-full py-8 bg-red-600/5 rounded-3xl border-2 border-dashed border-red-600/30 text-red-500 font-black uppercase italic hover:bg-red-600/10 transition shadow-2xl flex flex-col items-center justify-center group">
                    <i className="fas fa-calendar-plus text-3xl mb-3 group-hover:scale-110 transition"></i>
                    <span>DODAJ NOWY DZIEŃ TRENINGOWY</span>
                  </button>
                )}
              </div>
            )}

            {/* PROWADZENIE TRENINGU (TABLET) */}
            {activeTab === 'training' && (
               <div className="space-y-6">
                 {!activeTraining ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {Object.entries(selectedClient.plan || {}).map(([id, w]: any) => (
                       <button key={id} onClick={() => startLiveTraining(id)} className="bg-[#161616] p-10 rounded-3xl border border-gray-800 hover:border-yellow-500 transition text-center shadow-xl group relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-yellow-600 opacity-0 group-hover:opacity-100 transition"></div>
                          <i className="fas fa-bolt text-4xl mb-4 text-gray-700 group-hover:text-yellow-500 transition transform group-hover:-translate-y-1"></i>
                          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">{w.title}</h3>
                          <p className="text-[10px] text-gray-600 font-bold uppercase mt-2">Rozpocznij sesję na żywo</p>
                       </button>
                     ))}
                   </div>
                 ) : (
                   <div className="bg-[#161616] rounded-3xl border border-yellow-600/30 p-8 shadow-2xl relative overflow-hidden animate-slide-up">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none"><i className="fas fa-tablet-alt text-[250px]"></i></div>
                      <div className="flex flex-col md:flex-row justify-between items-center mb-10 relative z-10 gap-6">
                        <div className="flex items-center space-x-4">
                           <button onClick={() => setActiveTraining(null)} className="text-gray-500 hover:text-white"><i className="fas fa-arrow-left"></i></button>
                           <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">Prowadzisz: {selectedClient.plan[activeTraining.workoutId].title}</h3>
                        </div>
                        <button onClick={finishLiveTraining} className="bg-green-600 hover:bg-green-700 text-white px-10 py-5 rounded-2xl font-black uppercase italic shadow-2xl transition transform active:scale-95 flex items-center">
                          <i className="fas fa-check-double mr-3"></i> ZAPISZ TRENING KLIENTA
                        </button>
                      </div>
                      <div className="space-y-6 relative z-10">
                         {selectedClient.plan[activeTraining.workoutId].exercises.map((ex: any) => (
                           <div key={ex.id} className="bg-black/40 p-6 rounded-3xl border border-gray-800 shadow-inner group hover:border-gray-700 transition">
                              <div className="flex flex-col md:flex-row justify-between mb-6 gap-2">
                                <span className="font-black text-white uppercase italic text-xl tracking-tight group-hover:text-yellow-500 transition">{ex.name}</span>
                                <div className="flex items-center space-x-4">
                                  <span className="bg-gray-800 px-3 py-1 rounded-full text-[10px] text-gray-400 font-bold uppercase tracking-widest">{ex.reps}p | RIR {ex.rir} | {ex.tempo}</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                 {Array.from({length: ex.sets}).map((_, sIdx) => (
                                   <div key={sIdx} className="bg-gray-900/50 p-3 rounded-2xl border border-gray-800">
                                      <span className="text-[9px] font-black text-gray-600 uppercase mb-2 block tracking-widest text-center">Seria {sIdx+1}</span>
                                      <input 
                                        placeholder="kg x p"
                                        onChange={(e) => updateLiveResult(ex.id, sIdx, e.target.value)}
                                        className="w-full bg-black border border-gray-700 text-white p-3 rounded-xl text-center font-bold text-sm focus:border-yellow-500 outline-none placeholder:text-gray-800 font-mono"
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

            {/* HISTORIA */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {selectedClient.history?.length > 0 ? selectedClient.history.map((s: any, idx: number) => (
                  <div key={idx} className="bg-[#161616] p-6 rounded-3xl border border-gray-800 shadow-xl hover:bg-[#1a1a1a] transition group">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-4">
                       <div className="text-blue-500 font-black text-sm uppercase tracking-widest italic">{s.date}</div>
                       <div className="text-[9px] text-gray-600 font-bold uppercase">Sesja nr {selectedClient.history.length - idx}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(s.results).map(([exId, res]: any) => (
                        <div key={exId} className="bg-black/30 p-4 rounded-2xl border border-gray-800/50 group-hover:border-gray-700 transition">
                           <div className="text-[9px] font-black text-gray-500 uppercase truncate mb-2 tracking-tighter">
                             {selectedClient.plan?.[s.workoutId]?.exercises?.find((e:any)=>e.id===exId)?.name || 'Ćwiczenie'}
                           </div>
                           <div className="text-xs text-white font-mono font-bold">{res}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="py-20 text-center opacity-10">
                    <i className="fas fa-history text-6xl mb-4"></i>
                    <p className="uppercase font-black italic">Brak zapisanych sesji treningowych</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-10 py-20 animate-pulse">
            <i className="fas fa-bear-tracking text-[180px] mb-8 text-gray-700"></i>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter text-gray-600">BEAR GYM SYSTEM</h2>
            <p className="mt-4 text-xl font-bold text-gray-700 uppercase tracking-[0.3em]">Wybierz podopiecznego z listy</p>
          </div>
        )}
      </main>

      {/* MODALE DODAWANIA */}
      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-[#161616] border border-gray-800 rounded-3xl p-10 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="flex items-center space-x-4 mb-8">
               <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${modalType === 'add-coach' ? 'bg-blue-600' : 'bg-green-600'}`}>
                 <i className={`fas ${modalType === 'add-coach' ? 'fa-user-tie' : 'fa-user-plus'}`}></i>
               </div>
               <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">
                {modalType === 'add-coach' ? 'Nowy Trener' : 'Nowy Klient'}
               </h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Imię i Nazwisko</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="np. Adam Nowak" className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none text-white text-sm focus:border-red-600 transition" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Kod Logowania (HASŁO)</label>
                <input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="UNIKALNY KOD" className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none text-white text-sm font-mono tracking-widest focus:border-red-600 transition" />
              </div>
              <button 
                onClick={async () => {
                   if(!form.name || !form.code) return alert("Wypełnij wszystkie pola.");
                   setLoading(true);
                   let res;
                   if(modalType === 'add-coach') {
                      res = await remoteStorage.createNewCoach(form.code, form.name);
                   } else {
                      const coachId = userRole === 'super-admin' ? selectedCoachId : authCode;
                      if(!coachId) { alert("Błąd: Nie wybrano trenera."); setLoading(false); return; }
                      res = await remoteStorage.createNewClient(form.code, form.name, coachId);
                   }
                   
                   if(res.success) {
                      alert("Pomyślnie utworzono profil!");
                      setModalType(null);
                      setForm({name:'', code:''});
                      handleLogin(); // Odśwież listy
                   } else {
                      alert(res.error || "Wystąpił błąd.");
                   }
                   setLoading(false);
                }} 
                className="w-full bg-red-600 hover:bg-red-700 py-5 rounded-2xl font-black uppercase italic shadow-2xl text-white mt-4 transition transform active:scale-95"
              >UTWÓRZ PROFIL TERAZ</button>
              <button onClick={() => setModalType(null)} className="w-full text-gray-600 text-[10px] font-bold uppercase py-2 hover:text-gray-400 transition">Zamknij okno</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SmallInput({ label, val, onChange, disabled }: any) {
  return (
    <div className="flex flex-col">
      <span className="text-[8px] font-black text-gray-600 uppercase mb-1.5 tracking-tighter text-center">{label}</span>
      <input 
        value={val} 
        onChange={e => onChange(e.target.value)} 
        disabled={disabled}
        className={`bg-black border border-gray-800 rounded-xl p-3 text-center text-xs font-black ${disabled ? 'text-gray-600' : 'text-blue-400 focus:border-red-600 outline-none'} transition`} 
      />
    </div>
  );
}

function TabBtn({ active, onClick, label, icon, color = 'text-gray-500' }: any) {
  return (
    <button onClick={onClick} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase italic transition flex items-center space-x-2 ${active ? 'bg-red-600 text-white shadow-xl' : `${color} hover:text-white hover:bg-white/5`}`}>
      <i className={`fas ${icon}`}></i>
      <span>{label}</span>
    </button>
  );
}
