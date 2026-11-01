import React, { useState, useEffect } from 'react';
import { Product, Category, KitchenStation } from '../../types';
import { api } from '../../services/api';
import { Plus, Edit2, Trash2, BookOpen, Loader2, Search, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from '../common/Modal';

export const MenuManageScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(10);
  const [description, setDescription] = useState('');
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cats, prods, stns] = await Promise.all([
        api.getCategories(),
        api.getProducts(),
        api.getKdsStations(),
      ]);
      setCategories(cats);
      setProducts(prods);
      setStations(stns);
      if (cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setUnitPrice(0);
    setVatRate(10);
    setDescription('');
    setSelectedStations(stations.length > 0 ? [stations[0].id] : []);
    setModalOpen(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCategoryId(prod.categoryId);
    setUnitPrice(prod.unitPrice);
    setVatRate(prod.vatRate);
    setDescription(prod.description || '');
    setSelectedStations(prod.stationRouteIds || []);
    setModalOpen(true);
  };

  const handleToggleActive = async (prod: Product) => {
    try {
      await api.updateProduct(prod.id, {
        categoryId: prod.categoryId,
        name: prod.name,
        description: prod.description,
        unitPrice: prod.unitPrice,
        vatRate: prod.vatRate,
        isActive: !prod.isActive,
        isAvailable: prod.isAvailable,
        stationRouteIds: prod.stationRouteIds,
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;

    try {
      setSubmitting(true);
      const payload = {
        categoryId,
        name: name.trim(),
        description: description.trim(),
        unitPrice: Number(unitPrice),
        vatRate: Number(vatRate),
        isActive: true,
        isAvailable: true,
        stationRouteIds: selectedStations,
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.deleteProduct(deleteConfirmId);
      setDeleteConfirmId(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="flex-1 bg-slate-50/60 p-6 sm:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header matching Tıklayönet */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-burgundy-800" />
              Menü Yönetimi
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Ürünlerinizi, fiyatlarını, kategorilerini ve mutfak/bar yönlendirmelerini yönetin.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-burgundy-800 hover:bg-burgundy-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            + Ürün Ekle
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-burgundy-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Tümü ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === c.id
                    ? 'bg-burgundy-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ürün adı ara..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
            />
          </div>
        </div>

        {/* Products Table matching Tıklayönet exactly */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-burgundy-800" />
              <span className="text-xs font-semibold">Ürünler yükleniyor...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30 text-burgundy-800" />
              <p className="text-sm font-semibold text-slate-600">Ürün bulunamadı.</p>
              <p className="text-xs text-slate-400 mt-1">Yeni bir ürün ekleyerek başlayabilirsiniz.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold tracking-wider uppercase text-[11px]">
                    <th className="py-3.5 px-6">Ürün Adı</th>
                    <th className="py-3.5 px-6">Kategori</th>
                    <th className="py-3.5 px-6">Durum</th>
                    <th className="py-3.5 px-6">Fiyat</th>
                    <th className="py-3.5 px-6 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-4 px-6">
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                          {p.description && (
                            <div className="text-[11px] text-slate-400 line-clamp-1">{p.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs">
                          {p.categoryName || 'Genel'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {p.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200/60">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 font-bold text-[11px]">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Pasif
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {/* Amber Gold price styling matching Tıklayönet */}
                        <div className="text-amber-600 font-black text-sm tracking-tight">
                          ₺{p.unitPrice.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleActive(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
                          >
                            {p.isActive ? 'Pasif yap' : 'Aktif yap'}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            Düzenle
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(p.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Product Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Ürün Adı *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: San Sebastian Cheesecake"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Kategori *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Fiyat (TL) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">KDV Oranı (%)</label>
              <select
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
              >
                <option value={1}>%1 (Temel Gıda)</option>
                <option value={10}>%10 (Yeme-İçme Standardı)</option>
                <option value={20}>%20 (Alkol / Genel)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Mutfak/Bar İstasyonu</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {stations.map((stn) => {
                  const isChecked = selectedStations.includes(stn.id);
                  return (
                    <button
                      type="button"
                      key={stn.id}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedStations(selectedStations.filter((id) => id !== stn.id));
                        } else {
                          setSelectedStations([...selectedStations, stn.id]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        isChecked
                          ? 'bg-burgundy-800 border-burgundy-800 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {stn.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Açıklama / İçerik</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ürün içeriği, gramajı veya özel tarifi..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-burgundy-800 hover:bg-burgundy-900 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              {submitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Product In-App Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Ürünü Sil"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Bu ürünü menüden kaldırmak istediğinizden emin misiniz?
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              onClick={handleDelete}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
            >
              Evet, Sil
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
