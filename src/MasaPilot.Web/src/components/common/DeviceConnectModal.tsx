import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { api } from '../../services/api';
import {
  Smartphone,
  Wifi,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  HelpCircle,
  Apple,
  ExternalLink
} from 'lucide-react';

interface DeviceConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceConnectModal: React.FC<DeviceConnectModalProps> = ({ isOpen, onClose }) => {
  const [networkInfo, setNetworkInfo] = useState<{
    primaryIp: string;
    allLocalIps: string[];
    port: number;
    serverUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activePlatform, setActivePlatform] = useState<'all' | 'ios' | 'android'>('all');

  useEffect(() => {
    if (isOpen) {
      api.getNetworkInfo()
        .then((info) => setNetworkInfo(info))
        .catch(() => {
          // Fallback to window.location if API fails
          const origin = window.location.origin;
          setNetworkInfo({
            primaryIp: window.location.hostname,
            allLocalIps: [window.location.hostname],
            port: Number(window.location.port) || 5000,
            serverUrl: origin,
          });
        });
    }
  }, [isOpen]);

  const targetUrl = networkInfo?.serverUrl || window.location.origin;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(targetUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mobil Cihaz & Garson Terminali Bağlantısı">
      <div className="space-y-5">
        {/* Network status banner */}
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
          <Wifi className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Tek Veritabanı & Yerel Ağ (LAN) Entegrasyonu:</span>
            <div className="text-emerald-800 mt-0.5">
              İşletmedeki tüm iOS (iPhone/iPad), Android ve PC cihazlar tek bir veritabanına bağlı çalışır. İnternetiniz kesilse bile yerel Wi-Fi ağı üzerinden siparişler ve mutfak ekranı kesintisiz işlemeye devam eder.
            </div>
          </div>
        </div>

        {/* Center QR Code and Link */}
        <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-50 border border-slate-200 shrink-0">
            <img
              src={qrCodeUrl}
              alt="Mobil Bağlantı QR Kodu"
              className="w-48 h-48 rounded-xl object-contain bg-white p-2 shadow-2xs"
            />
            <span className="text-[11px] font-bold text-slate-500 mt-2 flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-burgundy-800" />
              Kamera ile Okutun
            </span>
          </div>

          {/* Connection URL and Instructions */}
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Cihaz Bağlantı Adresi
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={targetUrl}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 select-all focus:outline-hidden"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Garson veya personelin telefon kamerasını bu QR koda tutarak sisteme saniyeler içinde bağlanmasını sağlayabilirsiniz.
            </p>

            {/* Local IP Selector if multiple NICs */}
            {networkInfo && networkInfo.allLocalIps.length > 1 && (
              <div className="pt-1">
                <span className="text-[11px] text-slate-400 font-semibold">Farklı Ağ Kartları: </span>
                <span className="text-[11px] font-mono text-slate-600">
                  {networkInfo.allLocalIps.join(' | ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Setup Guide by Platform */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-burgundy-800" />
              Mobil Uygulama Olarak Kullanma (Tam Ekran PWA)
            </span>
            <div className="flex items-center gap-1 text-[11px] font-bold">
              <button
                onClick={() => setActivePlatform('ios')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  activePlatform === 'ios' ? 'bg-burgundy-800 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Apple iOS
              </button>
              <button
                onClick={() => setActivePlatform('android')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  activePlatform === 'android' ? 'bg-burgundy-800 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Android
              </button>
            </div>
          </div>

          <div className="p-4 bg-white text-xs space-y-2.5">
            {activePlatform !== 'android' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                  🍏
                </div>
                <div>
                  <div className="font-bold text-slate-900">iPhone / iPad Kurulumu:</div>
                  <div className="text-slate-600 mt-0.5 leading-relaxed">
                    Safari'de adresi açın ➔ Alttaki <strong className="text-slate-900">Paylaş (Kare + Ok)</strong> simgesine dokunun ➔ <strong className="text-slate-900">"Ana Ekrana Ekle"</strong> seçeneğini seçin. Artık cihazınızda App Store uygulaması gibi tam ekran çalışır.
                  </div>
                </div>
              </div>
            )}

            {activePlatform !== 'ios' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                  🤖
                </div>
                <div>
                  <div className="font-bold text-slate-900">Android Telefon / Tablet Kurulumu:</div>
                  <div className="text-slate-600 mt-0.5 leading-relaxed">
                    Chrome tarayıcısında açın ➔ Sağ üstteki <strong className="text-slate-900">üç noktaya</strong> dokunun ➔ <strong className="text-slate-900">"Uygulamayı Yükle"</strong> veya <strong className="text-slate-900">"Ana Ekrana Ekle"</strong> butonuna basın. Masaüstünde simge oluşur.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Close */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
};
