
import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../App';
import { storage, parseDateStr } from '../services/storage';
import { WorkoutHistoryEntry } from '../types';

export default function HistoryView() {
  const { workouts, syncData } = useContext(AppContext);
  const workoutIds = Object.keys(workouts);
  const [openSessions, setOpenSessions] = useState<{ [key: string]: boolean }>({});
  
  // State for adding/editing
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState("");

  // Long press & Options Menu State
  const [optionsSession, setOptionsSession] = useState<{ wId: string, index: number, date: string } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const isLongPress = useRef(false);
  
  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; action: () => void } | null>(null);
  
  // Manual Entry Form State
  const [manualForm, setManualForm] = useState<{
    workoutId: string;
    date: string;
    results: { [exId: string]: string };
  }>({
    workoutId: workoutIds[0] || "",
    date: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:MM
    results: {}
  });

  // Wymuszenie odświeżenia komponentu po zmianach w storage
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --- GESTURE HANDLERS ---
  const handleTouchStart = (wId: string, index: number, date: string) => {
    isLongPress.current = false;
    longPressTimer.current = window.setTimeout(() => {
      isLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      setOptionsSession({ wId, index, date });
    }, 600); // 600ms hold time
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  
  // Anuluj long-press przy przewijaniu
  const handleTouchMove = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
  };

  const handleSessionClick = (uniqueId: string) => {
    // Jeśli to był long press, nie otwieraj akordeonu
    if (isLongPress.current) {
        return;
    }
    setOpenSessions(prev => ({ ...prev, [uniqueId]: !prev[uniqueId] }));
  };
  // ------------------------

  const handleDeleteRequest = () => {
      if(!optionsSession) return;
      setConfirmModal({
          isOpen: true,
          message: "Czy na pewno chcesz usunąć ten trening z historii? Operacji nie można cofnąć.",
          action: performDelete
      });
  };

  const performDelete = async () => {
    if(!optionsSession) return;
    const { wId, index } = optionsSession;

    // Pobierz surową historię
    const history = storage.getHistory(wId);
    // Posortuj tak, jak widzi to użytkownik (po dacie string)
    const sortedHistory = [...history].sort((a: any, b: any) => parseDateStr(b.date) - parseDateStr(a.date));
    
    // Usuń element z posortowanej tablicy
    sortedHistory.splice(index, 1);
    
    // Zapisz nową tablicę (kolejność w storage zostanie zaktualizowana do posortowanej)
    storage.saveHistory(wId, sortedHistory);
    await syncData('history', null);
    
    setOptionsSession(null);
    setConfirmModal(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEditInit = () => {
    if(!optionsSession) return;
    const { wId, index, date } = optionsSession;
    setOptionsSession(null); // Zamknij menu
    
    const uniqueId = `${wId}_${index}`;
    setEditingDateId(uniqueId);
    setEditDateValue(date);
  };

  const saveDate = async (workoutId: string, index: number) => {
    // Pobierz i posortuj, aby trafić w dobry indeks
    const history = storage.getHistory(workoutId);
    const sortedHistory = [...history].sort((a: any, b: any) => parseDateStr(b.date) - parseDateStr(a.date));
    
    if(sortedHistory[index]) {
        sortedHistory[index].date = editDateValue;
        // Aktualizacja timestampu, aby sortowanie działało poprawnie w przyszłości
        sortedHistory[index].timestamp = parseDateStr(editDateValue);
        
        storage.saveHistory(workoutId, sortedHistory);
        await syncData('history', null);
    }
    setEditingDateId(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleManualSubmit = async () => {
    if(!manualForm.workoutId) return;
    
    // Formatowanie daty na styl aplikacji (DD.MM.YYYY, HH:MM)
    const d = new Date(manualForm.date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth()+1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const formattedDate = `${day}.${month}.${year} (${time})`;

    const history = storage.getHistory(manualForm.workoutId);
    const newEntry: WorkoutHistoryEntry = {
        date: formattedDate,
        timestamp: d.getTime(), // Timestamp z inputa
        results: manualForm.results
    };

    history.push(newEntry);
    
    // Sortujemy malejąco (najnowsze na górze) przy użyciu parsera stringów dla pewności
    history.sort((a: any, b: any) => parseDateStr(b.date) - parseDateStr(a.date));

    storage.saveHistory(manualForm.workoutId, history);
    await syncData('history', null);
    
    setIsAddModalOpen(false);
    setRefreshTrigger(prev => prev + 1);
    setManualForm(prev => ({ ...prev, results: {} }));
  };

  const handleManualResultChange = (exId: string, val: string) => {
    setManualForm(prev => ({
        ...prev,
        results: { ...prev.results, [exId]: val }
    }));
  };

  return (
    <div className="animate-fade-in pb-10 relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white text-center">Historia</h2>
        <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded text-xs font-bold flex items-center shadow"
        >
            <i className="fas fa-plus mr-2"></i> DODAJ RĘCZNIE
        </button>
      </div>
      
      {workoutIds.length === 0 && <p className="text-center text-gray-500">Brak planów treningowych.</p>}

      {workoutIds.map(wId => {
        // SORTOWANIE: Najnowsze na górze (b - a) używając parsera daty
        const history: WorkoutHistoryEntry[] = storage.getHistory(wId).sort((a: any, b: any) => parseDateStr(b.date) - parseDateStr(a.date));
        const planData = workouts[wId];
        
        if (history.length === 0) return null;

        return (
          <div key={wId} className="mb-8">
             <h3 className="text-xl font-bold text-red-500 mb-3 pl-3 border-l-4 border-red-500">{planData.title}</h3>
             <div className="space-y-3">
               {history.map((session, idx) => {
                 const uniqueId = `${wId}_${idx}`;
                 const isOpen = openSessions[uniqueId];
                 const isEditing = editingDateId === uniqueId;

                 return (
                   <div key={uniqueId} className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow border border-gray-800 select-none">
                     <div 
                        className="w-full p-4 flex justify-between items-center bg-gray-800 active:bg-gray-700 transition-colors cursor-pointer"
                        onContextMenu={(e) => e.preventDefault()} // Blokada menu przeglądarki
                        onTouchStart={() => handleTouchStart(wId, idx, session.date)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchMove} // Anulowanie przy scrollowaniu
                        onMouseDown={() => handleTouchStart(wId, idx, session.date)}
                        onMouseUp={handleTouchEnd}
                        onMouseLeave={handleTouchEnd}
                        onClick={() => handleSessionClick(uniqueId)}
                     >
                        {isEditing ? (
                            <div className="flex items-center space-x-2 w-full mr-2" onClick={(e) => e.stopPropagation()}>
                                <input 
                                    type="text" 
                                    value={editDateValue} 
                                    onChange={(e) => setEditDateValue(e.target.value)}
                                    className="bg-gray-900 text-white border border-gray-600 rounded px-2 py-1 text-sm w-full outline-none focus:border-blue-500"
                                />
                                <button onClick={() => saveDate(wId, idx)} className="text-green-500 p-1"><i className="fas fa-check"></i></button>
                                <button onClick={() => setEditingDateId(null)} className="text-gray-400 p-1"><i className="fas fa-times"></i></button>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-3">
                                <span className="font-bold text-white text-sm">
                                    {session.date}
                                </span>
                                <span className="text-gray-500 text-[10px] bg-gray-900 px-1 rounded border border-gray-700">
                                    Przytrzymaj opcje
                                </span>
                            </div>
                        )}
                        
                        {!isEditing && (
                             <i className={`fas fa-chevron-down text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                        )}
                     </div>
                     
                     {isOpen && (
                       <div className="bg-gray-900 p-4 border-t border-gray-700 text-sm animate-fade-in cursor-default">
                         <ul className="space-y-4">
                           {planData.exercises.map(ex => {
                             const res = session.results[ex.id];
                             if (!res) return null;
                             return (
                               <li key={ex.id} className="border-b border-gray-800 pb-2 flex flex-col last:border-0">
                                 <div className="text-gray-500 font-black uppercase text-[9px] mb-1 tracking-tight">{ex.name}</div>
                                 <div className="text-white font-mono text-xs break-words leading-relaxed">{res}</div>
                               </li>
                             );
                           })}
                         </ul>
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
          </div>
        );
      })}

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-fade-in">
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
                          Usuń
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* OPTIONS MODAL (LONG PRESS) */}
      {optionsSession && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4 animate-fade-in"
            onClick={() => setOptionsSession(null)}
          >
              <div 
                className="bg-[#1e1e1e] rounded-xl w-full max-w-xs p-6 shadow-2xl border border-gray-600 flex flex-col space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                  <h3 className="text-white font-bold text-center mb-2">{optionsSession.date}</h3>
                  
                  <button 
                    onClick={handleEditInit}
                    className="w-full bg-blue-700 hover:bg-blue-600 text-white py-3 rounded font-bold flex items-center justify-center"
                  >
                      <i className="fas fa-pen mr-2"></i> Edytuj Datę
                  </button>

                  <button 
                    onClick={handleDeleteRequest}
                    className="w-full bg-red-700 hover:bg-red-600 text-white py-3 rounded font-bold flex items-center justify-center"
                  >
                      <i className="fas fa-trash mr-2"></i> Usuń Wpis
                  </button>

                  <button 
                    onClick={() => setOptionsSession(null)}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 py-3 rounded font-bold mt-2"
                  >
                      Anuluj
                  </button>
              </div>
          </div>
      )}

      {/* MODAL DODAWANIA RĘCZNEGO */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4 overflow-y-auto">
            <div className="bg-[#1e1e1e] rounded-xl w-full max-w-lg shadow-2xl border border-gray-700 max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-[#1e1e1e] z-10 rounded-t-xl">
                    <h3 className="text-white font-bold">Dodaj trening ręcznie</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white">
                        <i className="fas fa-times fa-lg"></i>
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-grow">
                    <div className="mb-4">
                        <label className="text-xs text-gray-500 block mb-1">Wybierz plan</label>
                        <select 
                            value={manualForm.workoutId} 
                            onChange={(e) => setManualForm(prev => ({ ...prev, workoutId: e.target.value, results: {} }))}
                            className="w-full bg-gray-800 text-white p-3 rounded border border-gray-600 outline-none"
                        >
                            {workoutIds.map(id => (
                                <option key={id} value={id}>{workouts[id].title}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-6">
                        <label className="text-xs text-gray-500 block mb-1">Data i godzina</label>
                        <input 
                            type="datetime-local" 
                            value={manualForm.date}
                            onChange={(e) => setManualForm(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full bg-gray-800 text-white p-3 rounded border border-gray-600 outline-none"
                        />
                    </div>

                    <h4 className="text-sm font-bold text-red-500 mb-3 border-b border-red-900 pb-1">Ćwiczenia</h4>
                    {manualForm.workoutId && workouts[manualForm.workoutId].exercises.map(ex => (
                        <div key={ex.id} className="mb-3">
                            <label className="text-xs text-gray-300 block mb-1">{ex.name}</label>
                            <input 
                                type="text" 
                                placeholder="np. 100kg x 5 | 100kg x 5"
                                value={manualForm.results[ex.id] || ""}
                                onChange={(e) => handleManualResultChange(ex.id, e.target.value)}
                                className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700 text-sm focus:border-green-500 outline-none"
                            />
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-gray-700 sticky bottom-0 bg-[#1e1e1e] rounded-b-xl">
                    <button 
                        onClick={handleManualSubmit}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded shadow transition"
                    >
                        ZAPISZ DO HISTORII
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
