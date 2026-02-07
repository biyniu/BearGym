
import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../App';
import { storage, parseDateStr } from '../services/storage';
import { CLIENT_CONFIG } from '../constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WorkoutPlan } from '../types';

declare var html2pdf: any;

export default function ProgressView() {
  const { workouts, logo } = useContext(AppContext);
  const workoutIds = Object.keys(workouts);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>(workoutIds[0] || "");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const getExerciseData = (workoutId: string, exerciseId: string) => {
    const history = storage.getHistory(workoutId);
    if (!history || history.length === 0) return [];

    // Sortujemy po dacie chronologicznie (OD NAJSTARSZEGO DO NAJNOWSZEGO)
    // Używamy parseDateStr dla pewności
    return history.slice()
      .sort((a, b) => parseDateStr(a.date) - parseDateStr(b.date))
      .map(entry => {
        const resultStr = entry.results[exerciseId];
        if (!resultStr) return null;

        // POPRAWKA: Ignorowanie treści w nawiasach kwadratowych i okrągłych (Notatki)
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
          weight: maxWeight,
          fullDate: entry.date
        };
      })
      .filter(Boolean);
  };

  const handleExportPDF = () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    const element = reportRef.current;
    const opt = {
      margin: 0,
      filename: `Raport_Postepow_${CLIENT_CONFIG.name.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    setTimeout(() => {
        html2pdf().set(opt).from(element).save().then(() => setIsGeneratingPdf(false));
    }, 1000);
  };

  const CustomLabel = (props: any) => {
    const { x, y, value } = props;
    return (
      <text x={x} y={y - 12} fill="#ffffff" textAnchor="middle" fontSize={10} fontWeight="bold">{value}</text>
    );
  };

  const currentWorkout = workouts[selectedWorkoutId];

  return (
    <div className="animate-fade-in pb-20 relative">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-white">Wykresy Postępu</h2>
        <div className="flex gap-2 w-full md:w-auto">
            <select 
                value={selectedWorkoutId} 
                onChange={(e) => setSelectedWorkoutId(e.target.value)}
                className="flex-grow bg-gray-800 text-white p-3 rounded-lg border border-gray-600 outline-none"
            >
                {(Object.entries(workouts) as [string, WorkoutPlan][]).map(([id, data]) => (
                <option key={id} value={id}>{data.title}</option>
                ))}
            </select>
            <button onClick={handleExportPDF} disabled={isGeneratingPdf} className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-bold shadow transition flex items-center">
                {isGeneratingPdf ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-file-pdf mr-2"></i>} PDF
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
          {currentWorkout?.exercises.map((ex) => {
              const data = getExerciseData(selectedWorkoutId, ex.id);
              if (!data || data.length === 0) return null; // Zmieniono z < 2 na === 0

              const weights = data.map((d: any) => d.weight);
              const maxVal = Math.max(...weights);
              const minVal = Math.min(...weights);
              const domainMax = Math.ceil(maxVal * 1.25); 
              const domainMin = Math.max(0, Math.floor(minVal * 0.8));

              return (
                  <div key={ex.id} className="bg-[#1e1e1e] p-3 rounded-lg shadow-sm border border-gray-800">
                      <div className="flex justify-between items-center mb-1 border-b border-gray-700 pb-1">
                          <h3 className="font-bold text-white text-sm truncate max-w-[70%]">{ex.name}</h3>
                          <span className="text-xs font-bold text-blue-400">Max: {maxVal} kg</span>
                      </div>
                      <div className="h-44 w-full pt-4">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={data as any} margin={{ top: 25, right: 35, bottom: 20, left: 10 }}>
                              <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="date" stroke="#666" tick={{fill: '#888', fontSize: 10}} tickMargin={10} padding={{ left: 25, right: 25 }} />
                              <YAxis hide={true} domain={[domainMin, domainMax]} />
                              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #444', borderRadius: '4px', fontSize: '10px' }} itemStyle={{ color: '#fff' }} formatter={(v: any) => [`${v} kg`, '']} />
                              <Line type="monotone" dataKey="weight" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#1e1e1e' }} activeDot={{ r: 6, fill: '#fff' }} label={<CustomLabel />} isAnimationActive={false} />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              );
          })}
      </div>

      {/* PDF TEMPLATE (STAYS HIDDEN) */}
      <div className="absolute top-0 left-[-9999px]">
        <div ref={reportRef} className="w-[210mm] bg-[#121212] text-white font-sans p-8">
            <h1 className="text-3xl font-bold border-b-4 border-red-600 pb-4 mb-8">BEAR GYM - RAPORT POSTĘPÓW</h1>
            {(Object.entries(workouts) as [string, WorkoutPlan][]).map(([wId, plan]) => {
                const hasData = plan.exercises.some(ex => getExerciseData(wId, ex.id).length >= 1);
                if (!hasData) return null;
                return (
                    <section key={wId} className="mb-8 break-inside-avoid">
                        <h2 className="text-xl font-bold text-red-500 mb-4 uppercase">{plan.title}</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {plan.exercises.map(ex => {
                                const data = getExerciseData(wId, ex.id);
                                if (data.length === 0) return null;
                                return (
                                    <div key={ex.id} className="bg-gray-900 p-2 border border-gray-800 rounded">
                                        <div className="text-[10px] font-bold text-gray-500 mb-1">{ex.name}</div>
                                        <div className="text-xs text-white">Peak: {Math.max(...data.map(d => d.weight))} kg</div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
      </div>
    </div>
  );
}
