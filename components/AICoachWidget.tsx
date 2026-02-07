
import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { GoogleGenAI } from "@google/genai";
import { CLIENT_CONFIG } from '../constants';
import { storage } from '../services/storage';

export default function AICoachWidget() {
  const { clientName, workouts, clientCode, settings } = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  
  // Ładowanie historii z localStorage przy starcie
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>(() => {
      return storage.getChatHistory();
  });
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Zapisywanie historii do localStorage przy każdej zmianie messages
  useEffect(() => {
    storage.saveChatHistory(messages);
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const toggleChat = () => setIsOpen(!isOpen);

  const clearHistory = () => {
      if(window.confirm("Czy na pewno chcesz wyczyścić pamięć trenera? Zapomni o czym rozmawialiście wcześniej.")) {
          setMessages([]);
          storage.clearChatHistory();
      }
  };

  // Funkcja pomocnicza: Pobiera wszystkie aktywności posortowane chronologicznie
  const getAllActivities = () => {
    const allActivities: { date: string, timestamp: number, type: 'strength'|'cardio', title: string }[] = [];
    
    // 1. Treningi siłowe
    Object.keys(workouts).forEach(id => {
        const history = storage.getHistory(id);
        history.forEach(h => {
            allActivities.push({
                date: h.date,
                timestamp: h.timestamp || 0,
                type: 'strength',
                title: workouts[id].title
            });
        });
    });

    // 2. Cardio
    const cardio = storage.getCardioSessions();
    cardio.forEach(c => {
        // Konwersja daty "YYYY-MM-DD" na timestamp (przyjmujemy południe)
        const d = new Date(c.date);
        allActivities.push({
            date: c.date,
            timestamp: d.getTime(),
            type: 'cardio',
            title: c.type.toUpperCase()
        });
    });

    // Sortowanie malejąco (najnowsze pierwsze)
    return allActivities.sort((a, b) => b.timestamp - a.timestamp);
  };

  const getSystemInstruction = () => {
    const activities = getAllActivities();
    const lastActivity = activities.length > 0 ? activities[0] : null;
    
    // Obliczanie statystyk dla BIEŻĄCEGO TYGODNIA KALENDARZOWEGO (od Poniedziałku)
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Niedziela, 1 = Poniedziałek, ...
    
    // Obliczamy dystans do ostatniego poniedziałku
    // Jeśli dzisiaj niedziela (0), to poniedziałek był 6 dni temu.
    // Jeśli poniedziałek (1), to 0 dni temu.
    const distanceToMonday = (currentDay + 6) % 7;
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0); // Początek dnia w poniedziałek
    const startOfWeekTimestamp = startOfWeek.getTime();

    const thisWeekActivities = activities.filter(a => a.timestamp >= startOfWeekTimestamp);
    
    const strengthCount = thisWeekActivities.filter(a => a.type === 'strength').length;
    const cardioCount = thisWeekActivities.filter(a => a.type === 'cardio').length;

    const targetStrength = settings.targetWorkoutsPerWeek || 3;
    const targetCardio = settings.targetCardioPerWeek || 3;

    // Analiza wagi
    const startWeight = parseFloat(settings.userInitialWeight || '0');
    const currentWeight = parseFloat(settings.userCurrentWeight || '0');
    const targetWeight = parseFloat(settings.userTargetWeight || '0');
    let weightContext = "";
    
    if (startWeight > 0 && currentWeight > 0 && targetWeight > 0) {
        const totalToLose = startWeight - targetWeight; // np. 10kg
        const lostSoFar = startWeight - currentWeight; // np. 4kg
        const leftToLose = currentWeight - targetWeight; // np. 6kg
        
        // Sprawdzenie czy cel to redukcja czy masa
        if (startWeight > targetWeight) {
            // REDUKCJA
            weightContext = `POSTĘPY WAGOWE (REDUKCJA):
            - Start: ${startWeight}kg, Teraz: ${currentWeight}kg, Cel: ${targetWeight}kg.
            - Schudł już: ${lostSoFar.toFixed(1)}kg.
            - Zostało do celu: ${leftToLose.toFixed(1)}kg.
            - Jeśli schudł > 0, pochwal go ("Już ${lostSoFar.toFixed(1)}kg mniej!").
            - Jeśli przytył (current > start), delikatnie zapytaj co się dzieje, ale bez hejtu.`;
        } else {
            // MASA
            const gainedSoFar = currentWeight - startWeight;
            const leftToGain = targetWeight - currentWeight;
            weightContext = `POSTĘPY WAGOWE (MASA):
            - Start: ${startWeight}kg, Teraz: ${currentWeight}kg, Cel: ${targetWeight}kg.
            - Zyskał już: ${gainedSoFar.toFixed(1)}kg.
            - Zostało do celu: ${leftToGain.toFixed(1)}kg.`;
        }
    } else {
        weightContext = "Brak pełnych danych wagowych (Start/Teraz/Cel) w ustawieniach. Jeśli użytkownik pyta o wagę, poproś by uzupełnił te dane w Ustawieniach.";
    }

    return `
      Jesteś Bear AI - doświadczonym trenerem personalnym z podejściem psychologicznym i stoickim.
      
      DANE PODOPIECZNEGO:
      - Imię: ${clientName || "Użytkownik"}
      - Cel główny: ${settings.userGoal || "Brak (zapytaj o cel, to kluczowe)"}
      - Trudności/Słabości: ${settings.userDifficulties || "Brak (zapytaj co jest trudne)"}
      
      ${weightContext}
      
      STATYSTYKI (Obecny tydzień kalendarzowy - od Poniedziałku):
      - Treningi siłowe w tym tygodniu: ${strengthCount} (Cel: ${targetStrength})
      - Cardio w tym tygodniu: ${cardioCount} (Cel: ${targetCardio})
      - Ostatnia aktywność: ${lastActivity ? `${lastActivity.date} (${lastActivity.title})` : "BRAK AKTYWNOŚCI OD DAWNA!"}
      
      TWOJA OSOBOWOŚĆ I ZASADY:
      1. FORMATOWANIE: Twoje odpowiedzi muszą być czytelne. Używaj AKAPITÓW (oddzielaj myśli pustą linią). Stosuj WYPUNKTOWANIA (listy) tam gdzie wymieniasz kilka rzeczy. Nie twórz ściany tekstu.
      2. ANALIZA TYGODNIOWA: Zawsze odnoś się do bieżącego tygodnia. Jeśli jest np. Piątek, a on zrobił 2 treningi (a cel to 3), zmotywuj go, że ma jeszcze weekend, by dobić cel.
      3. EMPATIA NA PIERWSZYM MIEJSCU: Jeśli użytkownik narzeka, że mu się nie chce, jest zmęczony lub ma zły dzień - ZAAKCEPTUJ TO. Powiedz: "Rozumiem, że masz gorszy dzień", "Wiem, że dzisiaj kanapa wygrywa".
      4. PRZYPOMNIENIE "DLACZEGO" i LICZBY: Używaj danych wagowych! Jeśli ktoś chce odpuścić, powiedz: "Schudłeś już ${startWeight - currentWeight}kg, zostało tylko ${currentWeight - targetWeight}kg. Nie zmarnuj tego wysiłku". Liczby działają na wyobraźnię.
      5. METODA MAŁYCH KROKÓW: Zamiast krzyczeć "IDŹ NA TRENING", zaproponuj kompromis. Np. "Rozumiem, że nie masz siły na całość. Zrób tylko rozgrzewkę i jedną serię. Tylko tyle. Jak dalej nie będziesz chciał, to wrócisz do domu".
      6. BRAK WYNIKÓW: Jeśli statystyki są słabe (${strengthCount} treningów vs cel ${targetStrength}), nie ochrzaniaj go bezmyślnie. Zapytaj z troską: "Widzę, że w tym tygodniu trochę słabiej. Co się dzieje? Jak możemy wrócić na tory?".
      
      STYL WYPOWIEDZI:
      - Mów jak do przyjaciela, któremu dobrze życzysz.
      - Unikaj wykrzykników i agresji.
      - Bądź konkretny, ale ciepły.
    `;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
        // Use process.env.API_KEY directly for GoogleGenAI initialization
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const response = await ai.models.generateContent({
            // Using gemini-3-flash-preview as recommended for text tasks
            model: CLIENT_CONFIG.geminiModel || "gemini-3-flash-preview", 
            contents: [
                ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
                { role: 'user', parts: [{ text: userMsg }] }
            ],
            config: {
                systemInstruction: getSystemInstruction(),
            }
        });

        const text = response.text;
        
        if (text) {
            setMessages(prev => [...prev, { role: 'model', text: text }]);
        } else {
             setMessages(prev => [...prev, { role: 'model', text: "Coś poszło nie tak, ale pamiętaj o swoim celu." }]);
        }

    } catch (e: any) {
        console.error("Gemini Error:", e);
        const errorMessage = e.message || JSON.stringify(e);
        setMessages(prev => [...prev, { role: 'model', text: `Błąd: ${errorMessage}` }]);
    } finally {
        setLoading(false);
    }
  };

  // Helper do renderowania tekstu z formatowaniem
  const renderMessageContent = (text: string) => {
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={index} className="h-2" />; // Odstęp dla pustych linii

      // Wykrywanie list punktowanych (- , * , • )
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
         return (
           <div key={index} className="flex items-start ml-1 mb-1">
             <span className="mr-2 text-red-400 font-bold">•</span>
             <span>{trimmed.substring(2)}</span>
           </div>
         );
      }

      // Zwykły akapit
      return <p key={index} className="mb-2 last:mb-0">{line}</p>;
    });
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button 
          onClick={toggleChat}
          className="fixed bottom-24 right-6 z-40 bg-gradient-to-br from-red-600 to-red-800 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center animate-pulse border-2 border-white/20 hover:scale-110 transition active:scale-95"
        >
          <i className="fas fa-robot text-2xl"></i>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-[#161616] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh] animate-fade-in-up ring-1 ring-white/10">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-700 to-red-900 p-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-red-700 font-bold border-2 border-red-900">
                        <i className="fas fa-bear-tracking text-xl"></i>
                    </div>
                    <div>
                        <h3 className="text-white font-black italic text-sm tracking-wide">BEAR AI COACH</h3>
                        <p className="text-[10px] text-red-200 uppercase font-bold flex items-center">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span> Online
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={clearHistory} className="text-white/60 hover:text-white transition p-2" title="Wyczyść pamięć">
                        <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                    <button onClick={toggleChat} className="text-white/80 hover:text-white transition transform hover:rotate-90 p-2">
                        <i className="fas fa-times text-lg"></i>
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-grow p-4 overflow-y-auto space-y-3 bg-[#121212] h-80 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 text-xs mt-8 px-4">
                        <i className="fas fa-dumbbell text-4xl mb-3 opacity-20"></i>
                        <p className="mb-2 font-bold text-gray-400">Widzę Twoje statystyki.</p>
                        <p>Jestem tu, żeby Ci pomóc osiągnąć Twój cel.</p>
                    </div>
                )}
                {messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        <div className={`max-w-[90%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            m.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-br-sm' 
                            : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
                        }`}>
                            {renderMessageContent(m.text)}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="bg-gray-800 text-gray-400 p-3 rounded-2xl rounded-bl-sm text-xs flex space-x-1 items-center border border-gray-700">
                            <span className="text-[9px] uppercase font-bold mr-2">Analizuję...</span>
                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-[#1e1e1e] border-t border-gray-800 flex space-x-2">
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Napisz do trenera..." 
                    className="flex-grow bg-black/50 text-white text-sm p-3 rounded-xl border border-gray-700 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/50 transition"
                />
                <button 
                    onClick={handleSend}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white w-10 h-10 rounded-xl flex items-center justify-center transition shadow-lg active:scale-95"
                >
                    <i className="fas fa-paper-plane text-xs"></i>
                </button>
            </div>
        </div>
      )}
    </>
  );
}
