import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { KitchenStation } from '../../types';
import { Clock, ChefHat, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const KdsScreen: React.FC = () => {
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stationList, orderList] = await Promise.all([
        api.getKdsStations(),
        api.getKdsOrders(selectedStationId || undefined),
      ]);
      setStations(stationList);
      setOrders(orderList);
    } catch (err) {
      console.error('KDS verisi yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Polling fallback every 5s
    return () => clearInterval(interval);
  }, [selectedStationId]);

  const handleUpdateLine = async (lineId: string, currentStatus: string) => {
    const nextStatus =
      currentStatus === 'SentToKitchen' || currentStatus === 'New'
        ? 'Preparing'
        : currentStatus === 'Preparing'
        ? 'Ready'
        : 'Served';

    try {
      await api.updateKdsLineStatus(lineId, nextStatus);
      await loadData();
    } catch (err) {
      console.error('Durum güncellenemedi:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden p-4 sm:p-6">
      {/* Top Bar: Title & Station Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/30">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Mutfak & Bar Ekranı (KDS)</h1>
            <p className="text-xs text-slate-400 font-medium">Canlı sipariş takibi ve hazırlık durumu</p>
          </div>
        </div>

        {/* Station Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedStationId(null)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedStationId === null
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Tüm İstasyonlar
          </button>

          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStationId(s.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedStationId === s.id
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {s.name}
            </button>
          ))}

          <button
            onClick={loadData}
            title="Yenile"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
            <CheckCircle2 className="w-16 h-16 mb-3 text-slate-700 stroke-[1.2]" />
            <h3 className="text-lg font-bold text-slate-300">Bekleyen sipariş yok</h3>
            <p className="text-xs text-slate-500 mt-1">Yeni sipariş geldiğinde kartlar burada belirecektir.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const isUrgent = order.elapsedMinutes > 15;

              return (
                <div
                  key={order.orderId}
                  className={`flex flex-col justify-between rounded-2xl border-2 bg-slate-900/90 backdrop-blur-md overflow-hidden transition-all shadow-xl ${
                    isUrgent ? 'border-amber-500/80 shadow-amber-500/10' : 'border-slate-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className={`p-4 border-b flex items-center justify-between ${
                    isUrgent ? 'bg-amber-950/40 border-amber-500/30' : 'bg-slate-800/60 border-slate-800'
                  }`}>
                    <div>
                      <div className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        <span>{order.tableNumber}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                          {order.orderNumber}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-medium">Adisyon: {order.sessionNumber}</div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className={isUrgent ? 'text-amber-400 font-black' : ''}>{order.elapsedMinutes} dk</span>
                    </div>
                  </div>

                  {order.orderNotes && (
                    <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Sipariş Notu: {order.orderNotes}</span>
                    </div>
                  )}

                  {/* Lines List */}
                  <div className="p-4 flex-1 space-y-2.5 overflow-y-auto max-h-[340px]">
                    {order.lines.map((line: any) => {
                      const isReady = line.status === 'Ready';
                      const isPrep = line.status === 'Preparing';

                      return (
                        <div
                          key={line.lineId}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition"
                        >
                          <div className="flex-1">
                            <div className="text-base font-black text-white flex items-center gap-2">
                              <span className="text-brand-400">{line.quantity}x</span>
                              <span>{line.productName}</span>
                            </div>

                            {line.notes && (
                              <div className="text-xs font-semibold text-amber-300/90 mt-0.5">
                                Not: {line.notes}
                              </div>
                            )}

                            <span className="inline-block text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                              {line.stationName}
                            </span>
                          </div>

                          <button
                            onClick={() => handleUpdateLine(line.lineId, line.status)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 uppercase tracking-wider ${
                              isReady
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : isPrep
                                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                          >
                            {isReady ? 'Hazır' : isPrep ? 'Hazırlanıyor' : 'Yeni'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
