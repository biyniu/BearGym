
import React, { useState, useEffect, useMemo } from 'react';
import { remoteStorage, parseDateStr, storage } from '../services/storage';
import { Exercise, WarmupExercise, ExerciseType } from '../types';
import { ActivityWidget } from './Dashboard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type CoachTab = 'plan' | 'history' | 'calendar' | 'cardio' | 'measurements' | 'progress' | 'training' | 'info';

export default function CoachDashboard() {
  const [authCode, setAuthCode] = useState('');
  const [userRole, setUserRole] = useState<'super-admin' | 'coach' | null>(null);
  const [currentCoachName, setCurrentCoachName] = useState('');
  
  const [coaches, setCoaches] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<CoachTab>('plan');
  
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editedPlan, setEditedPlan] = useState<any>(null);
  const [selectedChartWorkoutId, setSelectedChartWorkoutId] = useState<string>("");

  const [activeTraining, setActiveTraining] = useState<{workoutId: string, results: { [exId: string]: { kg: string, reps: string }[] }} | null>(null);
  const [modalType, setModalType] = useState<'add-coach' | 'add-client' | 'confirm-delete-client' | 'confirm-delete-coach' | 'excel-import' | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [excelData, setExcelData] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    const res = await remoteStorage.checkCoachAuth(authCode);
    if (res.success) {
      setUserRole(res.role as any);
      setCurrentCoachName(res.name || 'Super Admin');
      await refreshData(res.role as any, authCode);
    } else alert(res.error);
    setLoading(false);
  };

  const refreshData = async (role: 'super-admin' | 'coach', code: string) => {
    if (role === 'super-admin') {
      const list = await remoteStorage.fetchAllCoaches();
      setCoaches(list);
    } else {
      const list = await remoteStorage.fetchClients(code);
      setClients(list);
    }
  };

  const handleGlobalRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
        if (userRole) {
            await refreshData(userRole, authCode);
            if (selectedCoachId && userRole === 'super-admin') {
                const list = await remoteStorage.fetchClients(selectedCoachId);
                setClients(list);
            }
            if (selectedClient) {
                await loadClientDetail(selectedClient.code);
            }
        }
    } catch (e) {
        console.error("Refresh error", e);
    } finally {
        setRefreshing(false);
    }
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
      const wIds = Object.keys(res.plan || {});
      if(wIds.length > 0) setSelectedChartWorkoutId(wIds[0]);
      setIsEditingPlan(false);
      setSearchQuery('');
    }
    setLoading(false);
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      if (a.status === 'active' && b.status === 'inactive') return -1;
      if (a.status === 'inactive' && b.status === 'active') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [clients, searchQuery]);

  const flatHistory = useMemo(() => {
    if (!selectedClient?.history) return [];
    if (Array.isArray(selectedClient.history)) return selectedClient.history;
    const all: any[] = [];
    Object.values(selectedClient.history).forEach((h: any) => {
        if (Array.isArray(h)) all.push(...h);
    });
    return all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [selectedClient]);

  const getExerciseChartData = (workoutId: string, exerciseId: string) => {
    if (!flatHistory) return [];
    return flatHistory.slice()
      .filter(h => h.workoutId === workoutId)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .map(entry => {
        const resultStr = entry.results[exerciseId];
        if (!resultStr) return null;
        let cleanResultStr = resultStr.split('[')[0].split('(')[0];
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
        return { date: entry.date.split(/[ ,]/)[0].slice(0, 5), weight: maxWeight };
      })
      .filter(Boolean);
  };

  useEffect(() => {
    if (selectedClient && activeTab === 'calendar') {
        if (selectedClient.history) {
            Object.entries(selectedClient.history).forEach(([id, h]) => {
                storage.saveHistory(id, h as any[]);
            });
        }
        if (selectedClient.extras) {
            storage.saveCardioSessions(selectedClient.extras.cardio || []);
        }
    }
  }, [selectedClient, activeTab]);

  const confirmDeleteClient = (client: any) => {
    setItemToDelete(client);
    setModalType('confirm-delete-client');
  };

  const confirmDeleteCoach = (coach: any) => {
    setItemToDelete(coach);
    setModalType('confirm-delete-coach');
  };

  const handleDeleteClient = async () => {
    if (!itemToDelete) return;
    setLoading(true);
    const success = await remoteStorage.deleteClient(itemToDelete.code);
    if (success) {
      setClients(prev => prev.filter(c => c.code !== itemToDelete.code));
      if (selectedClient?.code === itemToDelete.code) setSelectedClient(null);
      setModalType(null);
    } else alert("Błąd usuwania");
    setLoading(false);
  };

  const handleDeleteCoach = async () => {
    if (!itemToDelete) return;
    setLoading(true);
    const success = await remoteStorage.deleteCoach(itemToDelete.id);
    if (success) {
      setCoaches(prev => prev.filter(c => c.id !== itemToDelete.id));
      if (selectedCoachId === itemToDelete.id) {
        setSelectedCoachId(null);
        setClients([]);
      }
      setModalType(null);
    } else alert("Błąd usuwania");
    setLoading(false);
  };

  const toggleClientStatus = async () => {
    if (!selectedClient) return;
    const newStatus = selectedClient.status === 'active' ? 'inactive' : 'active';
    setLoading(true);
    const success = await remoteStorage.updateClientStatus(selectedClient.code, newStatus);
    if (success) {
      setSelectedClient({ ...selectedClient, status: newStatus });
      setClients(prev => prev.map(c => c.code === selectedClient.code ? { ...c, status: newStatus } : c));
    }
    setLoading(false);
  };

  const saveInfo = async (info: string) => {
    if (!selectedClient) return;
    await remoteStorage.saveToCloud(selectedClient.code, 'coachNotes', info);
    setSelectedClient({ ...selectedClient, coachNotes: info });
  };

  const handleSavePlan = async () => {
    if (!selectedClient || !editedPlan) return;
    setLoading(true);
    const success = await remoteStorage.saveToCloud(selectedClient.code, 'plan', editedPlan);
    if (success) {
        alert("Plan zapisany!");
        setIsEditingPlan(false);
        loadClientDetail(selectedClient.code);
    } else alert("Błąd zapisu.");
    setLoading(false);
  };

  const addWorkoutDay = () => {
    const title = window.prompt("Nazwa dnia:");
    if(!title) return;
    const id = `w_${Date.now()}`;
    setEditedPlan({ ...editedPlan, [id]: { title, exercises: [], warmup: [] } });
  };

  const addExercise = (wId: string) => {
    const newEx: Exercise = { id: `ex_${Date.now()}`, name: "Nowe ćwiczenie", pl: "", sets: 4, reps: "8-12", tempo: "2011", rir: "2", rest: 90, link: "", type: "standard" };
    const updated = { ...editedPlan };
    if (!updated[wId].exercises) updated[wId].exercises = [];
    updated[wId].exercises.push(newEx);
    setEditedPlan(updated);
  };

  const addWarmup = (wId: string) => {
    const newW: WarmupExercise = { name: "Nowe cardio/mobilizacja", pl: "", link: "", reps: "10 min" };
    const updated = { ...editedPlan };
    if (!updated[wId].warmup) updated[wId].warmup = [];
    updated[wId].warmup.push(newW);
    setEditedPlan(updated);
  };

  const updateExField = (wId: string, exIdx: number, field: keyof Exercise, val: any) => {
    const updated = { ...editedPlan };
    updated[wId].exercises[exIdx] = { ...updated[wId].exercises[exIdx], [field]: val };
    setEditedPlan(updated);
  };

  const updateWarmupField = (wId: string, wIdx: number, field: keyof WarmupExercise, val: any) => {
    const updated = { ...editedPlan };
    updated[wId].warmup[wIdx] = { ...updated[wId].warmup[wIdx], [field]: val };
    setEditedPlan(updated);
  };

  const handleExcelImport = () => {
    if (!excelData.trim()) return;
    const rows = excelData.trim().split('\n');
    const headers = rows[0].split('\t').map(h => h.trim().toLowerCase());
    
    // Znajdź indeksy kolumn
    const idx = {
        plan: headers.indexOf('plan'),
        sekcja: headers.indexOf('sekcja'),
        nazwa: headers.indexOf('nazwa ćwiczenia'),
        opis: headers.indexOf('opis pl'),
        serie: headers.indexOf('serie'),
        powt: headers.indexOf('powt.'),
        tempo: headers.indexOf('tempo'),
        rir: headers.indexOf('rir'),
        przerwa: headers.indexOf('przerwa (s)'),
        link: headers.indexOf('link yt')
    };

    const newPlan: any = {};
    const workoutMap: Record<string, string> = {}; // Tytuł -> ID

    rows.slice(1).forEach((row, i) => {
        const cols = row.split('\t');
        const planTitle = cols[idx.plan]?.trim() || "Trening";
        
        if (!workoutMap[planTitle]) {
            const wId = `w_${Date.now()}_${i}`;
            workoutMap[planTitle] = wId;
            newPlan[wId] = { title: planTitle, exercises: [], warmup: [] };
        }

        const wId = workoutMap[planTitle];
        const isWarmup = cols[idx.sekcja]?.toLowerCase().includes('rozgrzewka') || cols[idx.sekcja]?.toLowerCase().includes('warmup');

        if (isWarmup) {
            newPlan[wId].warmup.push({
                name: cols[idx.nazwa] || "Rozgrzewka",
                pl: cols[idx.opis] || "",
                reps: cols[idx.powt] || "10 min",
                link: cols[idx.link] || ""
            });
        } else {
            newPlan[wId].exercises.push({
                id: `ex_${Date.now()}_${i}`,
                name: cols[idx.nazwa] || "Ćwiczenie",
                pl: cols[idx.opis] || "",
                sets: parseInt(cols[idx.serie]) || 4,
                reps: cols[idx.powt] || "8-12",
                tempo: cols[idx.tempo] || "2011",
                rir: cols[idx.rir] || "2",
                rest: parseInt(cols[idx.przerwa]) || 90,
                link: cols[idx.link] || "",
                type: "standard"
            });
        }
    });

    setEditedPlan(newPlan);
    setModalType(null);
    setExcelData('');
    setIsEditingPlan(true);
  };

  const updateLiveResult = (exId: string, sIdx: number, field: 'kg' | 'reps', val: string) => {
    if (!activeTraining) return;
    const updatedResults = { ...activeTraining.results };
    if (!updatedResults[exId]) updatedResults[exId] = [];
    if (!updatedResults[exId][sIdx]) updatedResults[exId][sIdx] = { kg: '', reps: '' };
    updatedResults[exId][sIdx] = { ...updatedResults[exId][sIdx], [field]: val };
    setActiveTraining({ ...activeTraining, results: updatedResults });
  };

  const startLiveTraining = (workoutId: string) => {
    setActiveTraining({ workoutId, results: {} });
    setActiveTab('training');
  };

  const finishLiveTraining = async () => {
    if(!activeTraining || !selectedClient) return;
    if(!window.confirm("Zapisać trening?")) return;
    setLoading(true);
    const d = new Date();
    const dateStr = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} (Trener: ${currentCoachName})`;
    const sessionResults: any = {};
    Object.entries(activeTraining.results).forEach(([exId, sets]: any) => {
        const formattedSets = sets.filter((s: any) => s.kg || s.reps).map((s: any) => `${s.kg || '0'}kg x ${s.reps || '0'}`);
        if (formattedSets.length > 0) sessionResults[exId] = formattedSets.join(' | ');
    });
    const newEntry = { date: dateStr, timestamp: d.getTime(), results: sessionResults, workoutId: activeTraining.workoutId };
    const updatedHistory = [newEntry, ...(flatHistory || [])];
    const success = await remoteStorage.saveToCloud(selectedClient.code, 'history', updatedHistory);
    if (success) {
        alert("Zapisano!");
        await loadClientDetail(selectedClient.code);
        setActiveTraining(null);
    } else alert("Błąd zapisu.");
    setLoading(false);
  };

  if (!userRole) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#161616] p-10 rounded-3xl border border-gray-800 shadow-2xl text-center animate-fade-in">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-900/20"><i className="fas fa-user-shield text-3xl text-white"></i></div>
          <h1 className="text-2xl font-black text-white mb-2 italic uppercase">Bear Gym Admin</h1>
          <input type="password" placeholder="KOD DOSTĘPU" value={authCode} onChange={(e) => setAuthCode(e.target.value.toUpperCase())} className="w-full bg-black border border-gray-700 text-white p-4 rounded-xl text-center mb-6 outline-none font-mono tracking-widest text-lg" />
          <button onClick={handleLogin} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl transition shadow-lg uppercase italic">{loading ? <i className="fas fa-spinner fa-spin"></i> : "ZALOGUJ"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex text-gray-300 font-sans overflow-hidden">
      <aside className="w-72 bg-[#111] border-r border-gray-800 flex flex-col h-screen sticky top-0 z-20">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-black italic shadow-lg">B</div>
            <h2 className="text-[10px] font-black text-white italic uppercase tracking-widest">{userRole}</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={handleGlobalRefresh} title="Odśwież" className={`text-gray-600 hover:text-blue-500 transition ${refreshing ? 'animate-spin text-blue-500' : ''}`}><i className="fas fa-sync-alt"></i></button>
            <button onClick={() => window.location.reload()} className="text-gray-600 hover:text-red-500 transition"><i className="fas fa-sign-out-alt"></i></button>
          </div>
        </div>
        <div className="p-4">
          <div className="relative group">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-[10px] group-focus-within:text-red-500 transition-colors"></i>
            <input 
              type="text" 
              placeholder="Szukaj podopiecznego..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="w-full bg-black border border-gray-800 rounded-lg p-2.5 pl-9 text-[10px] text-white outline-none focus:border-red-600 transition" 
            />
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-6">
          {userRole === 'super-admin' && (
            <div>
              <div className="flex justify-between items-center mb-3 px-2">
                <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Trenerzy</span>
                <button onClick={() => setModalType('add-coach')} className="text-blue-500 text-[10px] font-black hover:scale-110 transition"><i className="fas fa-plus"></i></button>
              </div>
              {coaches.map(c => (
                <div key={c.id} className="group relative flex items-center">
                  <button onClick={() => handleSelectCoach(c.id)} className={`flex-grow text-left p-3 rounded-xl transition mb-1 border ${selectedCoachId === c.id ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-transparent border-transparent hover:bg-gray-800/50 text-gray-500'}`}><span className="font-bold text-[10px] uppercase italic">{c.name}</span></button>
                  <button onClick={() => confirmDeleteCoach(c)} className="absolute right-2 opacity-0 group-hover:opacity-100 text-red-900 hover:text-red-500 transition text-[10px] p-2"><i className="fas fa-trash"></i></button>
                </div>
              ))}
            </div>
          )}
          <div>
            <div className="flex justify-between items-center mb-3 px-2">
              <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Podopieczni</span>
              {(userRole === 'coach' || selectedCoachId) && <button onClick={() => setModalType('add-client')} className="text-green-500 text-[10px] font-black hover:scale-110 transition"><i className="fas fa-plus"></i></button>}
            </div>
            {filteredClients.map(c => (
              <div key={c.code} className="group relative flex items-center">
                <button onClick={() => loadClientDetail(c.code)} className={`flex-grow text-left p-3 rounded-xl transition mb-1 border ${selectedClient?.code === c.code ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-transparent border-transparent hover:bg-gray-800/50 text-gray-400'} ${c.status === 'inactive' ? 'opacity-40' : ''}`}><div className="font-bold text-[10px] uppercase italic">{c.name}</div></button>
                <button onClick={() => confirmDeleteClient(c)} className="absolute right-2 opacity-0 group-hover:opacity-100 text-red-900 hover:text-red-500 transition text-[10px] p-2"><i className="fas fa-trash"></i></button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-grow p-8 overflow-y-auto">
        {selectedClient ? (
          <div className="max-w-6xl mx-auto animate-fade-in">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start gap-6 border-b border-gray-800 pb-8">
              <div className="flex items-start space-x-6">
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-3xl font-black text-white italic border border-gray-700">{selectedClient.name.charAt(0)}</div>
                <div><h1 className="text-5xl font-black text-white italic uppercase leading-none mb-2">{selectedClient.name}</h1><div className="flex items-center space-x-4"><span className="bg-gray-800 px-2 py-0.5 rounded text-[10px] text-gray-400">ID: {selectedClient.code}</span><button onClick={toggleClientStatus} className={`text-[10px] font-black uppercase italic ${selectedClient.status === 'active' ? 'text-green-500' : 'text-red-500'}`}>Status: {selectedClient.status === 'active' ? 'Aktywny' : 'Zarchiwizowany'}</button></div></div>
              </div>
              <nav className="flex bg-[#161616] p-1 rounded-2xl border border-gray-800 overflow-x-auto">
                <TabBtn active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} label="PLAN" icon="fa-dumbbell" />
                <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="HISTORIA" icon="fa-history" />
                <TabBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} label="KALENDARZ" icon="fa-calendar-alt" />
                <TabBtn active={activeTab === 'progress'} onClick={() => setActiveTab('progress')} label="PROGRES" icon="fa-chart-line" color="text-blue-400" />
                <TabBtn active={activeTab === 'cardio'} onClick={() => setActiveTab('cardio')} label="CARDIO" icon="fa-running" />
                <TabBtn active={activeTab === 'measurements'} onClick={() => setActiveTab('measurements')} label="POMIARY" icon="fa-ruler" />
                <TabBtn active={activeTab === 'info'} onClick={() => setActiveTab('info')} label="INFO" icon="fa-info-circle" color="text-blue-400" />
                <div className="w-px bg-gray-800 mx-1"></div>
                <TabBtn active={activeTab === 'training'} onClick={() => setActiveTab('training')} label="PROWADŹ" icon="fa-tablet-alt" color="text-yellow-500" />
              </nav>
            </header>

            {activeTab === 'progress' && (
              <div className="space-y-10 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Wykresy Postępów</h3>
                    <select value={selectedChartWorkoutId} onChange={e => setSelectedChartWorkoutId(e.target.value)} className="bg-black border border-gray-800 text-white p-3 rounded-xl text-xs font-black uppercase italic">
                        {Object.entries(selectedClient.plan || {}).map(([id, w]: any) => (<option key={id} value={id}>{w.title}</option>))}
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {selectedClient.plan?.[selectedChartWorkoutId]?.exercises.map((ex: any) => {
                        const data = getExerciseChartData(selectedChartWorkoutId, ex.id);
                        if (data.length === 0) return null;
                        const weights = data.map(d => d.weight);
                        const maxW = Math.max(...weights);
                        const minW = Math.min(...weights);
                        return (
                            <div key={ex.id} className="bg-[#161616] p-8 rounded-3xl border border-gray-800 shadow-2xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="font-black text-white italic uppercase text-sm truncate max-w-[70%]">{ex.name}</h4>
                                    <span className="text-blue-500 font-black text-[10px] uppercase">Peak: {maxW}kg</span>
                                </div>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={data}>
                                            <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" stroke="#666" tick={{fill: '#888', fontSize: 10}} />
                                            <YAxis hide={true} domain={[minW * 0.8, maxW * 1.2]} />
                                            <Tooltip contentStyle={{backgroundColor: '#111', border: '1px solid #444', borderRadius: '8px'}} />
                                            <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6}} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
            )}

            {activeTab === 'calendar' && (
              <div className="space-y-10 animate-fade-in">
                <ActivityWidget workouts={selectedClient.plan || {}} logo={selectedClient.logo || 'https://lh3.googleusercontent.com/u/0/d/1GZ-QR4EyK6Ho9czlpTocORhwiHW4FGnP'} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {flatHistory.map((h: any, i: number) => (
                        <div key={i} className="bg-[#161616] p-6 rounded-2xl border border-gray-800 shadow-xl border-l-4 border-blue-600">
                            <div className="text-blue-500 font-black text-xs uppercase mb-3 italic">{h.date}</div>
                            <div className="text-white font-black text-lg uppercase italic mb-4 truncate">{selectedClient.plan?.[h.workoutId]?.title || 'Trening'}</div>
                            <div className="space-y-1 opacity-60">
                                {Object.keys(h.results).slice(0, 3).map(exId => (<div key={exId} className="text-[10px] truncate">• {selectedClient.plan?.[h.workoutId]?.exercises.find((e:any)=>e.id===exId)?.name || 'Ćwiczenie'}</div>))}
                            </div>
                        </div>
                    ))}
                </div>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-[#161616] p-8 rounded-3xl border border-blue-500/20 shadow-2xl">
                  <h3 className="text-xl font-black text-white italic uppercase mb-6 flex items-center"><i className="fas fa-user-tag text-blue-500 mr-3"></i>Prywatne Notatki</h3>
                  <textarea value={selectedClient.coachNotes || ''} onChange={e => saveInfo(e.target.value)} placeholder="..." className="w-full h-96 bg-black border border-gray-800 rounded-2xl p-6 text-sm text-gray-300 outline-none focus:border-blue-500 transition leading-relaxed" />
                </div>
              </div>
            )}

            {activeTab === 'plan' && (
              <div className="space-y-10">
                <div className="flex justify-end space-x-3 sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur py-4">
                   <button onClick={() => setModalType('excel-import')} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-2xl font-black uppercase italic text-[10px] shadow-xl transition active:scale-95"><i className="fas fa-file-excel mr-2"></i> IMPORT Z EXCELA</button>
                   {!isEditingPlan ? (<button onClick={() => setIsEditingPlan(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs shadow-xl transition active:scale-95">EDYTUJ PLAN</button>) : (<><button onClick={handleSavePlan} className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs shadow-xl transition active:scale-95">ZAPISZ</button><button onClick={() => setIsEditingPlan(false)} className="bg-gray-800 text-gray-500 px-8 py-4 rounded-2xl font-bold uppercase text-xs">ANULUJ</button></>)}
                </div>
                {Object.entries(editedPlan || {}).map(([wId, workout]: any) => (
                  <div key={wId} className="bg-[#161616] rounded-3xl border border-gray-800 p-8 shadow-2xl space-y-8 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-6">
                        <div className="flex items-center space-x-4"><div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg"><i className="fas fa-calendar-alt"></i></div><h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">{workout.title}</h3></div>
                        {isEditingPlan && <button onClick={() => { delete editedPlan[wId]; setEditedPlan({...editedPlan}); }} className="text-red-900 hover:text-red-500 transition p-3 bg-red-900/10 rounded-xl"><i className="fas fa-trash"></i></button>}
                    </div>

                    {/* SEKCJA ROZGRZEWKI */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center"><h4 className="text-sm font-black text-yellow-500 uppercase italic tracking-widest">Rozgrzewka / Aktywacja</h4></div>
                        <div className="grid grid-cols-1 gap-2">
                            {workout.warmup?.map((w: any, idx: number) => (
                                <div key={idx} className="bg-black/20 p-4 rounded-xl border border-gray-800 flex items-center space-x-4">
                                    <div className="flex-grow grid grid-cols-3 gap-4">
                                        <input disabled={!isEditingPlan} value={w.pl} onChange={e => updateWarmupField(wId, idx, 'pl', e.target.value)} placeholder="Nazwa ćwiczenia" className="bg-black border border-gray-800 text-white p-2 rounded text-[10px] font-bold uppercase" />
                                        <input disabled={!isEditingPlan} value={w.reps} onChange={e => updateWarmupField(wId, idx, 'reps', e.target.value)} placeholder="Objętość" className="bg-black border border-gray-800 text-yellow-500 p-2 rounded text-center text-[10px] font-bold" />
                                        <input disabled={!isEditingPlan} value={w.link} onChange={e => updateWarmupField(wId, idx, 'link', e.target.value)} placeholder="Link YT" className="bg-black border border-gray-800 text-blue-500 p-2 rounded text-[10px] font-bold" />
                                    </div>
                                    {isEditingPlan && <button onClick={() => { workout.warmup.splice(idx,1); setEditedPlan({...editedPlan}); }} className="text-red-900 hover:text-red-500"><i className="fas fa-times-circle"></i></button>}
                                </div>
                            ))}
                            {isEditingPlan && <button onClick={() => addWarmup(wId)} className="w-full py-3 bg-yellow-600/5 rounded-xl border border-dashed border-yellow-600/30 text-yellow-500 text-[9px] font-black uppercase italic">+ Dodaj Rozgrzewkę</button>}
                        </div>
                    </div>

                    {/* SEKCJA ĆWICZEŃ GŁÓWNYCH */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-blue-500 uppercase italic tracking-widest">Ćwiczenia Główne</h4>
                        <div className="space-y-2 overflow-x-auto">
                            <div className="grid grid-cols-12 gap-2 px-4 mb-2 text-[10px] font-black text-gray-600 uppercase italic min-w-[800px]">
                                <div className="col-span-1">#</div><div className="col-span-4">Ćwiczenie</div><div className="col-span-1 text-center">S</div><div className="col-span-1 text-center">Reps</div><div className="col-span-1 text-center">Tempo</div><div className="col-span-1 text-center">RIR</div><div className="col-span-1 text-center">Rest</div><div className="col-span-1 text-center">Typ</div><div className="col-span-1 text-right">Usuń</div>
                            </div>
                            {workout.exercises?.map((ex: any, idx: number) => (
                            <div key={ex.id} className="grid grid-cols-12 gap-2 items-center bg-black/40 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition min-w-[800px]">
                                <div className="col-span-1 font-black text-blue-600 italic text-sm">{idx + 1}</div>
                                <div className="col-span-4">
                                    {isEditingPlan ? (
                                        <div className="space-y-1">
                                            <input value={ex.name} onChange={e => updateExField(wId, idx, 'name', e.target.value)} placeholder="Nazwa" className="w-full bg-black border border-gray-800 text-white p-2 rounded text-xs font-black uppercase italic" />
                                            <input value={ex.pl} onChange={e => updateExField(wId, idx, 'pl', e.target.value)} placeholder="Opis PL / Uwagi" className="w-full bg-black border border-gray-800 text-gray-400 p-2 rounded text-[10px] font-bold uppercase italic" />
                                            <input value={ex.link} onChange={e => updateExField(wId, idx, 'link', e.target.value)} placeholder="Link YT" className="w-full bg-black border border-gray-800 text-blue-400 p-2 rounded text-[10px] font-bold" />
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden">
                                            <div className="font-black text-white text-xs uppercase italic truncate">{ex.name}</div>
                                            <div className="text-[10px] text-gray-500 truncate">{ex.pl}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-1"><input disabled={!isEditingPlan} type="number" value={ex.sets} onChange={e => updateExField(wId, idx, 'sets', parseInt(e.target.value))} className="w-full bg-black border border-gray-800 text-white p-2.5 rounded text-center text-xs font-black" /></div>
                                <div className="col-span-1"><input disabled={!isEditingPlan} value={ex.reps} onChange={e => updateExField(wId, idx, 'reps', e.target.value)} className="w-full bg-black border border-gray-800 text-green-500 p-2.5 rounded text-center text-xs font-black" /></div>
                                <div className="col-span-1"><input disabled={!isEditingPlan} value={ex.tempo} onChange={e => updateExField(wId, idx, 'tempo', e.target.value)} className="w-full bg-black border border-gray-800 text-blue-500 p-2.5 rounded text-center text-xs font-black" /></div>
                                <div className="col-span-1"><input disabled={!isEditingPlan} value={ex.rir} onChange={e => updateExField(wId, idx, 'rir', e.target.value)} className="w-full bg-black border border-gray-800 text-red-500 p-2.5 rounded text-center text-xs font-black" /></div>
                                <div className="col-span-1"><input disabled={!isEditingPlan} type="number" value={ex.rest} onChange={e => updateExField(wId, idx, 'rest', parseInt(e.target.value))} className="w-full bg-black border border-gray-800 text-white p-2.5 rounded text-center text-xs font-black" /></div>
                                <div className="col-span-1"><select disabled={!isEditingPlan} value={ex.type} onChange={e => updateExField(wId, idx, 'type', e.target.value)} className="w-full bg-black border border-gray-800 text-gray-400 p-2 rounded text-[9px] font-black uppercase text-center outline-none"><option value="standard">STD</option><option value="reps_only">REPS</option><option value="time">TIME</option></select></div>
                                <div className="col-span-1 flex justify-end">{isEditingPlan && <button onClick={() => { workout.exercises.splice(idx,1); setEditedPlan({...editedPlan}); }} className="text-red-900 hover:text-red-500 transition"><i className="fas fa-trash text-xs"></i></button>}</div>
                            </div>
                        ))}
                        {isEditingPlan && <button onClick={() => addExercise(wId)} className="w-full py-4 bg-gray-800/20 rounded-2xl border border-dashed border-gray-700 text-gray-600 text-[10px] font-black uppercase hover:bg-gray-800/40 transition">+ Dodaj Ćwiczenie</button>}
                        </div>
                    </div>
                  </div>
                ))}
                {isEditingPlan && <button onClick={addWorkoutDay} className="w-full py-8 bg-red-600/5 rounded-3xl border-2 border-dashed border-red-600/30 text-red-500 font-black uppercase italic hover:bg-red-600/10 transition">+ DODAJ NOWY DZIEŃ</button>}
              </div>
            )}

            {activeTab === 'training' && (
                <div className="space-y-6 animate-fade-in">
                    {!activeTraining ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Object.entries(selectedClient.plan || {}).map(([id, w]: any) => (<button key={id} onClick={() => startLiveTraining(id)} className="bg-[#161616] p-10 rounded-3xl border border-gray-800 hover:border-yellow-500 text-center shadow-2xl group transition transform active:scale-95"><i className="fas fa-play text-4xl text-gray-700 group-hover:text-yellow-500 mb-6 block transition"></i><span className="text-white font-black italic uppercase tracking-widest text-lg">{w.title}</span></button>))}</div>) : (<div className="bg-[#111] p-10 rounded-3xl border border-yellow-600/50 shadow-2xl"><div className="flex justify-between items-center mb-12"><div><h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">{selectedClient.plan[activeTraining.workoutId].title}</h3><p className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mt-1">TRENING NA ŻYWO</p></div><div className="flex items-center space-x-4"><button onClick={() => setActiveTraining(null)} className="text-gray-500 hover:text-white font-bold text-xs uppercase italic">Anuluj</button><button onClick={finishLiveTraining} className="bg-green-600 hover:bg-green-700 px-10 py-5 rounded-2xl font-black text-white uppercase italic shadow-2xl transition transform active:scale-95">ZAKOŃCZ I ZAPISZ</button></div></div><div className="space-y-6">{selectedClient.plan[activeTraining.workoutId].exercises.map((ex: any) => (<div key={ex.id} className="bg-black/40 p-8 rounded-2xl border border-gray-800 hover:border-gray-700 transition group"><div className="flex justify-between items-center mb-8"><span className="text-2xl font-black text-white uppercase italic tracking-tight">{ex.name}</span><span className="bg-gray-800 px-4 py-2 rounded-full text-[10px] text-gray-400 font-bold uppercase tracking-widest">{ex.reps}p | {ex.tempo} | RIR {ex.rir}</span></div><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">{Array.from({length: ex.sets}).map((_, sIdx) => (<div key={sIdx} className="space-y-3"><span className="text-[9px] font-black text-gray-700 uppercase ml-2 tracking-widest">Seria {sIdx+1}</span><div className="flex space-x-2"><input placeholder="kg" value={activeTraining.results[ex.id]?.[sIdx]?.kg || ''} onChange={(e) => updateLiveResult(ex.id, sIdx, 'kg', e.target.value)} className="w-1/2 bg-black border border-gray-800 text-white p-4 rounded-2xl text-center font-black text-sm focus:border-yellow-500 outline-none placeholder:text-gray-900 transition" /><input placeholder="p" value={activeTraining.results[ex.id]?.[sIdx]?.reps || ''} onChange={(e) => updateLiveResult(ex.id, sIdx, 'reps', e.target.value)} className="w-1/2 bg-black border border-gray-800 text-white p-4 rounded-2xl text-center font-black text-sm focus:border-yellow-500 outline-none placeholder:text-gray-900 transition" /></div></div>))}</div></div>))}</div></div>)}
                </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-20 animate-fade-in">
            {searchQuery ? (
              <div className="w-full max-w-4xl">
                 <div className="mb-10 text-center">
                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Wyniki Wyszukiwania</h2>
                    <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mt-2">Znaleziono: {filteredClients.length}</p>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map(c => (
                        <button 
                            key={c.code} 
                            onClick={() => loadClientDetail(c.code)}
                            className="bg-[#161616] p-8 rounded-3xl border border-gray-800 hover:border-red-600 transition shadow-2xl text-left group"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-xl font-black text-white italic group-hover:bg-red-600 transition-colors">{c.name.charAt(0)}</div>
                                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${c.status === 'active' ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'}`}>{c.status}</span>
                            </div>
                            <h3 className="text-white font-black italic uppercase text-lg mb-1">{c.name}</h3>
                            <p className="text-gray-600 text-[10px] font-mono mb-4">Kod: {c.code}</p>
                            <div className="flex items-center text-blue-500 font-black text-[9px] uppercase italic">
                                OTWÓRZ PROFIL <i className="fas fa-arrow-right ml-2 group-hover:translate-x-2 transition-transform"></i>
                            </div>
                        </button>
                    ))}
                    {filteredClients.length === 0 && (
                        <div className="col-span-full text-center py-20 opacity-20">
                            <i className="fas fa-user-slash text-6xl mb-4"></i>
                            <p className="text-xl font-black uppercase italic">Nie znaleziono podopiecznego</p>
                        </div>
                    )}
                 </div>
              </div>
            ) : (
              <div className="opacity-5 text-center">
                <i className="fas fa-bear-tracking text-[200px] mb-8"></i>
                <h2 className="text-6xl font-black italic uppercase tracking-tighter">BEAR GYM SYSTEM</h2>
              </div>
            )}
          </div>
        )}
      </main>

      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-[#161616] border border-gray-800 rounded-3xl p-10 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 ${modalType.includes('delete') ? 'bg-red-600' : 'bg-blue-600'}`}></div>
            
            {modalType === 'add-coach' || modalType === 'add-client' ? (
              <><h3 className="text-2xl font-black text-white italic uppercase mb-8 tracking-tight">{modalType === 'add-coach' ? 'Nowy Trener' : 'Nowy Klient'}</h3><div className="space-y-5"><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Imię i Nazwisko" className="w-full bg-black border border-gray-800 p-5 rounded-2xl outline-none text-white text-sm font-bold focus:border-red-600 transition" /><input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="KOD / HASŁO" className="w-full bg-black border border-gray-800 p-5 rounded-2xl outline-none text-white text-sm font-mono tracking-widest focus:border-red-600 transition" /><button onClick={async () => { setLoading(true); if(modalType === 'add-coach') await remoteStorage.createNewCoach(form.code, form.name); else await remoteStorage.createNewClient(form.code, form.name, userRole === 'super-admin' ? selectedCoachId! : authCode); setModalType(null); setForm({name:'', code:''}); await handleGlobalRefresh(); setLoading(false); }} className="w-full bg-red-600 hover:bg-red-700 py-5 rounded-2xl font-black uppercase italic text-white shadow-2xl transition transform active:scale-95">UTWÓRZ</button></div></>
            ) : modalType === 'excel-import' ? (
              <div className="max-w-xl w-full">
                <h3 className="text-2xl font-black text-white italic uppercase mb-2 tracking-tight">Import z Excela</h3>
                <p className="text-[10px] text-gray-500 mb-6 uppercase">Zaznacz dane w Excelu (z nagłówkami) i wklej je poniżej.</p>
                <div className="space-y-4">
                    <textarea 
                        value={excelData} 
                        onChange={e => setExcelData(e.target.value)}
                        placeholder="Wklej tutaj dane (tab-separated)..."
                        className="w-full h-64 bg-black border border-gray-800 p-4 rounded-xl text-[10px] text-gray-400 font-mono outline-none focus:border-purple-600 transition"
                    />
                    <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800 text-[8px] text-gray-600 space-y-1">
                        <p className="font-bold text-gray-500">WYMAGANE NAGŁÓWKI (KOLEJNOŚĆ DOWOLNA):</p>
                        <p>Plan | Sekcja | Nazwa Ćwiczenia | Opis PL | Serie | Powt. | Tempo | RIR | Przerwa (s) | Link YT</p>
                    </div>
                    <button onClick={handleExcelImport} className="w-full bg-purple-600 hover:bg-purple-700 py-4 rounded-xl font-black uppercase italic text-white shadow-2xl transition active:scale-95">PRZETWÓRZ I ZAIMPORTUJ</button>
                </div>
              </div>
            ) : (
              <div className="text-center"><i className="fas fa-exclamation-triangle text-red-600 text-5xl mb-6"></i><h3 className="text-xl font-black text-white uppercase italic mb-2">Czy na pewno?</h3><p className="text-gray-500 text-xs mb-8">Usunięcie {itemToDelete?.name} spowoduje bezpowrotną utratę danych.</p><div className="flex space-x-4"><button onClick={modalType === 'confirm-delete-client' ? handleDeleteClient : handleDeleteCoach} className="flex-1 bg-red-600 py-4 rounded-xl font-black uppercase italic text-white shadow-xl transition active:scale-95">USUŃ</button><button onClick={() => setModalType(null)} className="flex-1 bg-gray-800 py-4 rounded-xl font-black uppercase italic text-gray-500">ANULUJ</button></div></div>
            )}
            <button onClick={() => setModalType(null)} className="w-full text-gray-600 text-[10px] font-black uppercase py-4 mt-2">Zamknij</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label, icon, color = 'text-gray-500' }: any) {
  return (
    <button onClick={onClick} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase italic transition flex items-center space-x-2 shrink-0 ${active ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : `${color} hover:text-white hover:bg-white/5`}`}>
      <i className={`fas ${icon}`}></i>
      <span>{label}</span>
    </button>
  );
}
