
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  const processEnv = { ...process.env, ...env };

  const finalGeminiKey = processEnv.API_KEY || processEnv.VITE_GEMINI_API_KEY || "";
  const finalFirebaseKey = processEnv.FIREBASE_API_KEY || processEnv.VITE_FIREBASE_API_KEY || "";

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(finalGeminiKey),
      'process.env.FIREBASE_API_KEY': JSON.stringify(finalFirebaseKey)
    }
  };
});
