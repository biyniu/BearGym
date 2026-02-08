
export type ExerciseType = 'standard' | 'time' | 'reps_only' | 'reps';

export interface WarmupExercise {
  name: string;
  pl: string;
  link: string;
  reps: string;
}

export interface Exercise {
  id: string;
  name: string;
  pl: string;
  sets: number;
  reps: string;
  tempo: string;
  rir: string;
  rest: number;
  link: string;
  type: ExerciseType;
}

export interface WorkoutPlan {
  title: string;
  warmup: WarmupExercise[];
  exercises: Exercise[];
}

export interface WorkoutsMap {
  [key: string]: WorkoutPlan;
}

export interface WorkoutSessionResult {
  [exerciseId: string]: string;
}

export interface WorkoutHistoryEntry {
  date: string;
  timestamp: number;
  results: WorkoutSessionResult;
}

export interface AppSettings {
  volume: number;
  soundType: 'bell' | 'double_bell' | 'chord' | 'cosmic' | 'gong' | 'victory' | 'siren' | 'school_bell';
  autoRestTimer: boolean;
  pushNotificationsEnabled: boolean;
  wakeLockEnabled: boolean;
  // Usunięto pole vibration
  // Nowe pola profilowe
  userGoal?: string;
  userDifficulties?: string;
  targetWorkoutsPerWeek?: number;
  targetCardioPerWeek?: number;
  // Pola wagowe do motywacji
  userInitialWeight?: string;
  userCurrentWeight?: string;
  userTargetWeight?: string;
}

export interface BodyMeasurement {
  id: string;
  date: string;
  weight: string;
  waist: string;
  chest: string;
  biceps: string;
  thigh: string;
}

export type CardioType = 'rowerek' | 'bieznia' | 'schody' | 'orbitrek' | 'mobility' | 'fight' | 'spacer' | 'basen' | 'inne';

export interface CardioSession {
  id: string;
  date: string;
  type: CardioType;
  duration: string; // np. "30 min"
  steps?: string;   // np. "10000"
  notes?: string;
  customName?: string;
}
