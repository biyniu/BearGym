
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { remoteStorage } from '../services/storage';

interface AuthViewProps {
  onLogin: (code: string, userData: any) => void;
}

export default function AuthView({ onLogin }: AuthViewProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    setLoading(true);
    setError('');

    try {
      const result = await remoteStorage.fetchUserData(cleanCode);
      if (result && result.success) {
        onLogin(cleanCode, result);
      } else {
        setError(result?.error || "Nieprawidłowy kod dostępu.");
      }
    } catch (err) {
      setError("Problem z połączeniem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#121212] animate-fade-in">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-2xl border-4 border-white/10 bg-red-600 shadow-red-900/50">
        <i className="fas fa-lock text-white text-4xl"></i>
      </div>
      
      <div className="w-full max-w-sm bg-[#1e1e1e] p-8 rounded-2xl border border-gray-800 shadow-2xl text-center">
        <h1 className="text-3xl font-black text-white mb-2 tracking-tighter italic">BEAR GYM</h1>
        <p className="text-gray-500 text-sm mb-8 uppercase tracking-widest font-bold">Wpisz swój kod klienta</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="text" 
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="KOD KLIENTA"
            className="w-full bg-gray-900 border border-gray-700 text-white p-4 rounded-xl text-center font-bold tracking-widest focus:border-red-600 outline-none uppercase transition"
            disabled={loading}
          />

          {error && <p className="text-red-500 text-xs font-bold animate-pulse">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full text-white font-black py-4 rounded-xl shadow-lg transition transform active:scale-95 flex items-center justify-center bg-red-600 hover:bg-red-700 uppercase italic tracking-tighter"
          >
            {loading ? <i className="fas fa-spinner fa-spin text-xl"></i> : "OTWÓRZ PLAN"}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-gray-800">
            <button 
                onClick={() => navigate('/coach-admin')}
                className="text-gray-600 hover:text-red-500 transition-colors text-[10px] font-black uppercase italic tracking-widest flex items-center justify-center mx-auto group"
            >
                <i className="fas fa-user-shield mr-2 group-hover:scale-110 transition-transform"></i>
                Panel Trenera
            </button>
        </div>
      </div>
      
      <p className="mt-8 text-[9px] text-gray-700 font-bold uppercase tracking-[0.3em]">Built for strength</p>
    </div>
  );
}
