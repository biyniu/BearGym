
import React, { useContext, useRef, useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { storage } from '../services/storage';
import { CLIENT_CONFIG } from '../constants';
import { WorkoutPlan } from '../types';

export default function Dashboard() {
  const { workouts, logo, updateLogo, clientName, coachName } = useContext(AppContext);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if(ev.target?.result) updateLogo(ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const getLastDate = (id: string) => {
    const history = storage.getHistory(id);
    return history.length > 0 ? history[0].date : 'Nigdy';
  };

  // Sortowanie treningów według displayOrder
  const sortedWorkouts = useMemo(() => {
    return (Object.entries(workouts) as [string, WorkoutPlan][]).sort((a, b) => {
        const orderA = (a[1] as any).displayOrder ?? 0;
        const orderB = (b[1] as any).displayOrder ?? 0;
        return orderA - orderB;
    });
  }, [workouts]);

  return (
    <div className="animate-fade-in relative">
      <div className="flex flex-col items-center mb-6">
        <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer relative group w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mb-4 overflow-hidden border-4 border-red-600 shadow-xl transition-all hover:shadow-red-900/50">
          <img 
            src={logo || 'https://lh3.googleusercontent.com/u/0/d/1GZ-QR4EyK6Ho9czlpTocORhwiHW4FGnP'} 
            alt="Logo"
            onError={(e) => { (e.target as HTMLImageElement).src='https://lh3.googleusercontent.com/u/0/d/1GZ-QR4EyK6Ho9czlpTocORhwiHW4FGnP'; }} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
            <i className="fas fa-camera text-white text-2xl"></i>
          </div>
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight uppercase text-center px-4 italic leading-none mb-2">{clientName || "TWÓJ TRENING"}</h2>
        
        {coachName && (
          <div className="border border-red-600/50 bg-red-900/10 px-6 py-1 rounded-sm">
             <span className="text-[11px] text-red-600 font-black uppercase italic tracking-widest">
                TRENER: {coachName}
             </span>
          </div>
        )}
        
        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleLogoUpload} />
      </div>

      <div className="grid gap-4 mb-6">
        {sortedWorkouts.map(([id, data]) => (
          <button key={id} onClick={() => navigate(`/workout/${id}`)} className="bg-[#1e1e1e] rounded-xl shadow-md p-6 flex items-center justify-between border-l-4 border-red-500 hover:bg-gray-800 transition transform active:scale-95 group">
            <div className="text-left">
              <h2 className="text-xl font-black text-white italic uppercase group-hover:text-red-400 transition-colors">{data.title}</h2>
              <span className="text-gray-500 text-[10px] font-bold uppercase flex items-center mt-1"><i className="fas fa-clock mr-1 text-blue-500"></i> Ostatnio: {getLastDate(id)}</span>
            </div>
            <i className="fas fa-play text-gray-700 group-hover:text-red-500 transition-colors text-xl"></i>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <ActivityWidget workouts={workouts} logo={logo} />
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => navigate('/history')} className="bg-[#1e1e1e] rounded-xl shadow p-4 text-gray-400 hover:text-white flex flex-col items-center justify-center transition border border-transparent hover:border-gray-600"><i className="fas fa-history mb-2 text-2xl"></i> <span className="text-xs font-bold uppercase tracking-tighter">Pełna historia</span></button>
          <button onClick={() => navigate('/progress')} className="bg-[#1e1e1e] rounded-xl shadow p-4 text-blue-400 hover:text-blue-300 flex flex-col items-center justify-center transition border border-transparent hover:border-blue-900"><i className="fas fa-chart-line mb-2 text-2xl"></i> <span className="text-xs font-bold uppercase tracking-tighter">Wykresy postępu</span></button>
        </div>
        <button onClick={() => navigate('/measurements')} className="w-full bg-[#1e1e1e] rounded-xl shadow p-4 text-green-400 hover:text-green-300 flex items-center justify-center transition border border-transparent hover:border-green-900"><i className="fas fa-ruler-combined text-2xl mr-3"></i><span className="font-black uppercase italic tracking-tighter">Pomiary Ciała</span></button>
        <button onClick={() => navigate('/cardio')} className="w-full bg-[#1e1e1e] rounded-xl shadow p-4 text-red-400 hover:text-red-300 flex flex-col items-center justify-center transition border border-transparent hover:border-red-900 group">
          <div className="flex items-center justify-center space-x-3 mb-2">
            <i className="fas fa-heartbeat text-2xl group-hover:scale-110 transition"></i>
            <span className="text-gray-600">|</span>
            <i className="fas fa-person-walking text-2xl text-green-500 group-hover:scale-110 transition"></i>
            <span className="text-gray-600">|</span>
            <i className="fas fa-universal-access text-2xl text-purple-500 group-hover:scale-110 transition"></i>
            <span className="text-gray-600">|</span>
            <i className="fas fa-hand-fist text-2xl text-sky-400 group-hover:scale-110 transition"></i>
          </div>
          <span className="text-xs font-black uppercase italic tracking-tighter">Cardio | Spacer | Mobility | Fight</span>
        </button>
      </div>
    </div>
  );
}

export function ActivityWidget({ workouts, logo, externalHistory, externalCardio }: { workouts: any, logo: string, externalHistory?: any, externalCardio?: any }) {
    const [viewMode, setViewMode] = useState<'calendar' | 'summary'>('calendar');
    const [viewDate, setViewDate] = useState(new Date());
    const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    const daysShort = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

    const { dayStatus, lastSessionStats } = useMemo(() => {
        const status: Record<string, { T: boolean; C: boolean; M: boolean; F: boolean; S: boolean }> = {};
        let allEntries: any[] = [];
        const ensureDate = (d: string) => { if (!status[d]) status[d] = { T: false, C: false, M: false, F: false, S: false }; };
        
        Object.keys(workouts).forEach(id => {
            const hist = externalHistory ? (externalHistory[id] || []) : storage.getHistory(id);
            hist.forEach((h: any) => {
                const datePart = h.date.split(/[ ,(]/)[0].replace(/,/g, ''); 
                ensureDate(datePart);
                status[datePart].T = true;
                allEntries.push({ ...h, workoutId: id, workoutTitle: workouts[id].title });
            });
        });
        
        const cardio = externalCardio || storage.getCardioSessions();
        cardio.forEach((c: any) => {
            const [y, m, d] = c.date.split('-');
            const datePart = `${d.toString().padStart(2, '0')}.${m.toString().padStart(2, '0')}.${y}`;
            ensureDate(datePart);
            if (c.type === 'mobility') status[datePart].M = true;
            else if (c.type === 'fight') status[datePart].F = true;
            else if (c.type === 'spacer') status[datePart].S = true;
            else status[datePart].C = true;
        });
        
        let stats = null;
        if (allEntries.length > 0) {
            allEntries.sort((a, b) => b.timestamp - a.timestamp);
            const latest = allEntries[0];
            let totalWeight = 0, totalReps = 0, totalSets = 0;
            Object.values(latest.results).forEach((res: any) => {
                const sets = res.split('|');
                totalSets += sets.length;
                sets.forEach((s: string) => {
                    const weightMatch = s.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
                    const repsMatch = s.match(/(?:x\s*|(\d+)\s*p)(\d+)?/i);
                    const weight = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : 0;
                    const reps = repsMatch ? parseInt(repsMatch[2] || repsMatch[1]) : 0;
                    totalWeight += (weight * reps); totalReps += reps;
                });
            });
            const durationMatch = latest.date.match(/\((.*?)\)/);
            stats = { title: latest.workoutTitle, date: latest.date.split(',')[0], totalWeight: Math.round(totalWeight), totalReps, totalSets, totalExercises: Object.keys(latest.results).length, duration: durationMatch ? durationMatch[1] : '--:--' };
        }
        return { dayStatus: status, lastSessionStats: stats };
    }, [workouts, externalHistory, externalCardio]);

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

    return (
        <div className="bg-[#1e1e1e] rounded-2xl shadow-xl p-6 border border-gray-800 relative overflow-hidden transition-all w-full max-w-[500px] mx-auto">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4 relative z-10">
                <div className="flex space-x-4">
                    <button onClick={() => setViewMode('calendar')} className={`text-[12px] font-black uppercase tracking-widest transition-colors ${viewMode === 'calendar' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'}`}>Kalendarz</button>
                    <button onClick={() => setViewMode('summary')} className={`text-[12px] font-black uppercase tracking-widest transition-colors ${viewMode === 'summary' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'}`}>Ostatni</button>
                </div>
                {viewMode === 'calendar' && (
                    <div className="flex items-center space-x-3">
                        <button onClick={prevMonth} className="text-gray-500 hover:text-white p-1"><i className="fas fa-chevron-left text-sm"></i></button>
                        <span className="text-[11px] text-white font-black uppercase italic tracking-tighter">{months[month]} {year}</span>
                        <button onClick={nextMonth} className="text-gray-500 hover:text-white p-1"><i className="fas fa-chevron-right text-sm"></i></button>
                    </div>
                )}
            </div>

            <div className="min-h-[250px] flex flex-col justify-center">
                {viewMode === 'calendar' ? (
                    <div className="animate-fade-in">
                        <div className="grid grid-cols-7 gap-2 mb-3 text-center">
                            {daysShort.map(d => <div key={d} className="text-[10px] text-gray-600 font-black uppercase">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {days.map((day, idx) => {
                                if (day === null) return <div key={`empty-${idx}`} className="aspect-square"></div>;
                                const dStr = day.toString().padStart(2, '0');
                                const mStr = (month + 1).toString().padStart(2, '0');
                                const status = dayStatus[`${dStr}.${mStr}.${year}`];
                                const activeTypes = [];
                                if (status?.T) activeTypes.push({ color: 'bg-red-600', letter: 'T' });
                                if (status?.C) activeTypes.push({ color: 'bg-red-500', letter: 'C' });
                                if (status?.S) activeTypes.push({ color: 'bg-green-500', letter: 'S' });
                                if (status?.M) activeTypes.push({ color: 'bg-purple-600', letter: 'M' });
                                if (status?.F) activeTypes.push({ color: 'bg-sky-400', letter: 'F' });
                                return (
                                    <div key={day} className={`aspect-square rounded-xl flex items-center justify-center relative border border-gray-800 transition-all overflow-hidden bg-black/40 group hover:border-gray-600`}>
                                        <span className={`absolute top-1 left-2 text-[12px] font-black z-20 ${activeTypes.length > 0 ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]' : 'text-gray-700'}`}>{day}</span>
                                        {activeTypes.length > 0 && (
                                            <div className={`w-full h-full grid ${activeTypes.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${activeTypes.length > 2 ? 'grid-rows-2' : ''}`}>
                                                {activeTypes.map((t, i) => (
                                                    <div key={i} className={`${t.color} flex items-center justify-center relative ${activeTypes.length === 3 && i === 2 ? 'col-span-2' : ''}`}><span className="text-[10px] font-black text-white italic drop-shadow-sm group-hover:scale-110 transition-transform">{t.letter}</span></div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in px-2">
                        {lastSessionStats ? (
                            <div className="space-y-6">
                                <div className="flex justify-between items-end border-b border-gray-800 pb-3">
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-[10px] text-red-500 font-black uppercase tracking-widest italic mb-1">Ostatnia Sesja</div>
                                        <div className="text-2xl font-black text-white italic uppercase truncate tracking-tighter leading-none">{lastSessionStats.title}</div>
                                    </div>
                                    <div className="text-right ml-3 shrink-0"><div className="text-[11px] text-gray-500 font-black uppercase tracking-tighter">{lastSessionStats.date}</div></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <StatItem icon="fa-weight-hanging" label="Tonaż" value={lastSessionStats.totalWeight} unit="kg" color="text-red-500" />
                                    <StatItem icon="fa-dumbbell" label="Ćwiczenia" value={lastSessionStats.totalExercises} unit="" color="text-blue-500" />
                                    <StatItem icon="fa-redo" label="Powt." value={lastSessionStats.totalReps} unit="" color="text-green-500" />
                                    <StatItem icon="fa-stopwatch" label="Czas" value={lastSessionStats.duration} unit="" color="text-yellow-500" />
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 opacity-10"><i className="fas fa-dumbbell text-6xl mb-4"></i><div className="text-sm font-black uppercase italic tracking-widest">Brak danych historycznych</div></div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex justify-center space-x-3 mt-6">
                <button onClick={() => setViewMode('calendar')} className={`h-2 rounded-full transition-all duration-300 ${viewMode === 'calendar' ? 'bg-red-500 w-8' : 'bg-gray-800 w-2'}`}></button>
                <button onClick={() => setViewMode('summary')} className={`h-2 rounded-full transition-all duration-300 ${viewMode === 'summary' ? 'bg-red-500 w-8' : 'bg-gray-800 w-2'}`}></button>
            </div>
        </div>
    );
}

function StatItem({ icon, label, value, unit, color }: any) {
    return (
        <div className="bg-black/60 p-4 rounded-2xl border border-gray-800 flex flex-col items-center justify-center shadow-inner group hover:border-gray-600 transition-colors">
            <i className={`fas ${icon} ${color} text-lg mb-2 opacity-80 group-hover:scale-110 transition-transform`}></i>
            <div className="text-white font-black text-xl leading-none tracking-tighter">{value}<span className="text-[11px] ml-1 opacity-40 font-bold uppercase">{unit}</span></div>
            <div className="text-[9px] text-gray-600 uppercase font-black italic mt-2 tracking-widest">{label}</div>
        </div>
    );
}
