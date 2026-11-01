import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { DailyReport, Area } from '../../types';
import {
  DollarSign,
  ClipboardList,
  LayoutGrid,
  BookOpen,
  Tag,
  BarChart3,
  Users
} from 'lucide-react';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [activeTableCount, setActiveTableCount] = useState<number>(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [rData, areas] = await Promise.all([
          api.getDailyReport(),
          api.getAreas(),
        ]);
        setReport(rData);

        const occupied = areas
          .flatMap((a: Area) => a.tables)
          .filter((t) => t.status === 'Occupied' || t.status === 'BillRequested').length;
        setActiveTableCount(occupied);
      } catch (err) {
        console.error('Panel verileri yüklenemedi:', err);
      }
    };
    loadData();
  }, []);

  const topProduct = report?.topProducts?.[0]?.productName || 'Kıymalı Açık Pide';

  return (
    <div className="flex-1 bg-white p-6 sm:p-10 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Panel</h1>
          <p className="text-sm text-slate-500 mt-1">
            Restoran yönetim paneline hoş geldiniz. Masaları, siparişleri yönetin ve raporları görüntüleyin.
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Günlük Ciro */}
          <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-800">Günlük Ciro</div>
              <div className="text-2xl font-black text-amber-950 mt-1.5">
                ₺{(report?.grossSales || 0).toFixed(2)}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <DollarSign className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>

          {/* Toplam Sipariş */}
          <div className="p-6 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-rose-800">Toplam Sipariş</div>
              <div className="text-2xl font-black text-rose-950 mt-1.5">
                {report?.totalOrders || 0}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <ClipboardList className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>

          {/* Aktif Masa Sayısı */}
          <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-emerald-800">Aktif Masa Sayısı</div>
              <div className="text-2xl font-black text-emerald-950 mt-1.5">
                {activeTableCount}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <LayoutGrid className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>

          {/* En Çok Satan Ürün */}
          <div className="p-6 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-purple-800">En Çok Satan Ürün</div>
              <div className="text-xl font-black text-purple-950 mt-1.5 line-clamp-1">
                {topProduct}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0 ml-2">
              <BookOpen className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>
        </div>

        {/* 5 Navigation Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Masalar */}
          <button
            onClick={() => onNavigate('pos')}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md text-left transition group min-h-[160px] flex flex-col justify-between"
          >
            <LayoutGrid className="w-8 h-8 text-burgundy-800 stroke-[2] group-hover:scale-105 transition" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Masalar</h3>
              <p className="text-xs text-slate-500 mt-1">Masa durumlarını görüntüle ve yönet</p>
            </div>
          </button>

          {/* Ürünler */}
          <button
            onClick={() => onNavigate('menu-manage')}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md text-left transition group min-h-[160px] flex flex-col justify-between"
          >
            <BookOpen className="w-8 h-8 text-burgundy-800 stroke-[2] group-hover:scale-105 transition" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Ürünler</h3>
              <p className="text-xs text-slate-500 mt-1">Menü ve ürün kataloğu</p>
            </div>
          </button>

          {/* Kategoriler */}
          <button
            onClick={() => onNavigate('categories-manage')}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md text-left transition group min-h-[160px] flex flex-col justify-between"
          >
            <Tag className="w-8 h-8 text-burgundy-800 stroke-[2] group-hover:scale-105 transition" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Kategoriler</h3>
              <p className="text-xs text-slate-500 mt-1">Ürün kategorileri</p>
            </div>
          </button>

          {/* Raporlar */}
          <button
            onClick={() => onNavigate('reports')}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md text-left transition group min-h-[160px] flex flex-col justify-between"
          >
            <BarChart3 className="w-8 h-8 text-burgundy-800 stroke-[2] group-hover:scale-105 transition" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Raporlar</h3>
              <p className="text-xs text-slate-500 mt-1">Günlük ciro ve siparişler</p>
            </div>
          </button>

          {/* Kullanıcılar */}
          <button
            onClick={() => onNavigate('users-manage')}
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md text-left transition group min-h-[160px] flex flex-col justify-between"
          >
            <Users className="w-8 h-8 text-burgundy-800 stroke-[2] group-hover:scale-105 transition" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Kullanıcılar</h3>
              <p className="text-xs text-slate-500 mt-1">Kullanıcı yönetimi</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
