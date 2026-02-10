
export const CLIENT_CONFIG = {
  name: "BEAR GYM",
  storageKey: 'bear_gym_cloud_v1',
  geminiApiKey: process.env.API_KEY || "",
  geminiModel: "gemini-3-flash-preview",
  
  // KONFIGURACJA FIREBASE POBIERANA ZE ZMIENNYCH ŚRODOWISKOWYCH
  firebaseConfig: {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: "bear-gym.firebaseapp.com",
    projectId: "bear-gym",
    storageBucket: "bear-gym.firebasestorage.app",
    messagingSenderId: "470788559712",
    appId: "1:470788559712:web:7ec5134770a83aee84c405",
    measurementId: "G-RJMKNNBHNF"
  },
  
  // Hasło trenera do panelu admina (Master Code)
  coachMasterCode: "ADMIN123"
};

export const DEFAULT_SETTINGS = {
  volume: 0.5,
  soundType: 'double_bell' as const,
  autoRestTimer: true,
  pushNotificationsEnabled: false,
  wakeLockEnabled: true,
  userGoal: "",
  userDifficulties: "",
  targetWorkoutsPerWeek: 3,
  targetCardioPerWeek: 3,
  userInitialWeight: "",
  userCurrentWeight: "",
  userTargetWeight: ""
};

export const DEFAULT_WORKOUTS: Record<string, any> = {};
