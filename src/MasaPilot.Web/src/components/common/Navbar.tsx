import React, { useState } from 'react';
import { AuthUser, SystemHealth } from '../../types';
import { TiklaYonetLogo } from './TiklaYonetLogo';
import { DeviceConnectModal } from './DeviceConnectModal';
import {
  Home,
  LayoutGrid,
  BarChart2,
  Menu as MenuIcon,
  Globe,
  LogOut,
  ChevronDown,
  BookOpen,
  Tag,
  Users,
  FileText,
  Printer,
  Monitor,
  Smartphone,
  QrCode
} from 'lucide-react';

interface NavbarProps {
  user: AuthUser;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  health: SystemHealth | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  onTabChange,
  onLogout,
}) => {
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTabChange('dashboard')}
              className="flex items-center gap-2 hover:opacity-90 transition"
            >
              <TiklaYonetLogo size="sm" />
            </button>
          </div>

          {/* Center Navigation Capsule */}
          <nav className="flex items-center bg-slate-100/80 p-1 rounded-full border border-slate-200/60 shadow-inner">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-burgundy-800 shadow-sm border border-burgundy-100'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              Panel
            </button>

            <button
              onClick={() => onTabChange('pos')}
              className={`flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'pos'
                  ? 'bg-white text-burgundy-800 shadow-sm border border-burgundy-100'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Masalar
            </button>

            <button
              onClick={() => onTabChange('reports')}
              className={`flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'reports'
                  ? 'bg-white text-burgundy-800 shadow-sm border border-burgundy-100'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Raporlar
            </button>
          </nav>

          {/* Right Navigation & User Controls */}
          <div className="flex items-center gap-2.5">
            {/* Mobile / Garson QR Code Connect Button */}
            <button
              onClick={() => setIsDeviceModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition shadow-2xs"
              title="iOS ve Android Garson Telefonlarını Bağla"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">Mobil Terminal (QR)</span>
            </button>

            {/* Management Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsManagementOpen(!isManagementOpen)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
              >
                <MenuIcon className="w-3.5 h-3.5" />
                Yönetim
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isManagementOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1"
                  onClick={() => setIsManagementOpen(false)}
                >
                  <button
                    onClick={() => setIsDeviceModalOpen(true)}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/60 flex items-center gap-2.5"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    Mobil Cihaz Bağlantısı (QR)
                  </button>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    onClick={() => onTabChange('menu-manage')}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <BookOpen className="w-4 h-4 text-burgundy-800" />
                    Menü Yönetimi
                  </button>

                  <button
                    onClick={() => onTabChange('categories-manage')}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <Tag className="w-4 h-4 text-burgundy-800" />
                    Kategori Yönetimi
                  </button>

                  <button
                    onClick={() => onTabChange('users-manage')}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <Users className="w-4 h-4 text-burgundy-800" />
                    Kullanıcı Yönetimi
                  </button>

                  <button
                    onClick={() => onTabChange('note-templates')}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <FileText className="w-4 h-4 text-burgundy-800" />
                    Sipariş Notu Şablonları
                  </button>

                  <button
                    onClick={() => onTabChange('printers')}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <Printer className="w-4 h-4 text-burgundy-800" />
                    Yazıcı Ayarları
                  </button>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    onClick={() => onTabChange('kds')}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <Monitor className="w-4 h-4 text-burgundy-800" />
                    Mutfak / Bar Ekranı (KDS)
                  </button>
                </div>
              )}
            </div>

            {/* Ana Site Pill */}
            <button
              onClick={() => onTabChange('landing')}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
            >
              <Globe className="w-3.5 h-3.5" />
              Ana site
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center gap-1 px-3.5 py-1.5 rounded-full border border-slate-200 bg-slate-50/80 text-xs font-bold text-slate-800">
              <span>{user.fullName}</span>
              <span className="text-[11px] font-normal text-slate-500 ml-1">
                {user.role === 'TenantOwner' ? 'Yönetici' : user.role}
              </span>
            </div>

            {/* Logout Link */}
            <button
              onClick={onLogout}
              className="text-xs font-bold text-slate-600 hover:text-burgundy-800 ml-1 transition"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      {/* Device Connection Modal */}
      <DeviceConnectModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />
    </>
  );
};

