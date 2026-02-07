
import { CLIENT_CONFIG } from '../constants';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs,
  query,
  where
} from 'firebase/firestore';

// Inicjalizacja Firebase
const app = initializeApp(CLIENT_CONFIG.firebaseConfig);
const db = getFirestore(app);

export const parseDateStr = (dateStr: string): number => {
  try {
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!match) return 0;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    let hour = 12;
    let minute = 0;
    const timeMatch = dateStr.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
    }
    return new Date(year, month, day, hour, minute).getTime();
  } catch(e) { return 0; }
};

export const remoteStorage = {
  /**
   * Sprawdza czy dany kod to Super-Admin czy Trener
   */
  checkCoachAuth: async (code: string) => {
    try {
      const cleanCode = code.trim().toUpperCase();
      // 1. Sprawdź Super-Admina
      if (cleanCode === CLIENT_CONFIG.coachMasterCode) {
        return { success: true, role: 'super-admin' };
      }
      // 2. Sprawdź w kolekcji coaches
      const coachRef = doc(db, "coaches", cleanCode);
      const coachSnap = await getDoc(coachRef);
      if (coachSnap.exists()) {
        return { success: true, role: 'coach', name: coachSnap.data().name };
      }
      return { success: false, error: "Błędny kod autoryzacji." };
    } catch (e) {
      return { success: false, error: "Błąd połączenia z bazą." };
    }
  },

  /**
   * Super-Admin: Pobiera listę wszystkich trenerów
   */
  fetchAllCoaches: async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "coaches"));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (e) { return []; }
  },

  /**
   * Trener/Admin: Pobiera listę podopiecznych (opcjonalnie filtrowaną po trenerze)
   */
  fetchClients: async (coachId?: string) => {
    try {
      let q;
      if (coachId) {
        q = query(collection(db, "clients"), where("coachId", "==", coachId.toUpperCase()));
      } else {
        q = collection(db, "clients");
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        code: doc.id,
        name: doc.data().name || "Bez imienia",
        coachId: doc.data().coachId
      }));
    } catch (e) { return []; }
  },

  /**
   * Super-Admin: Tworzy nowego trenera
   */
  createNewCoach: async (code: string, name: string) => {
    try {
      const cleanCode = code.trim().toUpperCase();
      const coachRef = doc(db, "coaches", cleanCode);
      await setDoc(coachRef, { 
        name, 
        adminId: CLIENT_CONFIG.coachMasterCode,
        createdAt: Date.now()
      });
      return { success: true };
    } catch (e) { return { success: false }; }
  },

  /**
   * Tworzy nowego klienta przypisanego do trenera
   */
  createNewClient: async (code: string, name: string, coachId: string) => {
    try {
      const cleanCode = code.trim().toUpperCase();
      const docRef = doc(db, "clients", cleanCode);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { success: false, error: "Ten kod klienta jest już zajęty." };
      }

      await setDoc(docRef, { 
        name, 
        code: cleanCode, 
        coachId: coachId.toUpperCase(),
        plan: {}, 
        history: {}, 
        extras: { measurements: [], cardio: [] } 
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: "Błąd podczas tworzenia klienta." };
    }
  },

  fetchUserData: async (code: string) => {
    try {
      const cleanCode = code.trim().toUpperCase();
      const docRef = doc(db, "clients", cleanCode);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { success: true, ...docSnap.data(), code: cleanCode };
      } else {
        return { success: false, error: "Nie znaleziono kodu klienta." };
      }
    } catch (e) {
      console.error("Firebase Error:", e);
      return { success: false, error: "Błąd połączenia z bazą Firebase." };
    }
  },

  fetchCoachClientDetail: async (clientId: string) => {
    try {
      const docRef = doc(db, "clients", clientId.toUpperCase());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { success: true, ...docSnap.data(), code: clientId.toUpperCase() };
      }
      return { success: false };
    } catch (e) { return { success: false }; }
  },

  saveToCloud: async (code: string, type: string, data: any) => {
    try {
      const cleanCode = code.toUpperCase();
      const docRef = doc(db, "clients", cleanCode);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, { [type]: data });
      } else {
        await updateDoc(docRef, { [type]: data });
      }
      return true;
    } catch (e) { return false; }
  }
};

export const storage = {
  getLastBackupReminder: () => Number(localStorage.getItem(`${CLIENT_CONFIG.storageKey}_last_backup`)) || 0,
  setLastBackupReminder: (val: number) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_last_backup`, val.toString()),
  getHistory: (id: string) => JSON.parse(localStorage.getItem(`${CLIENT_CONFIG.storageKey}_history_${id}`) || '[]'),
  saveHistory: (id: string, h: any[]) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_history_${id}`, JSON.stringify(h)),
  getCardioSessions: () => JSON.parse(localStorage.getItem(`${CLIENT_CONFIG.storageKey}_cardio`) || '[]'),
  saveCardioSessions: (s: any[]) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_cardio`, JSON.stringify(s)),
  getMeasurements: () => JSON.parse(localStorage.getItem(`${CLIENT_CONFIG.storageKey}_measurements`) || '[]'),
  saveMeasurements: (m: any[]) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_measurements`, JSON.stringify(m)),
  getTempInput: (id: string) => localStorage.getItem(`${CLIENT_CONFIG.storageKey}_temp_${id}`) || '',
  saveTempInput: (id: string, v: string) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_temp_${id}`, v),
  getStickyNote: (wId: string, exId: string) => localStorage.getItem(`${CLIENT_CONFIG.storageKey}_sticky_${wId}_${exId}`) || '',
  saveStickyNote: (wId: string, exId: string, v: string) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_sticky_${wId}_${exId}`, v),
  getChatHistory: () => JSON.parse(localStorage.getItem(`${CLIENT_CONFIG.storageKey}_chat_history`) || '[]'),
  saveChatHistory: (msgs: any[]) => {
      const limited = msgs.slice(-50); 
      localStorage.setItem(`${CLIENT_CONFIG.storageKey}_chat_history`, JSON.stringify(limited));
  },
  clearChatHistory: () => localStorage.removeItem(`${CLIENT_CONFIG.storageKey}_chat_history`),
  clearTempInputs: (workoutId: string, exercises: any[]) => {
    exercises.forEach(ex => {
      localStorage.removeItem(`${CLIENT_CONFIG.storageKey}_temp_note_${workoutId}_${ex.id}`);
      localStorage.removeItem(`completed_${workoutId}_${ex.id}`);
      for(let i=1; i<=ex.sets; i++) {
        localStorage.removeItem(`${CLIENT_CONFIG.storageKey}_temp_input_${workoutId}_${ex.id}_s${i}_kg`);
        localStorage.removeItem(`${CLIENT_CONFIG.storageKey}_temp_input_${workoutId}_${ex.id}_s${i}_reps`);
        localStorage.removeItem(`${CLIENT_CONFIG.storageKey}_temp_input_${workoutId}_${ex.id}_s${i}_time`);
      }
    });
  },
  getLastResult: (wId: string, exId: string) => localStorage.getItem(`history_${wId}_${exId}`) || '',
  saveWorkouts: (w: any) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_workouts`, JSON.stringify(w))
};

export const localStorageCache = {
  save: (k: string, d: any) => localStorage.setItem(k, JSON.stringify(d)),
  get: (k: string) => {
    const d = localStorage.getItem(k);
    return d ? JSON.parse(d) : null;
  }
};
