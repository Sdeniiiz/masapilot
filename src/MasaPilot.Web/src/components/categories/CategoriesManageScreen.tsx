import React, { useState, useEffect } from 'react';
import { Category } from '../../types';
import { api } from '../../services/api';
import { Plus, Edit2, Trash2, Tag, Loader2, ArrowUpDown } from 'lucide-react';
import { Modal } from '../common/Modal';

export const CategoriesManageScreen: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [colorHex, setColorHex] = useState('#7C1C1D');
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await api.getCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setDisplayOrder(categories.length + 1);
    setColorHex('#7C1C1D');
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDisplayOrder(cat.displayOrder);
    setColorHex(cat.colorHex || '#7C1C1D');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, { name: name.trim(), displayOrder, colorHex });
      } else {
        await api.createCategory({ name: name.trim(), displayOrder, colorHex });
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.deleteCategory(deleteConfirmId);
      setDeleteConfirmId(null);
      fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 bg-slate-50/60 p-6 sm:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header matching Tıklayönet */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Tag className="w-6 h-6 text-burgundy-800" />
              Kategori Yönetimi
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Menü ürünlerinizin gruplanacağı kategorileri ekleyin, düzenleyin ve sıralayın.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-burgundy-800 hover:bg-burgundy-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            + Kategori Ekle
          </button>
        </div>

        {/* Content Card / Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-burgundy-800" />
              <span className="text-xs font-semibold">Kategoriler yükleniyor...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-30 text-burgundy-800" />
              <p className="text-sm font-semibold text-slate-600">Henüz kategori bulunmuyor.</p>
              <p className="text-xs text-slate-400 mt-1">Yukarıdaki butonla ilk kategorinizi oluşturabilirsiniz.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold tracking-wider uppercase text-[11px]">
                    <th className="py-3.5 px-6">Kategori Adı</th>
                    <th className="py-3.5 px-6">Sıralama</th>
                    <th className="py-3.5 px-6">Ürün Sayısı</th>
                    <th className="py-3.5 px-6 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-100 shadow-xs"
                            style={{ backgroundColor: cat.colorHex || '#7C1C1D' }}
                          />
                          <span className="font-bold text-slate-800 text-sm">{cat.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md text-slate-600">
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          <span>{cat.displayOrder}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-semibold">
                        {cat.productCount} ürün
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            Düzenle
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(cat.id)}
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

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Kategori Adı *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Tatlılar, İçecekler, Sıcak Kahveler"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Görüntüleme Sırası</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Renk Teması</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="w-10 h-10 p-0.5 rounded-lg border border-slate-200 cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-600">{colorHex}</span>
              </div>
            </div>
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

      {/* Delete Confirmation In-App Modal (Zero native alert/confirm) */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Kategoriyi Sil"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Bu kategoriyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
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
