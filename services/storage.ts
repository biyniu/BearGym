
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
  where,
  deleteDoc
} from 'firebase/firestore';
// Import types for storage helpers
import { WorkoutsMap, BodyMeasurement, CardioSession, Exercise } from '../types';

const app = initializeApp(CLIENT_CONFIG.firebaseConfig);
const db = getFirestore(app);

// Helper to parse dates for sorting and comparison
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

// Fix for Error in file App.tsx on line 15: Module '"./services/storage"' has no exported member 'localStorageCache'.
export const localStorageCache = {
  get: (key: string) => {
    const val = localStorage.getItem(`${CLIENT_CONFIG.storageKey}_${key}`);
    return val ? JSON.parse(val) : null;
  },
  save: (key: string, data: any) => {
    localStorage.setItem(`${CLIENT_CONFIG.storageKey}_${key}`, JSON.stringify(data));
  }
};

export const remoteStorage = {
  checkCoachAuth: async (code: string) => {
    try {
      const cleanCode = code.trim().toUpperCase();
      if (cleanCode === CLIENT_CONFIG.coachMasterCode) {
        return { success: true, role: 'super-admin' };
      }
      const coachRef = doc(db, "coaches", cleanCode);
      const coachSnap = await getDoc(coachRef);
      if (coachSnap.exists()) {
        return { success: true, role: 'coach', name: coachSnap.data().name };
      }
      return { success: false, error: "Błędny kod." };
    } catch (e) {
      return { success: false, error: "Błąd bazy." };
    }
  },

  fetchAllCoaches: async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "coaches"));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) { return []; }
  },

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

  createNewCoach: async (code: string, name: string) => {
    try {
      const cleanCode = code.trim().toUpperCase();
      await setDoc(doc(db, "coaches", cleanCode), { 
        name, 
        adminId: CLIENT_CONFIG.coachMasterCode,
        createdAt: Date.now()
      });
      return { success: true };
    } catch (e) { return { success: false }; }
  },

  createNewClient: async (code: string, name: string, coachId: string) => {
    try {
      const cleanCode = code.trim().toUpperCase();
      const docRef = doc(db, "clients", cleanCode);
      await setDoc(docRef, { 
        name, 
        code: cleanCode, 
        coachId: coachId.toUpperCase(),
        plan: {}, 
        history: {}, 
        extras: { measurements: [], cardio: [] } 
      });
      return { success: true };
    } catch (e) { return { success: false, error: "Błąd." }; }
  },

  fetchUserData: async (code: string) => {
    try {
      const cleanCode = code.trim().toUpperCase();
      const docSnap = await getDoc(doc(db, "clients", cleanCode));
      if (docSnap.exists()) return { success: true, ...docSnap.data(), code: cleanCode };
      return { success: false, error: "Nie znaleziono." };
    } catch (e) { return { success: false, error: "Błąd." }; }
  },

  saveToCloud: async (code: string, type: string, data: any) => {
    try {
      const docRef = doc(db, "clients", code.toUpperCase());
      await updateDoc(docRef, { [type]: data });
      return true;
    } catch (e) { return false; }
  }
};

export const storage = {
  // Helpers dla localStorage - updated to include storage key prefix for consistency
  getHistory: (id: string) => JSON.parse(localStorage.getItem(`${CLIENT_CONFIG.storageKey}_history_${id}`) || '[]'),
  saveHistory: (id: string, h: any[]) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_history_${id}`, JSON.stringify(h)),

  // Fix for Error in file App.tsx on line 322: Property 'saveWorkouts' does not exist on type storage
  saveWorkouts: (w: WorkoutsMap) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_workouts`, JSON.stringify(w)),

  // Fix for Error in file App.tsx on line 334: Property 'saveMeasurements' does not exist on type storage
  saveMeasurements: (m: BodyMeasurement[]) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_measurements`, JSON.stringify(m)),
  getMeasurements: (): BodyMeasurement[] => JSON.parse(localStorage.getItem(`${CLIENT_CONFIG.storageKey}_measurements`) || '[]'),

  // Fix for Error in file App.tsx on line 335: Property 'saveCardioSessions' does not exist on type storage
  saveCardioSessions: (s: CardioSession[]) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_cardio`, JSON.stringify(s)),
  getCardioSessions: (): CardioSession[] => JSON.parse(localStorage.getItem(`${CLIENT_CONFIG.storageKey}_cardio`) || '[]'),

  // Helpers for temporary inputs used during active workout session
  getTempInput: (key: string) => localStorage.getItem(`temp_${key}`) || '',
  saveTempInput: (key: string, val: string) => localStorage.setItem(`temp_${key}`, val),
  clearTempInputs: (workoutId: string, exercises: Exercise[]) => {
    exercises.forEach(ex => {
      for(let i=1; i<=ex.sets; i++) {
        localStorage.removeItem(`temp_input_${workoutId}_${ex.id}_s${i}_kg`);
        localStorage.removeItem(`temp_input_${workoutId}_${ex.id}_s${i}_reps`);
        localStorage.removeItem(`temp_input_${workoutId}_${ex.id}_s${i}_time`);
      }
      localStorage.removeItem(`temp_note_${workoutId}_${ex.id}`);
    });
  },

  // Helpers for persistent notes attached to exercises
  getStickyNote: (workoutId: string, exerciseId: string) => localStorage.getItem(`sticky_note_${workoutId}_${exerciseId}`) || '',
  saveStickyNote: (workoutId: string, exerciseId: string, note: string) => localStorage.setItem(`sticky_note_${workoutId}_${exerciseId}`, note),

  // Helpers for AI Chat history
  getChatHistory: () => JSON.parse(localStorage.getItem(`${CLIENT_CONFIG.storageKey}_chat_history`) || '[]'),
  saveChatHistory: (h: any[]) => localStorage.setItem(`${CLIENT_CONFIG.storageKey}_chat_history`, JSON.stringify(h)),
  clearChatHistory: () => localStorage.removeItem(`${CLIENT_CONFIG.storageKey}_chat_history`),

  // Czyści tymczasowe pola podczas prowadzenia treningu przez trenera
  clearCoachTemp: (clientId: string) => {
    Object.keys(localStorage).forEach(key => {
        if(key.includes(`coach_temp_${clientId}`)) localStorage.removeItem(key);
    });
  }
};
