
import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../App';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { logo } = useContext(AppContext);

  useEffect(() => {
    // 1. Sprawdź czy aplikacja już jest zainstalowana (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    // 2. Wykryj iOS (w tym iPadOS, który może udawać Maca)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIosDevice);

    // 3. Jeśli to iOS, pokaż instrukcję po chwili (jeśli nie w trybie standalone)
    if (isIosDevice) {
        // Pokaż tylko jeśli nie zamknięto wcześniej w tej sesji
        if (!sessionStorage.getItem('installPromptDismissed')) {
            setTimeout(() => setShowPrompt(true), 2000);
        }
    }

    // 4. Obsługa Android/Desktop (beforeinstallprompt)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!sessionStorage.getItem('installPromptDismissed')) {
          setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-fade-in-up">
      <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl p-5 max-w-md mx-auto relative ring-1 ring-white/10">
        <button 
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-gray-500 hover:text-white p-2 transition"
        >
            <i className="fas fa-times"></i>
        </button>

        <div className="flex items-start space-x-4 pr-6">
            <div className="w-14 h-14 flex-shrink-0 bg-gray-800 rounded-xl overflow-hidden border border-gray-600 shadow-md">
                <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex-grow">
                <h3 className="font-bold text-white text-base mb-1">Zainstaluj Bear Gym</h3>
                
                {isIOS ? (
                    <div className="text-gray-300 text-xs leading-relaxed space-y-2">
                        <p>Aby dodać aplikację do ekranu początkowego:</p>
                        <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 bg-gray-700 rounded flex items-center justify-center text-blue-400"><i className="fas fa-share-from-square"></i></span>
                            <span>1. Kliknij <strong>Udostępnij</strong> na pasku.</span>
                        </div>
                        <div className="flex items-center space-x-2">
                             <span className="w-5 h-5 bg-gray-700 rounded flex items-center justify-center text-white"><i className="fas fa-plus-square"></i></span>
                            <span>2. Wybierz <strong>Do ekranu początkowego</strong>.</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-400 text-xs mb-3">
                        Zainstaluj aplikację, aby korzystać z niej w trybie pełnoekranowym i mieć szybszy dostęp.
                    </div>
                )}

                {!isIOS && (
                    <button 
                        onClick={handleInstallClick}
                        className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-xs font-black transition w-full shadow-lg tracking-wide uppercase"
                    >
                        Zainstaluj teraz
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
