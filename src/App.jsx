import { useState, useMemo, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Users,
  FolderKanban,
  DollarSign,
  AlertCircle,
  ChevronDown,
  Search,
  LayoutGrid,
  Zap,
  Check,
  Eye,
  Printer,
  FileText,
  CircleCheck,
  Circle,
  CircleDot,
  Calendar,
  Receipt,
  ExternalLink,
  MessageSquare,
  Paperclip,
  Star,
  Timer,
  Play,
  Square,
  Pause,
  Repeat,
} from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { Routes, Route, useNavigate, Navigate, useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import logoUrl from './Logo Daussaurus.svg';

// ============================================================================
// MOCK DATA — Initial project entries for the spreadsheet
// ============================================================================

// Initial projects data removed, data is now fetched from Firestore.

// ============================================================================
// STATUS CONFIGURATION — Colors and styling for each status
// ============================================================================

const STATUS_OPTIONS = ['None', 'On Progress', 'Done', 'Revisi', 'Need to Check'];

const STATUS_STYLES = {
  'None': {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-400',
    dot: 'bg-gray-400',
  },
  'On Progress': {
    bg: 'bg-yellow-300',
    text: 'text-black',
    border: 'border-yellow-500',
    dot: 'bg-yellow-600',
  },
  'Done': {
    bg: 'bg-[#39FF14]',
    text: 'text-black',
    border: 'border-green-600',
    dot: 'bg-green-700',
  },
  'Revisi': {
    bg: 'bg-[#FF006E]',
    text: 'text-white',
    border: 'border-pink-700',
    dot: 'bg-pink-300',
  },
  'Need to Check': {
    bg: 'bg-[#00E5FF]',
    text: 'text-black',
    border: 'border-cyan-600',
    dot: 'bg-cyan-700',
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Formats a number as IDR or USD currency */
const formatMoney = (amount, currency = 'IDR') => {
  return new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/** Formats a date string to a short readable format */
const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/** Analyzes deadline and returns status for Smart Alerts */
const getDeadlineStatus = (deadlineStr, status) => {
  if (!deadlineStr || status === 'Done') return 'safe';
  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'warning';
  return 'safe';
};

/** Blank project template for the Create form */
const EMPTY_PROJECT = {
  clientName: '',
  projectName: '',
  startDate: '',
  deadline: '',
  status: 'None',
  currency: 'IDR',
  fee: '',
  expense: '',
  amountPaid: 0,
  isRetainer: false,
  progressNotes: '',
  tasks: [],
  files: [],
};

/** Standard milestones for all projects */
const MILESTONES = [
  { key: 'requirements', label: 'Requirements & Brief' },
  { key: 'design', label: 'Design & Mockup' },
  { key: 'development', label: 'Development' },
  { key: 'review', label: 'Review & Revisions' },
  { key: 'delivery', label: 'Final Delivery' },
];

/** Project templates with pre-filled tasks */
const PROJECT_TEMPLATES = {
  'Web Development': [
    { id: 't1', text: 'Gather requirements & brief', done: false },
    { id: 't2', text: 'Create UI/UX wireframes', done: false },
    { id: 't3', text: 'Frontend development (React/HTML)', done: false },
    { id: 't4', text: 'Backend & Database setup', done: false },
    { id: 't5', text: 'Testing & bug fixing', done: false },
    { id: 't6', text: 'Deployment & handover', done: false },
  ],
  'Logo Design': [
    { id: 't1', text: 'Client brief & moodboard', done: false },
    { id: 't2', text: 'Sketching concepts (3 options)', done: false },
    { id: 't3', text: 'Vectorizing chosen concept', done: false },
    { id: 't4', text: 'Color & typography exploration', done: false },
    { id: 't5', text: 'Client review & revisions', done: false },
    { id: 't6', text: 'Final files delivery (AI, EPS, PNG)', done: false },
  ],
  'Social Media Mgt': [
    { id: 't1', text: 'Content pillar & strategy', done: false },
    { id: 't2', text: 'Copywriting & hashtag research', done: false },
    { id: 't3', text: 'Design visual posts / reels', done: false },
    { id: 't4', text: 'Client approval', done: false },
    { id: 't5', text: 'Scheduling posts', done: false },
    { id: 't6', text: 'Monthly analytics report', done: false },
  ]
};

/**
 * Derives milestone progress from a project's status.
 * Returns the index of the current active milestone (0-based).
 */
const getMilestoneIndex = (status) => {
  switch (status) {
    case 'None': return 0;
    case 'On Progress': return 2;
    case 'Need to Check': return 3;
    case 'Revisi': return 3;
    case 'Done': return 5; // all complete
    default: return 0;
  }
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Neo-brutalist status badge */
const StatusBadge = ({ status }) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES['None'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wide border-2 border-black ${style.bg} ${style.text} shadow-[2px_2px_0px_rgba(0,0,0,1)]`}
    >
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
};

/** Neo-brutalist button component */
const BrutalButton = ({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  className = '',
  type = 'button',
  disabled = false,
}) => {
  const variants = {
    default:
      'bg-white text-black border-black hover:bg-gray-100',
    primary:
      'bg-[#5B5FFF] text-white border-black hover:bg-[#4A4EE0]',
    success:
      'bg-[#39FF14] text-black border-black hover:bg-[#2DE00F]',
    danger:
      'bg-[#FF006E] text-white border-black hover:bg-[#E00060]',
    warning:
      'bg-yellow-300 text-black border-black hover:bg-yellow-400',
    ghost:
      'bg-transparent text-black border-transparent hover:bg-gray-200',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-bold border-2
        shadow-[4px_4px_0px_rgba(0,0,0,1)]
        active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
        hover:shadow-[2px_2px_0px_rgba(0,0,0,1)]
        hover:translate-x-[2px] hover:translate-y-[2px]
        transition-all duration-100 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {children}
    </button>
  );
};

/** Neo-brutalist stat card for the dashboard header */
const StatCard = ({ icon: Icon, label, value, color }) => (
  <div
    className={`${color} border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] p-4 md:p-5 flex items-center gap-4 hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-100`}
  >
    <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_rgba(0,0,0,1)]">
      <Icon size={22} strokeWidth={2.5} />
    </div>
    <div>
      <p className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-xl md:text-2xl font-black mt-0.5 tracking-tight">{value}</p>
    </div>
  </div>
);

// ============================================================================
// TIME TRACKER (POMODORO / STOPWATCH)
// ============================================================================
const TimeTracker = () => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let intervalId;
    if (isRunning) {
      intervalId = setInterval(() => setTime((t) => t + 1), 1000);
    }
    return () => clearInterval(intervalId);
  }, [isRunning]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setTime(0);
  };

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-colors ${isRunning ? 'bg-yellow-300' : 'bg-white'}`}>
      <Timer size={16} strokeWidth={2.5} className={isRunning ? 'animate-pulse' : ''} />
      <span className="text-sm font-black w-[45px] text-center">{formatTime(time)}</span>
      <div className="flex gap-1 border-l-2 border-black pl-2 ml-1">
        <button onClick={toggleTimer} className="hover:scale-110 transition-transform">
          {isRunning ? <Pause size={14} strokeWidth={3} /> : <Play size={14} strokeWidth={3} />}
        </button>
        <button onClick={resetTimer} className="hover:scale-110 transition-transform text-red-500">
          <Square size={12} strokeWidth={3} fill="currentColor" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL COMPONENT — For Create / Edit operations
// ============================================================================

const ProjectModal = ({ isOpen, onClose, onSave, initialData, isEdit }) => {
  const [form, setForm] = useState(initialData || EMPTY_PROJECT);
  const [errors, setErrors] = useState({});
  const [newTask, setNewTask] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');

  const handleAddLink = () => {
    const url = newFileUrl.trim();
    if (url) {
      let name = newFileName.trim();
      if (!name) {
        try {
          const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
          name = domain || 'Link Attachment';
        } catch {
          name = 'Link Attachment';
        }
      }
      const finalUrl = url.startsWith('http') ? url : `https://${url}`;
      
      setForm(prev => ({
        ...prev,
        files: [...(prev.files || []), { id: Date.now().toString(), name, url: finalUrl }]
      }));
      setNewFileName('');
      setNewFileUrl('');
    }
  };

  const removeFile = (fileId) => {
    setForm(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId)
    }));
  };

  const addTask = () => {
    if (newTask.trim()) {
      setForm((prev) => ({
        ...prev,
        tasks: [...(prev.tasks || []), { id: Date.now().toString(), text: newTask.trim(), done: false }],
      }));
      setNewTask('');
    }
  };

  const toggleTask = (taskId) => {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
    }));
  };

  const removeTask = (taskId) => {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  };

  /** Update a single form field */
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  /** Validate and submit the form */
  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.clientName.trim()) newErrors.clientName = 'Client name is required';
    if (!form.projectName.trim()) newErrors.projectName = 'Project name is required';
    if (!form.startDate) newErrors.startDate = 'Start date is required';
    if (!form.deadline) newErrors.deadline = 'Deadline is required';
    if (!form.fee && form.fee !== 0) newErrors.fee = 'Fee is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      ...form,
      fee: typeof form.fee === 'string' ? parseInt(form.fee.replace(/\D/g, ''), 10) || 0 : form.fee,
      expense: typeof form.expense === 'string' ? parseInt(form.expense.replace(/\D/g, ''), 10) || 0 : form.expense,
      currency: form.currency || 'IDR',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#f4f4f0] border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#5B5FFF] text-white border-b-4 border-black px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-wide flex items-center gap-2">
            {isEdit ? <Pencil size={20} strokeWidth={2.5} /> : <Plus size={20} strokeWidth={2.5} />}
            {isEdit ? 'Edit Project' : 'Add New Project'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white text-black border-2 border-black flex items-center justify-center font-black hover:bg-red-100 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all duration-100 cursor-pointer"
          >
            <X size={16} strokeWidth={3} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Use Template */}
          {!isEdit && (
            <div className="bg-yellow-300 border-2 border-black p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] flex items-start gap-3">
              <Zap size={20} strokeWidth={2.5} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-black uppercase mb-2 tracking-wider">Use a Template</p>
                <div className="relative shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <select
                    onChange={(e) => {
                      const template = PROJECT_TEMPLATES[e.target.value];
                      if (template) {
                        setForm((prev) => ({
                          ...prev,
                          projectName: e.target.value,
                          tasks: template,
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border-2 border-black text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] cursor-pointer appearance-none"
                  >
                    <option value="">-- Select to auto-fill tasks --</option>
                    {Object.keys(PROJECT_TEMPLATES).map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} strokeWidth={2.5} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Client Name */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
              Client Name <span className="text-[#FF006E]">*</span>
            </label>
            <input
              type="text"
              value={form.clientName}
              onChange={(e) => handleChange('clientName', e.target.value)}
              placeholder="e.g. Andi Prasetyo"
              className={`w-full px-4 py-2.5 bg-white border-2 border-black text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[3px_3px_0px_rgba(0,0,0,1)] ${errors.clientName ? 'border-[#FF006E]' : ''}`}
            />
            {errors.clientName && (
              <p className="text-xs font-bold text-[#FF006E] mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.clientName}
              </p>
            )}
          </div>

          {/* Project Name & Retainer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black uppercase tracking-wider">
                Project Name <span className="text-[#FF006E]">*</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isRetainer || false}
                  onChange={(e) => handleChange('isRetainer', e.target.checked)}
                  className="w-4 h-4 border-2 border-black accent-[#5B5FFF]"
                />
                <span className="text-[10px] font-black uppercase flex items-center gap-1">
                  <Repeat size={10} strokeWidth={3} /> Retainer (Monthly)
                </span>
              </label>
            </div>
            <input
              type="text"
              value={form.projectName}
              onChange={(e) => handleChange('projectName', e.target.value)}
              placeholder="e.g. Website Redesign"
              className={`w-full px-4 py-2.5 bg-white border-2 border-black text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[3px_3px_0px_rgba(0,0,0,1)] ${errors.projectName ? 'border-[#FF006E]' : ''}`}
            />
            {errors.projectName && (
              <p className="text-xs font-bold text-[#FF006E] mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.projectName}
              </p>
            )}
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
                Start Date <span className="text-[#FF006E]">*</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className={`w-full px-4 py-2.5 bg-white border-2 border-black text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[3px_3px_0px_rgba(0,0,0,1)] ${errors.startDate ? 'border-[#FF006E]' : ''}`}
              />
              {errors.startDate && (
                <p className="text-xs font-bold text-[#FF006E] mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.startDate}
                </p>
              )}
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
                Deadline <span className="text-[#FF006E]">*</span>
              </label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => handleChange('deadline', e.target.value)}
                className={`w-full px-4 py-2.5 bg-white border-2 border-black text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[3px_3px_0px_rgba(0,0,0,1)] ${errors.deadline ? 'border-[#FF006E]' : ''}`}
              />
              {errors.deadline && (
                <p className="text-xs font-bold text-[#FF006E] mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.deadline}
                </p>
              )}
            </div>

          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
              Status
            </label>
            <div className="relative">
              <select
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2.5 bg-white border-2 border-black text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[3px_3px_0px_rgba(0,0,0,1)] appearance-none cursor-pointer"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Finance Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Currency & Fee */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
                Currency & Fee <span className="text-[#FF006E]">*</span>
              </label>
              <div className="flex shadow-[3px_3px_0px_rgba(0,0,0,1)]">
                <select
                  value={form.currency || 'IDR'}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="px-3 py-2.5 bg-gray-100 border-2 border-r-0 border-black text-sm font-black focus:outline-none cursor-pointer"
                >
                  <option value="IDR">IDR</option>
                  <option value="USD">USD</option>
                </select>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-500 pointer-events-none">
                    {form.currency === 'USD' ? '$' : 'Rp'}
                  </span>
                  <input
                    type="text"
                    value={
                      form.fee !== '' && form.fee !== undefined
                        ? typeof form.fee === 'number'
                          ? form.fee.toLocaleString(form.currency === 'USD' ? 'en-US' : 'id-ID')
                          : form.fee
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      handleChange('fee', raw ? parseInt(raw, 10).toLocaleString(form.currency === 'USD' ? 'en-US' : 'id-ID') : '');
                    }}
                    placeholder="0"
                    className={`w-full pl-10 pr-4 py-2.5 bg-white border-2 border-l-2 border-black text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#5B5FFF] ${errors.fee ? 'border-[#FF006E]' : ''}`}
                  />
                </div>
              </div>
              {errors.fee && (
                <p className="text-xs font-bold text-[#FF006E] mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.fee}
                </p>
              )}
            </div>

            {/* Expense */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
                Expense / Modal
              </label>
              <div className="relative shadow-[3px_3px_0px_rgba(0,0,0,1)]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-500 pointer-events-none">
                  {form.currency === 'USD' ? '$' : 'Rp'}
                </span>
                <input
                  type="text"
                  value={
                    form.expense !== '' && form.expense !== undefined
                      ? typeof form.expense === 'number'
                        ? form.expense.toLocaleString(form.currency === 'USD' ? 'en-US' : 'id-ID')
                        : form.expense
                      : ''
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    handleChange('expense', raw ? parseInt(raw, 10).toLocaleString(form.currency === 'USD' ? 'en-US' : 'id-ID') : '');
                  }}
                  placeholder="0"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-black text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#5B5FFF]"
                />
              </div>
            </div>
          </div>

          {/* Progress / Process Notes */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
              Progress Notes
            </label>
            <textarea
              value={form.progressNotes}
              onChange={(e) => handleChange('progressNotes', e.target.value)}
              placeholder="e.g. Completed initial design phase..."
              rows={3}
              className="w-full px-4 py-2.5 bg-white border-2 border-black text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[3px_3px_0px_rgba(0,0,0,1)] resize-y"
            />
          </div>

          {/* To-Do List (Tasks) */}
          <div className="border-t-2 border-black/10 pt-3">
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Mini To-Do List</span>
              <span className="text-[10px] bg-gray-200 px-2 py-0.5 border border-black text-gray-700">
                {form.tasks?.filter((t) => t.done).length || 0}/{form.tasks?.length || 0}
              </span>
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTask();
                  }
                }}
                placeholder="Add a sub-task..."
                className="flex-1 px-3 py-2 bg-white border-2 border-black text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[2px_2px_0px_rgba(0,0,0,1)]"
              />
              <BrutalButton type="button" variant="primary" size="sm" onClick={addTask}>
                <Plus size={16} strokeWidth={3} />
              </BrutalButton>
            </div>
            
            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
              {form.tasks?.length === 0 && (
                <p className="text-xs font-bold text-gray-400 text-center italic">No tasks added yet.</p>
              )}
              {form.tasks?.map((task) => (
                <div key={task.id} className="flex items-center justify-between bg-white border-2 border-black p-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] group">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className={`w-5 h-5 border-2 border-black flex items-center justify-center shrink-0 ${task.done ? 'bg-[#39FF14] text-black' : 'bg-white'}`}
                    >
                      {task.done && <Check size={12} strokeWidth={3} />}
                    </button>
                    <span className={`text-sm font-bold truncate ${task.done ? 'line-through text-gray-400' : 'text-black'}`}>
                      {task.text}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="w-6 h-6 bg-[#FF006E] text-white border-2 border-black flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Link Upload (Attachments) */}
          <div className="border-t-2 border-black/10 pt-3">
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Attachments (Links)</span>
              <span className="text-[10px] bg-gray-200 px-2 py-0.5 border border-black text-gray-700">
                {form.files?.length || 0} Links
              </span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Link Name (Optional)"
                className="w-full sm:w-1/3 px-3 py-2 bg-white border-2 border-black text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[2px_2px_0px_rgba(0,0,0,1)]"
              />
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="url"
                  value={newFileUrl}
                  onChange={(e) => setNewFileUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLink();
                    }
                  }}
                  placeholder="Paste URL (e.g. Google Drive, Figma, dsb)"
                  className="flex-1 px-3 py-2 bg-white border-2 border-black text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                />
                <BrutalButton type="button" variant="primary" size="sm" onClick={handleAddLink} className="h-full !px-3">
                  <Plus size={16} strokeWidth={3} />
                </BrutalButton>
              </div>
            </div>
            
            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
              {form.files?.length === 0 && (
                <p className="text-xs font-bold text-gray-400 text-center italic">No files attached.</p>
              )}
              {form.files?.map((file) => (
                <div key={file.id} className="flex items-center justify-between bg-white border-2 border-black p-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] group">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText size={14} className="text-[#5B5FFF] shrink-0" strokeWidth={3} />
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-[#5B5FFF] hover:underline truncate"
                    >
                      {file.name}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="w-6 h-6 bg-[#FF006E] text-white border-2 border-black flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t-2 border-black/10">
            <BrutalButton type="submit" variant="primary" className="flex-1">
              <Save size={16} strokeWidth={2.5} />
              {isEdit ? 'Update Project' : 'Save Project'}
            </BrutalButton>
            <BrutalButton variant="default" onClick={onClose}>
              Cancel
            </BrutalButton>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// DELETE CONFIRMATION MODAL
// ============================================================================

const DeleteModal = ({ isOpen, onClose, onConfirm, projectName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-[#f4f4f0] border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-sm">
        <div className="bg-[#FF006E] text-white border-b-4 border-black px-6 py-4 flex items-center gap-2">
          <Trash2 size={20} strokeWidth={2.5} />
          <h2 className="text-lg font-black uppercase tracking-wide">Delete Project</h2>
        </div>

        <div className="p-6">
          <p className="text-sm font-semibold mb-1">Are you sure you want to delete:</p>
          <p className="text-base font-black text-[#FF006E] mb-5 bg-pink-50 border-2 border-black px-3 py-2 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
            "{projectName}"
          </p>

          <div className="flex items-center gap-3">
            <BrutalButton variant="danger" onClick={onConfirm} className="flex-1">
              <Trash2 size={14} strokeWidth={2.5} />
              Yes, Delete
            </BrutalButton>
            <BrutalButton variant="default" onClick={onClose}>
              Cancel
            </BrutalButton>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INVOICE GENERATOR MODAL (PDF)
// ============================================================================

const InvoiceModal = ({ project, onClose }) => {
  const componentRef = useRef();
  
  // Custom Pay To Fields
  const [payToName, setPayToName] = useState(() => localStorage.getItem('invoice_payToName') || 'Firdaus');
  const [payToEmail, setPayToEmail] = useState(() => localStorage.getItem('invoice_payToEmail') || 'daussaurus@studio.com');
  const [payToBank, setPayToBank] = useState(() => localStorage.getItem('invoice_payToBank') || 'BCA - 1234567890');

  useEffect(() => {
    localStorage.setItem('invoice_payToName', payToName);
    localStorage.setItem('invoice_payToEmail', payToEmail);
    localStorage.setItem('invoice_payToBank', payToBank);
  }, [payToName, payToEmail, payToBank]);
  
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Invoice_${project.projectName.replace(/\s+/g, '_')}_${project.clientName}`,
  });

  const remaining = project.fee - (project.amountPaid || 0);
  const paidPercent = project.fee > 0 ? Math.round(((project.amountPaid || 0) / project.fee) * 100) : 0;
  const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const invoiceNo = `INV-${String(project.id).padStart(4, '0')}-2026`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-[#f4f4f0] border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#9D4EDD] text-white border-b-4 border-black px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Printer size={20} strokeWidth={2.5} />
            <h2 className="text-lg font-black uppercase tracking-wide">Generate Invoice PDF</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white text-black border-2 border-black flex items-center justify-center font-black hover:bg-red-100 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all duration-100"
          >
            <X size={16} strokeWidth={3} />
          </button>
        </div>

        {/* Settings Area (Hidden in Print) */}
        <div className="bg-white border-b-4 border-black p-4 md:p-6 shrink-0 flex flex-col sm:flex-row gap-4 no-print print:hidden">
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase tracking-wider mb-1 text-gray-500">Pay To Name</label>
            <input 
              type="text" 
              value={payToName} 
              onChange={(e) => setPayToName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#9D4EDD]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase tracking-wider mb-1 text-gray-500">Pay To Email</label>
            <input 
              type="text" 
              value={payToEmail} 
              onChange={(e) => setPayToEmail(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#9D4EDD]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase tracking-wider mb-1 text-gray-500">Bank Details</label>
            <input 
              type="text" 
              value={payToBank} 
              onChange={(e) => setPayToBank(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#9D4EDD]"
            />
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-200 flex justify-center items-start">
          {/* A4 Paper Container */}
          <div 
            ref={componentRef}
            className="bg-white border shadow-lg w-full max-w-[794px] min-h-[1123px] p-10 md:p-14 text-black font-['Inter',sans-serif]"
          >
            {/* Invoice Header */}
            <div className="flex items-start justify-between border-b-4 border-black pb-8 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-black flex items-center justify-center p-2">
                  <img src={logoUrl} alt="Daussaurus" className="w-full h-full object-contain filter invert" />
                </div>
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Daussaurus</h1>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-[0.3em] mt-1">Creative Studio</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-black uppercase text-[#5B5FFF] tracking-tighter">INVOICE</h2>
                <p className="text-sm font-bold text-gray-800 mt-2"># {invoiceNo}</p>
                <p className="text-xs font-bold text-gray-500 mt-1">Date: {today}</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-10 flex justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Billed To:</p>
                <h3 className="text-xl font-black">{project.clientName}</h3>
                <p className="text-sm font-semibold text-gray-600 mt-1">Project: {project.projectName}</p>
                <p className="text-sm font-semibold text-gray-600">Start Date: {formatDate(project.startDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Pay To:</p>
                <h3 className="text-lg font-black">{payToName}</h3>
                <p className="text-sm font-semibold text-gray-600 mt-1">{payToEmail}</p>
                <p className="text-sm font-semibold text-gray-600">{payToBank}</p>
              </div>
            </div>

            {/* Table */}
            <table className="w-full mb-10">
              <thead>
                <tr className="border-b-4 border-black bg-gray-100">
                  <th className="py-3 px-4 text-left text-xs font-black uppercase tracking-wider">Description</th>
                  <th className="py-3 px-4 text-right text-xs font-black uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b-2 border-gray-200">
                  <td className="py-4 px-4">
                    <p className="font-bold">{project.projectName}</p>
                    <p className="text-xs text-gray-500 mt-1">{project.isRetainer ? 'Monthly Retainer Services' : 'Project Development & Delivery'}</p>
                  </td>
                  <td className="py-4 px-4 text-right font-black">{formatMoney(project.fee, project.currency)}</td>
                </tr>
                {project.amountPaid > 0 && (
                  <tr className="border-b-2 border-gray-200">
                    <td className="py-4 px-4 text-right font-bold text-gray-500">Already Paid ({paidPercent}%)</td>
                    <td className="py-4 px-4 text-right font-bold text-green-600">-{formatMoney(project.amountPaid, project.currency)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-black text-white">
                  <td className="py-4 px-4 text-right font-black uppercase tracking-wider">Total Due</td>
                  <td className="py-4 px-4 text-right text-xl font-black">{formatMoney(remaining, project.currency)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Footer */}
            <div className="mt-20 border-t-4 border-black pt-8">
              <h4 className="font-black uppercase tracking-wider mb-2 text-sm">Terms & Conditions</h4>
              <p className="text-xs text-gray-600 font-semibold max-w-xl">
                Please process payment within 14 days of receiving this invoice. 
                For any questions or revisions regarding this invoice, please contact us immediately.
                Thank you for your business!
              </p>
            </div>
            
            <div className="mt-16 text-center text-xs font-bold text-gray-400">
              <p>This is a computer-generated document. No signature is required.</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t-4 border-black flex items-center justify-end gap-3 shrink-0">
          <BrutalButton variant="default" onClick={onClose}>
            Close
          </BrutalButton>
          <BrutalButton variant="primary" onClick={handlePrint} className="bg-[#39FF14] text-black hover:bg-green-400 border-black">
            <Printer size={18} strokeWidth={2.5} />
            Download PDF
          </BrutalButton>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CLIENT PORTAL MODAL — Read-only client-facing view with print/export
// ============================================================================

const ClientPortalModal = ({ isOpen, onClose, project }) => {
  const [hasSigned, setHasSigned] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [isSigning, setIsSigning] = useState(false);

  if (!isOpen || !project) return null;

  const isSigned = !!project.eSignature || hasSigned;
  const remaining = project.fee - (project.amountPaid || 0);
  const paidPercent = project.fee > 0 ? Math.round(((project.amountPaid || 0) / project.fee) * 100) : 0;
  const milestoneIdx = getMilestoneIndex(project.status);
  const statusStyle = STATUS_STYLES[project.status] || STATUS_STYLES['None'];
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const invoiceNo = `INV-${String(project.id).padStart(4, '0')}-2026`;

  const handleSign = async (e) => {
    e.preventDefault();
    if (!signatureName.trim()) return;
    setIsSigning(true);
    try {
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, {
        eSignature: {
          name: signatureName.trim(),
          date: new Date().toISOString()
        }
      });
      setHasSigned(true);
    } catch (err) {
      console.error(err);
    }
    setIsSigning(false);
  };

  const handleFileAction = async (fileId, action) => {
    try {
      const projectRef = doc(db, 'projects', project.id);
      const updatedFiles = project.files.map(f => 
        f.id === fileId ? { ...f, status: action } : f
      );
      await updateDoc(projectRef, { files: updatedFiles });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestimonialSubmit = async (e) => {
    e.preventDefault();
    if (!testimonial.review.trim()) return;
    setIsSubmittingReview(true);
    try {
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, {
        testimonial: {
          rating: testimonial.rating,
          review: testimonial.review.trim(),
          date: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error(err);
    }
    setIsSubmittingReview(false);
  };

  /** Trigger browser print dialog (Save as PDF) */
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 print:hidden"
        onClick={onClose}
      />

      {/* Full-screen Portal Container */}
      <div className="relative w-full max-w-4xl mx-4 my-6 md:my-10 print-area">
        {/* ---- PORTAL CARD ---- */}
        <div className="bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] print:shadow-none print:border print:border-gray-300">

          {/* Portal Header — Hidden in print, replaced by formal header */}
          <div className="bg-[#5B5FFF] text-white border-b-4 border-black px-6 py-5 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 border-2 border-white/40 flex items-center justify-center">
                <ExternalLink size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide">Client Portal</h2>
                <p className="text-xs font-semibold opacity-80">Read-only project view for your client</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black border-2 border-black font-bold text-sm shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all duration-100 cursor-pointer"
              >
                <Printer size={16} strokeWidth={2.5} />
                Export / Print PDF
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 bg-white text-black border-2 border-black flex items-center justify-center font-black hover:bg-red-100 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all duration-100 cursor-pointer"
              >
                <X size={18} strokeWidth={3} />
              </button>
            </div>
          </div>

          {!isSigned ? (
            <div className="p-6 md:p-12 text-center border-t-4 border-black">
              <div className="w-20 h-20 bg-yellow-300 border-4 border-black mx-auto flex items-center justify-center mb-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
                <FileText size={40} strokeWidth={2.5} />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tight mb-3">Project Agreement</h3>
              <p className="text-gray-700 font-semibold mb-8 max-w-lg mx-auto text-sm">
                Before accessing the project portal and deliverables, please type your full name below to digitally sign and agree to the terms and conditions of this project.
              </p>
              <form onSubmit={handleSign} className="max-w-md mx-auto space-y-5">
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Type your full name..."
                  required
                  className="w-full px-5 py-4 bg-white border-4 border-black text-center font-bold text-xl focus:outline-none focus:ring-4 focus:ring-[#5B5FFF] shadow-[6px_6px_0px_rgba(0,0,0,1)]"
                />
                <button
                  type="submit"
                  disabled={isSigning}
                  className="w-full py-4 bg-[#39FF14] text-black border-4 border-black font-black text-xl uppercase tracking-widest hover:bg-green-400 active:translate-x-[4px] active:translate-y-[4px] shadow-[6px_6px_0px_rgba(0,0,0,1)] active:shadow-none transition-all disabled:opacity-50"
                >
                  {isSigning ? 'Signing...' : 'I Agree & Enter'}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-6 md:p-8 space-y-8">

            {/* Print-only Formal Header */}
            <div className="hidden print:block mb-8">
              <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] p-1 print:shadow-none">
                    <img src={logoUrl} alt="Daussaurus Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight">Daussaurus</h1>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">Project Invoice & Brief</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{invoiceNo}</p>
                  <p className="text-xs text-gray-500">Issued: {today}</p>
                </div>
              </div>
            </div>

            {/* Personalized Greeting */}
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-black leading-tight">
                Project Dashboard for{' '}
                <span className="text-[#5B5FFF] print:text-black print:underline">{project.clientName}</span>
              </h3>
              <p className="text-sm font-semibold text-gray-500 mt-1 print:text-gray-600">
                Document generated on {today}
              </p>
            </div>

            {/* Project Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Project Name */}
              <div className="bg-[#f4f4f0] border-2 border-black p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] print:shadow-none print:bg-gray-50 print:border-gray-300 print-border-clean">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} strokeWidth={2.5} className="text-gray-500" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Project Name</p>
                </div>
                <p className="text-base font-black text-black">{project.projectName}</p>
              </div>

              {/* Start Date */}
              <div className="bg-[#f4f4f0] border-2 border-black p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] print:shadow-none print:bg-gray-50 print:border-gray-300 print-border-clean">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} strokeWidth={2.5} className="text-gray-500" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Start Date</p>
                </div>
                <p className="text-base font-black text-black">{project.startDate ? formatDate(project.startDate) : '-'}</p>
              </div>

              {/* Deadline */}
              <div className="bg-[#f4f4f0] border-2 border-black p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] print:shadow-none print:bg-gray-50 print:border-gray-300 print-border-clean">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} strokeWidth={2.5} className="text-gray-500" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Deadline</p>
                </div>
                <p className="text-base font-black text-black">{project.deadline ? formatDate(project.deadline) : '-'}</p>
              </div>

              {/* Status */}
              <div className="bg-[#f4f4f0] border-2 border-black p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] print:shadow-none print:bg-gray-50 print:border-gray-300 print-border-clean">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={14} strokeWidth={2.5} className="text-gray-500" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Current Status</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-black uppercase tracking-wide border-2 border-black ${statusStyle.bg} ${statusStyle.text} shadow-[2px_2px_0px_rgba(0,0,0,1)] print:shadow-none status-badge-print`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot}`} />
                  {project.status}
                </span>
              </div>
            </div>

            {/* ---- FINANCIAL BREAKDOWN ---- */}
            <div className="border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] print:shadow-none print:border-gray-300 print-border-clean overflow-hidden">
              <div className="bg-black text-white px-5 py-3 flex items-center gap-2 print:bg-gray-800">
                <Receipt size={16} strokeWidth={2.5} />
                <h4 className="text-sm font-black uppercase tracking-wider">Financial Summary</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/20 print:divide-gray-300">
                {/* Total Fee */}
                <div className="p-5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Total Project Fee</p>
                  <p className="text-xl md:text-2xl font-black text-black">{formatMoney(project.fee, project.currency)}</p>
                </div>

                {/* Amount Paid */}
                <div className="p-5 text-center bg-[#39FF14]/10 print:bg-green-50">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Amount Paid</p>
                  <p className="text-xl md:text-2xl font-black text-green-700">
                    {formatMoney(project.amountPaid || 0, project.currency)}
                  </p>
                  <p className="text-xs font-bold text-green-600 mt-1">({paidPercent}% of total)</p>
                </div>

                {/* Remaining */}
                <div className={`p-5 text-center ${remaining > 0 ? 'bg-[#FF006E]/10 print:bg-red-50' : 'bg-[#39FF14]/10 print:bg-green-50'}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Remaining Balance</p>
                  <p className={`text-xl md:text-2xl font-black ${remaining > 0 ? 'text-[#FF006E]' : 'text-green-700'}`}>
                    {formatMoney(remaining, project.currency)}
                  </p>
                  {remaining === 0 && (
                    <p className="text-xs font-bold text-green-600 mt-1 flex items-center justify-center gap-1">
                      <CircleCheck size={12} /> Fully Paid
                    </p>
                  )}
                </div>
              </div>

              {/* Payment Progress Bar */}
              <div className="px-5 py-3 bg-[#f4f4f0] border-t border-black/10 print:bg-gray-50">
                <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-1.5">
                  <span>Payment Progress</span>
                  <span>{paidPercent}%</span>
                </div>
                <div className="h-3 bg-gray-200 border border-black/20 overflow-hidden">
                  <div
                    className="h-full bg-[#39FF14] border-r-2 border-black/30 transition-all duration-500"
                    style={{ width: `${paidPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ---- PROGRESS NOTES ---- */}
            {project.progressNotes && (
              <div className="border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] print:shadow-none print:border-gray-300 print-border-clean overflow-hidden">
                <div className="bg-[#00E5FF] px-5 py-3 flex items-center gap-2 border-b-2 border-black print:bg-cyan-50 print:border-gray-300">
                  <Pencil size={16} strokeWidth={2.5} />
                  <h4 className="text-sm font-black uppercase tracking-wider">Progress Notes</h4>
                </div>
                <div className="p-5 bg-white">
                  <p className="text-sm font-medium whitespace-pre-wrap text-gray-800">{project.progressNotes}</p>
                </div>
              </div>
            )}

            {/* ---- TO-DO LIST (SUB-TASKS) ---- */}
            {project.tasks && project.tasks.length > 0 && (
              <div className="border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] print:shadow-none print:border-gray-300 print-border-clean overflow-hidden">
                <div className="bg-[#9D4EDD] text-white px-5 py-3 flex items-center justify-between border-b-2 border-black print:bg-purple-50 print:text-black print:border-gray-300">
                  <div className="flex items-center gap-2">
                    <Check size={16} strokeWidth={2.5} />
                    <h4 className="text-sm font-black uppercase tracking-wider">Sub-Tasks</h4>
                  </div>
                  <span className="text-xs font-bold bg-black/20 px-2 py-0.5 border border-white/20 print:bg-gray-200 print:text-black">
                    {project.tasks.filter((t) => t.done).length}/{project.tasks.length} Completed
                  </span>
                </div>
                <div className="p-5 bg-white space-y-3">
                  {project.tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 border-2 border-black flex items-center justify-center shrink-0 print:border-gray-400 ${task.done ? 'bg-[#39FF14] text-black print:bg-green-100 print:text-green-700' : 'bg-gray-100'}`}>
                        {task.done && <Check size={12} strokeWidth={3} />}
                      </div>
                      <p className={`text-sm font-bold pt-0.5 ${task.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {task.text}
                      </p>
                    </div>
                  ))}
                  {/* Progress Bar for Tasks */}
                  <div className="mt-4 pt-4 border-t-2 border-black/10">
                    <div className="h-2 bg-gray-200 border-2 border-black/20 overflow-hidden print:border-gray-300">
                      <div
                        className="h-full bg-[#9D4EDD] border-r-2 border-black/30 transition-all duration-500 print:bg-purple-400"
                        style={{ width: `${Math.round((project.tasks.filter((t) => t.done).length / project.tasks.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---- ATTACHMENTS ---- */}
            {project.files && project.files.length > 0 && (
              <div className="border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] print:shadow-none print:border-gray-300 print-border-clean overflow-hidden">
                <div className="bg-[#FF006E] text-white px-5 py-3 flex items-center gap-2 border-b-2 border-black print:bg-red-50 print:text-black print:border-gray-300">
                  <Paperclip size={16} strokeWidth={2.5} />
                  <h4 className="text-sm font-black uppercase tracking-wider">Project Files</h4>
                </div>
                <div className="p-5 bg-white space-y-2">
                  {project.files.map((file) => (
                    <div key={file.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border-2 border-black bg-gray-50 hover:bg-white transition-colors print:border-gray-300 gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText size={16} className="text-[#5B5FFF] shrink-0" strokeWidth={2.5} />
                        <span className="text-sm font-bold text-gray-900 truncate">{file.name}</span>
                        {file.status === 'Approved' && (
                          <span className="text-[10px] bg-[#39FF14] border border-black font-black uppercase px-2 py-0.5">Approved</span>
                        )}
                        {file.status === 'Revision' && (
                          <span className="text-[10px] bg-[#FF006E] text-white border border-black font-black uppercase px-2 py-0.5">Needs Revision</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto no-print print:hidden">
                        <button
                          onClick={() => handleFileAction(file.id, 'Approved')}
                          title="Approve"
                          className="flex-1 sm:flex-none px-3 py-1.5 bg-[#39FF14] border-2 border-black flex items-center justify-center text-xs font-black hover:bg-green-400 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                        >
                          <Check size={14} strokeWidth={3} className="mr-1" /> ACC
                        </button>
                        <button
                          onClick={() => handleFileAction(file.id, 'Revision')}
                          title="Request Revision"
                          className="flex-1 sm:flex-none px-3 py-1.5 bg-[#FF006E] text-white border-2 border-black flex items-center justify-center text-xs font-black hover:bg-pink-600 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                        >
                          <AlertCircle size={14} strokeWidth={3} className="mr-1" /> Revisi
                        </button>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 bg-[#00E5FF] border-2 border-black flex items-center justify-center shrink-0 hover:bg-cyan-300 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                          title="Open Link"
                        >
                          <ExternalLink size={14} strokeWidth={2.5} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---- MILESTONE / CHECKLIST ---- */}
            <div className="border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] print:shadow-none print:border-gray-300 print-border-clean overflow-hidden">
              <div className="bg-yellow-300 px-5 py-3 flex items-center gap-2 border-b-2 border-black print:bg-yellow-100 print:border-gray-300">
                <FolderKanban size={16} strokeWidth={2.5} />
                <h4 className="text-sm font-black uppercase tracking-wider">Project Milestones</h4>
              </div>

              <div className="p-5">
                <div className="space-y-0">
                  {MILESTONES.map((milestone, idx) => {
                    const isCompleted = idx < milestoneIdx;
                    const isCurrent = idx === milestoneIdx && project.status !== 'Done';
                    const isPending = idx > milestoneIdx || (idx === milestoneIdx && project.status === 'Done' && idx < MILESTONES.length);

                    return (
                      <div key={milestone.key} className="flex items-stretch">
                        {/* Timeline Line + Icon */}
                        <div className="flex flex-col items-center mr-4 w-8">
                          {/* Icon */}
                          <div className="flex items-center justify-center w-8 h-8 shrink-0">
                            {isCompleted ? (
                              <div className="w-7 h-7 bg-[#39FF14] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] print:shadow-none">
                                <Check size={14} strokeWidth={3} className="text-black" />
                              </div>
                            ) : isCurrent ? (
                              <div className="w-7 h-7 bg-yellow-300 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] animate-pulse print:shadow-none print:animate-none">
                                <CircleDot size={14} strokeWidth={2.5} className="text-black" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 bg-gray-100 border-2 border-black/30 flex items-center justify-center">
                                <Circle size={14} strokeWidth={2} className="text-gray-400" />
                              </div>
                            )}
                          </div>
                          {/* Connector line */}
                          {idx < MILESTONES.length - 1 && (
                            <div className={`w-0.5 flex-1 min-h-[16px] ${
                              isCompleted ? 'bg-[#39FF14] border-x border-black/20' : 'bg-gray-200'
                            }`} />
                          )}
                        </div>

                        {/* Label */}
                        <div className={`flex items-center pb-4 ${
                          isCurrent ? 'font-black text-black' : isCompleted ? 'font-bold text-gray-700' : 'font-semibold text-gray-400'
                        }`}>
                          <div>
                            <p className={`text-sm ${isCurrent ? 'text-base' : ''}`}>
                              {milestone.label}
                            </p>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-yellow-300 border-2 border-black text-[10px] font-black uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] print:shadow-none">
                                ← Current Phase
                              </span>
                            )}
                            {isCompleted && (
                              <p className="text-[10px] font-bold text-green-600 uppercase mt-0.5">Completed</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ---- TESTIMONIAL ---- */}
            {project.status === 'Done' && remaining === 0 && (
              <div className="border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden no-print print:hidden">
                <div className="bg-[#5B5FFF] text-white px-5 py-3 flex items-center gap-2 border-b-2 border-black">
                  <Star size={16} strokeWidth={2.5} />
                  <h4 className="text-sm font-black uppercase tracking-wider">Project Feedback</h4>
                </div>
                <div className="p-5 bg-white">
                  {project.testimonial ? (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} size={18} className={star <= project.testimonial.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                        ))}
                      </div>
                      <p className="text-sm font-medium text-gray-800 italic">"{project.testimonial.review}"</p>
                      <p className="text-xs font-bold text-gray-500 mt-2">— {project.clientName}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleTestimonialSubmit} className="space-y-4">
                      <p className="text-sm font-bold">How was your experience working with us?</p>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setTestimonial(prev => ({ ...prev, rating: star }))}
                            className="focus:outline-none hover:scale-110 transition-transform"
                          >
                            <Star size={24} className={star <= testimonial.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={testimonial.review}
                        onChange={(e) => setTestimonial(prev => ({ ...prev, review: e.target.value }))}
                        placeholder="Write your review here..."
                        required
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-black text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[3px_3px_0px_rgba(0,0,0,1)]"
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="px-5 py-2.5 bg-[#39FF14] text-black border-2 border-black font-black text-sm uppercase tracking-wider hover:bg-green-400 shadow-[3px_3px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all disabled:opacity-50"
                      >
                        {isSubmittingReview ? 'Submitting...' : 'Submit Feedback'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* ---- PRINT-ONLY FOOTER ---- */}
            <div className="hidden print:block mt-8 pt-4 border-t-2 border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-600">Daussaurus — Firdaus</p>
                  <p className="text-xs text-gray-500">This document was generated automatically.</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-600">{invoiceNo}</p>
                  <p className="text-xs text-gray-500">{today}</p>
                </div>
              </div>
            </div>

            {/* ---- BOTTOM ACTIONS (Screen Only) ---- */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t-2 border-black/10 print:hidden">
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-black text-white border-2 border-black font-black text-sm uppercase tracking-wider shadow-[4px_4px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all duration-100 cursor-pointer"
              >
                <Printer size={18} strokeWidth={2.5} />
                Export Document / Print Invoice
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 bg-white text-black border-2 border-black font-bold text-sm shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all duration-100 cursor-pointer"
              >
                Close Portal
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LOGIN COMPONENT
// ============================================================================
const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f4f0] font-['Inter',sans-serif] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-md overflow-hidden">
        <div className="bg-[#5B5FFF] text-white border-b-4 border-black p-6 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-black border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,1)] p-1 overflow-hidden mb-4">
            <img src={logoUrl} alt="Daussaurus Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Daussaurus</h1>
          <p className="text-xs font-bold text-white/80 uppercase tracking-[0.2em] mt-1">
            Pro Dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-[#FF006E] text-white p-3 border-2 border-black font-bold text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-white border-2 border-black text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[3px_3px_0px_rgba(0,0,0,1)]"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-white border-2 border-black text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[3px_3px_0px_rgba(0,0,0,1)]"
            />
          </div>

          <div className="pt-2">
            <BrutalButton type="submit" variant="primary" className="w-full">
              {isRegister ? 'Create Account' : 'Login securely'}
            </BrutalButton>
          </div>

          <div className="text-center mt-4 pt-4 border-t-2 border-black/10">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs font-bold uppercase tracking-wider hover:underline text-[#5B5FFF]"
            >
              {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// DASHBOARD COMPONENT
// ============================================================================
const Dashboard = ({ user, onLogout }) => {
  // ---- Core State ----
  const [projects, setProjects] = useState([]);
  const [deletingProject, setDeletingProject] = useState(null);
  const [printingProject, setPrintingProject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [timeRangeFilter, setTimeRangeFilter] = useState('All Time');
  const [specificMonthFilter, setSpecificMonthFilter] = useState('All');

  // ---- Modal State ----
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [portalProject, setPortalProject] = useState(null);

  // ---- Firebase Sync ----
  useEffect(() => {
    const q = collection(db, 'projects');
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const projectsData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setProjects(projectsData);
    });
    return () => unsubscribe();
  }, []);

  // ---- Toast State ----
  const [toast, setToast] = useState(null);

  /** Display a temporary toast notification */
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ---- Computed Statistics ----
  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const uniqueClients = new Set(projects.map((p) => p.clientName)).size;
    
    let totalFees = 0;
    let netProfit = 0;
    const USD_RATE = 15500;

    projects.forEach((p) => {
      const rate = p.currency === 'USD' ? USD_RATE : 1;
      const feeIDR = (p.fee || 0) * rate;
      const expenseIDR = (p.expense || 0) * rate;
      totalFees += feeIDR;
      netProfit += (feeIDR - expenseIDR);
    });

    const activeProjects = projects.filter(
      (p) => p.status === 'On Progress' || p.status === 'Revisi' || p.status === 'Need to Check'
    ).length;
    return { totalProjects, uniqueClients, totalFees, netProfit, activeProjects };
  }, [projects]);

  const chartData = useMemo(() => {
    const monthlyData = {};
    const USD_RATE = 15500;
    projects.forEach(p => {
      if (!p.deadline) return;
      const date = new Date(p.deadline);
      const monthYear = date.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = { name: monthYear, Revenue: 0, NetProfit: 0 };
      }
      
      const rate = p.currency === 'USD' ? USD_RATE : 1;
      const feeIDR = (p.fee || 0) * rate;
      const expenseIDR = (p.expense || 0) * rate;
      
      monthlyData[monthYear].Revenue += feeIDR;
      monthlyData[monthYear].NetProfit += (feeIDR - expenseIDR);
    });
    // Sort by date basic
    return Object.values(monthlyData).sort((a, b) => {
      const [m1, y1] = a.name.split(' ');
      const [m2, y2] = b.name.split(' ');
      return new Date(`${m1} 1, ${y1}`) - new Date(`${m2} 1, ${y2}`);
    });
  }, [projects]);

  // ---- Available Months for Filter ----
  const availableMonths = useMemo(() => {
    const months = new Set();
    projects.forEach(p => {
      const d = p.startDate ? new Date(p.startDate) : (p.deadline ? new Date(p.deadline) : null);
      if (d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.add(`${y}-${m}`);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [projects]);

  // ---- Filtered Projects ----
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        searchQuery === '' ||
        project.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.projectName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || project.status === statusFilter;
      
      let matchesTime = true;
      const dDate = project.startDate ? new Date(project.startDate) : (project.deadline ? new Date(project.deadline) : null);
      
      if (dDate) {
        const now = new Date();
        if (specificMonthFilter !== 'All') {
          const [year, month] = specificMonthFilter.split('-');
          matchesTime = dDate.getFullYear() === parseInt(year) && (dDate.getMonth() + 1) === parseInt(month);
        } else if (timeRangeFilter !== 'All Time') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          if (timeRangeFilter === 'This Week') {
             const day = startOfToday.getDay();
             const diff = startOfToday.getDate() - day + (day === 0 ? -6:1);
             const startOfWeek = new Date(startOfToday.setDate(diff));
             matchesTime = dDate >= startOfWeek;
          } else if (timeRangeFilter === 'This Month') {
             matchesTime = dDate.getFullYear() === now.getFullYear() && dDate.getMonth() === now.getMonth();
          } else if (timeRangeFilter === 'Last 3 Months') {
             const threeMonthsAgo = new Date();
             threeMonthsAgo.setMonth(now.getMonth() - 3);
             matchesTime = dDate >= threeMonthsAgo;
          } else if (timeRangeFilter === 'Last 6 Months') {
             const sixMonthsAgo = new Date();
             sixMonthsAgo.setMonth(now.getMonth() - 6);
             matchesTime = dDate >= sixMonthsAgo;
          } else if (timeRangeFilter === 'This Year') {
             matchesTime = dDate.getFullYear() === now.getFullYear();
          }
        }
      }

      return matchesSearch && matchesStatus && matchesTime;
    });
  }, [projects, searchQuery, statusFilter, timeRangeFilter, specificMonthFilter]);

  // ---- CRUD Handlers ----

  /** CREATE — Add a new project to the list */
  const handleCreate = async (formData) => {
    try {
      await addDoc(collection(db, 'projects'), formData);
      setIsCreateOpen(false);
      showToast(`"${formData.projectName}" added successfully!`);
    } catch (e) {
      console.error("Error adding document: ", e);
      showToast("Error adding project", "danger");
    }
  };

  /** UPDATE — Replace existing project data */
  const handleUpdate = async (formData) => {
    try {
      const projectRef = doc(db, 'projects', editingProject.id);
      const { id, ...dataToUpdate } = formData;
      await updateDoc(projectRef, dataToUpdate);
      setEditingProject(null);
      showToast(`"${formData.projectName}" updated successfully!`);
    } catch (e) {
      console.error("Error updating document: ", e);
      showToast("Error updating project", "danger");
    }
  };

  /** DELETE — Remove a project from the list */
  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'projects', deletingProject.id));
      showToast(`"${deletingProject.projectName}" deleted successfully!`, 'danger');
      setDeletingProject(null);
    } catch (e) {
      console.error("Error deleting document: ", e);
      showToast("Error deleting project", "danger");
    }
  };

  /** WhatsApp Generator */
  const handleWA = (project) => {
    const remaining = (project.fee || 0) - (project.amountPaid || 0);
    const message = `Halo ${project.clientName},\n\nBerikut adalah update untuk project *${project.projectName}*.\n\nSisa tagihan: *${formatMoney(remaining, project.currency)}*\n\nAnda dapat melihat detail progres dan invoice (PDF) secara real-time melalui portal klien berikut:\n${window.location.origin}/portal/${project.id}\n\nTerima kasih!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className={`min-h-screen bg-[#f4f4f0] font-['Inter',sans-serif]`}>
      {/* ---- TOAST NOTIFICATION ---- */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] animate-bounce-in print:hidden">
          <div
            className={`flex items-center gap-2 px-5 py-3 border-2 border-black font-bold text-sm shadow-[4px_4px_0px_rgba(0,0,0,1)] ${
              toast.type === 'danger'
                ? 'bg-[#FF006E] text-white'
                : 'bg-[#39FF14] text-black'
            }`}
          >
            <Check size={16} strokeWidth={3} />
            {toast.message}
          </div>
        </div>
      )}

      {/* ---- HEADER ---- */}
      <header className="bg-white border-b-4 border-black no-print print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-black border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_rgba(0,0,0,1)] p-1 overflow-hidden">
                <img src={logoUrl} alt="Daussaurus Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-black uppercase tracking-tight">
                  Daussaurus
                </h1>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] -mt-0.5">
                  Client Dashboard
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Time Tracker */}
              <TimeTracker />

              {/* Add New Button (Header) */}
              <BrutalButton
                variant="primary"
                size="md"
                onClick={() => setIsCreateOpen(true)}
                className="hidden sm:inline-flex"
              >
                <Plus size={18} strokeWidth={2.5} />
                Add New Project
              </BrutalButton>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="w-10 h-10 md:w-12 md:h-12 bg-white text-black border-2 border-black flex items-center justify-center hover:bg-gray-100 shadow-[3px_3px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
                title="Logout"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ---- MAIN CONTENT ---- */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 no-print print:hidden">
        {/* ---- STAT CARDS ---- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard
            icon={FolderKanban}
            label="Total Projects"
            value={stats.totalProjects}
            color="bg-yellow-300"
          />
          <StatCard
            icon={Users}
            label="Total Clients"
            value={stats.uniqueClients}
            color="bg-[#00E5FF]"
          />
          <StatCard
            icon={DollarSign}
            label="Gross Fees"
            value={formatMoney(stats.totalFees, 'IDR')}
            color="bg-[#39FF14]"
          />
          <StatCard
            icon={Zap}
            label="Net Profit"
            value={formatMoney(stats.netProfit, 'IDR')}
            color="bg-[#FF006E]"
          />
          <StatCard
            icon={Check}
            label="Active Projects"
            value={stats.activeProjects}
            color="bg-[#E0AAFF]"
          />
        </div>

        {/* ---- ANALYTICS CHART ---- */}
        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex items-center gap-2 mb-4 border-b-2 border-black pb-2">
            <div className="w-8 h-8 bg-[#00E5FF] border-2 border-black flex items-center justify-center">
              <span className="font-black text-xs">Rp</span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-wider">
              Projected Revenue
            </h2>
          </div>
          
          <div className="h-[250px] w-full mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#000', fontWeight: 900 }} axisLine={{ stroke: '#000', strokeWidth: 2 }} tickLine={{ stroke: '#000', strokeWidth: 2 }} />
                  <YAxis tickFormatter={(val) => `Rp${(val/1000000).toFixed(0)}M`} tick={{ fontSize: 10, fill: '#000', fontWeight: 900 }} axisLine={{ stroke: '#000', strokeWidth: 2 }} tickLine={{ stroke: '#000', strokeWidth: 2 }} />
                  <Tooltip 
                    formatter={(value) => formatMoney(value, 'IDR')} 
                    contentStyle={{ backgroundColor: '#fff', border: '2px solid #000', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', fontWeight: 'bold', fontSize: '12px' }}
                  />
                  <Bar dataKey="Revenue" fill="#9D4EDD" stroke="#000" strokeWidth={2} name="Gross Revenue" />
                  <Bar dataKey="NetProfit" fill="#39FF14" stroke="#000" strokeWidth={2} name="Net Profit" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                <p className="text-xs font-bold uppercase">No data to display yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ---- TOOLBAR: Search + Filter ---- */}
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] p-3 md:p-4 mb-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
            {/* Search Input */}
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                strokeWidth={2.5}
              />
              <input
                type="text"
                placeholder="Search by client or project name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#f4f4f0] border-2 border-black text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B5FFF] shadow-[2px_2px_0px_rgba(0,0,0,1)]"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {['All', ...STATUS_OPTIONS].map((status) => {
                if (status === 'None') return null;
                const isActive = statusFilter === status;
                const style = status !== 'All' ? STATUS_STYLES[status] : null;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide border-2 border-black transition-all duration-100 cursor-pointer
                      ${
                        isActive
                          ? status === 'All'
                            ? 'bg-black text-white shadow-none translate-x-[2px] translate-y-[2px]'
                            : `${style?.bg} ${style?.text} shadow-none translate-x-[2px] translate-y-[2px]`
                          : 'bg-white text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px]'
                      }
                    `}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full border-t-2 border-gray-200 pt-3">
             <span className="text-xs font-black uppercase text-gray-500">Filter By Date:</span>
             <div className="relative">
                <select 
                   value={timeRangeFilter}
                   onChange={(e) => { setTimeRangeFilter(e.target.value); setSpecificMonthFilter('All'); }}
                   className="pl-3 pr-8 py-1.5 bg-white border-2 border-black text-xs font-bold cursor-pointer appearance-none shadow-[2px_2px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-[#5B5FFF]"
                >
                   <option value="All Time">All Time</option>
                   <option value="This Week">This Week</option>
                   <option value="This Month">This Month</option>
                   <option value="Last 3 Months">Last 3 Months</option>
                   <option value="Last 6 Months">Last 6 Months</option>
                   <option value="This Year">This Year</option>
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
             </div>
             
             <div className="relative">
                <select 
                   value={specificMonthFilter}
                   onChange={(e) => { setSpecificMonthFilter(e.target.value); setTimeRangeFilter('All Time'); }}
                   className="pl-3 pr-8 py-1.5 bg-white border-2 border-black text-xs font-bold cursor-pointer appearance-none shadow-[2px_2px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-[#5B5FFF]"
                >
                   <option value="All">All Months</option>
                   {availableMonths.map(ym => {
                      const [y, m] = ym.split('-');
                      const dateObj = new Date(y, parseInt(m)-1, 1);
                      const label = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                      return <option key={ym} value={ym}>{label}</option>
                   })}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
             </div>
          </div>
        </div>

        {/* ---- DATA SPREADSHEET TABLE ---- */}
        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] overflow-hidden">
          {/* Table Heading Bar */}
          <div className="bg-[#5B5FFF] text-white border-b-2 border-black px-4 md:px-6 py-3 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <FolderKanban size={16} strokeWidth={2.5} />
              Project Spreadsheet
            </h2>
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 border border-white/30">
              {filteredProjects.length} of {projects.length} entries
            </span>
          </div>

          {/* Scrollable Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#e8e8e4] border-b-2 border-black">
                  <th className="text-left text-[11px] font-black uppercase tracking-wider px-4 md:px-5 py-3 border-r border-black/10 w-8">
                    #
                  </th>
                  <th className="text-left text-[11px] font-black uppercase tracking-wider px-4 md:px-5 py-3 border-r border-black/10">
                    Client Name
                  </th>
                  <th className="text-left text-[11px] font-black uppercase tracking-wider px-4 md:px-5 py-3 border-r border-black/10">
                    Project Name
                  </th>
                  <th className="text-left text-[11px] font-black uppercase tracking-wider px-4 md:px-5 py-3 border-r border-black/10 w-28">
                    Deadline
                  </th>
                  <th className="text-left text-[11px] font-black uppercase tracking-wider px-4 md:px-5 py-3 border-r border-black/10 w-36">
                    Status
                  </th>
                  <th className="text-right text-[11px] font-black uppercase tracking-wider px-4 md:px-5 py-3 border-r border-black/10 w-40">
                    Fee / Price
                  </th>
                  <th className="text-center text-[11px] font-black uppercase tracking-wider px-4 md:px-5 py-3 w-36">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project, index) => (
                  <tr
                    key={project.id}
                    className={`border-b border-black/10 hover:bg-yellow-50 transition-colors duration-75 group ${
                      index % 2 === 0 ? 'bg-white' : 'bg-[#fafaf6]'
                    }`}
                  >
                    {/* Row Number */}
                    <td className="px-4 md:px-5 py-3 border-r border-black/10">
                      <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                    </td>

                    {/* Client Name */}
                    <td className="px-4 md:px-5 py-3 border-r border-black/10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#5B5FFF] border-2 border-black flex items-center justify-center text-[10px] font-black text-white shadow-[2px_2px_0px_rgba(0,0,0,1)] shrink-0">
                          {project.clientName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-gray-900">
                          {project.clientName}
                        </span>
                      </div>
                    </td>

                    {/* Project Name */}
                    <td className="px-4 md:px-5 py-3 border-r border-black/10">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-sm font-semibold text-gray-800">
                          {project.projectName}
                        </span>
                        {project.isRetainer && (
                          <span className="text-[9px] font-black uppercase bg-[#9D4EDD] text-white border border-black px-1 shadow-[1px_1px_0px_rgba(0,0,0,1)] flex items-center gap-0.5">
                            <Repeat size={8} strokeWidth={3} /> Retainer
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Deadline */}
                    <td className="px-4 md:px-5 py-3 border-r border-black/10">
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold text-gray-700">
                          {formatDate(project.deadline)}
                        </span>
                        {(() => {
                          const status = getDeadlineStatus(project.deadline, project.status);
                          if (status === 'overdue') return <span className="text-[10px] bg-[#FF006E] text-white border border-black px-1.5 py-0.5 mt-1 font-black uppercase shadow-[1px_1px_0px_rgba(0,0,0,1)]">Overdue</span>;
                          if (status === 'warning') return <span className="text-[10px] bg-yellow-400 border border-black px-1.5 py-0.5 mt-1 font-black uppercase shadow-[1px_1px_0px_rgba(0,0,0,1)] animate-pulse">Due Soon</span>;
                          return null;
                        })()}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 md:px-5 py-3 border-r border-black/10">
                      <StatusBadge status={project.status} />
                    </td>

                    {/* Fee */}
                    <td className="px-4 md:px-5 py-3 border-r border-black/10 text-right">
                      <span className="text-sm font-black text-gray-900 tracking-tight">
                        {formatMoney(project.fee, project.currency)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 md:px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {/* Portal / Share Button */}
                        <BrutalButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            window.open(`/portal/${project.id}`, '_blank');
                          }}
                          className="!p-2 text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700"
                          title="Share Magic Link"
                        >
                          <ExternalLink size={16} strokeWidth={2.5} />
                        </BrutalButton>

                        {/* Print Invoice Button */}
                        <button
                          onClick={() => setPrintingProject(project)}
                          title="Generate Invoice (PDF)"
                          className="w-8 h-8 bg-black text-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:bg-gray-800 transition-all duration-100 cursor-pointer"
                        >
                          <Printer size={14} strokeWidth={2.5} />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingProject(project)}
                          title="Edit Project"
                          className="w-8 h-8 bg-yellow-300 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:bg-yellow-400 transition-all duration-100 cursor-pointer"
                        >
                          <Pencil size={14} strokeWidth={2.5} />
                        </button>

                        {/* WhatsApp Button */}
                        <button
                          onClick={() => handleWA(project)}
                          title="Tagih via WhatsApp"
                          className="w-8 h-8 bg-[#39FF14] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:bg-green-400 transition-all duration-100 cursor-pointer"
                        >
                          <MessageSquare size={14} strokeWidth={2.5} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeletingProject(project)}
                          title="Delete Project"
                          className="w-8 h-8 bg-[#FF006E] text-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:bg-[#E00060] transition-all duration-100 cursor-pointer"
                        >
                          <Trash2 size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* ---- MOBILE CARD VIEW (Below md) ---- */}
        <div className="md:hidden mt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
            Swipe table ↔ or view cards below
          </p>
          {filteredProjects.map((project) => (
            <div
              key={`mobile-${project.id}`}
              className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col items-start gap-1">
                    <p className="text-sm font-black text-gray-900 truncate">
                      {project.projectName}
                    </p>
                    {project.isRetainer && (
                      <span className="text-[9px] font-black uppercase bg-[#9D4EDD] text-white border border-black px-1 shadow-[1px_1px_0px_rgba(0,0,0,1)] flex items-center gap-0.5">
                        <Repeat size={8} strokeWidth={3} /> Retainer
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-500 mt-1">
                    {project.clientName}
                  </p>
                </div>
                <StatusBadge status={project.status} />
              </div>

              <div className="flex items-center justify-between pt-3 border-t-2 border-black/10">
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400">Deadline</p>
                  <p className="text-xs font-bold flex items-center gap-2">
                    {formatDate(project.deadline)}
                    {(() => {
                      const status = getDeadlineStatus(project.deadline, project.status);
                      if (status === 'overdue') return <span className="text-[10px] bg-[#FF006E] text-white border border-black px-1 py-0.5 font-black uppercase shadow-[1px_1px_0px_rgba(0,0,0,1)]">Overdue</span>;
                      if (status === 'warning') return <span className="text-[10px] bg-yellow-400 border border-black px-1 py-0.5 font-black uppercase shadow-[1px_1px_0px_rgba(0,0,0,1)] animate-pulse">Due Soon</span>;
                      return null;
                    })()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-gray-400">Fee</p>
                  <p className="text-xs font-black">{formatMoney(project.fee, project.currency)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t-2 border-black/10">
                <BrutalButton
                  variant="default"
                  size="sm"
                  onClick={() => window.open(`/portal/${project.id}`, '_blank')}
                  className="flex-1 !bg-[#00E5FF]"
                >
                  <ExternalLink size={12} strokeWidth={2.5} />
                  Share
                </BrutalButton>
                <BrutalButton
                  variant="default"
                  size="sm"
                  onClick={() => handleWA(project)}
                  className="flex-1 !bg-[#39FF14]"
                >
                  <MessageSquare size={12} strokeWidth={2.5} />
                  WA
                </BrutalButton>
                <BrutalButton
                  variant="warning"
                  size="sm"
                  onClick={() => setEditingProject(project)}
                  className="flex-1"
                >
                  <Pencil size={12} strokeWidth={2.5} />
                  Edit
                </BrutalButton>
                <BrutalButton
                  variant="danger"
                  size="sm"
                  onClick={() => setDeletingProject(project)}
                  className="flex-1"
                >
                  <Trash2 size={12} strokeWidth={2.5} />
                  Delete
                </BrutalButton>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ---- FOOTER ---- */}
      <footer className="bg-white border-t-4 border-black mt-8 no-print print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs font-bold text-gray-500">
            © 2026 Daussaurus
          </p>
        </div>
      </footer>

      {/* ---- MODALS ---- */}

      {/* Create Modal */}
      <ProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreate}
        initialData={EMPTY_PROJECT}
        isEdit={false}
      />

      {/* Edit Modal */}
      {editingProject && (
        <ProjectModal
          key={editingProject.id}
          isOpen={true}
          onClose={() => setEditingProject(null)}
          onSave={handleUpdate}
          initialData={{
            clientName: editingProject.clientName,
            projectName: editingProject.projectName,
            startDate: editingProject.startDate || '',
            deadline: editingProject.deadline,
            status: editingProject.status,
            fee: editingProject.fee,
            progressNotes: editingProject.progressNotes || '',
            tasks: editingProject.tasks || [],
            files: editingProject.files || [],
          }}
          isEdit={true}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={deletingProject !== null}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDelete}
        projectName={deletingProject?.projectName}
      />

      {/* Invoice Generator Modal */}
      {printingProject && (
        <InvoiceModal
          project={printingProject}
          onClose={() => setPrintingProject(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// PORTAL PAGE (Public Magic Link)
// ============================================================================
const PortalPage = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'projects', projectId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setProject({ id: docSnap.id, ...docSnap.data() });
      } else {
        setProject(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching project:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  if (loading) {
    return <div className="min-h-screen bg-[#f4f4f0] flex items-center justify-center font-black uppercase text-xl">Loading...</div>;
  }

  if (!project) {
    return <div className="min-h-screen bg-[#f4f4f0] flex items-center justify-center font-black uppercase text-xl text-[#FF006E]">Project Not Found</div>;
  }

  // Render the Client Portal directly, full page
  return (
    <div className="min-h-screen bg-[#f4f4f0] print:bg-white flex justify-center py-6">
      <ClientPortalModal isOpen={true} onClose={() => {}} project={project} />
    </div>
  );
};

// ============================================================================
// MAIN APP ROUTER
// ============================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f4f0] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-black border-t-[#5B5FFF] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={user ? <Dashboard user={user} onLogout={() => signOut(auth)} /> : <Navigate to="/login" />} />
      <Route path="/portal/:projectId" element={<PortalPage />} />
    </Routes>
  );
}
