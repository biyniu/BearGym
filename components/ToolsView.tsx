import React, { useState } from 'react';

export default function ToolsView() {
  const [activeTab, setActiveTab] = useState<'1rm' | 'plates'>('1rm');

  return (
    <div className="animate-fade-in pb-10">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Narzędzia</h2>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-800 rounded-xl mb-6">
        <button 
            onClick={() => setActiveTab('1rm')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === '1rm' ? 'bg-[#1e1e1e] text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
        >
            Kalkulator 1RM
        </button>
        <button 
            onClick={() => setActiveTab('plates')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'plates' ? 'bg-[#1e1e1e] text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
        >
            Kalkulator Talerzy
        </button>
      </div>

      {activeTab === '1rm' ? <OneRepMaxCalc /> : <PlateLoaderCalc />}
    </div>
  );
}

// --- 1RM CALCULATOR ---
function OneRepMaxCalc() {
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');

    const calculate1RM = () => {
        const w = parseFloat(weight);
        const r = parseFloat(reps);
        if(!w || !r) return 0;
        if(r === 1) return w;
        // Formula Epley
        return Math.round(w * (1 + r / 30));
    };

    const max = calculate1RM();
    
    // Percentages table
    const percentages = [95, 90, 85, 80, 75, 70, 60, 50];

    return (
        <div className="bg-[#1e1e1e] p-5 rounded-xl border border-gray-800 shadow-md">
            <h3 className="text-purple-400 font-bold mb-4 uppercase text-sm">Szacowanie siły (Epley)</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="text-gray-500 text-xs block mb-1">Ciężar (kg)</label>
                    <input 
                        type="number" 
                        value={weight} 
                        onChange={e => setWeight(e.target.value)}
                        className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 text-xl font-bold focus:border-purple-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-gray-500 text-xs block mb-1">Powtórzenia</label>
                    <input 
                        type="number" 
                        value={reps} 
                        onChange={e => setReps(e.target.value)}
                        className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 text-xl font-bold focus:border-purple-500 outline-none"
                    />
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg text-center mb-6 border border-gray-700">
                <div className="text-gray-400 text-xs uppercase mb-1">Twój szacowany Max (1RM)</div>
                <div className="text-4xl font-black text-white">{max} <span className="text-lg text-purple-500">kg</span></div>
            </div>

            {max > 0 && (
                <div className="space-y-1">
                    <h4 className="text-gray-500 text-xs font-bold mb-2">TABELA PROCENTOWA</h4>
                    {percentages.map(pct => (
                        <div key={pct} className="flex justify-between items-center bg-gray-900 p-2 rounded border border-gray-800">
                            <span className="text-gray-400 font-bold">{pct}%</span>
                            <span className="text-white font-mono">{Math.round(max * (pct/100))} kg</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// --- PLATE LOADER ---
function PlateLoaderCalc() {
    const [targetWeight, setTargetWeight] = useState('');
    const [barWeight, setBarWeight] = useState(20);

    const availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25];
    
    // Plate Colors usually found in gyms
    const getPlateColor = (p: number) => {
        if(p === 25) return 'bg-red-600 border-red-800 text-white';
        if(p === 20) return 'bg-blue-600 border-blue-800 text-white';
        if(p === 15) return 'bg-yellow-500 border-yellow-700 text-black';
        if(p === 10) return 'bg-green-600 border-green-800 text-white';
        if(p === 5) return 'bg-white border-gray-300 text-black';
        return 'bg-gray-500 border-gray-700 text-white';
    };

    const getPlateSize = (p: number) => {
        if(p >= 20) return 'h-24 py-8';
        if(p >= 10) return 'h-20 py-6';
        if(p >= 5) return 'h-16 py-4';
        return 'h-12 py-2';
    };

    const calculatePlates = () => {
        const target = parseFloat(targetWeight);
        if(!target || target < barWeight) return [];

        let weightPerSide = (target - barWeight) / 2;
        const platesToLoad: number[] = [];

        availablePlates.forEach(plate => {
            while(weightPerSide >= plate) {
                platesToLoad.push(plate);
                weightPerSide -= plate;
            }
        });

        // Precision fix for floating point errors
        if(weightPerSide > 0.1) {
            // Remainder handling if needed
        }

        return platesToLoad;
    };

    const plates = calculatePlates();

    return (
        <div className="bg-[#1e1e1e] p-5 rounded-xl border border-gray-800 shadow-md">
            <h3 className="text-indigo-400 font-bold mb-4 uppercase text-sm">Kalkulator Talerzy</h3>

            <div className="mb-6">
                <label className="text-gray-500 text-xs block mb-1">Docelowy ciężar (kg)</label>
                <input 
                    type="number" 
                    value={targetWeight} 
                    onChange={e => setTargetWeight(e.target.value)}
                    placeholder="np. 100"
                    className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 text-xl font-bold focus:border-indigo-500 outline-none mb-4"
                />
                
                <div className="flex items-center justify-between bg-gray-900 p-3 rounded border border-gray-700">
                    <span className="text-gray-400 text-sm">Waga gryfu:</span>
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => setBarWeight(20)}
                            className={`px-3 py-1 rounded text-xs font-bold transition ${barWeight === 20 ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                        >
                            20kg
                        </button>
                        <button 
                            onClick={() => setBarWeight(15)}
                            className={`px-3 py-1 rounded text-xs font-bold transition ${barWeight === 15 ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                        >
                            15kg
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg min-h-[150px] flex items-center justify-center border border-gray-700 relative overflow-hidden">
                {/* Bar line */}
                <div className="absolute w-full h-4 bg-gray-500 left-0 top-1/2 transform -translate-y-1/2 z-0"></div>
                
                {/* Plates Visualization */}
                <div className="flex items-center space-x-1 z-10 relative">
                     {/* Sleeve stopper */}
                    <div className="w-4 h-28 bg-gray-400 border-r-2 border-gray-600 rounded-l"></div>
                    
                    {plates.length > 0 ? plates.map((p, idx) => (
                        <div 
                            key={idx} 
                            className={`w-6 rounded-md border-2 flex items-center justify-center shadow-lg ${getPlateColor(p)} ${getPlateSize(p)}`}
                        >
                           <span className="-rotate-90 text-[10px] font-bold">{p}</span>
                        </div>
                    )) : (
                        <span className="text-gray-500 text-xs absolute top-2 right-2">Pusta sztanga</span>
                    )}
                </div>
            </div>
            
            {plates.length > 0 && (
                <div className="mt-4 text-center">
                    <div className="text-gray-400 text-xs mb-1">Na jedną stronę:</div>
                    <div className="text-white font-mono text-sm">
                        {plates.join(' + ')} kg
                    </div>
                </div>
            )}
        </div>
    );
}