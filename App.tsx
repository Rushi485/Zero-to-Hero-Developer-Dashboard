
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trophy, 
  Flame, 
  Calendar, 
  Code, 
  BookOpen, 
  Layout as LayoutIcon, 
  CheckCircle2, 
  Circle,
  BarChart3,
  ChevronRight,
  Github,
  PenLine,
  ExternalLink,
  Target,
  Sparkles,
  Loader2,
  X,
  ArrowRight,
  TrendingUp,
  History,
  Link as LinkIcon,
  Cpu,
  Shield,
  Zap,
  Terminal,
  MousePointer2,
  Globe,
  Send,
  MessageSquare,
  Bot,
  Rocket,
  Image as ImageIcon,
  Trash2,
  Plus,
  Camera,
  Layers,
  Activity,
  User,
  Bell,
  Search,
  Settings as SettingsIcon,
  MoreVertical,
  Check,
  Moon,
  Sun,
  Volume2,
  Square
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { PhaseType, UserState } from './types';
import { ROADMAP_DATA, HABITS, PROJECTS, SKILLS } from './constants';

const STORAGE_KEY = 'hero_saas_state_v2';

// --- AUDIO HELPERS ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [userState, setUserState] = useState<UserState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return {
      completedDays: parsed?.completedDays || [],
      dayNotes: parsed?.dayNotes || {},
      dayNotesImages: parsed?.dayNotesImages || {},
      dayTaskProgress: parsed?.dayTaskProgress || {},
      dailyRoutine: parsed?.dailyRoutine || {},
      streak: parsed?.streak || 0,
      lastActiveDate: parsed?.lastActiveDate || null,
      projectUrls: parsed?.projectUrls || {},
      deployUrls: parsed?.deployUrls || {},
      theme: parsed?.theme || 'dark'
    };
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'roadmap' | 'projects' | 'notes' | 'settings'>('dashboard');
  const [showChat, setShowChat] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string, links?: {uri: string, title: string}[]}[]>([]);
  const [inputText, setInputText] = useState('');
  const [audioLoading, setAudioLoading] = useState<number | null>(null);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
    if (userState.theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  }, [userState]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (userState.lastActiveDate !== today) {
      const last = userState.lastActiveDate ? new Date(userState.lastActiveDate) : null;
      const tDate = new Date(today);
      const diff = last ? Math.floor((tDate.getTime() - last.getTime()) / (1000 * 3600 * 24)) : 0;
      setUserState(prev => ({
        ...prev,
        lastActiveDate: today,
        streak: diff === 1 ? prev.streak + 1 : (diff > 1 ? 1 : prev.streak)
      }));
    }
  }, []);

  const currentDay = userState.completedDays.length > 0 ? Math.min(60, Math.max(...userState.completedDays) + 1) : 1;
  const currentDayData = ROADMAP_DATA[currentDay - 1];
  const progressPercent = Math.round((userState.completedDays.length / 60) * 100);

  const routineChartData = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const completedCount = HABITS.filter(h => userState.dailyRoutine[`${dateStr}-${h.id}`]).length;
      days.push({
        name: date.toLocaleDateString(undefined, { weekday: 'short' }),
        score: Math.round((completedCount / HABITS.length) * 100)
      });
    }
    return days;
  }, [userState.dailyRoutine]);

  const handleImageUpload = (dayId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setUserState(prev => {
          const currentImages = prev.dayNotesImages[dayId] || [];
          return {
            ...prev,
            dayNotesImages: { ...prev.dayNotesImages, [dayId]: [...currentImages, base64] }
          };
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (dayId: number, imageIndex: number) => {
    setUserState(prev => {
      const currentImages = prev.dayNotesImages[dayId] || [];
      return {
        ...prev,
        dayNotesImages: { ...prev.dayNotesImages, [dayId]: currentImages.filter((_, idx) => idx !== imageIndex) }
      };
    });
  };

  const toggleDayTask = (dayId: number, taskIndex: number) => {
    setUserState(prev => {
      const currentTasks = [...(prev.dayTaskProgress[dayId] || new Array(ROADMAP_DATA[dayId - 1].tasks.length).fill(false))];
      currentTasks[taskIndex] = !currentTasks[taskIndex];
      return {
        ...prev,
        dayTaskProgress: { ...prev.dayTaskProgress, [dayId]: currentTasks }
      };
    });
  };

  const isDayTaskCompleted = (dayId: number, taskIndex: number) => !!userState.dayTaskProgress[dayId]?.[taskIndex];

  const currentDayTasksCompletedCount = useMemo(() => {
    return (userState.dayTaskProgress[currentDay] || []).filter(Boolean).length;
  }, [userState.dayTaskProgress, currentDay]);

  const getChatSession = () => {
    if (chatSessionRef.current) return chatSessionRef.current;
    const taskStatus = currentDayData.tasks.map((t, i) => `${t}: ${isDayTaskCompleted(currentDay, i) ? 'DONE' : 'PENDING'}`).join(', ');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: { 
        systemInstruction: `You are an elite Senior Developer Advisor for an intensive 60-day bootcamp.
        FOCUS CONTEXT:
        - Day ${currentDay}/60
        - Module: ${currentDayData.phase}
        - Topic: ${currentDayData.title}
        - Goal: ${currentDayData.goal}
        - Current Task Status: ${taskStatus}
        INSTRUCTIONS:
        1. Always reference today's curriculum.
        2. Help unblock PENDING tasks.
        3. Use Google Search for modern syntax.
        4. Professional, tactical tone.`,
        tools: [{ googleSearch: {} }]
      },
    });
    chatSessionRef.current = chat;
    return chat;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || chatLoading) return;
    const userMsg = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      const chat = getChatSession();
      const response: GenerateContentResponse = await chat.sendMessage({ message: userMsg });
      const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((c: any) => c.web)
        .map((c: any) => ({ uri: c.web.uri, title: c.web.title || 'Official Source' })) || [];
      setMessages(prev => [...prev, { role: 'model', text: response.text || 'System malfunction.', links }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: 'Advisor link dropped. Reconnecting...' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleSpeak = async (text: string, index: number) => {
    if (playingAudioIndex === index) {
      audioSourceRef.current?.stop();
      setPlayingAudioIndex(null);
      return;
    }

    setAudioLoading(index);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        
        audioSourceRef.current?.stop();
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        source.onended = () => setPlayingAudioIndex(null);
        source.start();
        
        audioSourceRef.current = source;
        setPlayingAudioIndex(index);
      }
    } catch (err) {
      console.error("Audio generation failed", err);
    } finally {
      setAudioLoading(null);
    }
  };

  const completeCurrentDay = () => {
    setUserState(prev => ({ ...prev, completedDays: Array.from(new Set([...prev.completedDays, currentDay])) }));
  };

  const toggleTheme = () => setUserState(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));

  const isDark = userState.theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${isDark ? 'bg-[#0a0b10]' : 'bg-slate-50'}`}>
      
      {/* SIDEBAR */}
      <aside className={`w-full md:w-20 lg:w-64 border-r transition-colors duration-300 flex flex-col fixed h-full z-50 ${isDark ? 'bg-[#111218] border-white/[0.05]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`p-6 border-b flex items-center gap-3 transition-colors ${isDark ? 'border-white/[0.05]' : 'border-slate-100'}`}>
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={18} className="text-white" />
          </div>
          <span className={`font-bold text-lg hidden lg:block tracking-tight transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>Hero<span className="text-blue-500">Node</span></span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutIcon, label: 'Control Center' },
            { id: 'roadmap', icon: Layers, label: 'Mission Map' },
            { id: 'projects', icon: Rocket, label: 'Applications' },
            { id: 'notes', icon: PenLine, label: 'Logbook' },
            { id: 'settings', icon: SettingsIcon, label: 'Settings' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-4 p-3 rounded-lg transition-all group relative ${activeTab === tab.id ? 'bg-blue-600/10 text-blue-500 font-semibold' : `${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}`}
            >
              <tab.icon size={20} />
              <span className="font-medium text-sm hidden lg:block">{tab.label}</span>
              {activeTab === tab.id && <div className="absolute left-0 w-1 h-5 bg-blue-500 rounded-full" />}
            </button>
          ))}
          
          <div className={`pt-4 mt-4 border-t transition-colors ${isDark ? 'border-white/[0.05]' : 'border-slate-100'}`}>
             <button 
              onClick={() => setShowChat(true)}
              className={`w-full flex items-center gap-4 p-3 rounded-lg text-emerald-500 transition-colors ${isDark ? 'hover:bg-emerald-500/10' : 'hover:bg-emerald-50/50'}`}
            >
              <Bot size={20} />
              <span className="font-medium text-sm hidden lg:block">Ask Advisor</span>
            </button>
          </div>
        </nav>

        <div className={`p-6 border-t hidden lg:block transition-colors ${isDark ? 'border-white/[0.05]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center overflow-hidden transition-colors ${isDark ? 'bg-slate-800 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
               <User size={16} />
            </div>
            <div className="flex-1 min-w-0">
               <p className={`text-xs font-semibold truncate transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>Operator_Alpha</p>
               <p className="text-[10px] text-slate-500 uppercase tracking-wider">Level {currentDay}</p>
            </div>
            <MoreVertical size={14} className="text-slate-500" />
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 md:ml-20 lg:ml-64 flex flex-col">
        
        {/* TOP NAVBAR */}
        <header className={`h-16 border-b transition-colors duration-300 px-6 flex items-center justify-between sticky top-0 z-40 ${isDark ? 'bg-[#0a0b10]/80 border-white/[0.05]' : 'bg-white/80 border-slate-200 shadow-sm'} backdrop-blur-md`}>
           <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">{activeTab}</h2>
              <div className={`h-4 w-px transition-colors ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}></div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                 <Calendar size={14} />
                 <span>Day {currentDay} of 60</span>
              </div>
           </div>

           <div className="flex items-center gap-6">
              <div className="relative hidden sm:block">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                 <input type="text" placeholder="Search roadmap..." className={`rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none transition-all w-48 lg:w-64 border ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-300'}`} />
              </div>
              <div className="flex items-center gap-3">
                 <button onClick={toggleTheme} className="text-slate-500 hover:text-blue-500 transition-colors" title="Toggle Theme">
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                 </button>
                 <button className="text-slate-500 hover:text-blue-500 transition-colors relative">
                    <Bell size={18} />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border-2 transition-colors border-current" style={{borderColor: isDark ? '#0a0b10' : '#fff'}}></span>
                 </button>
              </div>
           </div>
        </header>

        {/* CONTENT */}
        <div className="p-8 lg:p-12 space-y-12">
           {activeTab === 'dashboard' && (
             <div className="space-y-12 animate-slide">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 {[
                   { label: 'Completion', val: `${progressPercent}%`, change: '+12%', icon: Target, color: 'text-blue-500' },
                   { label: 'Current Streak', val: `${userState.streak}d`, change: '+2d', icon: Flame, color: 'text-orange-500' },
                   { label: 'Tasks Verified', val: `${currentDayTasksCompletedCount}/${currentDayData.tasks.length}`, change: 'Daily Goal', icon: CheckCircle2, color: 'text-emerald-500' },
                   { label: 'System Health', val: '98%', change: 'Nominal', icon: Shield, color: 'text-indigo-500' }
                 ].map((stat, i) => (
                   <div key={i} className="glass-card p-6 rounded-xl hover:scale-[1.02] transition-transform cursor-default">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-white/5' : 'bg-slate-100'} ${stat.color}`}>
                          <stat.icon size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.val}</span>
                        <span className={`text-[10px] font-semibold ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-slate-400'}`}>{stat.change}</span>
                      </div>
                   </div>
                 ))}
               </div>

               <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                 <div className="xl:col-span-2 space-y-8">
                   <div className="glass-card p-8 rounded-2xl overflow-hidden relative">
                     <div className={`absolute top-0 right-0 p-8 opacity-5 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
                       <Zap size={120} />
                     </div>
                     <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
                       <div>
                         <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full mb-4">
                           <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                           <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{currentDayData.phase}</span>
                         </div>
                         <h1 className={`text-4xl font-bold tracking-tight mb-2 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>Day {currentDay}: {currentDayData.title}</h1>
                         <p className="text-slate-500 text-sm max-w-xl font-medium leading-relaxed">{currentDayData.goal}</p>
                       </div>
                       <button onClick={() => setShowChat(true)} className="btn-primary px-8 py-3.5 rounded-full font-bold text-sm text-white flex items-center gap-3">
                         <Sparkles size={18} /> Advisor Sync
                       </button>
                     </div>

                     <div className="space-y-3 mb-10">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Verification Checklist</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentDayData.tasks.map((task, idx) => {
                            const done = isDayTaskCompleted(currentDay, idx);
                            return (
                              <button key={idx} onClick={() => toggleDayTask(currentDay, idx)} className={`flex items-center gap-4 p-5 rounded-xl border text-left transition-all group ${done ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : `bg-white/[0.02] border-white/[0.05] hover:border-blue-500/20 ${!isDark && 'bg-white border-slate-100 shadow-sm'}`}`}>
                                <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${done ? 'bg-emerald-500 text-white' : `border border-slate-300 bg-transparent text-transparent group-hover:border-blue-500 ${isDark && 'border-slate-700'}`}`}>
                                   <Check size={14} />
                                </div>
                                <span className={`text-sm font-medium transition-colors ${done ? 'text-emerald-500' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>{task}</span>
                              </button>
                            );
                          })}
                        </div>
                     </div>
                     <button onClick={completeCurrentDay} disabled={userState.completedDays.includes(currentDay)} className={`w-full py-5 rounded-xl font-bold tracking-widest uppercase text-xs transition-all ${userState.completedDays.includes(currentDay) ? (isDark ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed') : (isDark ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg')}`}>
                       {userState.completedDays.includes(currentDay) ? 'Mission Completed' : 'Finalize Module Protocol'}
                     </button>
                   </div>

                   <div className="glass-card p-8 rounded-2xl">
                     <div className="flex justify-between items-center mb-10">
                       <div>
                         <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Activity Analytics</h3>
                         <p className="text-xs text-slate-400 mt-1">Consistency tracking over the last 14 cycles</p>
                       </div>
                     </div>
                     <div className="h-64">
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={routineChartData}>
                           <defs>
                             <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                             </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)"} vertical={false} />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} />
                           <YAxis hide domain={[0, 100]} />
                           <Tooltip contentStyle={{backgroundColor: isDark ? '#111218' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', borderRadius: '12px', fontSize: '11px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}} itemStyle={{color: '#3b82f6', fontWeight: 'bold'}} />
                           <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                         </AreaChart>
                       </ResponsiveContainer>
                     </div>
                   </div>
                 </div>

                 <div className="space-y-8">
                   <div className="glass-card p-8 rounded-2xl">
                     <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-8">Bio-Optimization</h3>
                     <div className="space-y-3">
                       {HABITS.map(h => {
                         const today = new Date().toISOString().split('T')[0];
                         const active = userState.dailyRoutine[`${today}-${h.id}`];
                         return (
                           <button key={h.id} onClick={() => {
                             const key = `${today}-${h.id}`;
                             setUserState(prev => ({...prev, dailyRoutine: {...prev.dailyRoutine, [key]: !prev.dailyRoutine[key]}}));
                           }} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${active ? 'bg-blue-600/10 border-blue-500/30 text-blue-500' : `${isDark ? 'bg-white/[0.02] border-white/[0.05] text-slate-500 hover:bg-white/[0.05]' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}`}>
                             <span className="text-xs font-semibold">{h.label}</span>
                             {active ? <CheckCircle2 size={16} /> : <Circle size={16} className="opacity-20" />}
                           </button>
                         );
                       })}
                     </div>
                   </div>

                   <div className="glass-card p-8 rounded-2xl">
                     <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-8">Current Skills</h3>
                     <div className="space-y-5">
                       {SKILLS.slice(0, 5).map(skill => {
                         const completedInPhase = userState.completedDays.filter(d => ROADMAP_DATA[d-1].phase === skill.phase).length;
                         const totalInPhase = ROADMAP_DATA.filter(d => d.phase === skill.phase).length;
                         const perc = Math.round((completedInPhase / totalInPhase) * 100);
                         return (
                           <div key={skill.name} className="space-y-2">
                             <div className="flex justify-between text-[11px] font-bold">
                               <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{skill.name}</span>
                               <span className="text-slate-500">{perc}%</span>
                             </div>
                             <div className={`h-1 rounded-full overflow-hidden transition-colors ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                               <div className="h-full bg-blue-600 transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.3)]" style={{ width: `${perc}%` }} />
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           )}

           {activeTab === 'roadmap' && (
             <div className="space-y-16 animate-slide">
               {Object.values(PhaseType).map(phase => (
                 <section key={phase} className="space-y-8">
                   <div className="flex items-center gap-6">
                     <h2 className="text-xs font-black text-blue-500 uppercase tracking-[0.4em]">{phase}</h2>
                     <div className={`h-px flex-1 transition-colors ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}></div>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                     {ROADMAP_DATA.filter(d => d.phase === phase).map(day => (
                       <div key={day.id} className={`glass-card p-6 rounded-2xl premium-border transition-all ${userState.completedDays.includes(day.id) ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'opacity-60 grayscale-[0.3]'}`}>
                         <div className="flex justify-between items-start mb-4">
                           <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider transition-colors ${isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>DAY_{day.id}</span>
                           {userState.completedDays.includes(day.id) && <CheckCircle2 size={16} className="text-emerald-500" />}
                         </div>
                         <h4 className={`font-bold text-sm mb-2 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>{day.title}</h4>
                         <p className="text-[10px] text-slate-500 font-medium line-clamp-2 uppercase tracking-tight">{day.goal}</p>
                       </div>
                     ))}
                   </div>
                 </section>
               ))}
             </div>
           )}

           {activeTab === 'projects' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-slide">
               {PROJECTS.map(proj => {
                 const unlocked = currentDay >= proj.requiredDay;
                 const github = userState.projectUrls[proj.id] || '';
                 const deploy = userState.deployUrls[proj.id] || '';
                 return (
                   <div key={proj.id} className={`glass-card p-10 rounded-3xl border transition-all relative group ${unlocked ? 'border-white/10' : 'opacity-30 grayscale pointer-events-none'}`}>
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-blue-500 mb-8 border group-hover:scale-110 transition-transform ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-100'}`}>
                       <Rocket size={24} />
                     </div>
                     <h3 className={`text-xl font-bold mb-1 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>{proj.name}</h3>
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-8">{proj.phase}</p>
                     <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[9px] font-bold text-slate-500 ml-2 uppercase tracking-widest">Repository Link</label>
                           <input type="text" placeholder="https://github.com/..." value={github} onChange={(e) => setUserState(prev => ({...prev, projectUrls: {...prev.projectUrls, [proj.id]: e.target.value}}))} className={`w-full rounded-xl p-3 text-xs font-mono outline-none border transition-colors ${isDark ? 'bg-black/40 border-white/5 text-white focus:border-blue-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-300'}`} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] font-bold text-slate-500 ml-2 uppercase tracking-widest">Live Deploy</label>
                           <input type="text" placeholder="https://demo.vercel.app..." value={deploy} onChange={(e) => setUserState(prev => ({...prev, deployUrls: {...prev.deployUrls, [proj.id]: e.target.value}}))} className={`w-full rounded-xl p-3 text-xs font-mono outline-none border transition-colors ${isDark ? 'bg-black/40 border-white/5 text-white focus:border-blue-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-300'}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4">
                           <a href={github || '#'} target="_blank" className={`flex items-center justify-center gap-2 py-3.5 rounded-xl border font-bold text-[10px] tracking-widest uppercase transition-all ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}><Github size={14} /> Source</a>
                           <a href={deploy || '#'} target="_blank" className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] tracking-widest uppercase transition-all shadow-lg shadow-blue-500/20"><ExternalLink size={14} /> Launch</a>
                        </div>
                     </div>
                   </div>
                 );
               })}
             </div>
           )}

           {activeTab === 'notes' && (
             <div className="max-w-4xl mx-auto space-y-12 animate-slide">
               <div className="flex justify-between items-center">
                 <h2 className={`text-2xl font-bold tracking-tight transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>Mission Logbook</h2>
                 <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">Encryption: Active</p>
               </div>
               <div className="space-y-8">
                 {ROADMAP_DATA.filter(d => userState.completedDays.includes(d.id)).sort((a,b) => b.id - a.id).map(day => (
                   <div key={day.id} className="glass-card rounded-2xl overflow-hidden shadow-xl">
                     <div className={`p-8 border-b flex items-center justify-between transition-colors ${isDark ? 'border-white/[0.05] bg-white/[0.01]' : 'border-slate-100 bg-slate-50/50'}`}>
                       <div className="flex items-center gap-6">
                         <span className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold font-mono border transition-colors ${isDark ? 'bg-white/5 text-slate-400 border-white/5' : 'bg-white text-slate-600 border-slate-200 shadow-sm'}`}>{day.id}</span>
                         <div>
                           <h4 className={`font-bold text-lg leading-tight transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>{day.title}</h4>
                           <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{day.phase}</span>
                         </div>
                       </div>
                     </div>
                     <div className="p-8 space-y-8">
                       <textarea value={userState.dayNotes[day.id] || ''} onChange={(e) => setUserState(prev => ({...prev, dayNotes: {...prev.dayNotes, [day.id]: e.target.value}}))} placeholder="Document technical breakthroughs, code snippets, or system blockers..." className={`w-full h-40 rounded-xl p-6 font-mono text-sm focus:outline-none transition-all border resize-none ${isDark ? 'bg-black/30 border-white/5 text-slate-300 focus:border-blue-500/40' : 'bg-white border-slate-200 text-slate-700 focus:border-blue-300 shadow-inner'}`} />
                       <div className="space-y-4">
                         <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><ImageIcon size={14} /> Visual Logs</label>
                            <label className="cursor-pointer px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 rounded-lg text-[10px] font-bold tracking-widest uppercase border border-blue-500/20 transition-all">
                               <Plus size={14} className="inline mr-2" /> New Data Scan
                               <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(day.id, e)} />
                            </label>
                         </div>
                         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                           {(userState.dayNotesImages[day.id] || []).map((img, idx) => (
                             <div key={idx} className={`relative aspect-square rounded-xl overflow-hidden border transition-colors group shadow-2xl ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                               <img src={img} alt="Mission capture" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                               <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                 <button onClick={() => removeImage(day.id, idx)} className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 transition-colors border border-red-500/20"><Trash2 size={18} /></button>
                               </div>
                             </div>
                           ))}
                           <label className={`cursor-pointer relative aspect-square rounded-xl border border-dashed transition-all flex flex-col items-center justify-center gap-2 group ${isDark ? 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(day.id, e)} />
                              <Camera size={20} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Scanner</span>
                           </label>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {activeTab === 'settings' && (
             <div className="max-w-2xl mx-auto space-y-12 animate-slide">
                <header>
                  <h2 className={`text-2xl font-bold tracking-tight transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>System Preferences</h2>
                  <p className="text-xs text-slate-500 mt-2">Adjust your node's visual interface and operational settings.</p>
                </header>
                <div className="space-y-6">
                  <div className="glass-card p-8 rounded-2xl space-y-8">
                     <div className="flex items-center justify-between">
                        <div>
                           <h4 className={`text-sm font-bold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>Visual Interface Theme</h4>
                           <p className="text-xs text-slate-500 mt-1">Switch between dark and light operational modes.</p>
                        </div>
                        <div className={`flex p-1 rounded-xl transition-colors border ${isDark ? 'bg-black/40 border-white/5' : 'bg-slate-100 border-slate-200 shadow-inner'}`}>
                           <button onClick={() => setUserState(prev => ({...prev, theme: 'dark'}))} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${isDark ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}><Moon size={14} /> Dark</button>
                           <button onClick={() => setUserState(prev => ({...prev, theme: 'light'}))} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${!isDark ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}><Sun size={14} /> Light</button>
                        </div>
                     </div>
                     <div className={`h-px transition-colors ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}></div>
                     <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                        <div>
                           <h4 className={`text-sm font-bold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>Cloud Node Synchronization</h4>
                           <p className="text-xs text-slate-500 mt-1">Sync mission data across multiple workstations (Pro Feature).</p>
                        </div>
                        <div className="w-10 h-5 bg-slate-700 rounded-full relative"><div className="absolute left-1 top-1 w-3 h-3 bg-slate-500 rounded-full"></div></div>
                     </div>
                  </div>
                  <div className="glass-card p-8 rounded-2xl bg-red-500/[0.02] border-red-500/10">
                     <h4 className="text-sm font-bold text-red-500">Hazardous Operations</h4>
                     <p className="text-xs text-slate-500 mt-1">Actions that cannot be undone.</p>
                     <button onClick={() => { if (confirm("Reset all mission progress? This action is IRREVERSIBLE.")) { localStorage.removeItem(STORAGE_KEY); window.location.reload(); } }} className="mt-6 px-6 py-3 rounded-xl border border-red-500/20 text-red-500 text-[10px] font-bold tracking-widest uppercase hover:bg-red-500 hover:text-white transition-all">Reset All Progress</button>
                  </div>
                </div>
             </div>
           )}
        </div>
      </main>

      {/* AI ADVISOR OVERLAY */}
      {showChat && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowChat(false)} />
          <div className={`relative w-full max-w-2xl h-full border-l flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 transition-colors ${isDark ? 'bg-[#111218] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
            <header className={`p-8 border-b flex items-center justify-between transition-colors ${isDark ? 'border-white/[0.08] bg-white/[0.01]' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Bot size={24} className="text-white" />
                </div>
                <div>
                  <h2 className={`font-bold text-lg tracking-tight transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>Technical Advisor</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Curriculum Aware System</p>
                </div>
              </div>
              <button onClick={() => setShowChat(false)} className="p-2 hover:bg-slate-500/10 rounded-xl text-slate-500 transition-colors"><X size={24} /></button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                  <Terminal size={48} className="mb-6 text-slate-600" />
                  <p className="font-mono text-sm uppercase tracking-[0.2em] max-w-xs transition-colors">Day {currentDay} Protocol Loaded. Awaiting instruction.</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-6 rounded-2xl font-mono text-xs leading-relaxed transition-all ${m.role === 'user' ? 'bg-blue-600 text-white shadow-xl' : isDark ? 'bg-white/[0.03] text-slate-300 border border-white/[0.08]' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    
                    {/* TTS & LINKS */}
                    <div className="mt-4 flex flex-col gap-4">
                      {m.role === 'model' && (
                        <button 
                          onClick={() => handleSpeak(m.text, i)}
                          className={`self-start flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[9px] font-bold uppercase tracking-widest ${playingAudioIndex === i ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                        >
                          {audioLoading === i ? <Loader2 size={12} className="animate-spin" /> : playingAudioIndex === i ? <Square size={12} fill="currentColor" /> : <Volume2 size={12} />}
                          {playingAudioIndex === i ? 'Stop Advisor' : 'Listen'}
                        </button>
                      )}

                      {m.links && m.links.length > 0 && (
                        <div className={`pt-4 border-t space-y-2 transition-colors ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Grounding Citations</p>
                          <div className="flex flex-wrap gap-2">
                            {m.links.map((l, j) => (
                              <a key={j} href={l.uri} target="_blank" className="px-3 py-1 bg-white/5 hover:bg-white/10 text-emerald-500 rounded-full text-[9px] border border-white/10 transition-colors flex items-center gap-1.5"><Globe size={10} /> {l.title}</a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-3 text-[10px] font-mono text-emerald-500 uppercase tracking-widest animate-pulse">
                  <Loader2 size={14} className="animate-spin" /> Synthesizing Mission Data...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <form onSubmit={handleSendMessage} className={`p-8 border-t transition-colors ${isDark ? 'border-white/[0.08] bg-white/[0.01]' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex gap-4">
                <input value={inputText} onChange={e => setInputText(e.target.value)} placeholder={`Question about ${currentDayData.title}...`} className={`flex-1 rounded-xl px-5 py-4 text-xs font-mono focus:outline-none border transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.05] text-white focus:border-blue-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-300 shadow-inner'}`} />
                <button disabled={chatLoading} type="submit" className="p-4 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all shadow-lg active:scale-95 disabled:opacity-50 text-white"><Send size={20} /></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 border-t p-4 flex justify-around z-50 transition-colors duration-300 ${isDark ? 'bg-[#0a0b10]/95 border-white/[0.08]' : 'bg-white/95 border-slate-200'} backdrop-blur-xl`}>
        {[
          { id: 'dashboard', icon: LayoutIcon },
          { id: 'roadmap', icon: Layers },
          { id: 'projects', icon: Rocket },
          { id: 'notes', icon: Terminal },
          { id: 'settings', icon: SettingsIcon }
        ].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`p-3 rounded-xl transition-all ${activeTab === item.id ? 'text-blue-500 bg-blue-500/10' : 'text-slate-500'}`}><item.icon size={20} /></button>
        ))}
        <button onClick={() => setShowChat(true)} className="p-3 rounded-xl text-emerald-500"><Bot size={20} /></button>
      </nav>
    </div>
  );
};

export default App;
