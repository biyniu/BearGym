
import React, { useState, useMemo } from 'react';
import { remoteStorage, parseDateStr } from '../services/storage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Exercise, ExerciseType, WorkoutPlan } from '../types';

export default function CoachDashboard() {
  const [masterCode, setMasterCode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'plan' | 'history' | 'measurements' | 'cardio' | 'progress' | 'calendar' | 'json'>('plan');
  
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editedPlan, setEditedPlan] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Stan konwertera JSON
  const [excelInput, setExcelInput] = useState('');

  const cardioTypesMap: Record<string, string> = {
    'rowerek': 'fa-bicycle',
    'bieznia': 'fa-running',
    'schody': 'fa-stairs',
    'orbitrek': 'fa-walking',
    'mobility': 'fa-universal-access'
  };

  const handleLogin = async () => {
    setLoading(true);
    const res = await remoteStorage.fetchCoachOverview(masterCode);
    if (res.success) {
      setClients(res.clients);
      setIsAuthorized(true);
    } else {
      alert("Błędny kod trenera.");
    }
    setLoading(false);
  };

  const loadClientDetail = async (clientId: string) => {
    setLoading(true);
    const res = await remoteStorage.fetchCoachClientDetail(masterCode, clientId);
    if (res.success) {
      setSelectedClient(res);
      setEditedPlan(res.plan);
      setIsEditingPlan(false);
    }
    setLoading(false);
  };

  const handleSavePlanToCloud = async () => {
    if (!selectedClient || !editedPlan) return;
    if (!window.confirm("Czy na pewno chcesz zapisać te zmiany? Zostaną one natychmiast wysłane do aplikacji podopiecznego.")) return;

    setIsSaving(true);
    const success = await remoteStorage.saveToCloud(selectedClient.code, 'plan', editedPlan);
    if (success) {
      alert("Plan został pomyślnie zaktualizowany w chmurze!");
      setIsEditingPlan(false);
      loadClientDetail(selectedClient.code);
    } else {
      alert("Wystąpił błąd podczas zapisu. Spróbuj ponownie.");
    }
    setIsSaving(false);
  };

  const updateExerciseField = (workoutId: string, exIdx: number, field: keyof Exercise, value: any) => {
    const newPlan = { ...editedPlan };
    newPlan[workoutId].exercises[exIdx] = {
      ...newPlan[workoutId].exercises[exIdx],
      [field]: value
    };
    setEditedPlan(newPlan);
  };

  const removeExercise = (workoutId: string, exIdx: number) => {
    if (!window.confirm("Usunąć to ćwiczenie?")) return;
    const newPlan = { ...editedPlan };
    newPlan[workoutId].exercises.splice(exIdx, 1);
    setEditedPlan(newPlan);
  };

  const addExercise = (workoutId: string) => {
    const newPlan = { ...editedPlan };
    const newEx: Exercise = {
      id: `ex_${Date.now()}`,
      name: "Nowe ćwiczenie",
      pl: "Opis...",
      sets: 3,
      reps: "10-12",
      tempo: "2011",
      rir: "1-2",
      rest: 90,
      link: "",
      type: "standard"
    };
    newPlan[workoutId].exercises.push(newEx);
    setEditedPlan(newPlan);
  };

  const addWorkoutDay = () => {
    const title = window.prompt("Podaj nazwę nowego planu (np. Trening D):");
    if (!title) return;
    const id = title.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const newPlan = { ...editedPlan };
    newPlan[id] = {
      title,
      warmup: [],
      exercises: []
    };
    setEditedPlan(newPlan);
  };

  const removeWorkoutDay = (id: string) => {
    if (!window.confirm(`Usunąć cały plan "${editedPlan[id].title}"?`)) return;
    const newPlan = { ...editedPlan };
    delete newPlan[id];
    setEditedPlan(newPlan);
  };

  // Bezpieczne pobieranie sesji
  const mobilitySessions = useMemo(() => 
    selectedClient?.extras?.cardio?.filter((c: any) => c.type === 'mobility') || [], 
  [selectedClient]);

  const cardioSessions = useMemo(() => 
    selectedClient?.extras?.cardio?.filter((c: any) => c.type !== 'mobility') || [], 
  [selectedClient]);

  const groupSessionsByWeek = (sessions: any[]) => {
    if (!sessions || sessions.length === 0) return [];
    
    const groups: { [key: string]: any[] } = {};
    sessions.forEach(session => {
        if (!session.date) return;
        const parts = session.date.split('-');
        if (parts.length < 3) return;

        const [y, m, d] = parts.map(Number);
        const dateObj = new Date(y, m - 1, d, 12, 0, 0); 
        const dayOfWeek = dateObj.getDay(); 
        const dist = (dayOfWeek + 6) % 7;
        dateObj.setDate(dateObj.getDate() - dist);
        
        const monY = dateObj.getFullYear();
        const monM = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const monD = dateObj.getDate().toString().padStart(2, '0');
        const key = `${monY}-${monM}-${monD}`;
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(session);
    });
    
    return Object.entries(groups)
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .map(([mondayDate, items]) => {
            const [y, m, d] = mondayDate.split('-').map(Number);
            const start = new Date(y, m - 1, d, 12, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            
            const formatD = (dObj: Date) => `${dObj.getDate().toString().padStart(2,'0')}.${(dObj.getMonth()+1).toString().padStart(2,'0')}`;
            
            // Sortowanie itemów wewnątrz grupy od najnowszego
            items.sort((a, b) => b.date.localeCompare(a.date));
            
            return { label: `${formatD(start)} - ${formatD(end)}`, items: items, count: items.length };
        });
  };

  // Helper do pobierania danych do wykresów
  const getClientChartData = (workoutId: string, exerciseId: string) => {
    if (!selectedClient?.history?.[workoutId]) return [];
    
    const sessions = selectedClient.history[workoutId];
    if (!Array.isArray(sessions)) return [];

    // Sortujemy po dacie chronologicznie (OD NAJSTARSZEGO DO NAJNOWSZEGO)
    return sessions.slice()
      .sort((a: any, b: any) => parseDateStr(a.date) - parseDateStr(b.date))
      .map((entry: any) => {
        const resultStr = entry.results?.[exerciseId];
        if (!resultStr) return null;

        // POPRAWKA: Agresywne usuwanie notatek w nawiasach [] oraz ()
        // Dzielimy string po nawiasach, bierzemy tylko pierwszą część (czysty wynik)
        let cleanResultStr = resultStr.split('[')[0];
        cleanResultStr = cleanResultStr.split('(')[0];

        const matches = cleanResultStr.matchAll(/(\d+(?:[.,]\d+)?)\s*kg/gi);
        let maxWeight = 0;
        let found = false;

        for (const match of matches) {
          const weightVal = parseFloat(match[1].replace(',', '.'));
          if (!isNaN(weightVal)) {
            if (weightVal > maxWeight) maxWeight = weightVal;
            found = true;
          }
        }

        if (!found) return null;

        const datePart = entry.date.split(/[ ,]/)[0];
        return {
          date: datePart.slice(0, 5),
          weight: maxWeight
        };
      })
      .filter(Boolean);
  };

  const convertedJsonOutput = useMemo(() => {
    if (!excelInput.trim()) return '';
    const rows = excelInput.trim().split('\n');
    const result: Record<string, any> = {};

    rows.forEach((row, idx) => {
      const cols = row.split('\t');
      if (cols.length < 3 || !cols[0]?.trim() || cols[0].toLowerCase().startsWith('plan')) return;
      const planName = cols[0].trim();
      const section = cols[1]?.trim().toLowerCase() || "";
      const name = cols[2]?.trim() || "Ćwiczenie";
      const pl = cols[3]?.trim() || "";
      const sets = parseInt(cols[4]) || 1;
      const reps = cols[5]?.trim() || "10";
      const tempo = cols[6]?.trim() || "-";
      const rir = cols[7]?.trim() || "-";
      const rest = parseInt(cols[8]) || 90;
      const link = cols[9]?.trim() || "";
      
      const rawType = cols[10]?.trim().toLowerCase() || "standard";
      let type: ExerciseType = "standard";
      if (rawType.includes('time')) type = "time";
      else if (rawType.includes('reps')) type = "reps_only";

      const workoutId = planName.toLowerCase().replace(/\s+/g, '_');
      
      if (!result[workoutId]) {
        result[workoutId] = {
          title: planName,
          warmup: [],
          exercises: []
        };
      }

      if (section === 'rozgrzewka') {
        result[workoutId].warmup.push({
          name,
          pl,
          link,
          reps: sets > 1 ? `${sets}x ${reps}` : reps
        });
      } else {
        result[workoutId].exercises.push({
          id: `ex_${idx}_${Date.now()}`,
          name,
          pl,
          sets,
          reps,
          tempo,
          rir,
          rest,
          link,
          type
        });
      }
    });

    return JSON.stringify(result, null, 2);
  }, [excelInput]);
  
  const CustomLabel = (props: any) => {
    const { x, y, value } = props;
    return (
      <text x={x} y={y - 12} fill="#ffffff" textAnchor="middle" fontSize={10} fontWeight="bold">
        {value}
      </text>
    );
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#161616] p-10 rounded-3xl border border-gray-800 shadow-2xl text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-900/20">
            <i className="fas fa-user-shield text-3xl text-white"></i>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 italic">ADMIN PANEL</h1>
          <p className="text-gray-500 text-sm mb-8">Wprowadź Master Kod, aby zarządzać podopiecznymi</p>
          <input 
            type="password" 
            placeholder="MASTER KOD"
            value={masterCode}
            onChange={(e) => setMasterCode(e.target.value.toUpperCase())}
            className="w-full bg-black border border-gray-700 text-white p-4 rounded-xl text-center mb-4 focus:border-blue-500 outline-none font-mono tracking-[0.5em]"
          />
          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition shadow-lg flex items-center justify-center"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : "AUTORYZUJ"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex text-gray-300 font-sans">
      <aside className="w-80 bg-[#161616] border-r border-gray-800 flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-black italic">B</div>
          <h2 className="text-xl font-black text-white italic tracking-tighter">BEAR GYM COACH</h2>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-2">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 mb-2">Podopieczni ({clients.length})</p>
          {clients.map(c => (
            <button 
              key={c.code}
              onClick={() => loadClientDetail(c.code)}
              className={`w-full text-left p-4 rounded-xl transition flex items-center justify-between border ${selectedClient?.code === c.code ? 'bg-blue-900/20 border-blue-500 text-white' : 'bg-transparent border-transparent hover:bg-gray-800 text-gray-400'}`}
            >
              <div>
                <div className="font-bold text-sm">{c.name}</div>
                <div className="text-[10px] font-mono opacity-50">{c.code}</div>
              </div>
              <i className="fas fa-chevron-right text-[10px]"></i>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-800 bg-black/20">
           <button onClick={() => window.location.reload()} className="w-full py-2 text-xs text-red-500 hover:text-red-400 font-bold uppercase"><i className="fas fa-sign-out-alt mr-2"></i>Wyloguj</button>
        </div>
      </aside>

      <main className="flex-grow overflow-y-auto p-10 bg-gradient-to-br from-[#0f0f0f] to-[#050505]">
        {selectedClient ? (
          <div className="max-w-6xl mx-auto animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-4">
              <div>
                <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">{selectedClient.name}</h1>
                <p className="text-gray-500 font-mono">ID KLIENTA: {selectedClient.code}</p>
              </div>
              <div className="flex bg-[#161616] p-1 rounded-xl border border-gray-800 overflow-x-auto">
                <TabBtn active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} label="PLAN" icon="fa-dumbbell" />
                <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="HISTORIA" icon="fa-history" />
                <TabBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} label="KALENDARZ" icon="fa-calendar-alt" />
                <TabBtn active={activeTab === 'cardio'} onClick={() => setActiveTab('cardio')} label="CARDIO/MOB" icon="fa-running" />
                <TabBtn active={activeTab === 'measurements'} onClick={() => setActiveTab('measurements')} label="POMIARY" icon="fa-ruler" />
                <TabBtn active={activeTab === 'progress'} onClick={() => setActiveTab('progress')} label="PROGRES" icon="fa-chart-line" />
                <TabBtn active={activeTab === 'json'} onClick={() => setActiveTab('json')} label="JSON" icon="fa-code" isSubtle />
              </div>
            </div>

            {/* --- PLAN TAB --- */}
            {activeTab === 'plan' && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex justify-between items-center bg-[#161616] p-4 rounded-2xl border border-gray-800">
                  <p className="text-sm font-bold text-gray-400">Zarządzanie planem treningowym</p>
                  <div className="flex space-x-2">
                    {!isEditingPlan ? (
                      <button 
                        onClick={() => setIsEditingPlan(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition flex items-center"
                      >
                        <i className="fas fa-edit mr-2"></i> EDYTUJ PLAN
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={addWorkoutDay}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center"
                        >
                          <i className="fas fa-calendar-plus mr-2"></i> DODAJ DZIEŃ
                        </button>
                        <button 
                          onClick={handleSavePlanToCloud}
                          disabled={isSaving}
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition flex items-center"
                        >
                          {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-cloud-upload-alt mr-2"></i>}
                          ZAPISZ W CHMURZE
                        </button>
                        <button 
                          onClick={() => { setEditedPlan(selectedClient.plan); setIsEditingPlan(false); }}
                          className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-xl text-xs font-bold transition"
                        >
                          ANULUJ
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {Object.entries(editedPlan || {}).map(([id, workout]: any) => (
                  <div key={id} className="bg-[#161616] rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                    <div className="bg-gradient-to-r from-blue-900/20 to-transparent p-6 border-b border-gray-800 flex justify-between items-center">
                      <h3 className="text-xl font-black text-white italic uppercase">{workout.title}</h3>
                      <div className="flex space-x-2">
                        {isEditingPlan && (
                          <>
                            <button 
                              onClick={() => addExercise(id)}
                              className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 px-4 py-1.5 rounded-lg text-[10px] font-bold transition"
                            >
                              <i className="fas fa-plus mr-1"></i> DODAJ ĆWICZENIE
                            </button>
                            <button 
                              onClick={() => removeWorkoutDay(id)}
                              className="bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
                            >
                              <i className="fas fa-calendar-minus"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest">
                              <th className="pb-4 pl-2">#</th>
                              <th className="pb-4 min-w-[200px]">Ćwiczenie</th>
                              <th className="pb-4 text-center">S</th>
                              <th className="pb-4 text-center">Reps</th>
                              <th className="pb-4 text-center">Tempo</th>
                              <th className="pb-4 text-center">RIR</th>
                              <th className="pb-4 text-center">Rest</th>
                              {isEditingPlan && <th className="pb-4 text-center">Typ</th>}
                              {isEditingPlan && <th className="pb-4 text-right pr-2">Link/Usuń</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {workout.exercises?.map((ex: any, idx: number) => (
                              <tr key={ex.id} className="hover:bg-white/[0.02] transition">
                                <td className="py-4 pl-2 font-mono text-blue-500">{idx + 1}</td>
                                <td className="py-4">
                                  {isEditingPlan ? (
                                    <div className="space-y-1">
                                      <input 
                                        value={ex.name} 
                                        onChange={(e) => updateExerciseField(id, idx, 'name', e.target.value)}
                                        className="bg-black border border-gray-700 text-white p-1 rounded text-sm w-full font-bold focus:border-blue-500 outline-none"
                                      />
                                      <input 
                                        value={ex.pl} 
                                        onChange={(e) => updateExerciseField(id, idx, 'pl', e.target.value)}
                                        className="bg-black border border-gray-700 text-gray-500 p-1 rounded text-[10px] w-full focus:border-blue-500 outline-none"
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <div className="font-bold text-white">{ex.name}</div>
                                      <div className="text-[10px] text-gray-500 italic">{ex.pl}</div>
                                    </>
                                  )}
                                </td>
                                <td className="py-4 text-center">
                                  {isEditingPlan ? (
                                    <input type="number" value={ex.sets} onChange={(e) => updateExerciseField(id, idx, 'sets', parseInt(e.target.value))} className="bg-black border border-gray-700 text-white p-1 rounded text-sm w-10 text-center font-bold focus:border-blue-500 outline-none" />
                                  ) : (
                                    <span className="font-bold text-white">{ex.sets}</span>
                                  )}
                                </td>
                                <td className="py-4 text-center">
                                  {isEditingPlan ? (
                                    <input value={ex.reps} onChange={(e) => updateExerciseField(id, idx, 'reps', e.target.value)} className="bg-black border border-gray-700 text-green-400 p-1 rounded text-sm w-12 text-center font-mono focus:border-blue-500 outline-none" />
                                  ) : (
                                    <span className="font-mono text-green-400">{ex.reps}</span>
                                  )}
                                </td>
                                <td className="py-4 text-center">
                                  {isEditingPlan ? (
                                    <input value={ex.tempo} onChange={(e) => updateExerciseField(id, idx, 'tempo', e.target.value)} className="bg-black border border-gray-700 text-blue-400 p-1 rounded text-sm w-14 text-center font-mono focus:border-blue-500 outline-none" />
                                  ) : (
                                    <span className="font-mono text-blue-400">{ex.tempo}</span>
                                  )}
                                </td>
                                <td className="py-4 text-center">
                                  {isEditingPlan ? (
                                    <input value={ex.rir} onChange={(e) => updateExerciseField(id, idx, 'rir', e.target.value)} className="bg-black border border-gray-700 text-red-400 p-1 rounded text-sm w-12 text-center font-mono focus:border-blue-500 outline-none" />
                                  ) : (
                                    <span className="font-mono text-red-400">{ex.rir}</span>
                                  )}
                                </td>
                                <td className="py-4 text-center">
                                  {isEditingPlan ? (
                                    <input type="number" value={ex.rest} onChange={(e) => updateExerciseField(id, idx, 'rest', parseInt(e.target.value))} className="bg-black border border-gray-700 text-gray-400 p-1 rounded text-sm w-12 text-center font-mono focus:border-blue-500 outline-none" />
                                  ) : (
                                    <span className="font-mono text-gray-400">{ex.rest}s</span>
                                  )}
                                </td>
                                {isEditingPlan && (
                                  <td className="py-4 text-center">
                                    <select value={ex.type} onChange={(e) => updateExerciseField(id, idx, 'type', e.target.value)} className="bg-black border border-gray-700 text-white p-1 rounded text-[10px] outline-none">
                                      <option value="standard">STD</option>
                                      <option value="reps_only">REPS</option>
                                      <option value="time">TIME</option>
                                    </select>
                                  </td>
                                )}
                                <td className="py-4 text-right pr-2">
                                  <div className="flex items-center justify-end space-x-2">
                                    {isEditingPlan ? (
                                      <>
                                        <input 
                                          value={ex.link} 
                                          onChange={(e) => updateExerciseField(id, idx, 'link', e.target.value)} 
                                          placeholder="YT link"
                                          className="bg-black border border-gray-700 text-[8px] text-blue-500 p-1 rounded w-16 outline-none"
                                        />
                                        <button onClick={() => removeExercise(id, idx)} className="text-red-900 hover:text-red-500 transition px-1">
                                          <i className="fas fa-trash-alt text-xs"></i>
                                        </button>
                                      </>
                                    ) : (
                                      ex.link && <a href={ex.link} target="_blank" rel="noreferrer" className="text-red-600 hover:text-red-400"><i className="fab fa-youtube"></i></a>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* --- HISTORY TAB --- */}
            {activeTab === 'history' && (
              <div className="space-y-6 animate-fade-in">
                {selectedClient.history && Object.entries(selectedClient.history).map(([id, sessions]: any) => {
                  if (!Array.isArray(sessions)) return null;
                  const planName = selectedClient.plan?.[id]?.title || id;
                  // Sortowanie historii malejąco (najnowsze na górze) PO PARSOWANIU STRINGA
                  const sortedSessions = sessions.slice().sort((a: any, b: any) => parseDateStr(b.date) - parseDateStr(a.date));

                  return (
                    <div key={id} className="bg-[#161616] rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                      <div className="p-6 border-b border-gray-800 bg-black/20">
                        <h3 className="text-white font-black italic uppercase tracking-tighter text-lg">{planName}</h3>
                      </div>
                      <div className="divide-y divide-gray-800">
                        {sortedSessions.map((s: any, idx: number) => (
                          <div key={idx} className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
                              <span className="text-blue-400 font-black text-sm uppercase tracking-tighter flex items-center">
                                <i className="fas fa-calendar-check mr-2"></i> SESJA: {s.date}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {s.results && Object.entries(s.results).map(([exId, result]: any) => {
                                const exerciseName = selectedClient.plan?.[id]?.exercises?.find((e: any) => e.id === exId)?.name || exId;
                                return (
                                  <div key={exId} className="bg-black/30 p-3 rounded-xl border border-gray-800">
                                    <div className="text-[10px] font-black text-gray-500 uppercase mb-1 truncate">{exerciseName}</div>
                                    <div className="text-xs text-white font-mono break-words leading-relaxed">{result}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* --- CALENDAR TAB (FIXED) --- */}
            {activeTab === 'calendar' && (
              <div className="animate-fade-in max-w-2xl mx-auto">
                 <CoachCalendarWidget client={selectedClient} />
              </div>
            )}

            {/* --- PROGRESS TAB (FIXED - ADDED) --- */}
            {activeTab === 'progress' && (
                <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
                    {selectedClient.plan && Object.entries(selectedClient.plan).map(([wId, workout]: any) => (
                        <div key={wId} className="bg-[#161616] p-6 rounded-3xl border border-gray-800 shadow-xl">
                            <div className="flex items-center space-x-3 mb-6 border-b border-gray-700 pb-2">
                                <div className="w-8 h-8 rounded bg-red-900/20 text-red-500 flex items-center justify-center border border-red-500/30">
                                    <i className="fas fa-chart-line text-xs"></i>
                                </div>
                                <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{workout.title}</h3>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {workout.exercises.map((ex: any) => {
                                    const data = getClientChartData(wId, ex.id);
                                    if(data.length === 0) return null; // Zmieniono z < 2 na === 0

                                    const weights = data.map((d: any) => d.weight);
                                    const maxVal = Math.max(...weights);
                                    const minVal = Math.min(...weights);
                                    const domainMax = Math.ceil(maxVal * 1.25);
                                    const domainMin = Math.max(0, Math.floor(minVal * 0.8));

                                    return (
                                        <div key={ex.id} className="bg-black/30 p-4 rounded-xl border border-gray-700/50">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-widest truncate pr-2">{ex.name}</h4>
                                                <span className="text-[10px] font-mono text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/30">Max: {maxVal}kg</span>
                                            </div>
                                            <div className="h-40 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={data} margin={{ top: 10, right: 30, bottom: 0, left: 10 }}>
                                                        <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                                                        <XAxis 
                                                            dataKey="date" 
                                                            stroke="#555" 
                                                            tick={{fill: '#666', fontSize: 9}} 
                                                            tickMargin={5} 
                                                            padding={{ left: 30, right: 30 }}
                                                        />
                                                        <YAxis hide={true} domain={[domainMin, domainMax]} />
                                                        <Tooltip 
                                                            contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }} 
                                                            itemStyle={{ color: '#fff' }} 
                                                            formatter={(v: any) => [`${v} kg`, '']} 
                                                            labelStyle={{ color: '#888', marginBottom: '4px' }}
                                                        />
                                                        <Line 
                                                            type="monotone" 
                                                            dataKey="weight" 
                                                            stroke="#ef4444" 
                                                            strokeWidth={2} 
                                                            dot={{ r: 3, fill: '#ef4444', strokeWidth: 2, stroke: '#1e1e1e' }} 
                                                            activeDot={{ r: 5, fill: '#fff' }} 
                                                            connectNulls={true}
                                                            label={<CustomLabel />}
                                                            isAnimationActive={false}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                    {!selectedClient.history && <p className="text-center text-gray-500 italic">Brak danych historycznych do wyświetlenia wykresów.</p>}
                </div>
            )}

            {/* --- CARDIO/MOBILITY TAB (GROUPED) --- */}
            {activeTab === 'cardio' && (
              <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
                 {/* MOBILITY SECTION */}
                 <div className="bg-[#161616] p-8 rounded-3xl border border-gray-800 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <i className="fas fa-universal-access text-9xl text-purple-500"></i>
                    </div>
                    <div className="flex items-center space-x-3 mb-6 relative z-10">
                         <div className="w-10 h-10 rounded-full bg-purple-900/30 flex items-center justify-center border border-purple-500/50">
                             <i className="fas fa-universal-access text-purple-400"></i>
                         </div>
                         <h3 className="text-white font-black italic uppercase text-lg">Sesje Mobility</h3>
                    </div>
                    <div className="space-y-6 relative z-10">
                        {mobilitySessions.length > 0 ? (
                            groupSessionsByWeek(mobilitySessions).map((group, idx) => (
                                <div key={idx}>
                                    <div className="flex items-center justify-between border-b border-purple-900/30 pb-1 mb-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tydzień: <span className="text-purple-300 ml-1">{group.label}</span></span>
                                        <span className="text-xs font-bold bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded">{group.count} sesje</span>
                                    </div>
                                    <div className="space-y-2">
                                        {group.items.map((c: any) => (
                                            <div key={c.id} className="flex justify-between items-start p-3 bg-purple-900/10 rounded-xl border border-purple-500/10 hover:bg-purple-900/20 transition">
                                                <div>
                                                    <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">{c.date}</div>
                                                    {c.notes && <div className="text-xs text-gray-400 italic">"{c.notes}"</div>}
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-white italic uppercase tracking-tighter">{c.duration}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600 text-sm italic py-4">Brak zapisanych sesji mobility.</p>
                        )}
                    </div>
                 </div>

                 {/* CARDIO SECTION */}
                 <div className="bg-[#161616] p-8 rounded-3xl border border-gray-800 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <i className="fas fa-heartbeat text-9xl text-red-500"></i>
                    </div>
                    <div className="flex items-center space-x-3 mb-6 relative z-10">
                         <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center border border-red-500/50">
                             <i className="fas fa-running text-red-400"></i>
                         </div>
                         <h3 className="text-white font-black italic uppercase text-lg">Sesje Cardio</h3>
                    </div>
                    <div className="space-y-6 relative z-10">
                        {cardioSessions.length > 0 ? (
                            groupSessionsByWeek(cardioSessions).map((group, idx) => (
                                <div key={idx}>
                                    <div className="flex items-center justify-between border-b border-red-900/30 pb-1 mb-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tydzień: <span className="text-red-300 ml-1">{group.label}</span></span>
                                        <span className="text-xs font-bold bg-red-900/40 text-red-300 px-2 py-0.5 rounded">{group.count} sesje</span>
                                    </div>
                                    <div className="space-y-2">
                                        {group.items.map((c: any) => {
                                            const icon = cardioTypesMap[c.type] || 'fa-heartbeat';
                                            return (
                                                <div key={c.id} className="flex justify-between items-center p-3 bg-black/30 rounded-xl border border-gray-800 hover:border-gray-700 transition">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-red-500 border border-gray-700">
                                                            <i className={`fas ${icon}`}></i>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">{c.type}</div>
                                                            <div className="text-xs font-bold text-gray-400">{c.date}</div>
                                                            {c.notes && <div className="text-[10px] text-gray-600 mt-0.5 max-w-[200px] truncate">{c.notes}</div>}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-black text-white italic uppercase tracking-tighter">{c.duration}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600 text-sm italic py-4">Brak zapisanych sesji cardio.</p>
                        )}
                    </div>
                 </div>
              </div>
            )}

            {/* --- MEASUREMENTS TAB --- */}
            {activeTab === 'measurements' && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                <div className="bg-[#161616] p-8 rounded-3xl border border-gray-800 shadow-xl">
                  <div className="flex items-center space-x-3 mb-6">
                    <i className="fas fa-ruler-horizontal text-green-500"></i>
                    <h3 className="text-white font-black italic uppercase">Pomiary Ciała</h3>
                  </div>
                  <div className="space-y-4">
                    {selectedClient.extras?.measurements?.length > 0 ? (
                      selectedClient.extras.measurements.slice().reverse().map((m: any) => (
                        <div key={m.id} className="p-4 bg-black/30 rounded-2xl border border-gray-800 hover:border-gray-700 transition">
                          <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">{m.date}</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <MeasureItem label="WAGA" value={m.weight} unit="KG" color="text-white" />
                            <MeasureItem label="PAS" value={m.waist} unit="CM" color="text-blue-400" />
                            <MeasureItem label="KLATKA" value={m.chest} unit="CM" color="text-green-400" />
                            <MeasureItem label="BICEPS" value={m.biceps} unit="CM" color="text-yellow-400" />
                            <MeasureItem label="UDO" value={m.thigh} unit="CM" color="text-red-400" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-600 text-sm italic">Brak zapisanych pomiarów.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'json' && (
              <div className="animate-fade-in space-y-6 max-w-4xl mx-auto">
                <div className="bg-[#161616] p-8 rounded-3xl border border-gray-800 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-white font-black italic uppercase text-lg">Excel to JSON Converter</h3>
                      <p className="text-xs text-gray-500 mt-1">Konwertuj pełne plany wielodniowe na format aplikacji</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2 block">Wklej dane z Excela (Kolumny: Plan, Sekcja, Nazwa, Opis, Serie, Powt, Tempo, RIR, Przerwa, Link, Type):</label>
                      <textarea 
                        className="w-full bg-black border border-gray-800 text-gray-300 p-4 rounded-2xl font-mono text-[10px] focus:border-blue-500 outline-none transition"
                        rows={10}
                        placeholder="PUSH 1	Rozgrzewka	Bieżnia	Opis...	1	10 min...	-	-	120	link	standard"
                        value={excelInput}
                        onChange={(e) => setExcelInput(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2 block">Wygenerowany Obiekt Planu (Gotowy do zapisu):</label>
                      <textarea 
                        className="w-full bg-[#0a0a0a] border border-gray-800 text-blue-400 p-4 rounded-2xl font-mono text-[10px] outline-none"
                        rows={14}
                        readOnly
                        value={convertedJsonOutput}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-20">
            <i className="fas fa-users text-8xl mb-6"></i>
            <h2 className="text-2xl font-black italic">WYBIERZ PODOPIECZNEGO Z LISTY</h2>
          </div>
        )}
      </main>
    </div>
  );
}

function MeasureItem({ label, value, unit, color }: { label: string, value: any, unit: string, color: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[8px] text-gray-600 font-bold uppercase">{label}</span>
      <span className={`text-sm font-black ${color}`}>
        {value} <span className="text-[9px] font-normal opacity-50">{unit}</span>
      </span>
    </div>
  );
}

function CoachCalendarWidget({ client }: { client: any }) {
  const [viewDate, setViewDate] = useState(new Date());
  
  const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
  const daysShort = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

  const dayStatus = useMemo(() => {
    const status: Record<string, { strength: boolean; cardio: boolean; mobility: boolean }> = {};
    
    const ensureDate = (d: string) => {
      if (!status[d]) status[d] = { strength: false, cardio: false, mobility: false };
    };

    if (client.history) {
      Object.entries(client.history).forEach(([id, sessions]: any) => {
        if (!Array.isArray(sessions)) return;
        sessions.forEach((h: any) => {
          if (!h.date) return;
          const datePart = h.date.split(/[ ,(]/)[0].replace(/,/g, ''); 
          ensureDate(datePart);
          status[datePart].strength = true;
        });
      });
    }

    if (client.extras?.cardio) {
      client.extras.cardio.forEach((c: any) => {
        if (!c.date) return;
        const [y, m, d] = c.date.split('-');
        const datePart = `${d.toString().padStart(2, '0')}.${m.toString().padStart(2, '0')}.${y}`;
        ensureDate(datePart);
        
        if (c.type === 'mobility') {
            status[datePart].mobility = true;
        } else {
            status[datePart].cardio = true;
        }
      });
    }

    return status;
  }, [client, viewDate]);

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstDayIndex = new Date(year, month, 1).getDay();
  firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const days = [];
  for(let i=0; i<firstDayIndex; i++) days.push(null);
  for(let i=1; i<=daysInMonth; i++) days.push(i);

  const getStatus = (d: number) => {
    const dStr = d.toString().padStart(2, '0');
    const mStr = (month + 1).toString().padStart(2, '0');
    const checkDate = `${dStr}.${mStr}.${year}`;
    return dayStatus[checkDate];
  };

  const isToday = (d: number) => {
    const t = new Date();
    return d === t.getDate() && month === t.getMonth() && year === t.getFullYear();
  };

  const clientLogo = 'https://lh3.googleusercontent.com/u/0/d/1GZ-QR4EyK6Ho9czlpTocORhwiHW4FGnP';

  return (
    <div className="bg-[#161616] rounded-3xl border border-gray-800 p-4 shadow-2xl relative overflow-hidden">
      <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-3">
        <h3 className="text-white font-black italic uppercase tracking-tighter text-sm flex items-center">
          <i className="fas fa-calendar-alt mr-2 text-blue-500"></i>
          KALENDARZ
        </h3>
        <div className="flex items-center space-x-3">
           <button onClick={prevMonth} className="text-gray-500 hover:text-white transition text-xs"><i className="fas fa-chevron-left"></i></button>
           <span className="text-white font-bold uppercase tracking-widest text-[10px]">{months[month]} {year}</span>
           <button onClick={nextMonth} className="text-gray-500 hover:text-white transition text-xs"><i className="fas fa-chevron-right"></i></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2 text-center">
        {daysShort.map(d => <div key={d} className="text-[8px] text-gray-600 font-black uppercase tracking-widest">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="aspect-square"></div>;
          
          const status = getStatus(day);
          const today = isToday(day);
          
          const hasStrength = status?.strength;
          const hasCardio = status?.cardio;
          const hasMobility = status?.mobility;
          
          let activityLabel = "";
          let bgClass = "bg-[#121212]"; // Default background
          let borderClass = "border-gray-800"; // Default border

          // Logic for Labels and Styles based on priority
          if (hasStrength) {
              if (hasCardio) activityLabel = "TR + CA";
              else if (hasMobility) activityLabel = "TR + MO";
              else activityLabel = "TRENING";
          } else if (hasCardio) {
              if (hasMobility) activityLabel = "CA + MO";
              else activityLabel = "CARDIO";
              bgClass = "bg-red-900/10";
          } else if (hasMobility) {
              activityLabel = "MOBILITY";
              bgClass = "bg-purple-900/20";
          }

          const hasAny = hasStrength || hasCardio || hasMobility;

          return (
            <div 
              key={day} 
              className={`aspect-square rounded-lg flex items-center justify-center relative border transition overflow-hidden ${today ? 'border-blue-500 bg-blue-500/10' : ''} ${!today ? borderClass : ''} ${!today ? bgClass : ''} ${hasStrength ? 'shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''} ${!hasAny && !today ? 'bg-black/40 border-opacity-30' : ''}`}
            >
              <span className={`absolute top-0.5 left-1 text-[8px] font-black z-20 ${hasAny ? 'text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,1)]' : 'text-gray-700'}`}>
                {day}
              </span>
              
              {/* Strength Image Background */}
              {hasStrength && (
                <div className="absolute inset-0 w-full h-full">
                   <img 
                    src={clientLogo} 
                    className="w-full h-full object-cover grayscale opacity-30"
                    alt=""
                   />
                   {(hasCardio || hasMobility) && <div className="absolute inset-0 bg-black/40"></div>}
                </div>
              )}

              {/* Only Cardio Icon */}
              {hasCardio && !hasStrength && !hasMobility && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-heartbeat text-red-500 text-sm opacity-50"></i>
                </div>
              )}

              {/* Only Mobility Icon */}
              {hasMobility && !hasStrength && !hasCardio && (
                  <div className="absolute inset-0 flex items-center justify-center">
                      <i className="fas fa-universal-access text-purple-500 text-sm opacity-60"></i>
                  </div>
              )}
              
              {/* Mixed Icons (Cardio + Mobility, no Strength) */}
              {!hasStrength && hasCardio && hasMobility && (
                  <div className="absolute inset-0 flex items-center justify-center space-x-1">
                      <i className="fas fa-heartbeat text-red-500 text-[10px] opacity-60"></i>
                      <i className="fas fa-universal-access text-purple-500 text-[10px] opacity-60"></i>
                  </div>
              )}

              {/* Activity Label at Bottom */}
              {hasAny && (
                <div className={`absolute bottom-0 left-0 right-0 py-0.5 z-20 border-t ${hasMobility && !hasStrength && !hasCardio ? 'bg-purple-700 border-purple-500/50' : 'bg-red-600 border-red-500/50'}`}>
                    <div className="text-[6px] font-black text-white uppercase tracking-tighter text-center leading-none">
                        {activityLabel}
                    </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, icon, isSubtle }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-3 rounded-lg text-xs font-black transition flex items-center space-x-2 whitespace-nowrap ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : isSubtle ? 'text-gray-700 hover:text-gray-500 opacity-50' : 'text-gray-500 hover:text-gray-300'}`}
    >
      <i className={`fas ${icon}`}></i>
      <span className="uppercase tracking-tighter italic">{label}</span>
    </button>
  );
}
