import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { remoteStorage, parseDateStr, storage } from '../services/storage';
import { Exercise, WarmupExercise, ExerciseType } from '../types';
import { ActivityWidget } from './Dashboard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type CoachTab = 'plan' | 'history' | 'calendar' | 'cardio' | 'measurements' | 'progress' | 'training' | 'info';

const CustomLabel = (props: any) => {
  const { x, y, value } = props;
  return (
    <text x={x} y={y - 12} fill="#ffffff" textAnchor="middle" fontSize={10} fontWeight="bold">{value} kg</text>
  );
};

export default function CoachDashboard() {
  const [authCode, setAuthCode] = useState(() => localStorage.getItem('bear_gym_coach_code') || '');
  const [userRole, setUserRole] = useState<'super-admin' | 'coach' | null>(() => localStorage.getItem('bear_gym_coach_role') as any || null);
  const [currentCoachName, setCurrentCoachName] = useState(() => localStorage.getItem('bear_gym_coach_name') || '');
  
  const [coaches, setCoaches] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [allClientsPool, setAllClientsPool] = useState<any[]>([]); 
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<CoachTab>('plan');
  
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editedPlan, setEditedPlan] = useState<any>({});
  const [selectedChartWorkoutId, setSelectedChartWorkoutId] = useState<string>("");

  const [activeTraining, setActiveTraining] = useState<{
    workoutId: string, 
    results: { [exId: string]: { kg: string, reps: string }[] },
    notes: { [exId: string]: string }
  } | null>(null);
  const [modalType, setModalType] = useState<'add-coach' | 'add-client' | 'confirm-delete-client' | 'confirm-delete-coach' | 'excel-import' | 'transfer-client' | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [excelData, setExcelData] = useState('');

  // States dla paska bocznego
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const refreshData = async (role: 'super-admin' | 'coach', code: string) => {
    if (role === 'super-admin') {
      const coachList = await remoteStorage.fetchAllCoaches();
      setCoaches(coachList);
      const clientList = await remoteStorage.fetchClients();
      setAllClientsPool(clientList);
      setClients(clientList);
    } else {
      const list = await remoteStorage.fetchClients(code);
      setClients(list);
      setAllClientsPool(list);
    }
  };

  // Automatyczne odświeżanie danych jeśli sesja istnieje
  useEffect(() => {
    if (userRole && authCode) {
      refreshData(userRole, authCode);
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    const res = await remoteStorage.checkCoachAuth(authCode);
    if (res.success) {
      const role = res.role as 'super-admin' | 'coach';
      const name = res.name || 'Super Admin';
      
      setUserRole(role);
      setCurrentCoachName(name);
      
      // Zapisz sesję w localStorage
      localStorage.setItem('bear_gym_coach_code', authCode);
      localStorage.setItem('bear_gym_coach_role', role);
      localStorage.setItem('bear_gym_coach_name', name);
      localStorage.setItem('bear_gym_role_pref', 'coach');
      
      await refreshData(role, authCode);
    } else {
      alert(res.error);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    if (!window.confirm("Czy na pewno chcesz się wylogować z panelu trenera?")) return;
    
    // Czyść stan i pamięć
    setUserRole(null);
    setCurrentCoachName('');
    setAuthCode('');
    localStorage.removeItem('bear_gym_coach_code');
    localStorage.removeItem('bear_gym_coach_role');
    localStorage.removeItem('bear_gym_coach_name');
    localStorage.setItem('bear_gym_role_pref', 'client');
    
    // Opcjonalnie przeładuj stronę dla czystości stanu
    window.location.reload();
  };

  const handleGlobalRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
        if (userRole && authCode) {
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

  const handleShowAllClients = () => {
    setSelectedCoachId(null);
    setClients(allClientsPool);
    setSelectedClient(null);
    setSearchQuery('');
    setIsMobileSidebarOpen(false);
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
      setIsMobileSidebarOpen(false);
    }
    setLoading(false);
  };

  const editCoachName = async (id: string, currentName: string) => {
    const newName = window.prompt("Nowe imię i nazwisko trenera:", currentName);
    if (!newName || newName === currentName) return;
    setLoading(true);
    const success = await remoteStorage.updateCoachName(id, newName);
    if (success) await handleGlobalRefresh();
    setLoading(false);
  };

  const editClientName = async (code: string, currentName: string) => {
    const newName = window.prompt("Nowe imię i nazwisko podopiecznego:", currentName);
    if (!newName || newName === currentName) return;
    setLoading(true);
    const success = await remoteStorage.updateClientName(code, newName);
    if (success) await loadClientDetail(code);
    setLoading(false);
  };

  const filteredClients = useMemo(() => {
    const listToFilter = searchQuery ? allClientsPool : clients;
    return listToFilter.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      if (a.status === 'active' && b.status === 'inactive') return -1;
      if (a.status === 'inactive' && b.status === 'active') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [clients, allClientsPool, searchQuery]);

  const sortedPlanEntries = useMemo(() => {
    if (!editedPlan) return [];
    return Object.entries(editedPlan).sort((a: any, b: any) => {
        const orderA = a[1].displayOrder ?? 0;
        const orderB = b[1].displayOrder ?? 0;
        return orderA - orderB;
    });
  }, [editedPlan]);

  const flatHistory = useMemo(() => {
    if (!selectedClient?.history) return [];
    const all: any[] = [];
    Object.entries(selectedClient.history).forEach(([wId, historyArray]: [string, any]) => {
        if (Array.isArray(historyArray)) {
            historyArray.forEach(h => {
                all.push({ ...h, workoutId: wId });
            });
        }
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
      setAllClientsPool(prev => prev.filter(c => c.code !== itemToDelete.code));
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
    const clientCode = selectedClient.code;
    const newStatus = selectedClient.status === 'active' ? 'inactive' : 'active';
    setLoading(true);
    const success = await remoteStorage.updateClientStatus(clientCode, newStatus);
    if (success) {
      setSelectedClient((prev: any) => (prev ? { ...prev, status: newStatus } : prev));
      setClients(prev => prev.map(c => c.code === clientCode ? { ...c, status: newStatus } : c));
      setAllClientsPool(prev => prev.map(c => c.code === clientCode ? { ...c, status: newStatus } : c));
    }
    setLoading(false);
  };

  const saveInfo = async (info: string) => {
    if (!selectedClient) return;
    await remoteStorage.saveToCloud(selectedClient.code, 'coachNotes', info);
    setSelectedClient((prev: any) => (prev ? { ...prev, coachNotes: info } : prev));
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

  const moveWorkoutDay = (workoutId: string, direction: 'up' | 'down') => {
    const entries = [...sortedPlanEntries];
    const index = entries.findIndex(([id]) => id === workoutId);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= entries.length) return;
    [entries[index], entries[newIndex]] = [entries[newIndex], entries[index]];
    const updatedPlan: any = {};
    entries.forEach(([id, val], i) => {
        updatedPlan[id] = { ...(val as any || {}), displayOrder: i * 10 };
    });
    setEditedPlan(updatedPlan);
  };

  const handleExcelImport = () => {
    if (!excelData.trim()) return;
    const rows = excelData.trim().split('\n');
    const headers = rows[0].split('\t').map(h => h.trim().toLowerCase());
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
    const workoutMap: Record<string, string> = {};
    rows.slice(1).forEach((row, i) => {
        const cols = row.split('\t');
        const planTitle = cols[idx.plan]?.trim() || "Trening";
        if (!workoutMap[planTitle]) {
            const wId = `w_${Date.now()}_${i}`;
            workoutMap[planTitle] = wId;
            newPlan[wId] = { title: planTitle, exercises: [], warmup: [], displayOrder: i * 10 };
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
    const updatedResults = { ...(activeTraining.results || {}) };
    if (!updatedResults[exId]) updatedResults[exId] = [];
    if (!updatedResults[exId][sIdx]) updatedResults[exId][sIdx] = { kg: '', reps: '' };
    updatedResults[exId][sIdx] = { ...updatedResults[exId][sIdx], [field]: val };
    setActiveTraining({ ...(activeTraining as any), results: updatedResults });
  };

  const updateLiveNote = (exId: string, val: string) => {
    if (!activeTraining) return;
    const updatedNotes = { ...(activeTraining.notes || {}) };
    updatedNotes[exId] = val;
    setActiveTraining({ ...(activeTraining as any), notes: updatedNotes });
  };

  const startLiveTraining = (workoutId: string) => {
    setActiveTraining({ workoutId, results: {}, notes: {} });
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
        if (formattedSets.length > 0) {
            let resStr = formattedSets.join(' | ');
            if (activeTraining.notes[exId]) {
                resStr += ` [Note: ${activeTraining.notes[exId]}]`;
            }
            sessionResults[exId] = resStr;
        }
    });
    const newEntry = { date: dateStr, timestamp: d.getTime(), results: sessionResults, workoutId: activeTraining.workoutId };
    const currentHistory = selectedClient.history?.[activeTraining.workoutId] || [];
    const updatedHistory = [newEntry, ...currentHistory];
    const success = await remoteStorage.saveToCloud(selectedClient.code, 'history', { 
        ...(selectedClient.history || {}), 
        [activeTraining.workoutId]: updatedHistory 
    });
    if (success) {
        alert("Zapisano!");
        await loadClientDetail(selectedClient.code);
        setActiveTraining(null);
    } else alert("Błąd zapisu.");
    setLoading(false);
  };

  const handleTransferClient = async (newCoachId: string) => {
    if (!selectedClient) return;
    setLoading(true);
    const success = await remoteStorage.transferClient(selectedClient.code, newCoachId);
    if (success) {
        alert("Podopieczny został przeniesiony.");
        setModalType(null);
        await handleGlobalRefresh();
    } else alert("Błąd transferu.");
    setLoading(false);
  };

  const handleNameInput = (val: string) => {
    const parts = val.trim().split(/\s+/);
    let suggestedCode = form.code;
    if (parts.length >= 2 && (!form.code || form.code === "")) {
      const first = parts[0].substring(0, 3).toUpperCase();
      const last = parts[parts.length - 1].substring(0, 3).toUpperCase();
      const random = Math.floor(100 + Math.random() * 900);
      suggestedCode = `${first}${last}${random}`;
    }
    setForm({ ...form, name: val, code: suggestedCode });
  };

  const switchToClientView = () => {
    localStorage.setItem('bear_gym_role_pref', 'client');
    window.location.hash = '#/';
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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col md:flex-row text-gray-300 font-sans overflow-hidden">
      
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#111] border-b border-gray-800 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-black italic shadow-lg">B</div>
          <h2 className="text-[10px] font-black text-white italic uppercase tracking-widest">{currentCoachName || userRole}</h2>
        </div>
        <button onClick={() => setIsMobileSidebarOpen(true)} className="text-white p-2">
          <i className="fas fa-bars text-xl"></i>
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-[#111] border-r border-gray-800 flex flex-col h-screen 
        transition-all duration-300 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'} 
        ${isDesktopSidebarCollapsed ? 'md:w-0 md:opacity-0 md:pointer-events-none' : 'md:w-72 md:opacity-100'}
        md:relative md:sticky md:top-0
      `}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-black italic shadow-lg">B</div>
            <h2 className="text-[10px] font-black text-white italic uppercase tracking-widest">{userRole}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleGlobalRefresh} title="Odśwież" className={`text-gray-600 hover:text-blue-500 transition ${refreshing ? 'animate-spin text-blue-500' : ''}`}><i className="fas fa-sync-alt"></i></button>
            <button onClick={() => setIsMobileSidebarOpen(false)} className="md:hidden text-gray-600 hover:text-white transition"><i className="fas fa-times"></i></button>
            <button onClick={switchToClientView} title="Widok Klienta" className="text-gray-600 hover:text-green-500 transition"><i className="fas fa-user"></i></button>
            <button onClick={() => setIsDesktopSidebarCollapsed(true)} className="hidden md:block text-gray-600 hover:text-white transition"><i className="fas fa-angles-left"></i></button>
            <button onClick={handleLogout} className="text-gray-600 hover:text-red-500 transition" title="Wyloguj"><i className="fas fa-sign-out-alt"></i></button>
          </div>
        </div>
        <div className="p-4">
          <div className="relative group mb-4">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-[10px] group-focus-within:text-red-500 transition-colors"></i>
            <input type="text" placeholder="Szukaj podopiecznego..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 pl-9 text-[10px] text-white outline-none focus:border-red-600 transition" />
          </div>
          {userRole === 'super-admin' && <button onClick={handleShowAllClients} className="w-full bg-blue-600/10 hover:bg-blue-600 border border-blue-600/30 text-blue-500 hover:text-white py-3 rounded-xl transition font-black text-[9px] uppercase italic mb-6 shadow-lg"><i className="fas fa-users mr-2"></i> Pokaż wszystkich</button>}
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-6 scrollbar-hide">
          {userRole === 'super-admin' && (
            <div>
              <div className="flex justify-between items-center mb-3 px-2">
                <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Trenerzy</span>
                <button onClick={() => setModalType('add-coach')} className="text-blue-500 text-[10px] font-black hover:scale-110 transition"><i className="fas fa-plus"></i></button>
              </div>
              {coaches.map(c => (
                <div key={c.id} className="group relative flex items-center">
                  <button onClick={() => handleSelectCoach(c.id)} className={`flex-grow text-left p-3 rounded-xl transition mb-1 border ${selectedCoachId === c.id ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-transparent border-transparent hover:bg-gray-800/50 text-gray-500'}`}><span className="font-bold text-[11px] uppercase italic">{c.name}</span></button>
                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center space-x-1">
                    <button onClick={() => editCoachName(c.id, c.name)} className="text-blue-900 hover:text-blue-500 transition text-[10px] p-2"><i className="fas fa-pen"></i></button>
                    <button onClick={() => confirmDeleteCoach(c)} className="text-red-900 hover:text-red-500 transition text-[10px] p-2"><i className="fas fa-trash"></i></button>
                  </div>
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
                <button onClick={() => loadClientDetail(c.code)} className={`flex-grow text-left p-3 rounded-xl transition mb-1 border ${selectedClient?.code === c.code ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-transparent border-transparent hover:bg-gray-800/50 text-gray-400'} ${c.status === 'inactive' ? 'opacity-40' : ''}`}><div className="font-bold text-[9px] uppercase italic">{c.name}</div></button>
                <button onClick={() => confirmDeleteClient(c)} className="absolute right-2 opacity-0 group-hover:opacity-100 text-red-900 hover:text-red-500 transition text-[10px] p-2"><i className="fas fa-trash"></i></button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-grow p-4 md:p-8 overflow-y-auto relative">
        {/* Toggle Button for Desktop Sidebar Collapse */}
        {isDesktopSidebarCollapsed && (
          <button 
            onClick={() => setIsDesktopSidebarCollapsed(false)} 
            className="hidden md:flex absolute top-8 left-8 z-20 w-10 h-10 bg-red-600 rounded-xl items-center justify-center text-white shadow-lg hover:bg-red-700 transition"
            title="Pokaż listę klientów"
          >
            <i className="fas fa-angles-right"></i>
          </button>
        )}

        {selectedClient ? (
          <div className="max-w-6xl mx-auto animate-fade-in">
            <header className="mb-6 md:mb-10 flex flex-col xl:flex-row justify-between items-start gap-6 border-b border-gray-800 pb-8">
              <div className="flex items-start space-x-4 md:space-x-6 w-full xl:w-auto">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-xl md:text-3xl font-black text-white italic border border-gray-700 shrink-0">{selectedClient.name.charAt(0)}</div>
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <h1 className="text-3xl md:text-5xl font-black text-white italic uppercase leading-none mb-2 truncate">{selectedClient.name}</h1>
                    <button onClick={() => editClientName(selectedClient.code, selectedClient.name)} className="text-gray-600 hover:text-blue-500 transition-colors text-lg md:text-xl shrink-0"><i className="fas fa-pen"></i></button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1">
                    <span className="bg-gray-800 px-2 py-0.5 rounded text-[9px] md:text-[10px] text-gray-400">ID: {selectedClient.code}</span>
                    <button onClick={toggleClientStatus} className={`text-[9px] md:text-[10px] font-black uppercase italic ${selectedClient.status === 'active' ? 'text-green-500' : 'text-red-500'}`}>Status: {selectedClient.status === 'active' ? 'Aktywny' : 'Archiwum'}</button>
                    {userRole === 'super-admin' && (
                      <button onClick={() => setModalType('transfer-client')} className="text-[9px] md:text-[10px] font-black uppercase italic text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 hover:bg-blue-500 hover:text-white transition">Przenieś</button>
                    )}
                  </div>
                </div>
              </div>
              <nav className="flex bg-[#161616] p-1 rounded-2xl border border-gray-800 overflow-x-auto w-full xl:w-auto scrollbar-hide no-scrollbar">
                <TabBtn active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} label="PLAN" icon="fa-dumbbell" />
                <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="HISTORIA" icon="fa-history" />
                <TabBtn active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} label="KALENDARZ" icon="fa-calendar-alt" />
                <TabBtn active={activeTab === 'progress'} onClick={() => setActiveTab('progress')} label="PROGRES" icon="fa-chart-line" color="text-blue-400" />
                <TabBtn active={activeTab === 'cardio'} onClick={() => setActiveTab('cardio')} label="AKTYWNOŚĆ" icon="fa-running" />
                <TabBtn active={activeTab === 'measurements'} onClick={() => setActiveTab('measurements')} label="POMIARY" icon="fa-ruler" />
                <TabBtn active={activeTab === 'info'} onClick={() => setActiveTab('info')} label="INFO" icon="fa-info-circle" color="text-blue-400" />
                <TabBtn active={activeTab === 'training'} onClick={() => setActiveTab('training')} label="PROWADŹ" icon="fa-tablet-alt" color="text-yellow-500" />
              </nav>
            </header>

            {activeTab === 'plan' && (
              <div className="space-y-6 md:space-y-10">
                <div className="flex flex-col sm:flex-row justify-end gap-3 sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur py-4">
                   <button onClick={() => setModalType('excel-import')} className="bg-purple-600 hover:bg-purple-700 text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl font-black uppercase italic text-[9px] md:text-[10px] shadow-xl transition active:scale-95"><i className="fas fa-file-excel mr-2"></i> IMPORT Z EXCELA</button>
                   {!isEditingPlan ? (<button onClick={() => setIsEditingPlan(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-black uppercase italic text-xs shadow-xl transition active:scale-95">EDYTUJ PLAN</button>) : (<><button onClick={handleSavePlan} className="bg-green-600 hover:bg-green-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-black uppercase italic text-xs shadow-xl transition active:scale-95">ZAPISZ</button><button onClick={() => setIsEditingPlan(false)} className="bg-gray-800 text-gray-500 px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold uppercase text-xs">ANULUJ</button></>)}
                </div>
                {sortedPlanEntries.map(([wId, workout]: any, wIdx) => (
                  <div key={wId} className="bg-[#161616] rounded-3xl border border-gray-800 p-5 md:p-8 shadow-2xl space-y-6 md:space-y-8 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-4 md:pb-6">
                        <div className="flex items-center space-x-3 md:space-x-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-red-600 rounded-xl flex items-center justify-center text-white text-lg md:text-xl shadow-lg"><i className="fas fa-calendar-alt"></i></div>
                            <div className="flex items-center space-x-2 md:space-x-4">
                                <h3 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter truncate max-w-[150px] md:max-w-none">{workout.title}</h3>
                                {isEditingPlan && (
                                    <div className="flex space-x-1 md:space-x-2">
                                        <button onClick={() => moveWorkoutDay(wId, 'up')} className={`text-gray-500 hover:text-white transition p-1.5 md:p-2 bg-gray-800 rounded-lg ${wIdx === 0 ? 'opacity-20 pointer-events-none' : ''}`}><i className="fas fa-arrow-up text-[10px] md:text-xs"></i></button>
                                        <button onClick={() => moveWorkoutDay(wId, 'down')} className={`text-gray-500 hover:text-white transition p-1.5 md:p-2 bg-gray-800 rounded-lg ${wIdx === sortedPlanEntries.length - 1 ? 'opacity-20 pointer-events-none' : ''}`}><i className="fas fa-arrow-down text-[10px] md:text-xs"></i></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                        {workout.exercises?.map((ex: any, idx: number) => (
                            <div key={idx} className="bg-black/40 p-4 rounded-xl border border-gray-800">
                                <div className="font-black text-white text-xs italic uppercase truncate">{idx+1}. {ex.name}</div>
                                <div className="text-[10px] text-gray-500 mt-1">{ex.sets}s | {ex.reps}p | {ex.tempo} | RIR {ex.rir}</div>
                            </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Historia Treningów</h3>
                <div className="grid grid-cols-1 gap-4">
                    {flatHistory.map((h: any, i: number) => (
                        <div key={i} className="bg-[#161616] p-5 md:p-6 rounded-2xl border border-gray-800 hover:bg-gray-800/50 transition border-l-4 border-red-600">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <div className="text-red-500 font-black text-[10px] md:text-xs uppercase italic">{h.date}</div>
                                    <div className="text-white font-black text-lg md:text-xl uppercase italic tracking-tight truncate">{selectedClient.plan?.[h.workoutId]?.title || 'Trening'}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2 text-[10px] md:text-xs">
                                {Object.entries(h.results).map(([exId, res]: any) => (
                                    <div key={exId} className="flex justify-between border-b border-gray-800 pb-1">
                                        <span className="text-gray-500 truncate pr-4">{selectedClient.plan?.[h.workoutId]?.exercises.find((e:any)=>e.id===exId)?.name || 'Ćwiczenie'}</span>
                                        <span className="text-white font-mono shrink-0">{res}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {flatHistory.length === 0 && <div className="text-center py-20 opacity-20 font-black italic uppercase">Brak historii</div>}
                </div>
              </div>
            )}

            {activeTab === 'progress' && (
              <div className="space-y-6 md:space-y-10 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Analiza Postępów</h3>
                    <select value={selectedChartWorkoutId} onChange={e => setSelectedChartWorkoutId(e.target.value)} className="w-full sm:w-auto bg-black border border-gray-800 text-white p-3 rounded-xl text-xs font-black uppercase italic outline-none">
                        {sortedPlanEntries.map(([id, w]: any) => (<option key={id} value={id}>{w.title}</option>))}
                    </select>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {selectedClient.plan?.[selectedChartWorkoutId]?.exercises.map((ex: any) => {
                        const data = getExerciseChartData(selectedChartWorkoutId, ex.id);
                        if (data.length === 0) return null;
                        const weights = data.map(d => d.weight);
                        const maxW = Math.max(...weights);
                        const minW = Math.min(...weights);
                        const domainMax = Math.ceil(maxW * 1.25); 
                        const domainMin = Math.max(0, Math.floor(minW * 0.8));

                        return (
                            <div key={ex.id} className="bg-[#1e1e1e] p-3 md:p-4 rounded-xl shadow-sm border border-gray-800">
                                <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
                                    <h4 className="font-bold text-white text-xs md:text-sm truncate max-w-[70%] italic uppercase">{ex.name}</h4>
                                    <span className="text-[10px] md:text-xs font-bold text-blue-400 shrink-0">Max: {maxW} kg</span>
                                </div>
                                <div className="h-44 md:h-56 w-full pt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={data} margin={{ top: 30, right: 40, bottom: 20, left: 20 }}>
                                            <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" stroke="#666" tick={{fill: '#888', fontSize: 10}} tickMargin={10} padding={{ left: 30, right: 30 }} />
                                            <YAxis hide={true} domain={[domainMin, domainMax]} />
                                            <Tooltip contentStyle={{backgroundColor: '#111', border: '1px solid #444', borderRadius: '4px', fontSize: '10px'}} itemStyle={{ color: '#fff' }} />
                                            <Line type="monotone" dataKey="weight" stroke="#ef4444" strokeWidth={2} dot={{r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#1e1e1e'}} activeDot={{r: 6, fill: '#fff'}} label={<CustomLabel />} isAnimationActive={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
            )}

            {activeTab === 'training' && (
                <div className="space-y-6 animate-fade-in">
                    {!activeTraining ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            {sortedPlanEntries.map(([id, w]: any) => (
                                <button key={id} onClick={() => startLiveTraining(id)} className="bg-[#161616] p-6 md:p-10 rounded-3xl border border-gray-800 hover:border-yellow-500 text-center shadow-2xl group transition transform active:scale-95">
                                    <i className="fas fa-play text-3xl md:text-4xl text-gray-700 group-hover:text-yellow-500 mb-4 md:mb-6 block transition"></i>
                                    <span className="text-white font-black italic uppercase tracking-widest text-sm md:text-lg">{w.title}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-[#111] p-4 md:p-8 rounded-3xl border border-yellow-600/50 shadow-2xl">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-10">
                                <div>
                                    <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter truncate">{selectedClient.plan[activeTraining.workoutId].title}</h3>
                                    <p className="text-yellow-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-1">SESJA TRENINGOWA NA ŻYWO</p>
                                </div>
                                <div className="flex items-center space-x-3 md:space-x-4 w-full sm:w-auto">
                                    <button onClick={() => setActiveTraining(null)} className="text-gray-500 hover:text-white font-bold text-[10px] md:text-xs uppercase italic flex-1 sm:flex-none py-3">Anuluj</button>
                                    <button onClick={finishLiveTraining} className="bg-green-600 hover:bg-green-700 px-6 md:px-10 py-3 md:py-5 rounded-2xl font-black text-white text-xs md:text-sm uppercase italic shadow-2xl transition transform active:scale-95 flex-1 sm:flex-none">ZAKOŃCZ I ZAPISZ</button>
                                </div>
                            </div>

                            <div className="bg-yellow-600/10 rounded-2xl p-4 md:p-6 mb-8 border border-yellow-600/20">
                                <h4 className="text-yellow-500 font-black text-xs uppercase italic mb-4 flex items-center">
                                    <i className="fas fa-fire mr-2"></i> Rozgrzewka / Aktywacja
                                </h4>
                                <div className="space-y-2">
                                    {selectedClient.plan[activeTraining.workoutId].warmup?.map((w: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-xs md:text-sm border-b border-gray-800 pb-2 last:border-0">
                                            <span className="text-gray-300"><span className="text-gray-600 font-bold mr-2">{idx+1}.</span> {w.pl || w.name}</span>
                                            <span className="text-gray-500 font-bold">{w.reps}</span>
                                        </div>
                                    ))}
                                    {(!selectedClient.plan[activeTraining.workoutId].warmup || selectedClient.plan[activeTraining.workoutId].warmup.length === 0) && (
                                        <div className="text-gray-700 italic text-[10px]">Brak zdefiniowanej rozgrzewki.</div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6 md:space-y-8">
                                {selectedClient.plan[activeTraining.workoutId].exercises.map((ex: any, exIdx: number) => (
                                    <div key={ex.id} className="bg-black/40 p-4 md:p-8 rounded-3xl border border-gray-800 hover:border-gray-700 transition-all shadow-lg">
                                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                                            <div>
                                                <span className="text-red-500 font-black text-[10px] uppercase italic tracking-widest">Ćwiczenie {exIdx+1}</span>
                                                <h4 className="text-lg md:text-2xl font-black text-white uppercase italic tracking-tight">{ex.name}</h4>
                                                <p className="text-gray-500 text-[11px] md:text-xs italic">{ex.pl}</p>
                                            </div>
                                            {ex.link && (
                                                <a href={ex.link} target="_blank" rel="noreferrer" className="text-red-600 hover:text-red-500 p-2 text-xl">
                                                    <i className="fab fa-youtube"></i>
                                                </a>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-4 gap-2 text-center mb-8 bg-black/50 p-3 rounded-xl border border-gray-800">
                                            <div><div className="text-gray-600 text-[8px] uppercase font-black">Tempo</div><div className="text-blue-500 font-black text-xs">{ex.tempo}</div></div>
                                            <div><div className="text-gray-600 text-[8px] uppercase font-black">RIR</div><div className="text-blue-500 font-black text-xs">{ex.rir}</div></div>
                                            <div><div className="text-gray-600 text-[8px] uppercase font-black">Zakres</div><div className="text-green-500 font-black text-xs">{ex.reps}</div></div>
                                            <div><div className="text-gray-600 text-[8px] uppercase font-black">Przerwa</div><div className="text-white font-black text-xs">{ex.rest}s</div></div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 mb-6">
                                            {Array.from({length: ex.sets}).map((_, sIdx) => (
                                                <div key={sIdx} className="space-y-2">
                                                    <span className="text-[9px] font-black text-gray-700 uppercase ml-2 tracking-widest italic">Seria {sIdx+1}</span>
                                                    <div className="flex space-x-2">
                                                        <input 
                                                            placeholder="kg" 
                                                            value={activeTraining.results[ex.id]?.[sIdx]?.kg || ''} 
                                                            onChange={(e) => updateLiveResult(ex.id, sIdx, 'kg', e.target.value)} 
                                                            className="w-1/2 bg-black border border-gray-800 text-white p-3 md:p-4 rounded-xl md:rounded-2xl text-center font-black text-sm focus:border-yellow-500 outline-none placeholder:text-gray-900 transition shadow-inner" 
                                                        />
                                                        <input 
                                                            placeholder="p" 
                                                            value={activeTraining.results[ex.id]?.[sIdx]?.reps || ''} 
                                                            onChange={(e) => updateLiveResult(ex.id, sIdx, 'reps', e.target.value)} 
                                                            className="w-1/2 bg-black border border-gray-800 text-white p-3 md:p-4 rounded-xl md:rounded-2xl text-center font-black text-sm focus:border-yellow-500 outline-none placeholder:text-gray-900 transition shadow-inner" 
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-gray-800/50">
                                            <label className="text-[9px] font-black text-gray-600 uppercase italic tracking-widest ml-2 mb-2 block">Notatka do ćwiczenia</label>
                                            <textarea 
                                                value={activeTraining.notes[ex.id] || ''}
                                                onChange={(e) => updateLiveNote(ex.id, e.target.value)}
                                                placeholder="Np. Poprawić technikę, zwiększyć ciężar..."
                                                className="w-full bg-black/30 border border-gray-800 rounded-xl p-3 text-xs text-gray-400 outline-none focus:border-red-600 transition min-h-[60px]"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'cardio' && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Aktywność Dodatkowa</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(selectedClient.extras?.cardio || []).sort((a:any, b:any) => b.date.localeCompare(a.date)).map((c: any) => (
                        <div key={c.id} className={`bg-[#161616] p-5 md:p-6 rounded-2xl border border-gray-800 border-l-4 ${c.type === 'mobility' ? 'border-purple-600' : c.type === 'fight' ? 'border-sky-500' : 'border-green-600'}`}>
                            <div className="flex items-center space-x-4">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-lg md:text-xl shadow-lg ${c.type === 'mobility' ? 'bg-purple-900/20 text-purple-500' : c.type === 'fight' ? 'bg-sky-900/20 text-sky-500' : 'bg-green-900/20 text-green-500'}`}>
                                    <i className={`fas ${c.type === 'mobility' ? 'fa-universal-access' : c.type === 'fight' ? 'fa-hand-fist' : 'fa-running'}`}></i>
                                </div>
                                <div className="min-w-0">
                                    <div className="text-white font-black uppercase italic text-sm truncate">{c.type.toUpperCase()}</div>
                                    <div className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase truncate">{c.date} • {c.duration}</div>
                                </div>
                            </div>
                            {c.notes && <div className="mt-4 p-3 bg-black/40 rounded-xl text-[9px] md:text-[10px] text-gray-400 italic break-words">"{c.notes}"</div>}
                        </div>
                    ))}
                    {(selectedClient.extras?.cardio || []).length === 0 && <div className="col-span-full text-center py-20 opacity-20 font-black italic uppercase">Brak aktywności</div>}
                </div>
              </div>
            )}

            {activeTab === 'calendar' && (
              <div className="animate-fade-in overflow-hidden">
                <ActivityWidget 
                    workouts={selectedClient.plan || {}} 
                    logo={selectedClient.logo || 'https://lh3.googleusercontent.com/u/0/d/1GZ-QR4EyK6Ho9czlpTocORhwiHW4FGnP'}
                    externalHistory={selectedClient.history}
                    externalCardio={selectedClient.extras?.cardio}
                />
              </div>
            )}

            {activeTab === 'measurements' && (
              <div className="space-y-6 md:space-y-10 animate-fade-in">
                <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Pomiary Ciała</h3>
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                    {(selectedClient.extras?.measurements || []).slice().reverse().map((m: any) => (
                        <div key={m.id} className="bg-[#161616] p-5 md:p-6 rounded-2xl border border-gray-800 shadow-xl grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                            <div className="col-span-full md:col-span-1 border-b md:border-b-0 md:border-r border-gray-800 pb-2 md:pb-0">
                                <div className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase mb-1">DATA</div>
                                <div className="text-white font-black italic text-sm md:text-base">{m.date}</div>
                            </div>
                            <div><div className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase mb-1">WAGA</div><div className="text-green-500 font-black italic text-sm md:text-base">{m.weight || '-'} kg</div></div>
                            <div><div className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase mb-1">PAS</div><div className="text-blue-500 font-black italic text-sm md:text-base">{m.waist || '-'} cm</div></div>
                            <div><div className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase mb-1">KLATKA</div><div className="text-white font-black italic text-sm md:text-base">{m.chest || '-'} cm</div></div>
                            <div><div className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase mb-1">BICEPS</div><div className="text-red-500 font-black italic text-sm md:text-base">{m.biceps || '-'} cm</div></div>
                        </div>
                    ))}
                    {(selectedClient.extras?.measurements || []).length === 0 && <div className="text-center py-20 opacity-20 font-black italic uppercase">Brak pomiarów</div>}
                </div>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-[#161616] p-5 md:p-8 rounded-3xl border border-blue-500/20 shadow-2xl">
                  <h3 className="text-lg md:text-xl font-black text-white italic uppercase mb-4 md:mb-6 flex items-center"><i className="fas fa-user-tag text-blue-500 mr-3"></i>Prywatne Notatki</h3>
                  <textarea value={selectedClient.coachNotes || ''} onChange={e => saveInfo(e.target.value)} placeholder="..." className="w-full h-64 md:h-96 bg-black border border-gray-800 rounded-2xl p-4 md:p-6 text-xs md:text-sm text-gray-300 outline-none focus:border-blue-500 transition leading-relaxed" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-20 animate-fade-in text-center px-6">
              <div className="opacity-5">
                <i className="fas fa-bear-tracking text-[100px] md:text-[200px] mb-8"></i>
                <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">BEAR GYM SYSTEM</h2>
              </div>
              <p className="text-gray-600 font-black uppercase italic tracking-widest text-xs mt-6">Wybierz klienta z listy, aby rozpocząć</p>
          </div>
        )}
      </main>

      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-6 animate-fade-in">
          <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 md:p-10 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 ${modalType.includes('delete') ? 'bg-red-600' : 'bg-blue-600'}`}></div>
            {modalType === 'add-coach' || modalType === 'add-client' ? (
              <>
                <h3 className="text-xl md:text-2xl font-black text-white italic uppercase mb-6 md:mb-8 tracking-tight">{modalType === 'add-coach' ? 'Nowy Trener' : 'Nowy Klient'}</h3>
                <div className="space-y-4 md:space-y-5">
                  <input value={form.name} onChange={e => modalType === 'add-client' ? handleNameInput(e.target.value) : setForm({...form, name: e.target.value})} placeholder="Imię i Nazwisko" className="w-full bg-black border border-gray-800 p-4 md:p-5 rounded-2xl outline-none text-white text-xs md:text-sm font-bold focus:border-red-600 transition" />
                  <input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="KOD / HASŁO" className="w-full bg-black border border-gray-800 p-4 md:p-5 rounded-2xl outline-none text-white text-xs md:text-sm font-mono tracking-widest focus:border-red-600 transition" />
                  <button onClick={async () => { setLoading(true); if(modalType === 'add-coach') await remoteStorage.createNewCoach(form.code, form.name); else await remoteStorage.createNewClient(form.code, form.name, userRole === 'super-admin' ? selectedCoachId! : authCode); setModalType(null); setForm({name:'', code:''}); await handleGlobalRefresh(); setLoading(false); }} className="w-full bg-red-600 hover:bg-red-700 py-4 md:py-5 rounded-2xl font-black uppercase italic text-white shadow-2xl transition transform active:scale-95 text-sm md:text-base">UTWÓRZ</button>
                </div>
              </>
            ) : modalType === 'excel-import' ? (
              <div className="max-w-xl w-full">
                <h3 className="text-xl md:text-2xl font-black text-white italic uppercase mb-2 tracking-tight">Import z Excela</h3>
                <p className="text-[9px] md:text-[10px] text-gray-500 mb-6 uppercase">Zaznacz dane w Excelu i wklej poniżej.</p>
                <div className="space-y-4">
                    <textarea value={excelData} onChange={e => setExcelData(e.target.value)} placeholder="Wklej tutaj dane..." className="w-full h-48 md:h-64 bg-black border border-gray-800 p-4 rounded-xl text-[9px] md:text-[10px] text-gray-400 font-mono outline-none focus:border-purple-600 transition" />
                    <button onClick={handleExcelImport} className="w-full bg-purple-600 hover:bg-purple-700 py-3 md:py-4 rounded-xl font-black uppercase italic text-white shadow-2xl transition active:scale-95 text-xs md:text-sm">ZAIMPORTUJ</button>
                </div>
              </div>
            ) : modalType === 'transfer-client' ? (
              <div className="w-full">
                <h3 className="text-xl md:text-2xl font-black text-white italic uppercase mb-6 tracking-tight">Przenieś do trenera</h3>
                <div className="space-y-4">
                  <select 
                    onChange={(e) => handleTransferClient(e.target.value)}
                    className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white outline-none focus:border-blue-600 uppercase font-bold italic text-xs"
                    defaultValue=""
                  >
                    <option value="" disabled>-- WYBIERZ TRENERA --</option>
                    {coaches.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button onClick={() => setModalType(null)} className="w-full bg-gray-800 py-4 rounded-xl text-gray-400 font-black uppercase italic text-xs">Anuluj</button>
                </div>
              </div>
            ) : (
              <div className="text-center"><i className="fas fa-exclamation-triangle text-red-600 text-4xl md:text-5xl mb-6"></i><h3 className="text-lg md:text-xl font-black text-white uppercase italic mb-2">Czy na pewno?</h3><p className="text-gray-500 text-[10px] md:text-xs mb-8">Usunięcie {itemToDelete?.name} spowoduje bezpowrotną utratę danych.</p><div className="flex space-x-3 md:space-x-4"><button onClick={modalType === 'confirm-delete-client' ? handleDeleteClient : handleDeleteCoach} className="flex-1 bg-red-600 py-3 md:py-4 rounded-xl font-black uppercase italic text-white shadow-xl transition active:scale-95 text-xs">USUŃ</button><button onClick={() => setModalType(null)} className="flex-1 bg-gray-800 py-3 md:py-4 rounded-xl font-black uppercase italic text-gray-500 text-xs">ANULUJ</button></div></div>
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
    <button onClick={onClick} className={`px-4 md:px-5 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase italic transition flex items-center space-x-2 shrink-0 ${active ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : `${color} hover:text-white hover:bg-white/5`}`}>
      <i className={`fas ${icon} text-[10px] md:text-xs`}></i>
      <span>{label}</span>
    </button>
  );
}
