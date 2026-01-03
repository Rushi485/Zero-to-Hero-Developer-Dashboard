
export enum PhaseType {
  HTML_CSS = 'HTML & CSS',
  JAVASCRIPT = 'JavaScript',
  REACT = 'React',
  BACKEND = 'Backend & DB'
}

export interface DayTask {
  id: string;
  label: string;
  completed: boolean;
}

export interface DayData {
  id: number;
  title: string;
  phase: PhaseType;
  goal: string;
  tasks: string[];
  notes?: string;
  isCompleted: boolean;
}

export interface UserState {
  completedDays: number[];
  dayNotes: Record<number, string>;
  dayNotesImages: Record<number, string[]>; // Base64 encoded images
  dayTaskProgress: Record<number, boolean[]>; // Tracks completion of individual tasks per day
  dailyRoutine: Record<string, boolean>; // key is YYYY-MM-DD-habitId
  streak: number;
  lastActiveDate: string | null;
  projectUrls: Record<string, string>;
  deployUrls: Record<string, string>;
  theme: 'dark' | 'light';
}
