import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Printer, PrintJob } from '../../types';
import { Printer as PrinterIcon, RotateCw, CheckCircle2, AlertTriangle, RefreshCw, FileText } from 'lucide-react';

export const PrintersScreen: React.FC = () => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [selectedJobPreview, setSelectedJobPreview] = useState<PrintJob | null>(null);

  const loadData = async () => {
    try {
      const [pList, jList] = await Promise.all([
        api.getPrinters(),
        api.getPrintJobs(),
      ]);
      setPrinters(pList);
      setJobs(jList);
    } catch (err) {
      console.error('Yazıcı verileri yüklenemedi:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReprint = async (jobId: string) => {
    try {
      await api.reprintJob(jobId);
      await loadData();
    } catch (err) {
      console.error('Tekrar basım başarısız:', err);
    }
  };

  const handleConfirmPrinted = async (jobId: string) => {
    try {
      await api.confirmJobPrinted(jobId);
      await loadData();
    } catch (err) {
      console.error('Onaylama başarısız:', err);
    }
  };

  const manualReviewJobs = jobs.filter((j) => j.status === 'ManualReview' || j.status === 'RetryableFailed');

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-100 p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md">
              <PrinterIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Yazıcı & Baskı Kuyruğu Yönetimi</h1>
              <p className="text-xs text-slate-500 font-medium">ESC/POS termal yazıcılar ve kalıcı kuyruk kontrolü</p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Yenile
          </button>
        </div>

        {/* 1. CRITICAL: MANUAL REVIEW BANNER (If any job failed / status is ambiguous) */}
        {manualReviewJobs.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                  Baskı Durumu Belirsiz / Kullanıcı Müdahalesi Gereken Fişler ({manualReviewJobs.length})
                </h3>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Yazıcıdan yanıt alınamadı veya zaman aşımı oluştu. Mükerrer kağıt israfını ve mutfakta çift siparişi önlemek için sistem otomatik olarak tekrar basmaz. Lütfen yazıcıyı kontrol edip seçiminizi yapın.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {manualReviewJobs.map((j) => (
                <div key={j.id} className="p-3.5 rounded-xl bg-white border border-amber-200 flex flex-col justify-between gap-3 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800">{j.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">
                        {j.status} ({j.attemptsCount}. deneme)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Yazıcı: {j.printerName}</div>
                    {j.lastError && <div className="text-[10px] text-rose-600 mt-0.5 font-medium">{j.lastError}</div>}
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => handleConfirmPrinted(j.id)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Fiş Çıktı (Tamamlandı)
                    </button>
                    <button
                      onClick={() => handleReprint(j.id)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1 transition"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Fiş Çıkmadı (Tekrar Bas)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Registered Printers List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-slate-800 flex items-center justify-between">
            <span>Tanımlı Yazıcılar</span>
            <span className="text-xs font-medium text-slate-500">MasaPilot Spooler Entegrasyonu</span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {printers.map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.connectionType === 'VirtualFake'
                      ? 'Sanal / Simülasyon Yazıcı'
                      : p.connectionType === 'NetworkEthernet'
                      ? `Ethernet: ${p.ipAddress}:${p.port}`
                      : `USB Sürücü: ${p.windowsDriverName}`}
                  </div>
                  <div className="text-[11px] text-brand-600 font-semibold mt-1">
                    Genişlik: {p.paperWidth} | İstasyon: {p.stationName || 'Genel / Kasa'}
                  </div>
                </div>

                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1" title="Çalışıyor" />
              </div>
            ))}
          </div>
        </div>

        {/* 3. Recent Print Jobs Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-slate-800 flex items-center justify-between">
            <span>Son Baskı İşleri Kuyruğu</span>
            <span className="text-xs text-slate-400 font-medium">Kalıcı SQLite Kuyruğu</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">İş Başlığı</th>
                  <th className="p-3.5">Yazıcı</th>
                  <th className="p-3.5">Tür</th>
                  <th className="p-3.5">Durum</th>
                  <th className="p-3.5">Zaman</th>
                  <th className="p-3.5 text-right">Eylemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-bold text-slate-800 flex items-center gap-1.5">
                      {j.isReprint && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800">
                          TEKRAR
                        </span>
                      )}
                      <span>{j.title}</span>
                    </td>
                    <td className="p-3.5 text-slate-600">{j.printerName}</td>
                    <td className="p-3.5 text-slate-500">{j.jobType}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          j.status === 'Printed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : j.status === 'Queued'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">
                      {new Date(j.createdAtUtc).toLocaleTimeString('tr-TR')}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedJobPreview(j)}
                        className="text-slate-500 hover:text-slate-800 font-semibold p-1"
                        title="ESC/POS İçeriği Gör"
                      >
                        <FileText className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleReprint(j.id)}
                        className="text-brand-600 hover:text-brand-800 font-bold text-[11px]"
                      >
                        Tekrar Bas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RAW ESC/POS Preview Modal */}
      {selectedJobPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">ESC/POS Fiş Önizlemesi</h3>
            <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-96">
              {selectedJobPreview.rawContentEscPos}
            </pre>
            <button
              onClick={() => setSelectedJobPreview(null)}
              className="w-full py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
