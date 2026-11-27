import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { formatDateTimeID, formatNumberID, formatRupiah } from '../lib/format';
import { api, formatApiError } from '../lib/api';
import type { InventoryItem, StockMovement, StockMovementType } from '../types/database';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/Toast';

interface InventoryPageProps {
  items: InventoryItem[];
  movements: StockMovement[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  items,
  movements,
  loading,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'items' | 'movements'>('items');
  const [search, setSearch] = useState('');

  // Item Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [itemCode, setItemCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Sparepart');
  const [unit, setUnit] = useState('Pcs');
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('2');
  const [buyPrice, setBuyPrice] = useState('0');
  const [sellPrice, setSellPrice] = useState('0');
  const [savingItem, setSavingItem] = useState(false);

  // Stock Movement Modal
  const [moveItem, setMoveItem] = useState<InventoryItem | null>(null);
  const [moveType, setMoveType] = useState<StockMovementType>('MASUK');
  const [moveQty, setMoveQty] = useState('1');
  const [moveNote, setMoveNote] = useState('');
  const [savingMove, setSavingMove] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const lowStockItems = useMemo(
    () => items.filter((i) => Number(i.stock) <= Number(i.min_stock)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.item_code, i.name, i.category].join(' ').toLowerCase().includes(q)
    );
  }, [items, search]);

  const openAdd = () => {
    setEditing(null);
    setItemCode(`PRT-${String(items.length + 1).padStart(3, '0')}`);
    setName('');
    setCategory('Sparepart');
    setUnit('Pcs');
    setStock('0');
    setMinStock('2');
    setBuyPrice('0');
    setSellPrice('0');
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setItemCode(item.item_code);
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setStock(String(item.stock));
    setMinStock(String(item.min_stock));
    setBuyPrice(String(item.buy_price));
    setSellPrice(String(item.sell_price));
    setModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode.trim() || !name.trim()) {
      showToast('error', 'Kode barang dan nama barang wajib diisi.');
      return;
    }

    setSavingItem(true);
    try {
      const basePayload = {
        item_code: itemCode.trim().toUpperCase(),
        name: name.trim(),
        category: category.trim() || 'Sparepart',
        unit: unit.trim() || 'Pcs',
        min_stock: Math.max(0, Number(minStock) || 0),
        buy_price: Math.max(0, Number(buyPrice) || 0),
        sell_price: Math.max(0, Number(sellPrice) || 0),
      };

      if (editing) {
        await api.updateInventoryItem(editing.id, basePayload);
        showToast('success', `Barang ${basePayload.name} berhasil diperbarui.`);
      } else {
        await api.createInventoryItem({
          ...basePayload,
          stock: Math.max(0, Number(stock) || 0),
        });
        showToast('success', `Barang ${basePayload.name} berhasil ditambahkan.`);
      }

      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menyimpan barang inventaris.'));
    } finally {
      setSavingItem(false);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveItem) return;
    const qty = Number(moveQty);
    if (Number.isNaN(qty) || qty <= 0) {
      showToast('error', 'Jumlah stok harus lebih dari 0.');
      return;
    }

    setSavingMove(true);
    try {
      await api.recordStockMovement(moveItem.id, {
        movement_type: moveType,
        quantity: qty,
        reference_note: moveNote.trim(),
        order_id: null,
      });

      showToast(
        'success',
        `Stok ${moveItem.name} (${moveType} ${qty} ${moveItem.unit}) berhasil diperbarui.`
      );
      setMoveItem(null);
      setMoveNote('');
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal mencatat pergerakan stok.'));
    } finally {
      setSavingMove(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteInventoryItem(deleteTarget.id);
      showToast('success', `Barang ${deleteTarget.name} berhasil dihapus.`);
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menghapus barang.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-900">
            <strong className="font-semibold">Peringatan Stok Menipis:</strong>{' '}
            {lowStockItems.map((i) => `${i.name} (sisa ${i.stock} ${i.unit})`).join(', ')}.
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('items')}
            className={`px-3.5 py-2 rounded-md text-xs sm:text-sm font-semibold ${
              tab === 'items' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Daftar Barang ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('movements')}
            className={`px-3.5 py-2 rounded-md text-xs sm:text-sm font-semibold ${
              tab === 'movements' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Riwayat Stok ({movements.length})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 flex-1 sm:max-w-md">
          {tab === 'items' && (
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode atau nama sparepart..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          )}
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat inventaris...
        </div>
      ) : tab === 'items' ? (
        filteredItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            Belum ada barang atau sparepart tercatat.
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="py-3 px-4 text-left font-semibold">Kode</th>
                    <th className="py-3 px-4 text-left font-semibold">Nama Barang</th>
                    <th className="py-3 px-4 text-left font-semibold">Kategori</th>
                    <th className="py-3 px-4 text-right font-semibold">Stok</th>
                    <th className="py-3 px-4 text-right font-semibold">Harga Beli</th>
                    <th className="py-3 px-4 text-right font-semibold">Harga Jual</th>
                    <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredItems.map((item) => {
                    const isLow = Number(item.stock) <= Number(item.min_stock);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">
                          {item.item_code}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          {isLow && (
                            <span className="text-[11px] font-semibold text-amber-700">
                              Stok menipis (min: {item.min_stock} {item.unit})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{item.category}</td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${
                            isLow ? 'text-amber-700' : 'text-slate-900'
                          }`}
                        >
                          {formatNumberID(item.stock)} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                          {formatRupiah(item.buy_price)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          {formatRupiah(item.sell_price)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setMoveItem(item);
                                setMoveType('MASUK');
                                setMoveQty('1');
                              }}
                              title="Stok Masuk"
                              className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50"
                            >
                              <ArrowUpCircle className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMoveItem(item);
                                setMoveType('KELUAR');
                                setMoveQty('1');
                              }}
                              title="Stok Keluar"
                              className="p-2 rounded-lg text-amber-700 hover:bg-amber-50"
                            >
                              <ArrowDownCircle className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              title="Edit"
                              className="p-2 rounded-lg text-blue-700 hover:bg-blue-50"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              title="Hapus"
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filteredItems.map((item) => {
                const isLow = Number(item.stock) <= Number(item.min_stock);
                return (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs text-slate-500">{item.item_code}</span>
                        <div className="font-bold text-slate-900">{item.name}</div>
                      </div>
                      <span
                        className={`font-mono font-bold text-sm ${
                          isLow ? 'text-amber-700' : 'text-slate-900'
                        }`}
                      >
                        {formatNumberID(item.stock)} {item.unit}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Jual: <strong className="font-mono">{formatRupiah(item.sell_price)}</strong>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setMoveItem(item);
                          setMoveType('MASUK');
                          setMoveQty('1');
                        }}
                        className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                      >
                        + Stok
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMoveItem(item);
                          setMoveType('KELUAR');
                          setMoveQty('1');
                        }}
                        className="py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                      >
                        - Stok
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : movements.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Belum ada riwayat pergerakan stok.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
          {movements.map((m) => (
            <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold ${
                      m.movement_type === 'MASUK'
                        ? 'text-emerald-700'
                        : m.movement_type === 'KELUAR'
                        ? 'text-red-700'
                        : 'text-blue-700'
                    }`}
                  >
                    {m.movement_type}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {m.inventory_items?.name || 'Barang'} ({m.inventory_items?.item_code || '-'})
                  </span>
                </div>
                {m.reference_note && <p className="text-slate-600 mt-0.5">{m.reference_note}</p>}
              </div>
              <div className="sm:text-right font-mono">
                <div className="font-bold text-slate-900">
                  {m.movement_type === 'MASUK' ? '+' : m.movement_type === 'KELUAR' ? '-' : ''}
                  {formatNumberID(m.quantity)} {m.inventory_items?.unit || ''} (Stok: {m.previous_stock} →{' '}
                  {m.new_stock})
                </div>
                <div className="text-slate-500">{formatDateTimeID(m.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Item */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-navy-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editing ? 'Edit Barang Inventaris' : 'Tambah Barang Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveItem} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Barang *
                  </label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Barang / Sparepart *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Contoh: Kapasitor 35 uF / Freon R32"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    disabled={Boolean(editing)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stok Min.</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Beli (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {savingItem ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Stock Movement */}
      {moveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-navy-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Catat Stok {moveType}</h3>
                <p className="text-xs text-slate-300">
                  {moveItem.name} (Stok saat ini: {moveItem.stock} {moveItem.unit})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoveItem(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordMovement} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe</label>
                <select
                  value={moveType}
                  onChange={(e) => setMoveType(e.target.value as StockMovementType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="MASUK">STOK MASUK (+)</option>
                  <option value="KELUAR">STOK KELUAR (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jumlah ({moveItem.unit}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan</label>
                <input
                  type="text"
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                  placeholder="Contoh: Restock supplier / Dipakai order ORD-..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setMoveItem(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingMove}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {savingMove ? 'Memproses...' : 'Simpan Pergerakan Stok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Hapus Barang ${deleteTarget?.name || ''}?`}
        description="Barang beserta riwayat pergerakan stoknya akan dihapus permanen."
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
