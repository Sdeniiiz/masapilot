import React, { useState, useEffect } from 'react';
import { NoteTemplate } from '../../types';
import { api } from '../../services/api';
import { Plus, Trash2, FileText, Loader2, MessageSquare } from 'lucide-react';
import { Modal } from '../common/Modal';

export const NoteTemplatesScreen: React.FC = () => {
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await api.getNoteTemplates();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleOpenAdd = () => {
    setTitle('');
    setContent('');
    setDisplayOrder(templates.length + 1);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSubmitting(true);
      await api.createNoteTemplate({
        title: title.trim(),
        content: content.trim() || title.trim(),
        displayOrder,
      });
      setModalOpen(false);
      fetchTemplates();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.deleteNoteTemplate(deleteConfirmId);
      setDeleteConfirmId(null);
      fetchTemplates();
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
              <FileText className="w-6 h-6 text-burgundy-800" />
              Sipariş Notu Şablonları
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Sipariş alırken garsonların tek dokunuşla ekleyebileceği hazır mutfak/bar notları.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-burgundy-800 hover:bg-burgundy-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            + Şablon Ekle
          </button>
        </div>

        {/* Templates Table matching Tıklayönet aaaa.png */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-burgundy-800" />
              <span className="text-xs font-semibold">Şablonlar yükleniyor...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30 text-burgundy-800" />
              <p className="text-sm font-semibold text-slate-600">Henüz sipariş notu şablonu bulunmuyor.</p>
              <p className="text-xs text-slate-400 mt-1">"Az Pişmiş", "Buzsuz", "Acısız" gibi sık kullanılan notları ekleyebilirsiniz.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold tracking-wider uppercase text-[11px]">
                    <th className="py-3.5 px-6">Başlık</th>
                    <th className="py-3.5 px-6">Not Metni (Mutfak Fişinde Çıkacak)</th>
                    <th className="py-3.5 px-6">Sıra</th>
                    <th className="py-3.5 px-6 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-burgundy-800" />
                          <span>{t.title}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-xs text-slate-700">
                          {t.content || t.title}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400 font-semibold">{t.displayOrder}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setDeleteConfirmId(t.id)}
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

      {/* Add Template Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Yeni Sipariş Notu Şablonu"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Şablon Başlığı *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Az Pişmiş, Buzsuz, Duble Çikolata"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Mutfak/Fiş Açıklaması</label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Fişte gözükecek detay (boş bırakılırsa başlık kullanılır)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Sıralama</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
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

      {/* Delete Confirmation In-App Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Şablonu Sil"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Bu not şablonunu silmek istediğinizden emin misiniz?
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
