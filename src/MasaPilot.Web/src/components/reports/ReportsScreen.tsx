import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { DailyReport, AuditLog } from '../../types';
import {
  DollarSign,
  CreditCard,
  Banknote,
  ShoppingBag,
  Store,
  Users,
  Download,
  Calendar,
  RefreshCw,
  FileDown,
  ShieldCheck,
  CheckCircle,
  Clock
} from 'lucide-react';

export const ReportsScreen: React.FC = () => {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'audit'>('sales');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rData, logs] = await Promise.all([
        api.getDailyReport(dateFilter),
        api.getAuditLogs(),
      ]);
      setReport(rData);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Raporlar yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFilter]);

  const handleExportPdf = () => {
    window.print();
  };

  const cashTotal = report?.paymentBreakdown.find((p) => p.paymentMethodName.toLowerCase().includes('nakit'))?.totalAmount || 0;
  const cardTotal = report?.paymentBreakdown.find((p) => p.paymentMethodName.toLowerCase().includes('kart'))?.totalAmount || 0;
  const otherTotal = (report?.grossSales || 0) - cashTotal - cardTotal;

  return (
    <div className="flex-1 bg-slate-50/60 p-6 sm:p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header matching Tıklayönet */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-burgundy-800" />
              Satış ve Kasa Raporları
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Günlük ciro dağılımı, ödeme tipleri, sipariş sayıları ve denetim kayıtları
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 px-4 py-2 bg-burgundy-800 hover:bg-burgundy-900 text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              <FileDown className="w-4 h-4" />
              PDF İndir
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-xs transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-burgundy-800' : ''}`} />
              Yenile
            </button>
          </div>
        </div>

        {/* 6 Colored Stat Cards matching Ekran görüntüsü 202a6-10-29 015311.png */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: TOPLAM CİRO (Purple/Indigo) */}
          <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-xs relative overflow-hidden group hover:border-purple-300 transition">
            <div className="flex items-center justify-between text-purple-600 mb-2">
              <span className="text-[10px] font-black tracking-wider uppercase">Toplam Ciro</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 tracking-tight">
              ₺{report ? report.grossSales.toFixed(2) : '0.00'}
            </div>
            <div className="text-[10px] text-purple-600 font-semibold mt-1">KDV Dahil Net Gelir</div>
          </div>

          {/* Card 2: NAKİT (Emerald Green) */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition">
            <div className="flex items-center justify-between text-emerald-600 mb-2">
              <span className="text-[10px] font-black tracking-wider uppercase">Nakit</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-emerald-700 tracking-tight">
              ₺{cashTotal.toFixed(2)}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-1">Fiziki Kasa Girişi</div>
          </div>

          {/* Card 3: KREDİ KARTI (Blue) */}
          <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-xs relative overflow-hidden group hover:border-blue-300 transition">
            <div className="flex items-center justify-between text-blue-600 mb-2">
              <span className="text-[10px] font-black tracking-wider uppercase">Kredi Kartı</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-blue-700 tracking-tight">
              ₺{cardTotal.toFixed(2)}
            </div>
            <div className="text-[10px] text-blue-600 font-semibold mt-1">POS & Banka</div>
          </div>

          {/* Card 4: SİPARİŞ SAYISI (Amber/Orange) */}
          <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs relative overflow-hidden group hover:border-amber-300 transition">
            <div className="flex items-center justify-between text-amber-600 mb-2">
              <span className="text-[10px] font-black tracking-wider uppercase">Sipariş Sayısı</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-amber-700 tracking-tight">
              {report ? report.totalOrders : 0}
            </div>
            <div className="text-[10px] text-amber-600 font-semibold mt-1">Toplam Kapalı Sipariş</div>
          </div>

          {/* Card 5: GEL-AL (Cyan/Teal) */}
          <div className="bg-white rounded-2xl p-4 border border-teal-100 shadow-xs relative overflow-hidden group hover:border-teal-300 transition">
            <div className="flex items-center justify-between text-teal-600 mb-2">
              <span className="text-[10px] font-black tracking-wider uppercase">Gel-Al</span>
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                <Store className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-teal-700 tracking-tight">
              0
            </div>
            <div className="text-[10px] text-teal-600 font-semibold mt-1">Paket Sipariş</div>
          </div>

          {/* Card 6: MASA (Rose/Pink) */}
          <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs relative overflow-hidden group hover:border-rose-300 transition">
            <div className="flex items-center justify-between text-rose-600 mb-2">
              <span className="text-[10px] font-black tracking-wider uppercase">Masa</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-rose-700 tracking-tight">
              {report ? report.totalOrders : 0}
            </div>
            <div className="text-[10px] text-rose-600 font-semibold mt-1">Salonda Hizmet</div>
          </div>
        </div>

        {/* Date Filter & Tab Selector */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('sales')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeSubTab === 'sales'
                  ? 'bg-burgundy-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Satış & Tahsilat Detayları
            </button>
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeSubTab === 'audit'
                  ? 'bg-burgundy-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Güvenlik Denetim Günlüğü (Audit)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-hidden"
              />
            </div>
            <button
              onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
            >
              Bugün
            </button>
          </div>
        </div>

        {/* Content depending on subtab */}
        {activeSubTab === 'sales' ? (
          <div className="space-y-6">
            {/* Top Categories and Products Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Categories */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center justify-between">
                  <span>Kategori Dağılımı</span>
                  <span className="text-xs font-normal text-slate-400">Ürün bazında</span>
                </h3>
                {report?.categoryBreakdown && report.categoryBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {report.categoryBreakdown.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                        <span className="font-semibold text-slate-700">{cat.categoryName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{cat.quantity} adet</span>
                          <span className="font-black text-slate-900">₺{cat.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-6 text-center">Bu tarihte kategori verisi bulunamadı.</div>
                )}
              </div>

              {/* Top Products */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center justify-between">
                  <span>En Çok Satan Ürünler</span>
                  <span className="text-xs font-normal text-slate-400">Adet bazında</span>
                </h3>
                {report?.topProducts && report.topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {report.topProducts.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                        <span className="font-semibold text-slate-700">{p.productName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{p.quantity} sipariş</span>
                          <span className="font-black text-amber-600">₺{p.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-6 text-center">Bu tarihte ürün satışı kaydedilmemiş.</div>
                )}
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 mb-4">Ödeme Yöntemi Dağılımı</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {report?.paymentBreakdown.map((pm, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-700">{pm.paymentMethodName}</div>
                      <div className="text-[11px] text-slate-400">{pm.transactionCount} işlem</div>
                    </div>
                    <div className="text-sm font-black text-slate-900">
                      ₺{pm.totalAmount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Audit Logs Table */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Yetkili İşlem ve Güvenlik Denetim Günlüğü
              </div>
              <span className="text-[11px] text-slate-400">{auditLogs.length} kayıt listelendi</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200/80 text-slate-500 font-bold tracking-wider uppercase text-[11px]">
                    <th className="py-3 px-6">Tarih / Saat</th>
                    <th className="py-3 px-6">İşlem (Aksiyon)</th>
                    <th className="py-3 px-6">İlgili Varlık</th>
                    <th className="py-3 px-6">Detaylar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-6 text-slate-500 font-medium whitespace-nowrap">
                        {new Date(log.createdAtUtc).toLocaleString('tr-TR')}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md text-[11px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 font-semibold">{log.entityName}</td>
                      <td className="py-3.5 px-6 text-slate-500 font-mono text-[11px] truncate max-w-xs">
                        {log.detailsJson}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Kayıt bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
