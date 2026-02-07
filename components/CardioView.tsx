
import React, { useState, useRef, useMemo, useContext } from 'react';
import { storage } from '../services/storage';
import { CardioSession, CardioType } from '../types';
import { CLIENT_CONFIG } from '../constants';
import { AppContext } from '../App';

declare var html2pdf: any;

export default function CardioView() {
  const { syncData } = useContext(AppContext);
  const [sessions, setSessions] = useState<CardioSession[]>(storage.getCardioSessions());
  const [activeTab, setActiveTab] = useState<'cardio' | 'mobility'>('cardio');
  
  // Custom Modals State
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; action: () => void } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'rowerek' as CardioType,
    duration: '',
    notes: ''
  });
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const cardioTypes: { value: CardioType, label: string, icon: string }[] = [
    { value: 'rowerek', label: 'Rowerek Stacjonarny', icon: 'fa-bicycle' },
    { value: 'bieznia', label: 'Bieżnia', icon: 'fa-running' },
    { value: 'schody', label: 'Schody', icon: 'fa-stairs' },
    { value: 'orbitrek', label: 'Orbitrek', icon: 'fa-walking' }
  ];

  const handleSave = async () => {
    if (!form.duration) {
        setAlertMessage("Podaj czas trwania sesji.");
        return;
    }
    
    // Jeśli jesteśmy w zakładce Mobility, wymuszamy typ 'mobility'
    const finalType = activeTab === 'mobility' ? 'mobility' : form.type;

    const newSession: CardioSession = {
      id: Date.now().toString(),
      date: form.date,
      type: finalType,
      duration: form.duration,
      notes: form.notes
    };

    const updated = [newSession, ...sessions].sort((a,b) => b.date.localeCompare(a.date));
    
    // 1. Zapis lokalny (natychmiastowy)
    setSessions(updated);
    storage.saveCardioSessions(updated);
    
    // 2. Próba synchronizacji (nie blokuje UI w razie błędu)
    try {
      await syncData('extras', {
        measurements: storage.getMeasurements(),
        cardio: updated
      });
    } catch (e) {
      console.warn("Błąd synchronizacji cardio w tle:", e);
    }

    // 3. Reset formularza i sukces
    setForm(prev => ({ ...prev, duration: '', notes: '' }));
    
    const typeLabel = finalType === 'mobility' ? 'Mobility' : cardioTypes.find(c => c.value === finalType)?.label || 'Cardio';
    setSuccessMessage(`Zapisano trening: ${typeLabel} (${form.duration})`);
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
        measurements: storage.getMeasurements(),
        cardio: updated
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
        <h2 className="text-2xl font-bold text-white">Aktywność Dodatkowa</h2>
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
      <div className="flex bg-[#1e1e1e] p-1 rounded-xl mb-6 border border-gray-800">
        <button 
            onClick={() => setActiveTab('cardio')}
            className={`flex-1 py-3 rounded-lg text-xs font-black uppercase italic transition flex items-center justify-center space-x-2 ${activeTab === 'cardio' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
            <i className="fas fa-heartbeat"></i> <span>Cardio</span>
        </button>
        <button 
            onClick={() => setActiveTab('mobility')}
            className={`flex-1 py-3 rounded-lg text-xs font-black uppercase italic transition flex items-center justify-center space-x-2 ${activeTab === 'mobility' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
            <i className="fas fa-universal-access"></i> <span>Mobility</span>
        </button>
      </div>

      <div className={`bg-[#1e1e1e] rounded-xl shadow-md p-4 mb-6 border-l-4 ${activeTab === 'cardio' ? 'border-red-600' : 'border-purple-600'}`}>
        <div className="grid grid-cols-1 gap-4">
            <div>
                <label className="text-xs text-gray-500 block mb-1">Data</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-gray-800 text-white p-3 rounded border border-gray-600 outline-none" />
            </div>
            
            {activeTab === 'cardio' ? (
                <div>
                    <label className="text-xs text-gray-500 block mb-1">Rodzaj Cardio</label>
                    <div className="grid grid-cols-2 gap-2">
                        {cardioTypes.map(t => (
                            <button key={t.value} onClick={() => setForm({...form, type: t.value})} className={`p-3 rounded border flex flex-col items-center justify-center transition ${form.type === t.value ? 'bg-red-900/50 border-red-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                                <i className={`fas ${t.icon} text-xl mb-1`}></i>
                                <span className="text-xs font-bold">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400">
                    <i className="fas fa-universal-access text-4xl mr-4"></i>
                    <div>
                        <div className="font-black uppercase italic text-sm">Sesja Mobility</div>
                        <div className="text-[10px]">Rozciąganie, rolowanie, joga</div>
                    </div>
                </div>
            )}

            <div>
                <label className="text-xs text-gray-500 block mb-1">Czas trwania (np. 30 min)</label>
                <input type="text" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} placeholder="Wpisz czas..." className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 focus:border-red-500 outline-none font-bold" />
            </div>

            <div>
                <label className="text-xs text-gray-500 block mb-1">Notatki (opcjonalnie)</label>
                <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="..." className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 focus:border-red-500 outline-none" />
            </div>

            <button 
                onClick={handleSave} 
                className={`w-full text-white py-3 rounded-2xl font-black uppercase italic shadow-lg transition mt-2 active:scale-95 ${activeTab === 'cardio' ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
                ZAPISZ SESJĘ
            </button>
        </div>
      </div>

      <div ref={contentRef} className="bg-[#121212] p-2 rounded-xl min-h-[200px]">
         <div className="mb-4 text-center border-b border-gray-700 pb-2 hidden print:block" style={{display: isGeneratingPdf ? 'block' : 'none'}}>
            <h1 className="text-2xl font-bold text-red-500">RAPORT AKTYWNOŚCI</h1>
            <p className="text-gray-400 text-sm">{CLIENT_CONFIG.name}</p>
        </div>
        <h3 className="font-bold text-gray-300 mb-4 px-1 flex items-center justify-between">
            <span><i className="fas fa-history mr-2 text-gray-500"></i> Historia</span>
            <span className="text-xs text-gray-500">Łącznie: {sessions.length}</span>
        </h3>
        <div className="space-y-6">
            {groupedSessions.length > 0 ? groupedSessions.map((group, gIdx) => (
                <div key={gIdx} className="break-inside-avoid">
                    <div className="flex items-center justify-between border-b border-gray-700 pb-1 mb-2 px-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tydzień: <span className="text-white ml-1">{group.label}</span></span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${group.count >= 3 ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-300'}`}>{group.count} sesje</span>
                    </div>
                    <div className="space-y-2">
                        {group.items.map(session => {
                            const isMobility = session.type === 'mobility';
                            const typeInfo = isMobility 
                                ? { label: 'Mobility / Rozciąganie', icon: 'fa-universal-access' }
                                : cardioTypes.find(t => t.value === session.type);
                            
                            return (
                                <div key={session.id} className={`bg-[#1e1e1e] p-3 rounded-lg border flex justify-between items-center hover:bg-[#252525] transition ${isMobility ? 'border-purple-900/30' : 'border-gray-800'}`}>
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border shrink-0 ${isMobility ? 'bg-purple-900/20 border-purple-700 text-purple-500' : 'bg-gray-800 border-gray-700 text-red-500'}`}>
                                            <i className={`fas ${typeInfo?.icon || 'fa-heartbeat'}`}></i>
                                        </div>
                                        <div>
                                            <div className={`font-bold text-sm ${isMobility ? 'text-purple-300' : 'text-white'}`}>{typeInfo?.label}</div>
                                            <div className="text-gray-400 text-[10px]">
                                                {session.date} • <span className="text-gray-200 font-mono">{session.duration}</span>
                                                {session.notes && <span className="ml-2 italic opacity-70">- {session.notes}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {!isGeneratingPdf && <button onClick={() => handleDeleteRequest(session.id)} className="text-gray-600 hover:text-red-500 p-2 transition"><i className="fas fa-trash-alt"></i></button>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )) : <p className="text-center text-gray-500 py-6">Brak zapisanych sesji.</p>}
        </div>
      </div>

      {/* SUCCESS MODAL - Z-INDEX 100 */}
      {successMessage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-fade-in">
              <div className="bg-[#1e1e1e] border border-green-600 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-green-900/20 p-4 border-b border-green-900/30 flex items-center justify-center">
                      <i className="fas fa-check-circle text-green-500 text-3xl"></i>
                  </div>
                  <div className="p-6 text-center">
                      <h3 className="text-xl font-black text-white italic uppercase mb-2">Sukces</h3>
                      <p className="text-gray-400 text-sm">{successMessage}</p>
                  </div>
                  <button 
                      onClick={() => setSuccessMessage(null)}
                      className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold transition text-xs uppercase border-t border-green-800"
                  >
                      OK
                  </button>
              </div>
          </div>
      )}

      {/* CONFIRM MODAL - Z-INDEX 100 */}
      {confirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-fade-in">
              <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-red-900/20 p-4 border-b border-red-900/30 flex items-center justify-center">
                      <i className="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                  </div>
                  <div className="p-6 text-center">
                      <h3 className="text-xl font-black text-white italic uppercase mb-2">Potwierdzenie</h3>
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
                          Usuń
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ALERT MODAL - Z-INDEX 100 */}
      {alertMessage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-fade-in">
              <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                   <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-center">
                      <i className="fas fa-info-circle text-blue-500 text-3xl"></i>
                  </div>
                  <div className="p-6 text-center">
                      <h3 className="text-xl font-black text-white italic uppercase mb-2">Informacja</h3>
                      <p className="text-gray-400 text-sm">{alertMessage}</p>
                  </div>
                  <button 
                      onClick={() => setAlertMessage(null)}
                      className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold transition text-xs uppercase border-t border-gray-700"
                  >
                      OK
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}
