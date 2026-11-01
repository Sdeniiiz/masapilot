import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Shift } from '../../types';
import { Wallet, Clock, User, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ShiftsScreen: React.FC = () => {
  const [shift, setShift] = useState<Shift | null>(null);
  const [startingCash, setStartingCash] = useState<string>('500');
  const [openNotes, setOpenNotes] = useState<string>('');

  const [actualCash, setActualCash] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const loadShift = async () => {
    setIsLoading(true);
    try {
      const data = await api.getCurrentShift();
      setShift(data);
      if (data) {
        setActualCash(data.expectedCash.toString());
      }
    } catch (err) {
      console.error('Vardiya yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShift();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(startingCash);
    if (isNaN(cash) || cash < 0) return;

    try {
      await api.openShift(cash, openNotes);
      await loadShift();
    } catch (err) {
      console.error('Vardiya açılamadı:', err);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(actualCash);
    if (isNaN(cash) || cash < 0) return;

    try {
      await api.closeShift(cash, closeNotes);
      await loadShift();
    } catch (err) {
      console.error('Vardiya kapatılamadı:', err);
    }
  };

  const countedVal = parseFloat(actualCash) || 0;
  const difference = shift ? countedVal - shift.expectedCash : 0;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-100 p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Kasa & Vardiya Yönetimi</h1>
            <p className="text-xs text-slate-500 font-medium">Günlük kasa açılış/kapanış ve nakit mutabakatı</p>
          </div>
        </div>

        {/* Shift Card */}
        {shift && shift.isOpen ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-lg font-bold text-slate-900">Açık Vardiya</h2>
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Açılış: {new Date(shift.openedAtUtc).toLocaleString('tr-TR')}
              </div>
            </div>

            {/* Financial Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs font-semibold text-slate-500">Devir / Açılış Nakdi</div>
                <div className="text-xl font-black text-slate-900 mt-1">{shift.startingCash.toFixed(2)} ₺</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs font-semibold text-slate-500">Hesaplanan Nakit Satış</div>
                <div className="text-xl font-black text-emerald-600 mt-1">
                  {(shift.expectedCash - shift.startingCash).toFixed(2)} ₺
                </div>
              </div>

              <div className="p-4 rounded-xl bg-brand-50 border border-brand-200">
                <div className="text-xs font-semibold text-brand-700">Kasada Olması Gereken</div>
                <div className="text-xl font-black text-brand-900 mt-1">{shift.expectedCash.toFixed(2)} ₺</div>
              </div>
            </div>

            {/* Close Shift Form */}
            <form onSubmit={handleCloseShift} className="border-t border-slate-100 pt-6 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Vardiyayı Kapat ve Kasayı Teslim Et</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Sayılan Nakit Tutar (₺) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-black text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Fark / Mutabakat</label>
                  <div
                    className={`px-4 py-2.5 rounded-xl border font-black text-lg flex items-center justify-between ${
                      difference === 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : difference > 0
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <span>{difference.toFixed(2)} ₺</span>
                    <span className="text-xs font-bold">
                      {difference === 0 ? 'Tam Eşleşme' : difference > 0 ? 'Kasa Fazlası' : 'Kasa Açığı'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Kapanış Notu</label>
                <input
                  type="text"
                  placeholder="Opsiyonel vardiya notu..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition"
              >
                Vardiyayı Kapat ve Mutabakatı Kaydet
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <Clock className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-bold text-slate-900">Yeni Vardiya & Kasa Açılışı</h2>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Açılış / Devir Nakit Tutarı (₺) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={startingCash}
                  onChange={(e) => setStartingCash(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-black text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Kasada bulunan bozuk para ve başlangıç nakdi.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Açılış Notu</label>
                <input
                  type="text"
                  placeholder="Örn: Sabah vardiyası..."
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-600/30 transition"
              >
                Vardiyayı Aç
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
