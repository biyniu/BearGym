import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 1. Ładujemy zmienne z plików .env (lokalnie)
  // Używamy (process as any), aby uniknąć błędów TypeScript związanych z 'cwd'
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // 2. Łączymy ze zmiennymi procesu (Vercel Environment Variables)
  const processEnv = { ...process.env, ...env };

  // 3. Pobieramy klucz.
  // Priorytet ma 'API_KEY' (tak jak chciałeś), w drugiej kolejności sprawdzamy stary 'VITE_GEMINI_API_KEY'
  const finalApiKey = processEnv.API_KEY || processEnv.VITE_GEMINI_API_KEY || "";

  return {
    plugins: [react()],
    define: {
      // Definiujemy globalną zmienną process.env.API_KEY, która będzie zawierać wartość znalezionego klucza
      'process.env.API_KEY': JSON.stringify(finalApiKey)
    }
  };
});