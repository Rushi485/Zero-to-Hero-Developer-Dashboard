
import { PhaseType, DayData } from './types';

export const ROADMAP_DATA: DayData[] = Array.from({ length: 60 }, (_, i) => {
  const day = i + 1;
  let phase = PhaseType.HTML_CSS;
  let title = `Building Basics ${day}`;
  let goal = "Understand the fundamental structure of web pages.";
  let tasks = ["Watch intro video", "Practice 3 HTML tags", "Build a boilerplate"];

  if (day > 14 && day <= 28) {
    phase = PhaseType.JAVASCRIPT;
    title = `JS Essentials Day ${day}`;
    goal = "Master logic and interactivity.";
    tasks = ["Solve 2 logic puzzles", "Implement a click listener", "Review array methods"];
  } else if (day > 28 && day <= 42) {
    phase = PhaseType.REACT;
    title = `React Mastery Day ${day}`;
    goal = "Build modern user interfaces.";
    tasks = ["Create a component", "Manage state with useState", "Use props effectively"];
  } else if (day > 42) {
    phase = PhaseType.BACKEND;
    title = `Full Stack Flow Day ${day}`;
    goal = "Connect to data and servers.";
    tasks = ["Setup Node.js", "Define an API route", "Connect to MongoDB"];
  }

  // Refine specific days for more "realistic" feel
  if (day === 1) { title = "Environment Setup"; goal = "Get VS Code, Git, and Chrome ready."; tasks = ["Install VS Code", "Set up Git", "First Hello World"]; }
  if (day === 15) { title = "Variables & Types"; goal = "Data types in JS."; tasks = ["Declare let vs const", "Primitive types", "Basic Math"]; }
  if (day === 29) { title = "CRA & Vite"; goal = "Bootstrap React."; tasks = ["Init a project", "Understand folder structure", "JSX Intro"]; }
  if (day === 60) { title = "Deployment & Showcase"; goal = "The Grand Finale."; tasks = ["Deploy to Vercel/Netlify", "Update Portfolio", "Celebrate!"]; }

  return {
    id: day,
    title,
    phase,
    goal,
    tasks,
    isCompleted: false
  };
});

export const HABITS = [
  { id: 'sunlight', label: 'Wake up + Sunlight' },
  { id: 'exercise', label: 'Exercise / Walk' },
  { id: 'deepwork1', label: 'Deep Work Block 1' },
  { id: 'deepwork2', label: 'Deep Work Block 2' },
  { id: 'review', label: 'Review & Plan' },
  { id: 'sleep', label: 'Sleep on Time' },
];

export const PROJECTS = [
  { id: 'p1', name: 'Bio Page', phase: PhaseType.HTML_CSS, requiredDay: 7 },
  { id: 'p2', name: 'Calculator', phase: PhaseType.JAVASCRIPT, requiredDay: 20 },
  { id: 'p3', name: 'To-Do App', phase: PhaseType.JAVASCRIPT, requiredDay: 28 },
  { id: 'p4', name: 'Flashcards', phase: PhaseType.REACT, requiredDay: 35 },
  { id: 'p5', name: 'Movie Search App', phase: PhaseType.REACT, requiredDay: 42 },
  { id: 'p6', name: 'Quotes API', phase: PhaseType.BACKEND, requiredDay: 50 },
  { id: 'p7', name: 'Expense Tracker (Capstone)', phase: PhaseType.BACKEND, requiredDay: 60 },
];

export const SKILLS = [
  { name: 'HTML', phase: PhaseType.HTML_CSS },
  { name: 'CSS / Tailwind', phase: PhaseType.HTML_CSS },
  { name: 'JavaScript', phase: PhaseType.JAVASCRIPT },
  { name: 'React', phase: PhaseType.REACT },
  { name: 'Node.js', phase: PhaseType.BACKEND },
  { name: 'MongoDB', phase: PhaseType.BACKEND },
];
