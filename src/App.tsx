import { useState } from 'react';
import { UserCheck, Users, ClipboardList, Church, LogOut, Loader2, BarChart3, FolderKanban, Calendar } from 'lucide-react';
import { useAuth } from './lib/auth';
import CheckIn from './components/CheckIn';
import ChildrenList from './components/ChildrenList';
import AttendanceHistory from './components/AttendanceHistory';
import ConditionsReport from './components/ConditionsReport';
import CategoriesManager from './components/CategoriesManager';
import RegisterChild from './components/RegisterChild';
import EventsManager from './components/EventsManager';
import EventAttendance from './components/EventAttendance';
import Login from './pages/Login';
import Register from './pages/Register';
import type { Child, ChurchEvent } from './lib/supabase';

type Tab = 'events' | 'checkin' | 'children' | 'categories' | 'history' | 'reports';
type AuthTab = 'login' | 'register';

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('events');
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [showRegister, setShowRegister] = useState(false);
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [selectedEventForAttendance, setSelectedEventForAttendance] = useState<ChurchEvent | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center">
        <Loader2 size={40} className="text-sky-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return authTab === 'login' ? (
      <Login onSwitchToRegister={() => setAuthTab('register')} />
    ) : (
      <Register onSwitchToLogin={() => setAuthTab('login')} />
    );
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'events', label: 'Eventos', icon: <Calendar size={18} /> },
    { id: 'checkin', label: 'Asistencia', icon: <UserCheck size={18} /> },
    { id: 'children', label: 'Niños', icon: <Users size={18} /> },
    { id: 'categories', label: 'Categorías', icon: <FolderKanban size={18} /> },
    { id: 'history', label: 'Historial', icon: <ClipboardList size={18} /> },
    { id: 'reports', label: 'Reportes', icon: <BarChart3 size={18} /> },
  ];

  const handleNavigateToEventAttendance = (event: ChurchEvent) => {
    setSelectedEventForAttendance(event);
    setTab('events');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Church size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight text-base">Ministerio de Niños</h1>
              <p className="text-xs text-gray-400 leading-tight">Control y Registro de Asistencia</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:inline">{user.email}</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100 sticky top-16 z-30">
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex overflow-x-auto scrollbar-none">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  if (t.id !== 'events') {
                    // Reset selected event when leaving events tab if desired, or keep it
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-3.5 text-sm font-medium border-b-2 transition-colors flex-1 justify-center whitespace-nowrap ${
                  tab === t.id
                    ? 'border-sky-500 text-sky-600 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className={`${tab === 'reports' || tab === 'categories' || tab === 'events' ? 'max-w-4xl' : 'max-w-2xl'} mx-auto px-4 py-6`}>
        {tab === 'events' && (
          selectedEventForAttendance ? (
            <EventAttendance
              event={selectedEventForAttendance}
              onBack={() => setSelectedEventForAttendance(null)}
              onEventUpdated={(updated) => setSelectedEventForAttendance(updated)}
            />
          ) : (
            <EventsManager
              onSelectEventForAttendance={(event) => setSelectedEventForAttendance(event)}
            />
          )
        )}
        {tab === 'checkin' && (
          <CheckIn
            onCheckedIn={() => setRefreshKey(k => k + 1)}
            onGoToEventAttendance={handleNavigateToEventAttendance}
          />
        )}
        {tab === 'children' && (
          <ChildrenList
            onRegister={() => { setEditChild(null); setShowRegister(true); }}
            onEdit={child => { setEditChild(child); setShowRegister(true); }}
            refreshKey={refreshKey}
          />
        )}
        {tab === 'categories' && (
          <CategoriesManager />
        )}
        {tab === 'history' && <AttendanceHistory />}
        {tab === 'reports' && <ConditionsReport />}
      </main>

      {showRegister && (
        <RegisterChild
          editChild={editChild}
          onClose={() => { setShowRegister(false); setEditChild(null); }}
          onSaved={() => {
            setShowRegister(false);
            setEditChild(null);
            setRefreshKey(k => k + 1);
          }}
        />
      )}
    </div>
  );
}
