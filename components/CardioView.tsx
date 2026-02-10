
import React, { useState, useRef, useMemo, useContext } from 'react';
import { storage } from '../services/storage';
import { CardioSession, CardioType } from '../types';
import { CLIENT_CONFIG } from '../constants';
import { AppContext } from '../App';

declare var html2pdf: any;

export default function CardioView() {
  const { syncData } = useContext(AppContext);
  const [sessions, setSessions] = useState<CardioSession[]>(storage.getCardioSessions());
  const [activeTab, setActiveTab] = useState<'cardio' | 'mobility' | 'fight'>('cardio');
  
  // Custom Modals State
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; action: () => void } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'rowerek' as CardioType,
    duration: '',
    steps: '',
    notes: '',
    customName: ''
  });
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const cardioTypes: { value: CardioType, label: string, icon: string }[] = [
    { value: 'rowerek', label: 'Rowerek Stacjonarny', icon: 'fa-bicycle' },
    { value: 'bieznia', label: 'Bieżnia', icon: 'fa-running' },
    { value: 'schody', label: 'Schody', icon: 'fa-stairs' },
    { value: 'orbitrek', label: 'Orbitrek', icon: 'fa-walking' },
    { value: 'spacer', label: 'Spacer', icon: 'fa-person-walking' },
    { value: 'basen', label: 'Basen', icon: 'fa-swimmer' },
    { value: 'inne', label: 'Inne', icon: 'fa-heartbeat' }
  ];

  // Helper do czyszczenia undefined dla Firestore
  const cleanForFirebase = (data: any) => {
    return JSON.parse(JSON.stringify(data, (key, value) => {
      return value === undefined ? null : value;
    }));
  };

  const handleSave = async () => {
    if (!form.duration) {
        setAlertMessage("Podaj czas trwania sesji.");
        return;
    }
    
    if (activeTab === 'cardio' && form.type === 'inne' && !form.customName.trim()) {
        setAlertMessage("Wpisz nazwę aktywności.");
        return;
    }
    
    const finalType = activeTab === 'mobility' ? 'mobility' : activeTab === 'fight' ? 'fight' : form.type;

    const newSession: CardioSession = {
      id: Date.now().toString(),
      date: form.date,
      type: finalType,
      duration: form.duration,
      steps: (finalType === 'spacer' && form.steps) ? form.steps : undefined,
      notes: form.notes.trim() ? form.notes : undefined,
      customName: (finalType === 'inne' && form.customName.trim()) ? form.customName : undefined
    };

    const updated = [newSession, ...sessions].sort((a,b) => b.date.localeCompare(a.date));
    
    // 1. Zapis lokalny
    setSessions(updated);
    storage.saveCardioSessions(updated);
    
    // 2. Synchronizacja z Firebase z czyszczeniem danych
    try {
      const cleanCardio = cleanForFirebase(updated);
      const cleanMeasurements = cleanForFirebase(storage.getMeasurements());
      
      await syncData('extras', {
        measurements: cleanMeasurements,
        cardio: cleanCardio
      });
    } catch (e) {
      console.error("Błąd synchronizacji cardio z Firebase:", e);
    }

    // 3. Reset
    setForm(prev => ({ ...prev, duration: '', steps: '', notes: '', customName: '' }));
    
    let typeLabel = 'Aktywność';
    if (finalType === 'mobility') typeLabel = 'Mobility';
    else if (finalType === 'fight') typeLabel = 'Fight';
    else if (finalType === 'inne') typeLabel = form.customName || 'Inne';
    else typeLabel = cardioTypes.find(c => c.value === finalType)?.label || 'Cardio';

    setSuccessMessage(`Zapisano sesję: ${typeLabel} (${newSession.duration})`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDeleteRequest = (id: string) => {
    setConfirmModal({
        isOpen: true,
        message: "Czy na pewno chcesz usunąć ten wpis z dziennika?",
        action: () => performDelete(id)
    });
  };

  const performDelete = async (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    storage.saveCardioSessions(updated);
    
    try {
      await syncData('extras', {
        measurements: cleanForFirebase(storage.getMeasurements()),
        cardio: cleanForFirebase(updated)
      });
    } catch (e) { console.warn("Sync error delete", e); }
    
    setConfirmModal(null);
  };

  const handleExportPDF = () => {
    if (!contentRef.current) return;
    setIsGeneratingPdf(true);
    const element = contentRef.current;
    const opt = {
      margin: 10,
      filename: `Activity_Log_${CLIENT_CONFIG.name.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    setTimeout(() => {
        html2pdf().set(opt).from(element).save().then(() => {
            setIsGeneratingPdf(false);
        });
    }, 100);
  };

  const groupedSessions = useMemo(() => {
    const groups: { [key: string]: CardioSession[] } = {};
    sessions.forEach(session => {
        const [y, m, d] = session.date.split('-').map(Number);
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
            return { label: `${formatD(start)} - ${formatD(end)}`, items: items, count: items.length };
        });
  }, [sessions]);

  return (
    <div className="animate-fade-in pb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Dziennik Aktywności</h2>
        <button 
            onClick={handleExportPDF}
            disabled={isGeneratingPdf}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-bold shadow transition text-xs flex items-center"
        >
            {isGeneratingPdf ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-pdf mr-2"></i>}
            PDF
        </button>
      </div>

      {/* TABS SWITCHER */}
      <div className="flex bg-[#1e1e1e] p-1 rounded-xl mb-6 border border-gray-800 space-x-1">
        <button 
            onClick={() => setActiveTab('cardio')}
            className={`flex-1 py-3 rounded-lg text-[11px] font-black uppercase italic transition flex items-center justify-center space-x-2 ${activeTab === 'cardio' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
            <i className="fas fa-heartbeat"></i> <span>Cardio</span>
        </button>
        <button 
            onClick={() => setActiveTab('mobility')}
            className={`flex-1 py-3 rounded-lg text-[11px] font-black uppercase italic transition flex items-center justify-center space-x-2 ${activeTab === 'mobility' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
            <i className="fas fa-universal-access"></i> <span>Mobility</span>
        </button>
        <button 
            onClick={() => setActiveTab('fight')}
            className={`flex-1 py-3 rounded-lg text-[11px] font-black uppercase italic transition flex items-center justify-center space-x-2 ${activeTab === 'fight' ? 'bg-sky-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
            <i className="fas fa-hand-fist"></i> <span>Fight</span>
        </button>
      </div>

      {/* FORM SECTION */}
      <div className={`bg-[#1e1e1e] rounded-xl shadow-md p-4 mb-6 border-l-4 ${activeTab === 'cardio' ? 'border-green-600' : activeTab === 'mobility' ? 'border-purple-600' : 'border-sky-500'}`}>
        <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase">Dodaj sesję</h3>
        <div className="space-y-4">
            <div>
                <label className="text-xs text-gray-500 block mb-1">Data</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-lg outline-none" />
            </div>

            {activeTab === 'cardio' && (
                <div>
                    <label className="text-xs text-gray-500 block mb-1">Rodzaj</label>
                    <div className="grid grid-cols-3 gap-2">
                        {cardioTypes.map(type => (
                            <button 
                                key={type.value}
                                onClick={() => setForm({...form, type: type.value})}
                                className={`flex flex-col items-center p-2 rounded-lg border text-[10px] font-bold transition ${form.type === type.value ? 'bg-green-600/20 border-green-600 text-green-500' : 'bg-black border-gray-800 text-gray-500'}`}
                            >
                                <i className={`fas ${type.icon} mb-1 text-sm`}></i>
                                {type.label.split(' ')[0]}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {form.type === 'inne' && activeTab === 'cardio' && (
                <input type="text" placeholder="Nazwa aktywności..." value={form.customName} onChange={e => setForm({...form, customName: e.target.value})} className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-lg outline-none text-sm" />
            )}

            <div className="flex space-x-3">
                <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Czas (np. 30 min)</label>
                    <input type="text" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} placeholder="30 min" className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-lg outline-none text-sm" />
                </div>
                {form.type === 'spacer' && activeTab === 'cardio' && (
                    <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">Kroki</label>
                        <input type="number" value={form.steps} onChange={e => setForm({...form, steps: e.target.value})} placeholder="10000" className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-lg outline-none text-sm" />
                    </div>
                )}
            </div>

            <div>
                <label className="text-xs text-gray-500 block mb-1">Notatki (opcjonalnie)</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-lg outline-none text-sm h-16" placeholder="Jak się czułeś?"></textarea>
            </div>

            <button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-black uppercase italic shadow-lg transition active:scale-95">Zapisz aktywność</button>
        </div>
      </div>

      {/* HISTORY SECTION */}
      <div ref={contentRef} className="space-y-6">
          {groupedSessions.length > 0 ? groupedSessions.map((group, gIdx) => (
              <div key={gIdx} className="animate-fade-in">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-4 px-1">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Tydzień: <span className="text-white ml-2">{group.label}</span></span>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700 uppercase">{group.count} sesje</span>
                  </div>
                  <div className="space-y-3">
                      {group.items.map(session => {
                          const typeData = cardioTypes.find(t => t.value === session.type);
                          const icon = session.type === 'mobility' ? 'fa-universal-access' : session.type === 'fight' ? 'fa-hand-fist' : typeData?.icon || 'fa-heartbeat';
                          const colorClass = session.type === 'mobility' ? 'text-purple-500' : session.type === 'fight' ? 'text-sky-400' : 'text-green-500';
                          
                          return (
                              <div key={session.id} className="bg-[#1e1e1e] p-4 rounded-xl border border-gray-800 flex items-center justify-between group">
                                  <div className="flex items-center space-x-4">
                                      <div className={`w-10 h-10 rounded-full bg-black flex items-center justify-center ${colorClass} border border-gray-800 shadow-inner`}>
                                          <i className={`fas ${icon}`}></i>
                                      </div>
                                      <div>
                                          <div className="text-white font-bold text-sm uppercase italic">
                                            {session.customName || session.type.charAt(0).toUpperCase() + session.type.slice(1)}
                                          </div>
                                          <div className="text-[10px] text-gray-500 font-bold uppercase">
                                              {session.date} • <span className="text-gray-300">{session.duration}</span>
                                              {session.steps && <span className="ml-2 text-green-600">({session.steps} k)</span>}
                                          </div>
                                      </div>
                                  </div>
                                  <button onClick={() => handleDeleteRequest(session.id)} className="text-gray-700 hover:text-red-500 p-2 transition">
                                      <i className="fas fa-trash-alt"></i>
                                  </button>
                              </div>
                          );
                      })}
                  </div>
              </div>
          )) : (
              <div className="text-center py-20 opacity-20 font-black italic uppercase">Brak zapisanych aktywności</div>
          )}
      </div>

      {/* MODALS */}
      {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-fade-in">
              <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-red-900/20 p-4 border-b border-red-900/30 flex items-center justify-center">
                      <i className="fas fa-trash-alt text-red-500 text-3xl"></i>
                  </div>
                  <div className="p-6 text-center">
                      <h3 className="text-xl font-black text-white italic uppercase mb-2">Potwierdź</h3>
                      <p className="text-gray-400 text-sm font-medium">{confirmModal.message}</p>
                  </div>
                  <div className="flex border-t border-gray-800">
                      <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 text-gray-400 font-bold hover:bg-gray-800 transition text-xs uppercase">Anuluj</button>
                      <button onClick={confirmModal.action} className="flex-1 py-4 text-red-500 font-bold hover:bg-red-900/20 transition text-xs uppercase border-l border-gray-800">Usuń</button>
                  </div>
              </div>
          </div>
      )}

      {alertMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-fade-in">
              <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-6 text-center">
                      <i className="fas fa-info-circle text-blue-500 text-4xl mb-3"></i>
                      <p className="text-gray-300 text-sm font-bold">{alertMessage}</p>
                  </div>
                  <button onClick={() => setAlertMessage(null)} className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold transition text-xs uppercase border-t border-gray-700">ROZUMIEM</button>
              </div>
          </div>
      )}

      {successMessage && (
          <div className="fixed bottom-10 left-0 right-0 z-50 flex justify-center p-4 animate-fade-in-up pointer-events-none">
              <div className="bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center border border-green-400">
                  <i className="fas fa-check-circle mr-2"></i> {successMessage}
              </div>
          </div>
      )}
    </div>
  );
}
