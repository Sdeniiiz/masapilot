import React, { useState, useEffect } from 'react';
import { UserItem } from '../../types';
import { api } from '../../services/api';
import { Plus, Trash2, Users, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { Modal } from '../common/Modal';

export const UsersManageScreen: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password123!');
  const [pin, setPin] = useState('1234');
  const [role, setRole] = useState('Waiter');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setFullName('');
    setEmail('');
    setPassword('Password123!');
    setPin('1234');
    setRole('Waiter');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    try {
      setSubmitting(true);
      await api.createUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        pin,
        role,
      });
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.deleteUser(deleteConfirmId);
      setDeleteConfirmId(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'TenantOwner':
      case 'PlatformAdmin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            Yönetici
          </span>
        );
      case 'BranchManager':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
            Şube Müdürü
          </span>
        );
      case 'Cashier':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200">
            Kasiyer
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
            Garson
          </span>
        );
    }
  };

  return (
    <div className="flex-1 bg-slate-50/60 p-6 sm:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header matching Tıklayönet */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-burgundy-800" />
              Kullanıcı Yönetimi
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              İşletmenizdeki yetkili personelleri, garsonları ve hızlı PIN girişlerini yönetin.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-burgundy-800 hover:bg-burgundy-900 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            + Kullanıcı Ekle
          </button>
        </div>

        {/* Users Table matching Tıklayönet aaa.png */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-burgundy-800" />
              <span className="text-xs font-semibold">Kullanıcılar yükleniyor...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-burgundy-800" />
              <p className="text-sm font-semibold text-slate-600">Henüz personel bulunmuyor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold tracking-wider uppercase text-[11px]">
                    <th className="py-3.5 px-6">Ad Soyad</th>
                    <th className="py-3.5 px-6">E-posta</th>
                    <th className="py-3.5 px-6">Rol</th>
                    <th className="py-3.5 px-6">Kayıt Tarihi</th>
                    <th className="py-3.5 px-6 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-burgundy-50 text-burgundy-800 flex items-center justify-center font-black text-xs border border-burgundy-200">
                            {u.fullName.substring(0, 2).toUpperCase()}
                          </div>
                          <span>{u.fullName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">{u.email}</td>
                      <td className="py-4 px-6">{getRoleBadge(u.role)}</td>
                      <td className="py-4 px-6 text-slate-400 font-medium">
                        {new Date(u.createdAtUtc).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setDeleteConfirmId(u.id)}
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

      {/* Add User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Yeni Kullanıcı Ekle"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Ad Soyad *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Örn: Ahmet Yılmaz"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">E-posta Adresi *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ahmet@masapilot.com"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Şifre *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                Hızlı Giriş PIN (4 hane)
              </label>
              <input
                type="text"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="1234"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-center tracking-widest focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Rol / Yetki *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-burgundy-800"
            >
              <option value="Waiter">Garson (Sipariş & Masa Kontrolü)</option>
              <option value="Cashier">Kasiyer (Adisyon & Tahsilat & Kasa)</option>
              <option value="BranchManager">Şube Müdürü (Raporlar & Menü)</option>
              <option value="TenantOwner">Yönetici / İşletme Sahibi (Tam Yetki)</option>
            </select>
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
        title="Kullanıcıyı Sil"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Bu personelin hesabını pasife almak istediğinizden emin misiniz?
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
