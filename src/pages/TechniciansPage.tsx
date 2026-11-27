import React, { useMemo, useState } from 'react';
import { Edit2, MessageCircle, Plus, Power, Search, Trash2, X } from 'lucide-react';
import { buildWhatsAppLink } from '../lib/format';
import { api, formatApiError } from '../lib/api';
import type { Technician } from '../types/database';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/Toast';

interface TechniciansPageProps {
  technicians: Technician[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

export const TechniciansPage: React.FC<TechniciansPageProps> = ({
  technicians,
  loading,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Technician | null>(null);

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Technician | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return technicians;
    return technicians.filter((t) =>
      [t.name, t.whatsapp, t.specialty, t.address].join(' ').toLowerCase().includes(q)
    );
  }, [technicians, search]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setWhatsapp('');
    setAddress('');
    setSpecialty('');
    setNotes('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (tech: Technician) => {
    setEditing(tech);
    setName(tech.name);
    setWhatsapp(tech.whatsapp);
    setAddress(tech.address || '');
    setSpecialty(tech.specialty || '');
    setNotes(tech.notes || '');
    setIsActive(tech.is_active);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) {
      showToast('error', 'Nama teknisi dan nomor WhatsApp wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        address: address.trim(),
        specialty: specialty.trim(),
        notes: notes.trim(),
        is_active: isActive,
      };

      if (editing) {
        await api.updateTechnician(editing.id, payload);
        showToast('success', `Data teknisi ${payload.name} berhasil diperbarui.`);
      } else {
        await api.createTechnician(payload);
        showToast('success', `Teknisi ${payload.name} berhasil ditambahkan.`);
      }

      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menyimpan data teknisi.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tech: Technician) => {
    try {
      const next = !tech.is_active;
      await api.toggleTechnician(tech.id, next);
      showToast('success', `${tech.name} sekarang berstatus ${next ? 'Aktif' : 'Nonaktif'}.`);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal mengubah status teknisi.'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteTechnician(deleteTarget.id);
      showToast('success', `Teknisi ${deleteTarget.name} berhasil dihapus.`);
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menghapus teknisi.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama teknisi, WhatsApp, atau keahlian..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
          />
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold min-h-[42px]"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Teknisi</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat data teknisi...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <p className="text-sm text-slate-600">Belum ada data teknisi.</p>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Teknisi Pertama</span>
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">Nama Teknisi</th>
                  <th className="py-3 px-4 text-left font-semibold">Nomor WhatsApp</th>
                  <th className="py-3 px-4 text-left font-semibold">Keahlian</th>
                  <th className="py-3 px-4 text-left font-semibold">Alamat</th>
                  <th className="py-3 px-4 text-left font-semibold">Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((tech) => (
                  <tr key={tech.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{tech.name}</div>
                      {tech.notes && <div className="text-xs text-slate-500">{tech.notes}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{tech.whatsapp}</td>
                    <td className="py-3 px-4 text-slate-700">{tech.specialty || '-'}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-[220px] truncate">
                      {tech.address || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-semibold ${
                          tech.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {tech.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <a
                          href={buildWhatsAppLink(tech.whatsapp, `Halo ${tech.name}, `)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Chat WhatsApp"
                          className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(tech)}
                          title={tech.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(tech)}
                          title="Edit Teknisi"
                          className="p-2 rounded-lg text-blue-700 hover:bg-blue-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tech)}
                          title="Hapus Teknisi"
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((tech) => (
              <div key={tech.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">{tech.name}</div>
                    <div className="text-xs font-mono text-slate-600">{tech.whatsapp}</div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-md border text-xs font-semibold ${
                      tech.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {tech.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  Keahlian: <strong className="text-slate-800">{tech.specialty || '-'}</strong>
                </div>
                {tech.address && <div className="text-xs text-slate-500">{tech.address}</div>}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(tech)}
                    className="py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                  >
                    {tech.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(tech)}
                    className="py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(tech)}
                    className="py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Add / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-navy-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editing ? 'Edit Data Teknisi' : 'Tambah Teknisi Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Teknisi *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Contoh: Ahmad Fauzi"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp *
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  required
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keahlian</label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Contoh: AC Split, Inverter, Cassette, Bongkar Pasang"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat tempat tinggal teknisi"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <span>Teknisi berstatus Aktif (dapat ditugaskan ke order)</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Teknisi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Hapus Teknisi ${deleteTarget?.name || ''}?`}
        description="Data teknisi akan dihapus. Order lama yang pernah ditangani tetap menyimpan nama teknisi tersebut."
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
