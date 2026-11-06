import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { signalRManager } from './services/signalr';
import { AuthUser, SystemHealth } from './types';
import { ToastContainer, ToastItem } from './components/common/Toast';
import { Navbar } from './components/common/Navbar';
import { LandingPage } from './components/landing/LandingPage';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { PosScreen } from './components/pos/PosScreen';
import { KdsScreen } from './components/kds/KdsScreen';
import { PrintersScreen } from './components/printers/PrintersScreen';
import { ShiftsScreen } from './components/shifts/ShiftsScreen';
import { ReportsScreen } from './components/reports/ReportsScreen';
import { MenuManageScreen } from './components/menu/MenuManageScreen';
import { CategoriesManageScreen } from './components/categories/CategoriesManageScreen';
import { UsersManageScreen } from './components/users/UsersManageScreen';
import { NoteTemplatesScreen } from './components/notes/NoteTemplatesScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Toast listener hookup
  useEffect(() => {
    api.setToastListener((type, message) => {
      const id = `${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message }]);

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    });
  }, []);

  // Check existing session
  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getToken();
      if (!token) {
        setIsLoadingAuth(false);
        return;
      }

      try {
        const me = await api.getMe();
        setUser(me);
        if (me.branchId) {
          signalRManager.init(me.branchId);
        }
      } catch (err) {
        api.setToken(null);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Poll Health
  useEffect(() => {
    if (!user) return;

    const checkHealth = async () => {
      try {
        const h = await api.getHealth();
        setHealth(h);
      } catch (err) {
        console.warn('Sağlık kontrolü başarısız:', err);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
    setActiveTab('pos');
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-burgundy-800 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm font-semibold text-slate-300">MasaPilot Başlatılıyor...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-slate-100">
        {/* In-App Toast Container (Zero native alert/prompt/confirm) */}
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

        {!user ? (
          <LandingPage onAuthSuccess={(newUser) => setUser(newUser)} />
        ) : (
          <>
            <Navbar
              user={user}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onLogout={handleLogout}
              health={health}
            />

            <main className="flex-1 flex flex-col overflow-hidden">
              {activeTab === 'dashboard' && <DashboardScreen onNavigate={setActiveTab} />}
              {activeTab === 'pos' && <PosScreen />}
              {activeTab === 'reports' && <ReportsScreen />}
              {activeTab === 'menu-manage' && <MenuManageScreen />}
              {activeTab === 'categories-manage' && <CategoriesManageScreen />}
              {activeTab === 'users-manage' && <UsersManageScreen />}
              {activeTab === 'note-templates' && <NoteTemplatesScreen />}
              {activeTab === 'printers' && <PrintersScreen />}
              {activeTab === 'kds' && <KdsScreen />}
              {activeTab === 'shifts' && <ShiftsScreen />}
              {activeTab === 'landing' && (
                <div className="flex-1 overflow-y-auto">
                  <LandingPage onAuthSuccess={() => {}} />
                </div>
              )}
            </main>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
