/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useRef, Component } from 'react';
import { 
  Timer, 
  Plus, 
  Calendar, 
  List as ListIcon, 
  CheckCircle2, 
  Circle, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  Search, 
  Settings,
  MoreVertical,
  Trash2,
  Clock,
  LayoutDashboard,
  Bell,
  BellRing,
  AlertCircle,
  Moon,
  Sun,
  BarChart2,
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { format, addDays, subDays, isSameDay, startOfDay } from 'date-fns';
import { auth, db } from './firebase';
import { cn } from './lib/utils';

// --- Types ---

interface DayEntry {
  id: string;
  uid: string;
  date: string;
  content: string;
  createdAt: any;
}

interface Task {
  id: string;
  uid: string;
  text: string;
  completed: boolean;
  startTime?: any;
  dueTime?: any;
  category?: 'SCHOOL WORK' | 'PERSONAL TASK';
  priority?: 'low' | 'medium' | 'high';
  createdAt: any;
}

interface AppSettings {
  theme: 'light' | 'dark';
  schoolWorkColor: string;
  personalTaskColor: string;
}

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component {
  state: any = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = (this as any).state;
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-2xl font-bold mb-4 text-red-500">Something went wrong</h2>
          <p className="text-zinc-400 mb-6 max-w-xs">
            {error?.message?.includes('{"error"') 
              ? "A database error occurred. Please check your permissions." 
              : "An unexpected error occurred."}
          </p>
          <Button onClick={() => window.location.reload()}>Reload App</Button>
        </div>
      );
    }

    return children;
  }
}

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; 
  className?: string;
  disabled?: boolean;
}) => {
  const variants = {
    primary: 'bg-[#00D166] text-black hover:bg-[#00B156]',
    secondary: 'bg-zinc-800 text-white hover:bg-zinc-700',
    ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800',
    danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

const Input = ({ 
  value, 
  onChange, 
  placeholder, 
  onKeyDown,
  className = ''
}: { 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
}) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    placeholder={placeholder}
    className={cn(
      'w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#00D166] transition-colors',
      className
    )}
  />
);

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'tasks' | 'calendar' | 'stats' | 'settings'>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    schoolWorkColor: '#3b82f6', // blue
    personalTaskColor: '#00D166' // green
  });

  const [newItemText, setNewItemText] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<'SCHOOL WORK' | 'PERSONAL TASK'>('PERSONAL TASK');
  const [newItemPriority, setNewItemPriority] = useState<'low' | 'medium' | 'high'>('medium');
  
  const [filterCategory, setFilterCategory] = useState<'all' | 'SCHOOL WORK' | 'PERSONAL TASK'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'incomplete'>('all');

  // Task specific states
  const [taskStartTime, setTaskStartTime] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [overdueTasks, setOverdueTasks] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pomodoro timer states
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'break'>('work');
  const [activePomodoroTask, setActivePomodoroTask] = useState<string | null>(null);
  const pomodoroIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Theme ---
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  // --- Notifications ---
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const notifiedTasks = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const overdueIds: string[] = [];
      tasks.forEach(task => {
        if (!task.completed && task.dueTime) {
          const dueDate = task.dueTime.toDate();
          const timeDiff = dueDate.getTime() - now.getTime();
          const minutesDiff = timeDiff / (1000 * 60);

          if (minutesDiff <= 0) {
            overdueIds.push(task.id);
            if (!notifiedTasks.current.has(`${task.id}-overdue`)) {
              new Notification('Task Overdue!', { 
                body: `"${task.text}" was due at ${format(dueDate, 'HH:mm')}`,
              });
              notifiedTasks.current.add(`${task.id}-overdue`);
            }
          } else if (minutesDiff > 0 && minutesDiff <= 5 && !notifiedTasks.current.has(`${task.id}-approaching`)) {
            new Notification('Task Due Soon!', { 
              body: `"${task.text}" is due in ${Math.round(minutesDiff)} minutes`,
            });
            notifiedTasks.current.add(`${task.id}-approaching`);
          }
        }
      });
      setOverdueTasks(overdueIds);
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [tasks]);

  // --- Auth & Settings ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Manage User Profile
        const userRef = doc(db, 'users', u.uid);
        try {
          const userSnap = await getDocFromServer(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName || '',
              photoURL: u.photoURL || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } else {
            await updateDoc(userRef, {
              displayName: u.displayName || '',
              photoURL: u.photoURL || '',
              updatedAt: serverTimestamp()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
        }

        // Fetch settings
        const settingsRef = doc(db, 'settings', u.uid);
        try {
          const settingsSnap = await getDocFromServer(settingsRef);
          if (settingsSnap.exists()) {
            setSettings(settingsSnap.data() as AppSettings);
          } else {
            // Initialize default settings
            const initialSettings = {
              uid: u.uid,
              theme: settings.theme,
              schoolWorkColor: settings.schoolWorkColor,
              personalTaskColor: settings.personalTaskColor,
              updatedAt: serverTimestamp()
            };
            await setDoc(settingsRef, initialSettings);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `settings/${u.uid}`);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    if (!user) return;
    const next = { ...settings, ...newSettings };
    setSettings(next);
    try {
      await updateDoc(doc(db, 'settings', user.uid), {
        ...newSettings,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `settings/${user.uid}`);
    }
  };

  // --- Pomodoro Logic ---
  const togglePomodoro = () => {
    if (isPomodoroRunning) {
      if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
      setIsPomodoroRunning(false);
    } else {
      setIsPomodoroRunning(true);
      pomodoroIntervalRef.current = setInterval(() => {
        setPomodoroTime((prev) => {
          if (prev <= 0) {
            if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
            setIsPomodoroRunning(false);
            handlePomodoroEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const resetPomodoro = () => {
    if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
    setIsPomodoroRunning(false);
    setPomodoroTime(pomodoroMode === 'work' ? 25 * 60 : 5 * 60);
  };

  const handlePomodoroEnd = () => {
    // Alert logic
    const alertAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    alertAudio.play().catch(() => {});
    
    if (pomodoroMode === 'work') {
      setPomodoroMode('break');
      setPomodoroTime(5 * 60);
    } else {
      setPomodoroMode('work');
      setPomodoroTime(25 * 60);
    }
  };

  const formatPomodoroTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Data Fetching ---

  useEffect(() => {
    if (!user) return;

    const qDays = query(collection(db, 'days'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
    const qTasks = query(collection(db, 'tasks'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubDays = onSnapshot(qDays, (snapshot) => {
      setDayEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DayEntry)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'days'));

    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    return () => {
      unsubDays();
      unsubTasks();
    };
  }, [user]);

  // --- Actions ---

  const addItem = async () => {
    if (!user || !newItemText.trim()) return;

    const path = activeTab === 'today' ? 'days' : 'tasks';
    try {
      if (activeTab === 'today') {
        await addDoc(collection(db, 'days'), {
          uid: user.uid,
          date: format(selectedDate, 'yyyy-MM-dd'),
          content: newItemText,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else if (activeTab === 'tasks') {
        await addDoc(collection(db, 'tasks'), {
          uid: user.uid,
          text: newItemText,
          completed: false,
          category: newItemCategory,
          priority: newItemPriority,
          startTime: taskStartTime ? new Date(taskStartTime) : null,
          dueTime: taskDueTime ? new Date(taskDueTime) : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setTaskStartTime('');
        setTaskDueTime('');
        setNewItemPriority('medium');
      }
      setNewItemText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        completed: !task.completed,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const deleteItem = async (collectionName: string, id: string) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  // --- Chart Data ---
  const getChartData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const completedTasks = tasks.filter(t => 
        t.completed && 
        t.createdAt && 
        isSameDay(t.createdAt.toDate(), d)
      );
      return {
        name: format(d, 'EEE'),
        completed: completedTasks.length,
        date: dateStr
      };
    });
    return last7Days;
  };

  // --- Render Helpers ---

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center transition-colors duration-300", settings.theme === 'dark' ? "bg-black" : "bg-zinc-50")}>
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Timer className="w-12 h-12 text-[#00D166]" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-300", settings.theme === 'dark' ? "bg-black text-white" : "bg-zinc-50 text-black")}>
        <div className="w-24 h-24 bg-[#00D166] rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(0,209,102,0.2)]">
          <Timer className="w-14 h-14 text-black" />
        </div>
        <h1 className="text-4xl font-bold mb-2 tracking-tight">Rescue Time</h1>
        <p className="text-zinc-500 mb-12 text-center max-w-xs font-sans">
          Capture your days and tasks in one simple, powerful place.
        </p>
        <Button 
          onClick={handleLogin} 
          disabled={isLoggingIn}
          className="w-full max-w-xs py-4 text-lg font-sans"
        >
          {isLoggingIn ? 'Signing in...' : 'Get Started'}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen flex flex-col max-w-md mx-auto border-x shadow-2xl transition-colors duration-300 relative",
      settings.theme === 'dark' ? "bg-black text-white border-zinc-900" : "bg-white text-zinc-900 border-zinc-100"
    )}>
      {/* Header */}
      <header className={cn(
        "p-6 flex items-center justify-between sticky top-0 backdrop-blur-md z-30 transition-colors duration-300",
        settings.theme === 'dark' ? "bg-black/80" : "bg-white/80"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00D166] rounded-xl flex items-center justify-center">
            <Timer className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-xl font-bold font-sans tracking-tight">Rescue Time</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn("p-2 transition-colors", activeTab === 'settings' ? "text-[#00D166]" : "text-zinc-500 hover:text-[#00D166]")}
          >
            <Settings className="w-5 h-5" />
          </button>
          <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Pomodoro Floating Panel */}
      <AnimatePresence>
        {activePomodoroTask && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={cn(
              "fixed bottom-24 left-6 right-6 max-w-[calc(448px-3rem)] mx-auto border p-4 rounded-2xl shadow-2xl z-40 transition-colors",
              settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {pomodoroMode === 'work' ? <Brain className="w-4 h-4 text-orange-500" /> : <Coffee className="w-4 h-4 text-blue-500" />}
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {pomodoroMode === 'work' ? 'Focus Session' : 'Break Time'}
                </span>
              </div>
              <button 
                onClick={() => { setActivePomodoroTask(null); resetPomodoro(); }}
                className="text-zinc-500 hover:text-red-500"
              >
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className={cn("text-3xl font-mono font-bold tabular-nums", settings.theme === 'dark' ? "text-white" : "text-black")}>
                {formatPomodoroTime(pomodoroTime)}
              </div>
              <div className="flex-1 text-sm text-zinc-400 truncate">
                {tasks.find(t => t.id === activePomodoroTask)?.text}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={togglePomodoro}
                  className="w-10 h-10 rounded-full bg-[#00D166] text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                >
                  {isPomodoroRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button 
                  onClick={resetPomodoro}
                  className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm", settings.theme === 'dark' ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-600")}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-4 overflow-hidden">
              <motion.div 
                className={cn("h-full", pomodoroMode === 'work' ? "bg-orange-500" : "bg-blue-500")}
                initial={{ width: '100%' }}
                animate={{ width: `${(pomodoroTime / (pomodoroMode === 'work' ? 25 * 60 : 5 * 60)) * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 pb-24">
        {activeTab === 'today' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-1 text-zinc-500 hover:text-green-500 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold font-sans">
                  {isSameDay(selectedDate, new Date()) ? 'Today' : format(selectedDate, 'MMM d, yyyy')}
                </h2>
                <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-1 text-zinc-500 hover:text-green-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setActiveTab('stats')}
                  className="p-2 text-zinc-500 hover:text-[#00D166] transition-colors"
                >
                  <BarChart2 className="w-5 h-5" />
                </button>
                <button onClick={() => setSelectedDate(new Date())} className="text-xs text-[#00D166] font-bold uppercase tracking-tighter">
                  Jump to Today
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <Input 
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder="Capture something..."
              />
              
              <div className="space-y-3">
                {dayEntries
                  .filter(entry => entry.date === format(selectedDate, 'yyyy-MM-dd'))
                  .map(entry => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={entry.id} 
                      className={cn(
                        "group p-4 border rounded-2xl flex items-start justify-between transition-colors",
                        settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                      )}
                    >
                      <p className="text-inherit">{entry.content}</p>
                      <button 
                        onClick={() => deleteItem('days', entry.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-all font-sans"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                {dayEntries.filter(entry => entry.date === format(selectedDate, 'yyyy-MM-dd')).length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-zinc-500 italic font-sans">No captures for this day.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold font-sans">Task Manager</h2>
              {overdueTasks.length > 0 && (
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-xs font-bold"
                >
                  <BellRing className="w-4 h-4" />
                  {overdueTasks.length} OVERDUE
                </motion.div>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap gap-2 py-2">
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border focus:outline-none transition-colors",
                  settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-white border-zinc-200 text-zinc-600"
                )}
              >
                <option value="all">All Categories</option>
                <option value="SCHOOL WORK">School Work</option>
                <option value="PERSONAL TASK">Personal Task</option>
              </select>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border focus:outline-none transition-colors",
                  settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-white border-zinc-200 text-zinc-600"
                )}
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </div>
            
            <div className={cn(
              "space-y-4 p-4 border rounded-2xl shadow-sm",
              settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
            )}>
              <Input 
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder="Add a new task..."
                className="bg-transparent border-none px-0"
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => setNewItemCategory('SCHOOL WORK')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border",
                    newItemCategory === 'SCHOOL WORK' 
                      ? "bg-blue-500/10 border-blue-500 text-blue-500" 
                      : "bg-transparent border-zinc-700 text-zinc-500"
                  )}
                  style={{ borderColor: newItemCategory === 'SCHOOL WORK' ? settings.schoolWorkColor : undefined, color: newItemCategory === 'SCHOOL WORK' ? settings.schoolWorkColor : undefined }}
                >
                  School Work
                </button>
                <button 
                  onClick={() => setNewItemCategory('PERSONAL TASK')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border",
                    newItemCategory === 'PERSONAL TASK' 
                      ? "bg-green-500/10 border-green-500 text-green-500" 
                      : "bg-transparent border-zinc-700 text-zinc-500"
                  )}
                  style={{ borderColor: newItemCategory === 'PERSONAL TASK' ? settings.personalTaskColor : undefined, color: newItemCategory === 'PERSONAL TASK' ? settings.personalTaskColor : undefined }}
                >
                  Personal Task
                </button>
              </div>

              {/* Priority Selector */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/50">
                <label className="text-[10px] uppercase text-zinc-500 font-bold font-sans">Priority</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewItemPriority(p)}
                      className={cn(
                        "flex-1 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border",
                        newItemPriority === p
                          ? p === 'high' ? "bg-red-500/10 border-red-500 text-red-500" :
                            p === 'medium' ? "bg-yellow-500/10 border-yellow-500 text-yellow-500" :
                            "bg-blue-500/10 border-blue-500 text-blue-500"
                          : "bg-transparent border-zinc-700 text-zinc-500"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/50">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500 font-bold font-sans">Start Time</label>
                  <input 
                    type="datetime-local" 
                    value={taskStartTime}
                    onChange={(e) => setTaskStartTime(e.target.value)}
                    className="w-full bg-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00D166]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-zinc-500 font-bold font-sans">Due Time</label>
                  <input 
                    type="datetime-local" 
                    value={taskDueTime}
                    onChange={(e) => setTaskDueTime(e.target.value)}
                    className="w-full bg-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00D166]"
                  />
                </div>
              </div>
              <Button onClick={addItem} className="w-full py-2 text-sm mt-2 font-sans font-medium">Add to My Schedule</Button>
            </div>

            <div className="space-y-3">
              {tasks
                .filter(task => {
                  const categoryMatch = filterCategory === 'all' || task.category === filterCategory;
                  const statusMatch = filterStatus === 'all' || 
                    (filterStatus === 'completed' && task.completed) || 
                    (filterStatus === 'incomplete' && !task.completed);
                  return categoryMatch && statusMatch;
                })
                .map(task => {
                  const isOverdue = !task.completed && task.dueTime && task.dueTime.toDate() < new Date();
                  const categoryColor = task.category === 'SCHOOL WORK' ? settings.schoolWorkColor : settings.personalTaskColor;
                  const priorityColor = task.priority === 'high' ? 'text-red-500' : task.priority === 'medium' ? 'text-yellow-500' : 'text-blue-500';
                  
                  return (
                    <motion.div 
                      layout
                      key={task.id} 
                      className={cn(
                        "group flex items-center gap-4 p-4 border rounded-2xl transition-all",
                        isOverdue ? "border-red-500 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]" : "border-zinc-800 bg-zinc-900/50",
                        settings.theme === 'light' && "bg-zinc-50 border-zinc-200"
                      )}
                    >
                      <button onClick={() => toggleTask(task)} style={{ color: task.completed ? '#52525b' : categoryColor }}>
                        {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span 
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                            style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
                          >
                            {task.category || 'General'}
                          </span>
                          {task.priority && (
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider", priorityColor)}>
                              • {task.priority}
                            </span>
                          )}
                          {activePomodoroTask === task.id && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-orange-500 uppercase tracking-wider animate-pulse">
                              <Brain className="w-3 h-3" />
                              Focusing
                            </span>
                          )}
                        </div>
                        <p className={cn(
                          'font-medium truncate font-sans',
                          task.completed ? 'text-zinc-500 line-through' : 'text-inherit'
                        )}>
                          {task.text}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          {task.startTime && (
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-sans">
                              <Clock className="w-3 h-3" />
                              {format(task.startTime.toDate(), 'HH:mm')}
                            </span>
                          )}
                          {task.dueTime && (
                            <span className={cn(
                              "text-[10px] flex items-center gap-1 font-bold font-sans",
                              isOverdue ? "text-red-500" : "text-zinc-500"
                            )}>
                              <Bell className="w-3 h-3" />
                              {format(task.dueTime.toDate(), 'HH:mm')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!task.completed && (
                          <button 
                            onClick={() => { setActivePomodoroTask(task.id); resetPomodoro(); togglePomodoro(); }}
                            className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-all shadow-sm"
                          >
                            <Brain className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => deleteItem('tasks', task.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 transition-all font-sans"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold font-sans">Timeline</h2>
            <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-800">
              {dayEntries.slice(0, 10).map((entry, idx) => (
                <div key={entry.id} className="relative pl-12 font-sans">
                  <div className="absolute left-0 top-1 w-10 h-10 bg-black border-2 border-zinc-800 rounded-full flex items-center justify-center z-10">
                    <Clock className="w-4 h-4 text-[#00D166]" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-sans">
                      {format(new Date(entry.date), 'MMM d')}
                    </span>
                    <p className="text-inherit">{entry.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold font-sans">Performance</h2>
              <div className="bg-[#00D166]/10 px-3 py-1 rounded-full text-[#00D166] text-xs font-bold font-sans">
                Last 7 Days
              </div>
            </div>

            <div className={cn(
              "p-6 border rounded-2xl transition-colors shadow-sm",
              settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
            )}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-6 font-sans">Tasks Completed</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData()}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#71717a' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ 
                        backgroundColor: settings.theme === 'dark' ? '#18181b' : '#ffffff', 
                        borderColor: '#27272a',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: settings.theme === 'dark' ? '#ffffff' : '#000000'
                      }}
                    />
                    <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                      {getChartData().map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={isSameDay(new Date(entry.date), new Date()) ? '#00D166' : '#27272a'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <StatsCard 
                label="Daily Avg" 
                value={(getChartData().reduce((acc, curr) => acc + curr.completed, 0) / 7).toFixed(1)} 
                theme={settings.theme}
              />
              <StatsCard 
                label="Total" 
                value={tasks.filter(t => t.completed).length.toString()} 
                theme={settings.theme}
              />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold font-sans">Settings</h2>
            
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#00D166] font-sans">Appearance</h3>
              <div className={cn(
                "p-4 border rounded-2xl flex items-center justify-between shadow-sm",
                settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
              )}>
                <div className="flex items-center gap-3">
                  {settings.theme === 'dark' ? <Moon className="w-5 h-5 text-purple-500" /> : <Sun className="w-5 h-5 text-yellow-500" />}
                  <span className="font-medium font-sans">Dark Mode</span>
                </div>
                <button 
                  onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                  className={cn(
                    "w-12 h-6 rounded-full p-1 transition-colors relative",
                    settings.theme === 'dark' ? "bg-[#00D166]" : "bg-zinc-300"
                  )}
                >
                  <motion.div 
                    animate={{ x: settings.theme === 'dark' ? 24 : 0 }}
                    className="w-4 h-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#00D166] font-sans">Category Colors</h3>
              <div className={cn(
                "p-6 border rounded-2xl space-y-6 shadow-sm",
                settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
              )}>
                <ColorSetting 
                  label="School Work" 
                  color={settings.schoolWorkColor} 
                  onChange={(c) => updateSettings({ schoolWorkColor: c })}
                  theme={settings.theme}
                />
                <div className="h-px bg-zinc-700/30" />
                <ColorSetting 
                  label="Personal Task" 
                  color={settings.personalTaskColor} 
                  onChange={(c) => updateSettings({ personalTaskColor: c })}
                  theme={settings.theme}
                />
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 max-w-md mx-auto backdrop-blur-xl border-t p-4 flex items-center justify-around z-50 transition-colors duration-300",
        settings.theme === 'dark' ? "bg-black/80 border-zinc-900" : "bg-white/80 border-zinc-100"
      )}>
        <NavButton 
          active={activeTab === 'today'} 
          onClick={() => setActiveTab('today')} 
          icon={<LayoutDashboard className="w-6 h-6" />} 
          label="Today" 
          theme={settings.theme}
        />
        <NavButton 
          active={activeTab === 'tasks'} 
          onClick={() => setActiveTab('tasks')} 
          icon={<CheckCircle2 className="w-6 h-6" />} 
          label="Tasks" 
          theme={settings.theme}
        />
        <NavButton 
          active={activeTab === 'calendar'} 
          onClick={() => setActiveTab('calendar')} 
          icon={<Calendar className="w-6 h-6" />} 
          label="Timeline" 
          theme={settings.theme}
        />
      </nav>
    </div>
  );
}

const NavButton = ({ 
  active, 
  onClick, 
  icon, 
  label,
  theme
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  theme: 'light' | 'dark';
}) => (
  <button 
    onClick={onClick}
    className={cn(
      'flex flex-col items-center gap-1 transition-all',
      active ? 'text-[#00D166]' : 'text-zinc-500 hover:text-zinc-400'
    )}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-tighter sm:block hidden">{label}</span>
  </button>
);

const StatsCard = ({ label, value, theme }: { label: string, value: string, theme: 'light' | 'dark' }) => (
  <div className={cn(
    "p-4 border rounded-2xl shadow-sm",
    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
  )}>
    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">{label}</span>
    <span className="text-2xl font-bold font-sans">{value}</span>
  </div>
);

const ColorSetting = ({ label, color, onChange, theme }: { label: string, color: string, onChange: (c: string) => void, theme: 'light' | 'dark' }) => {
  const swatches = ['#3b82f6', '#00D166', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium font-sans">{label}</span>
        <div 
          className="w-10 h-6 rounded shadow border border-zinc-700" 
          style={{ backgroundColor: color }}
        />
      </div>
      <div className="flex gap-2 justify-between">
        {swatches.map(c => (
          <button 
            key={c}
            onClick={() => onChange(c)}
            className={cn(
              "w-8 h-8 rounded-full border-2 transition-transform active:scale-95",
              color === c ? "border-white" : "border-transparent"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
};
