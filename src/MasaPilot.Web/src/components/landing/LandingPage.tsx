import React, { useState } from 'react';
import { api } from '../../services/api';
import { AuthUser } from '../../types';
import {
  Home,
  Eye,
  EyeOff,
  KeyRound,
  Building,
  Sparkles,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  User,
  ArrowRight
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { TiklaYonetLogo } from '../common/TiklaYonetLogo';
import { DeviceConnectModal } from '../common/DeviceConnectModal';
import { QrCode } from 'lucide-react';

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

interface LandingPageProps {
  onAuthSuccess: (user: AuthUser) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthSuccess }) => {
  // Login states
  const [loginEmail, setLoginEmail] = useState('yonetici@masapilot.com');
  const [loginPassword, setLoginPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Alternative login mode: PIN login
  const [isPinMode, setIsPinMode] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  // Register Tenant Modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regTenantName, setRegTenantName] = useState('');
  const [regBranchName, setRegBranchName] = useState('Merkez Şube');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Info modal for "Ana site" / "İletişim" / "Hakkımızda"
  const [infoModalTitle, setInfoModalTitle] = useState<string | null>(null);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    setIsSubmitting(true);
    try {
      const res = await api.login({ email: loginEmail.trim(), password: loginPassword });
      onAuthSuccess({
        userId: res.userId,
        fullName: res.fullName,
        email: res.email,
        role: res.role,
        tenantId: res.tenantId,
        branchId: res.branchId,
        currencyCode: 'TRY',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode || pinCode.length < 4) return;

    setIsSubmitting(true);
    try {
      // Demo branch or first branch lookup
      const branchId = selectedBranchId || '47514bb6-7a54-4979-8f20-98b3854fb5c7';
      const res = await api.pinLogin(branchId, pinCode);
      onAuthSuccess({
        userId: res.userId,
        fullName: res.fullName,
        email: res.email,
        role: res.role,
        tenantId: res.tenantId,
        branchId: res.branchId,
        currencyCode: 'TRY',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regTenantName || !regFullName || !regEmail || !regPassword) return;

    setIsSubmitting(true);
    try {
      const slug = regTenantName
        .toLowerCase()
        .trim()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');

      const res = await api.register({
        tenantName: regTenantName.trim(),
        slug: slug || undefined,
        branchName: regBranchName.trim() || 'Merkez Şube',
        adminFullName: regFullName.trim(),
        adminEmail: regEmail.trim(),
        adminPassword: regPassword,
      });
      setIsRegisterModalOpen(false);
      onAuthSuccess({
        userId: res.userId,
        fullName: res.fullName,
        email: res.email,
        role: res.role,
        tenantId: res.tenantId,
        branchId: res.branchId,
        currencyCode: 'TRY',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* 1. TOP HEADER matching Ekran görüntüsü 2026-10-29 022059.png */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          {/* Left: Monitor Logo + PANEL GİRİŞİ capsule */}
          <div className="flex items-center gap-3.5">
            <TiklaYonetLogo size="sm" />
            <div className="hidden sm:inline-flex items-center px-3.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              PANEL GİRİŞİ
            </div>
          </div>

          {/* Right: Mobil QR and Ana Site Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsDeviceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 shadow-2xs transition"
              title="iOS ve Android Garson Telefonlarını Bağla"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>Garson Giriş QR Kodu</span>
            </button>

            <button
              onClick={() => setInfoModalTitle('Ana Site Tanıtımı')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition"
            >
              <Home className="w-4 h-4 text-slate-500" />
              <span>Ana site</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CENTER LOGIN CARD matching Ekran görüntüsü 2026-10-29 022059.png */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-[460px] bg-white rounded-3xl p-8 sm:p-11 shadow-xl border border-slate-100 transition-all">
          {/* Center Logo */}
          <div className="flex flex-col items-center justify-center mb-6">
            <TiklaYonetLogo size="lg" />
            <div className="text-sm font-medium text-slate-500 mt-3 text-center">
              Restoran Yönetim Sistemi
            </div>
          </div>

          {/* Switch tabs: Standart Giriş vs Hızlı PIN */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setIsPinMode(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                !isPinMode ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Yönetici / E-posta
            </button>
            <button
              type="button"
              onClick={() => setIsPinMode(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                isPinMode ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              Garson / PIN
            </button>
          </div>

          {!isPinMode ? (
            /* E-posta & Şifre Form matching screenshot exactly */
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  E-posta
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition bg-white placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Şifre
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition bg-white placeholder:text-slate-400 tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Exact Dark Navy Blue Button matching screenshot */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#1E3A5F] hover:bg-[#152B47] text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>
          ) : (
            /* Fast PIN Login Form */
            <form onSubmit={handlePinLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  4 Haneli Personel PIN Kodu
                </label>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  required
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-3 text-center tracking-[0.5em] text-2xl font-bold rounded-xl border border-slate-200 font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white"
                />
                <div className="text-[11px] text-slate-400 text-center mt-2">
                  Demo PIN: <strong className="text-slate-700 font-mono">1234</strong>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || pinCode.length < 4}
                className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? 'Doğrulanıyor...' : 'Hızlı Giriş Yap'}
              </button>
            </form>
          )}

          {/* Quick Pre-fill / Demo helper & Register link */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => {
                setLoginEmail('yonetici@masapilot.com');
                setLoginPassword('Password123!');
                setIsPinMode(false);
              }}
              className="text-slate-500 hover:text-slate-800 transition flex items-center gap-1.5 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Demo bilgilerini otomatik doldur
            </button>

            <div className="text-slate-400">
              Yeni restoran veya kafe misiniz?{' '}
              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="text-[#1E3A5F] hover:underline font-bold"
              >
                Kayıt Olun
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 3. SOLID BLACK FOOTER matching Ekran görüntüsü 2026-10-29 022059.png */}
      <footer className="bg-black text-white pt-14 pb-12 border-t border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Col 1: Brand & Links */}
          <div className="space-y-4">
            <TiklaYonetLogo size="md" lightText />
            <div className="pt-2 space-y-2.5 text-xs text-neutral-400 font-medium">
              <div>
                <button
                  onClick={() => setInfoModalTitle('İletişim')}
                  className="hover:text-white transition"
                >
                  İletişim
                </button>
              </div>
              <div>
                <button
                  onClick={() => setInfoModalTitle('Hakkımızda')}
                  className="hover:text-white transition"
                >
                  Hakkımızda
                </button>
              </div>
            </div>
          </div>

          {/* Col 2: Sosyal medya */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white tracking-wide">Sosyal medya</h4>
            <div className="pt-1">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 text-xs text-neutral-400 hover:text-white transition"
              >
                <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white">
                  <InstagramIcon className="w-4 h-4" />
                </div>
                <span>@tiklayonet</span>
              </a>
            </div>
          </div>

          {/* Col 3: Mobil uygulamalar */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white tracking-wide">Mobil uygulamalar</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              İşletmedeki tüm iPhone, iPad ve Android cihazları anında sisteme bağlayın.
            </p>
            <button
              onClick={() => setIsDeviceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-bold text-white hover:bg-neutral-800 transition"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              Mobil Bağlantı QR Kodu
            </button>
          </div>

          {/* Col 4: Mobile App Store Card Placeholder */}
          <div>
            <div
              onClick={() => setIsDeviceModalOpen(true)}
              className="p-5 rounded-2xl border border-neutral-800 bg-neutral-950/60 flex flex-col justify-center items-center text-center gap-2 cursor-pointer hover:border-neutral-700 transition"
            >
              <Smartphone className="w-6 h-6 text-emerald-400" />
              <div className="text-xs font-bold text-neutral-200">TıklaYönet Cepte</div>
              <div className="text-[11px] text-neutral-400">iOS & Android Garson Terminali (Tıkla & Bağlan)</div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 sm:px-8 mt-12 pt-6 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500">
          <div>© {new Date().getFullYear()} TıklaYönet — Tüm hakları saklıdır.</div>
          <div className="mt-2 sm:mt-0">Offline-First Güvenli Restoran & Kafe Otomasyon Platformu</div>
        </div>
      </footer>

      {/* Device Connection Modal */}
      <DeviceConnectModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />

      {/* MODAL: Yeni İşletme Kaydı (Tenant Onboarding) */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Yeni Restoran / Kafe Kaydı"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Kayıt sonrasında sisteminiz, menünüz ve masalarınız anında kullanıma hazır açılacaktır.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">İşletme / Restoran Adı *</label>
            <input
              type="text"
              required
              value={regTenantName}
              onChange={(e) => setRegTenantName(e.target.value)}
              placeholder="Örn: Galip Usta Kebap & Lahmacun"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1E3A5F] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">İlk Şube Adı</label>
            <input
              type="text"
              value={regBranchName}
              onChange={(e) => setRegBranchName(e.target.value)}
              placeholder="Merkez Şube"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1E3A5F] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Yönetici Ad Soyad *</label>
            <input
              type="text"
              required
              value={regFullName}
              onChange={(e) => setRegFullName(e.target.value)}
              placeholder="Ahmet Yılmaz"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1E3A5F] bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">E-posta Adresi *</label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="ahmet@restoran.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1E3A5F] bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Yönetici Şifresi *</label>
              <input
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="En az 6 karakter"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1E3A5F] bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#1E3A5F] hover:bg-[#152B47] text-white text-xs font-bold shadow-xs transition"
            >
              {isSubmitting ? 'Kuruluyor...' : 'Restoranı Başlat'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Info Modals (Hakkımızda / İletişim / Ana Site) */}
      <Modal
        isOpen={!!infoModalTitle}
        onClose={() => setInfoModalTitle(null)}
        title={infoModalTitle || ''}
      >
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          {infoModalTitle === 'İletişim' && (
            <div>
              <p className="font-semibold text-slate-800 mb-2">TıklaYönet Destek & Satış Ekibi</p>
              <p>E-posta: destek@tiklayonet.com</p>
              <p>Telefon: +90 (850) 555 00 24</p>
              <p className="mt-2 text-slate-500">Haftanın 7 günü 09:00 - 02:00 saatleri arasında kesintisiz restoran teknik desteği sağlanmaktadır.</p>
            </div>
          )}

          {infoModalTitle === 'Hakkımızda' && (
            <div>
              <p className="font-semibold text-slate-800 mb-2">Modern Restoran ve Kafe Otomasyonu</p>
              <p>
                TıklaYönet; internet bağlantısı kopsa dahi yerel ağda (LAN) sipariş alma, mutfak/bar ekranı (KDS), termal fiş yazdırma ve kasa işlemlerini kesintisiz sürdüren yeni nesil hibrit POS platformudur.
              </p>
            </div>
          )}

          {infoModalTitle === 'Ana Site Tanıtımı' && (
            <div>
              <p className="font-semibold text-slate-800 mb-2">TıklaYönet Restoran Yönetim Sistemi</p>
              <p>
                Tüm restoranınızı masalardan mutfağa, menüden detaylı kasa ve ciro raporlarına kadar tek ekrandan yönetin.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setInfoModalTitle(null)}
                  className="px-4 py-2 bg-[#1E3A5F] text-white rounded-xl text-xs font-bold"
                >
                  Giriş Ekranına Dön
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
