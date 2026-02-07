
import React, { useState, useMemo, useEffect } from 'react';
import { remoteStorage, parseDateStr } from '../services/storage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Exercise, ExerciseType, WorkoutPlan } from '../types';

export default function CoachDashboard() {
  const [authCode, setAuthCode] = useState('');
  const [userRole, setUserRole] = useState<'super-admin' | 'coach' | null>(null);
  const [currentCoachName, setCurrentCoachName] = useState('');
  
  const [coaches, setCoaches] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null); // Wybrany trener w widoku admina
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'history' | 'measurements' | 'cardio' | 'progress' | 'calendar' | 'json'>('plan');
  
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editedPlan, setEditedPlan] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modale
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddCoachModalOpen, setIsAddCoachModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: '', code: '' });
  const [newCoachForm, setNewCoachForm] = useState({ name: '', code: '' });

  const [excelInput, setExcelInput] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    const res = await remoteStorage.checkCoachAuth(authCode);
    if (res.success) {
      setUserRole(res.role as any);
      setCurrentCoachName(res.name || 'Super Admin');
      if (res.role === 'super-admin') {
        const coachesList = await remoteStorage.fetchAllCoaches();
        setCoaches(coachesList);
      } else {
        const clientsList = await remoteStorage.fetchClients(authCode);
        setClients(clientsList);
      }
    } else {
      alert(res.error || "Błąd autoryzacji.");
    }
    setLoading(false);
  };

  const handleSelectCoach = async (coachId: string) => {
    setSelectedCoachId(coachId);
    setLoading(true);
    const clientsList = await remoteStorage.fetchClients(coachId);
    setClients(clientsList);
    setSelectedClient(null);
    setLoading(false);
  };

  const loadClientDetail = async (clientId: string) => {
    setLoading(true);
    const res = await remoteStorage.fetchCoachClientDetail(clientId);
    if (res.success) {
      setSelectedClient(res);
      setEditedPlan(res.plan || {});
      setIsEditingPlan(false);
      setActiveTab('plan');
    }
    setLoading(false);
  };

  const handleAddNewCoach = async () => {
    if (!newCoachForm.name || !newCoachForm.code) return alert("Wypełnij pola.");
    setLoading(true);
    const res = await remoteStorage.createNewCoach(newCoachForm.code, newCoachForm.name);
    if (res.success) {
      alert("Dodano nowego trenera!");
      setIsAddCoachModalOpen(false);
      const coachesList = await remoteStorage.fetchAllCoaches();
      setCoaches(coachesList);
    }
    setLoading(false);
  };

  const handleAddNewClient = async () => {
    if (!newClientForm.name || !newClientForm.code) return alert("Wypełnij pola.");
    // Kto jest trenerem dla tego klienta?
    const targetCoachId = userRole === 'super-admin' ? selectedCoachId : authCode;
    if (!targetCoachId) return alert("Najpierw wybierz trenera, któremu chcesz dodać klienta.");

    setLoading(true);
    const res = await remoteStorage.createNewClient(newClientForm.code, newClientForm.name, targetCoachId);
    if (res.success) {
      alert("Dodano nowego podopiecznego!");
      setIsAddClientModalOpen(false);
      const clientsList = await remoteStorage.fetchClients(targetCoachId);
      setClients(clientsList);
      loadClientDetail(newClientForm.code);
    } else {
      alert(res.error || "Wystąpił błąd.");
    }
    setLoading(false);
  };

  const handleSavePlanToCloud = async () => {
    if (!selectedClient || !editedPlan) return;
    if (!window.confirm("Czy na pewno chcesz zapisać te zmiany? Zostaną one wysłane do klienta.")) return;
    setIsSaving(true);
    const success = await remoteStorage.saveToCloud(selectedClient.code, 'plan', editedPlan);
    if (success) {
      alert("Plan zaktualizowany!");
      setIsEditingPlan(false);
      loadClientDetail(selectedClient.code);
    }
    setIsSaving(false);
  };

  const updateExerciseField = (workoutId: string, exIdx: number, field: keyof Exercise, value: any) => {
    const newPlan = { ...editedPlan };
    newPlan[workoutId].exercises[exIdx] = { ...newPlan[workoutId].exercises[exIdx], [field]: value };
    setEditedPlan(newPlan);
  };

  const addExercise = (workoutId: string) => {
    const newPlan = { ...editedPlan };
    if (!newPlan[workoutId].exercises) newPlan[workoutId].exercises = [];
    newPlan[workoutId].exercises.push({
      id: `ex_${Date.now()}`,
      name: "Nowe ćwiczenie",
      pl: "Opis...",
      sets: 3, reps: "10-12", tempo: "2011", rir: "1-2", rest: 90, link: "", type: "standard"
    });
    setEditedPlan(newPlan);
  };

  // Logika wykresów
  const getClientChartData = (workoutId: string, exerciseId: string) => {
    if (!selectedClient?.history?.[workoutId]) return [];
    const sessions = selectedClient.history[workoutId];
    if (!Array.isArray(sessions)) return [];
    return sessions.slice()
      .sort((a: any, b: any) => parseDateStr(a.date) - parseDateStr(b.date))
      .map((entry: any) => {
        const res = entry.results?.[exerciseId]?.split('[')[0]?.split('(')[0];
        const match = res?.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
        return match ? { date: entry.date.split(/[ ,]/)[0].slice(0, 5), weight: parseFloat(match[1].replace(',', '.')) } : null;
      }).filter(Boolean);
  };

  if (!userRole) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#161616] p-10 rounded-3xl border border-gray-800 shadow-2xl text-center">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-900/20">
            <i className="fas fa-user-shield text-3xl text-white"></i>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 italic uppercase">Bear Gym Panel</h1>
          <p className="text-gray-500 text-sm mb-8">Wprowadź swój kod autoryzacji</p>
          <input 
            type="password" 
            placeholder="TWÓJ KOD"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
            className="w-full bg-black border border-gray-700 text-white p-4 rounded-xl text-center mb-4 focus:border-red-500 outline-none font-mono tracking-[0.5em]"
          />
          <button 
            onClick={handleLogin}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition shadow-lg flex items-center justify-center"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : "ZALOGUJ"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex text-gray-300 font-sans">
      {/* SIDEBAR */}
      <aside className="w-80 bg-[#161616] border-r border-gray-800 flex flex-col h-screen sticky top-0 overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
           <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-black italic">B</div>
             <h2 className="text-lg font-black text-white italic tracking-tighter uppercase">{userRole === 'super-admin' ? 'Super Admin' : 'Trener'}</h2>
           </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {/* SEKCJA TRENERÓW (tylko dla Admina) */}
          {userRole === 'super-admin' && (
            <div>
              <div className="flex justify-between items-center mb-2 px-2">
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Trenerzy ({coaches.length})</p>
                <button onClick={() => setIsAddCoachModalOpen(true)} className="text-blue-500 hover:text-blue-400 text-[10px] font-black uppercase">Dodaj</button>
              </div>
              <div className="space-y-1">
                {coaches.map(c => (
                  <button 
                    key={c.id}
                    onClick={() => handleSelectCoach(c.id)}
                    className={`w-full text-left p-3 rounded-xl transition flex items-center justify-between border ${selectedCoachId === c.id ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-transparent border-transparent hover:bg-gray-800 text-gray-500'}`}
                  >
                    <span className="font-bold text-xs uppercase italic">{c.name}</span>
                    <i className="fas fa-chevron-right text-[8px]"></i>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SEKCJA PODOPIECZNYCH */}
          <div>
            <div className="flex justify-between items-center mb-2 px-2">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Podopieczni ({clients.length})</p>
              {(userRole === 'coach' || selectedCoachId) && (
                 <button onClick={() => setIsAddClientModalOpen(true)} className="text-green-500 hover:text-green-400 text-[10px] font-black uppercase">Dodaj</button>
              )}
            </div>
            {clients.length > 0 ? (
              <div className="space-y-1">
                {clients.map(c => (
                  <button 
                    key={c.code}
                    onClick={() => loadClientDetail(c.code)}
                    className={`w-full text-left p-4 rounded-xl transition flex items-center justify-between border ${selectedClient?.code === c.code ? 'bg-red-600/20 border-red-500 text-white' : 'bg-transparent border-transparent hover:bg-gray-800 text-gray-400'}`}
                  >
                    <div>
                      <div className="font-bold text-sm uppercase italic">{c.name}</div>
                      <div className="text-[9px] font-mono opacity-50">{c.code}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : <p className="text-[10px] text-gray-700 italic px-2">Wybierz trenera lub dodaj klienta.</p>}
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 bg-black/20">
           <div className="text-center mb-2 text-[10px] text-gray-600 font-bold uppercase">{currentCoachName}</div>
           <button onClick={() => window.location.reload()} className="w-full py-2 text-[10px] text-red-500 hover:text-red-400 font-black uppercase"><i className="fas fa-sign-out-alt mr-2"></i>Wyloguj</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-grow overflow-y-auto p-10">
        {selectedClient ? (
          <div className="max-w-6xl mx-auto animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-4 border-b border-gray-800 pb-8">
              <div>
                <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter">{selectedClient.name}</h1>
                <p className="text-gray-500 font-mono text-sm">ID: {selectedClient.code} | Trener: {selectedClient.coachId}</p>
              </div>
              <div className="flex bg-[#161616] p-1 rounded-2xl border border-gray-800 overflow-x-auto">
                <TabBtn active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} label="PLAN" icon="fa-dumbbell" />
                <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="HISTORIA" icon="fa-history" />
                <TabBtn active={activeTab === 'progress'} onClick={() => setActiveTab('progress')} label="PROGRES" icon="fa-chart-line" />
              </div>
            </div>

            {activeTab === 'plan' && (
              <div className="space-y-6">
                <div className="flex justify-end space-x-2">
                  {!isEditingPlan ? (
                    <button onClick={() => setIsEditingPlan(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black uppercase italic transition text-xs">EDYTUJ PLAN</button>
                  ) : (
                    <>
                      <button onClick={handleSavePlanToCloud} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-2xl font-black uppercase italic transition text-xs">ZAPISZ</button>
                      <button onClick={() => setIsEditingPlan(false)} className="bg-gray-800 text-gray-400 px-8 py-3 rounded-2xl font-bold uppercase transition text-xs">ANULUJ</button>
                    </>
                  )}
                </div>

                {Object.entries(editedPlan || {}).map(([id, workout]: any) => (
                  <div key={id} className="bg-[#161616] rounded-3xl border border-gray-800 p-6 shadow-xl">
                    <h3 className="text-2xl font-black text-white italic uppercase mb-6 border-l-4 border-red-500 pl-4">{workout.title}</h3>
                    <div className="space-y-4">
                      {workout.exercises?.map((ex: any, idx: number) => (
                        <div key={ex.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center bg-black/20 p-4 rounded-2xl border border-gray-800">
                           <div className="col-span-2">
                              {isEditingPlan ? (
                                <input value={ex.name} onChange={(e) => updateExerciseField(id, idx, 'name', e.target.value)} className="w-full bg-black border border-gray-700 text-white p-2 rounded text-xs font-bold" />
                              ) : <div className="font-bold text-white text-sm uppercase">{ex.name}</div>}
                              <div className="text-[10px] text-gray-500 mt-1">{ex.pl}</div>
                           </div>
                           <div className="grid grid-cols-4 col-span-3 gap-2">
                              <SmallInput label="S" val={ex.sets} onChange={(v) => updateExerciseField(id, idx, 'sets', parseInt(v))} disabled={!isEditingPlan} />
                              <SmallInput label="R" val={ex.reps} onChange={(v) => updateExerciseField(id, idx, 'reps', v)} disabled={!isEditingPlan} />
                              <SmallInput label="T" val={ex.tempo} onChange={(v) => updateExerciseField(id, idx, 'tempo', v)} disabled={!isEditingPlan} />
                              <SmallInput label="RIR" val={ex.rir} onChange={(v) => updateExerciseField(id, idx, 'rir', v)} disabled={!isEditingPlan} />
                           </div>
                           <div className="flex justify-end">
                             {isEditingPlan && <button onClick={() => { workout.exercises.splice(idx,1); setEditedPlan({...editedPlan}); }} className="text-red-900 hover:text-red-500"><i className="fas fa-trash"></i></button>}
                           </div>
                        </div>
                      ))}
                      {isEditingPlan && <button onClick={() => addExercise(id)} className="w-full py-3 bg-gray-800 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:bg-gray-700 transition">+ Dodaj ćwiczenie</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'history' && (
               <div className="space-y-6">
                 {selectedClient.history && Object.entries(selectedClient.history).map(([id, sessions]: any) => (
                   <div key={id} className="bg-[#161616] rounded-3xl border border-gray-800 overflow-hidden">
                     <div className="p-4 bg-black/40 border-b border-gray-800 font-black uppercase italic text-sm">{selectedClient.plan?.[id]?.title || id}</div>
                     <div className="divide-y divide-gray-800">
                        {sessions.slice().sort((a:any, b:any) => parseDateStr(b.date) - parseDateStr(a.date)).map((s: any, idx: number) => (
                          <div key={idx} className="p-6 hover:bg-white/[0.01] transition">
                             <div className="text-blue-500 font-black text-xs uppercase mb-4 tracking-widest">{s.date}</div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Object.entries(s.results).map(([exId, res]: any) => (
                                   <div key={exId} className="bg-black/40 p-3 rounded-xl border border-gray-800">
                                      <div className="text-[10px] font-bold text-gray-600 uppercase truncate mb-1">{selectedClient.plan?.[id]?.exercises?.find((e:any) => e.id === exId)?.name || exId}</div>
                                      <div className="text-xs text-white font-mono">{res}</div>
                                   </div>
                                ))}
                             </div>
                          </div>
                        ))}
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-10">
            <i className="fas fa-bear-tracking text-[120px] mb-6"></i>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">Wybierz profil z listy</h2>
          </div>
        )}
      </main>

      {/* MODAL NOWY KLIENT */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6 animate-fade-in">
          <div className="bg-[#161616] border border-gray-800 rounded-3xl p-8 max-w-sm w-full">
            <h3 className="text-xl font-black text-white italic uppercase mb-6">Nowy Podopieczny</h3>
            <div className="space-y-4">
              <input value={newClientForm.name} onChange={e => setNewClientForm({...newClientForm, name: e.target.value})} placeholder="Imię i Nazwisko" className="w-full bg-black border border-gray-700 p-4 rounded-xl outline-none text-white text-sm" />
              <input value={newClientForm.code} onChange={e => setNewClientForm({...newClientForm, code: e.target.value.toUpperCase()})} placeholder="UNIKALNY KOD" className="w-full bg-black border border-gray-700 p-4 rounded-xl outline-none text-white text-sm font-mono" />
              <button onClick={handleAddNewClient} className="w-full bg-green-600 py-4 rounded-xl font-black uppercase italic shadow-lg">Utwórz profil</button>
              <button onClick={() => setIsAddClientModalOpen(false)} className="w-full text-gray-600 text-[10px] font-bold uppercase">Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOWY TRENER */}
      {isAddCoachModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6 animate-fade-in">
          <div className="bg-[#161616] border border-gray-800 rounded-3xl p-8 max-w-sm w-full">
            <h3 className="text-xl font-black text-white italic uppercase mb-6">Nowy Trener</h3>
            <div className="space-y-4">
              <input value={newCoachForm.name} onChange={e => setNewCoachForm({...newCoachForm, name: e.target.value})} placeholder="Nazwa Trenera" className="w-full bg-black border border-gray-700 p-4 rounded-xl outline-none text-white text-sm" />
              <input value={newCoachForm.code} onChange={e => setNewCoachForm({...newCoachForm, code: e.target.value.toUpperCase()})} placeholder="KOD LOGOWANIA" className="w-full bg-black border border-gray-700 p-4 rounded-xl outline-none text-white text-sm font-mono" />
              <button onClick={handleAddNewCoach} className="w-full bg-blue-600 py-4 rounded-xl font-black uppercase italic shadow-lg">Utwórz profil trenera</button>
              <button onClick={() => setIsAddCoachModalOpen(false)} className="w-full text-gray-600 text-[10px] font-bold uppercase">Anuluj</button>
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
      <span className="text-[8px] font-black text-gray-600 uppercase mb-1">{label}</span>
      <input 
        value={val} 
        onChange={e => onChange(e.target.value)} 
        disabled={disabled}
        className={`bg-black border border-gray-800 rounded p-1 text-center text-xs font-bold ${disabled ? 'text-gray-500' : 'text-blue-400 focus:border-blue-600 outline-none'}`} 
      />
    </div>
  );
}

function TabBtn({ active, onClick, label, icon }: any) {
  return (
    <button onClick={onClick} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase italic transition flex items-center space-x-2 ${active ? 'bg-red-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}>
      <i className={`fas ${icon}`}></i>
      <span>{label}</span>
    </button>
  );
}
