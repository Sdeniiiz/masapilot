import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { Area, DiningTable, Category, Product, SessionDetail, CartLine, PaymentMethod } from '../../types';
import {
  Search,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRightLeft,
  MoreHorizontal,
  Printer as PrinterIcon,
  ShoppingBag,
  Pencil,
  X,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface PosScreenProps {
  onSessionChange?: () => void;
}

export const PosScreen: React.FC<PosScreenProps> = () => {
  // State
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>('all');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [activeSession, setActiveSession] = useState<SessionDetail | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Unsent Cart
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [lineToVoidId, setLineToVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // New Table Modal
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableAreaId, setNewTableAreaId] = useState<string>('');

  // Move Table Modal
  const [isMoveTableModalOpen, setIsMoveTableModalOpen] = useState(false);
  const [targetTableId, setTargetTableId] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Compute suggested next table number based on selected area
  const suggestedTableNumber = useMemo(() => {
    if (!newTableAreaId) return 'S1';
    const area = areas.find((a) => a.id === newTableAreaId);
    if (!area) return 'S1';

    const prefix = area.name.trim().charAt(0).toUpperCase();
    const numbers = area.tables
      .map((t) => {
        const match = t.tableNumber.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => n > 0);

    const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `${prefix}${nextNum}`;
  }, [areas, newTableAreaId]);

  const handleTransferTable = async () => {
    if (!activeSession || !targetTableId) return;
    try {
      setIsSubmittingTransfer(true);
      const updated = await api.transferSession(activeSession.id, targetTableId);
      setIsMoveTableModalOpen(false);

      // Reload tables and select the new target table
      const areaList = await api.getAreas();
      setAreas(areaList);
      const allTables = areaList.flatMap((a) => a.tables);
      const newTable = allTables.find((t) => t.id === targetTableId);
      if (newTable) {
        setSelectedTable(newTable);
        setActiveSession(updated);
      }
      setTargetTableId('');
    } catch (err) {
      console.error('Masa transferi başarısız:', err);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Load Data
  const loadTables = async () => {
    try {
      const areaList = await api.getAreas();
      setAreas(areaList);
      if (areaList.length > 0 && !newTableAreaId) {
        setNewTableAreaId(areaList[0].id);
      }
    } catch (err) {
      console.error('Masalar yüklenemedi:', err);
    }
  };

  const loadMenu = async () => {
    try {
      const [cats, prods, payMethods] = await Promise.all([
        api.getCategories(),
        api.getProducts(),
        api.getPaymentMethods(),
      ]);
      setCategories(cats);
      setProducts(prods);
      setPaymentMethods(payMethods);
      if (cats.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(cats[0].id);
      }
      if (payMethods.length > 0) {
        setSelectedPaymentMethodId(payMethods[0].id);
      }
    } catch (err) {
      console.error('Menü yüklenemedi:', err);
    }
  };

  useEffect(() => {
    loadTables();
    loadMenu();
  }, []);

  // Table selection
  const handleSelectTable = async (table: DiningTable) => {
    setSelectedTable(table);
    setCart([]);
    try {
      const session = await api.openSession(table.id);
      setActiveSession(session);
      await loadTables();
    } catch (err) {
      console.error('Adisyon açılamadı:', err);
    }
  };

  const handleBackToTables = () => {
    setSelectedTable(null);
    setActiveSession(null);
    setCart([]);
    loadTables();
  };

  // Cart operations
  const handleAddToCart = (product: Product) => {
    if (!product.isAvailable) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: product.unitPrice,
          quantity: 1,
        },
      ];
    });
  };

  const handleUpdateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartLine[];
    });
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Product quantity in cart
  const getProductCartCount = (productId: string) => {
    const item = cart.find((c) => c.productId === productId);
    return item ? item.quantity : 0;
  };

  // Send Order to Kitchen ("Tamam" or "Mutfağa Gönder")
  const handleSendToKitchen = async () => {
    if (!activeSession || cart.length === 0 || isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    try {
      const idempotencyKey = `order_${activeSession.id}_${Date.now()}`;
      const updatedSession = await api.addOrder(
        activeSession.id,
        cart.map((c) => ({ productId: c.productId, quantity: c.quantity, notes: c.notes })),
        idempotencyKey
      );
      setActiveSession(updatedSession);
      setCart([]);
      await loadTables();
    } catch (err) {
      console.error('Sipariş gönderilemedi:', err);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Print Pre-Receipt ("Yazdır")
  const handlePrintPreReceipt = async () => {
    if (!activeSession) return;
    try {
      await api.printPreReceipt(activeSession.id);
      await loadTables();
    } catch (err) {
      console.error('Ön hesap basılamadı:', err);
    }
  };

  // Void line
  const handleOpenVoidModal = (lineId: string) => {
    setLineToVoidId(lineId);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!activeSession || !lineToVoidId || !voidReason.trim()) return;
    try {
      const updatedSession = await api.voidLine(activeSession.id, lineToVoidId, voidReason);
      setActiveSession(updatedSession);
      setIsVoidModalOpen(false);
      setLineToVoidId(null);
      await loadTables();
    } catch (err) {
      console.error('İptal yapılamadı:', err);
    }
  };

  // Payment
  const handleOpenPaymentModal = () => {
    if (!activeSession) return;
    setPaymentAmount(activeSession.remainingTotal.toFixed(2));
    setIsPaymentModalOpen(true);
  };

  const handleProcessPayment = async () => {
    if (!activeSession || !selectedPaymentMethodId) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const idempotencyKey = `pay_${activeSession.id}_${Date.now()}`;
      const updatedSession = await api.addPayment(
        activeSession.id,
        selectedPaymentMethodId,
        amount,
        0,
        idempotencyKey
      );

      setIsPaymentModalOpen(false);
      setActiveSession(updatedSession);

      if (updatedSession.status === 'Closed') {
        handleBackToTables();
      } else {
        await loadTables();
      }
    } catch (err) {
      console.error('Ödeme işlemi başarısız:', err);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        !selectedCategoryId || selectedCategoryId === 'all'
          ? true
          : p.categoryId === selectedCategoryId;
      const matchesSearch = productSearch
        ? p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(productSearch.toLowerCase()))
        : true;
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, productSearch]);

  // Tables to display based on area filter (sorted naturally by number)
  const displayedTables = useMemo(() => {
    let list: DiningTable[] = [];
    if (selectedAreaId === 'all') {
      list = areas.flatMap((a) => a.tables);
    } else {
      const area = areas.find((a) => a.id === selectedAreaId);
      list = area ? area.tables : [];
    }
    return [...list].sort((a, b) =>
      a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [areas, selectedAreaId]);

  const activeCategory =
    selectedCategoryId === 'all'
      ? { id: 'all', name: 'Tüm Ürünler' }
      : categories.find((c) => c.id === selectedCategoryId);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const totalAmount = (activeSession?.grandTotal || 0) + cartTotal;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* 1. TABLES VIEW (When no table is selected) */}
      {!selectedTable && (
        <div className="flex-1 flex flex-col p-6 sm:p-10 max-w-[1600px] mx-auto w-full overflow-y-auto">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Masalar</h1>
              <p className="text-sm text-slate-500 mt-1">
                Bir masaya tıklayarak sipariş oluşturun veya yönetin. Yönetici olarak masa ekleyebilir, düzenleyebilir veya silebilirsiniz.
              </p>
            </div>

            <button
              onClick={() => setIsNewTableModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-burgundy-800 hover:bg-burgundy-900 text-white font-bold text-xs shadow-md shadow-burgundy-800/20 flex items-center gap-1.5 self-start sm:self-auto transition"
            >
              + Masa Ekle
            </button>
          </div>

          {/* Subheader: Category Header */}
          <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-200 mb-6">
            <span>KATEGORİLER</span>
            <span className="text-burgundy-700 font-bold lowercase">Yönet</span>
            <span className="text-slate-800 font-black ml-auto">
              {selectedAreaId === 'all'
                ? 'TÜMÜ'
                : areas.find((a) => a.id === selectedAreaId)?.name.toUpperCase()}
            </span>
          </div>

          {/* Main Tables Grid with Left Side Categories */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Left Area Tabs */}
            <div className="w-full md:w-44 flex md:flex-col gap-2 shrink-0 overflow-x-auto pb-2 md:pb-0">
              <button
                onClick={() => setSelectedAreaId('all')}
                className={`w-full text-left px-5 py-3 rounded-2xl text-xs font-bold transition-all border ${
                  selectedAreaId === 'all'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Tümü
              </button>

              {areas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`w-full text-left px-5 py-3 rounded-2xl text-xs font-bold transition-all border ${
                    selectedAreaId === area.id
                      ? 'bg-rose-50/70 border-rose-200 text-rose-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {area.name.toLowerCase()}
                </button>
              ))}
            </div>

            {/* Tables Grid */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full">
              {displayedTables.map((table) => {
                const isOccupied = table.status === 'Occupied';
                const isBillReq = table.status === 'BillRequested';

                return (
                  <button
                    key={table.id}
                    onClick={() => handleSelectTable(table)}
                    className="relative bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-md p-5 flex flex-col items-center justify-between min-h-[160px] text-center transition group active:scale-[0.98]"
                  >
                    {/* Top Right Options */}
                    <div className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-700 p-1">
                      <MoreHorizontal className="w-4 h-4" />
                    </div>

                    {/* Status Dot */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold mt-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isBillReq
                            ? 'bg-amber-500'
                            : isOccupied
                            ? 'bg-rose-600'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <span
                        className={
                          isBillReq
                            ? 'text-amber-800'
                            : isOccupied
                            ? 'text-rose-800'
                            : 'text-slate-600'
                        }
                      >
                        {isBillReq ? 'Hesap İstendi' : isOccupied ? 'Dolu' : 'Boş'}
                      </span>
                    </div>

                    {/* Big Table Number */}
                    <div className="text-4xl font-extrabold text-slate-900 tracking-tight my-2">
                      {table.tableNumber}
                    </div>

                    {/* Active Bill Balance if any */}
                    <div className="text-xs font-bold text-slate-400">
                      {table.activeSessionTotal !== undefined && table.activeSessionTotal !== null ? (
                        <span className="text-slate-900 font-extrabold">
                          ₺{table.activeSessionTotal.toFixed(2)}
                        </span>
                      ) : (
                        <span>&nbsp;</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. ORDER & POS VIEW (When a table is selected) */}
      {selectedTable && (
        <div className="flex-1 flex flex-col p-6 max-w-[1600px] mx-auto w-full overflow-hidden">
          {/* Top Breadcrumb Links & Table Title */}
          <div className="mb-6 shrink-0">
            <div className="flex items-center gap-4 text-xs font-bold text-burgundy-800 mb-2">
              <button
                onClick={handleBackToTables}
                className="flex items-center gap-1 hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Masalara dön
              </button>

              <button
                onClick={() => setIsMoveTableModalOpen(true)}
                className="flex items-center gap-1 hover:underline"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Masaya taşı
              </button>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Sipariş – Masa {selectedTable.tableNumber}
            </h1>
          </div>

          {/* 3 Column Layout: Categories | Products Grid | Cart Summary */}
          <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
            {/* Column 1: Categories List */}
            <div className="w-full lg:w-56 bg-white rounded-2xl border border-slate-200/90 p-3 flex flex-col shrink-0 shadow-xs">
              <div className="text-xs font-bold text-slate-700 px-3 py-2 mb-1">Kategoriler</div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {/* All products button */}
                <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                    selectedCategoryId === 'all'
                      ? 'bg-burgundy-800 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>Tüm Ürünler</span>
                  <span className="text-[10px] opacity-75 font-normal">({products.length})</span>
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                      selectedCategoryId === cat.id
                        ? 'bg-burgundy-800 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-[10px] opacity-75 font-normal">
                      ({products.filter((p) => p.categoryId === cat.id).length})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Column 2: Products Grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Category Title & Search */}
              <div className="flex items-center justify-between gap-4 mb-3 shrink-0">
                <h2 className="text-base font-bold text-slate-900">
                  {activeCategory?.name || 'Ürünler'}
                </h2>

                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ürün ara..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-burgundy-800 shadow-xs"
                  />
                </div>
              </div>

              {/* Product Cards */}
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3.5">
                  {filteredProducts.map((p) => {
                    const cartCount = getProductCartCount(p.id);

                    return (
                      <div
                        key={p.id}
                        className="relative bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs hover:border-slate-300 transition min-h-[140px]"
                      >
                        {/* Red Badge if item is in cart */}
                        {cartCount > 0 && (
                          <span className="absolute top-3 right-3 text-xs font-black text-rose-600">
                            {cartCount}
                          </span>
                        )}

                        <div>
                          <div className="text-sm font-bold text-slate-900 leading-snug pr-4">
                            {p.name}
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-bold text-amber-600">
                              ₺{p.unitPrice.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                              1,5
                            </span>
                          </div>
                        </div>

                        {/* Minus / Count / Plus Controls */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs font-bold text-slate-700">
                          <button
                            onClick={() => handleUpdateCartQuantity(p.id, -1)}
                            disabled={cartCount === 0}
                            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <span className="text-sm font-black text-slate-900">
                            {cartCount}
                          </span>

                          <button
                            onClick={() => handleAddToCart(p)}
                            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Column 3: Cart / Sepet */}
            <div className="w-full lg:w-96 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col shrink-0 shadow-xs">
              {/* Cart Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <h3 className="text-base font-bold text-slate-900">Sepet</h3>
                <div className="flex items-center gap-3 text-xs font-semibold text-rose-600">
                  {cart.length > 0 && (
                    <button onClick={handleClearCart} className="hover:underline">
                      Tümünü sil
                    </button>
                  )}
                  <span className="cursor-pointer hover:underline">Sipariş detayı</span>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {/* 1. Unsent items in cart */}
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="p-3.5 rounded-2xl border border-slate-200/90 bg-white shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs">{item.productName}</div>
                      <div className="font-bold text-slate-900 text-xs">
                        ₺{(item.unitPrice * item.quantity).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      ₺{item.unitPrice.toFixed(2)} / adet
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {/* Quantity pill */}
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 px-1 py-0.5">
                        <button
                          onClick={() => handleUpdateCartQuantity(item.productId, -1)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-black text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateCartQuantity(item.productId, 1)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" className="rounded text-burgundy-800" />
                        <span>İkram</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateCartQuantity(item.productId, -item.quantity)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <X className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 2. Sent items already on table */}
                {activeSession && activeSession.orders.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Masadaki Siparişler
                    </div>
                    <div className="space-y-2">
                      {activeSession.orders
                        .flatMap((o) => o.lines)
                        .map((line) => {
                          const isVoided = line.status === 'Voided';

                          return (
                            <div
                              key={line.id}
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                                isVoided
                                  ? 'bg-rose-50/50 border-rose-200 line-through text-slate-400'
                                  : 'bg-slate-50/80 border-slate-200 text-slate-800'
                              }`}
                            >
                              <div>
                                <span className="font-bold">{line.quantity}x </span>
                                <span>{line.productName}</span>
                                {isVoided && line.voidReason && (
                                  <div className="text-[10px] text-rose-600 not-italic font-semibold">
                                    İptal: {line.voidReason}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="font-bold">₺{line.lineTotal.toFixed(2)}</span>
                                {!isVoided && (
                                  <button
                                    onClick={() => handleOpenVoidModal(line.id)}
                                    className="text-slate-400 hover:text-rose-600 p-0.5"
                                    title="Satırı İptal Et"
                                  >
                                    <X className="w-3.5 h-3.5 text-rose-500" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {cart.length === 0 && (!activeSession || activeSession.orders.length === 0) && (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-400">
                    <ShoppingBag className="w-8 h-8 text-slate-300 stroke-[1.5] mb-2" />
                    <span className="text-xs font-medium">Adisyon boş</span>
                  </div>
                )}
              </div>

              {/* Bottom Financials & Action Buttons */}
              <div className="pt-3 border-t border-slate-100 space-y-3 shrink-0">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Ara toplam</span>
                  <span className="font-bold text-slate-800">
                    ₺{(activeSession?.subTotal || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <span>Toplam</span>
                    <button className="text-xs text-rose-600 hover:underline font-semibold">
                      İndirim
                    </button>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    ₺{totalAmount.toFixed(2)}
                  </div>
                </div>

                {/* 2x2 Action Buttons Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Hesap */}
                  <button
                    onClick={handleOpenPaymentModal}
                    className="py-2.5 rounded-xl border border-burgundy-800 text-burgundy-800 hover:bg-rose-50 font-bold text-xs transition"
                  >
                    Hesap
                  </button>

                  {/* Yazdır */}
                  <button
                    onClick={handlePrintPreReceipt}
                    className="py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                  >
                    Yazdır
                  </button>

                  {/* Tamam (Mutfağa Gönder) */}
                  <button
                    onClick={handleSendToKitchen}
                    disabled={cart.length === 0 || isSubmittingOrder}
                    className="py-2.5 rounded-xl border border-burgundy-800 text-burgundy-800 hover:bg-rose-50 font-bold text-xs transition disabled:opacity-40"
                  >
                    {isSubmittingOrder ? 'İletiliyor...' : 'Tamam'}
                  </button>

                  {/* Hesabı Kapat (Gold Button) */}
                  <button
                    onClick={handleOpenPaymentModal}
                    className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition"
                  >
                    Hesabı Kapat
                  </button>
                </div>

                {/* Masalara Dön */}
                <button
                  onClick={handleBackToTables}
                  className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                >
                  Masalara dön
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Payment / Tahsilat */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Hesap Tahsilatı & Kapatma"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">Kalan Bakiye:</span>
            <span className="text-2xl font-black text-slate-900">
              ₺{activeSession?.remainingTotal.toFixed(2)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Ödeme Yöntemi</label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedPaymentMethodId(m.id)}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                    selectedPaymentMethodId === m.id
                      ? 'border-burgundy-800 bg-rose-50 text-burgundy-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Tahsil Edilecek Tutar (₺)</label>
            <input
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsPaymentModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100"
            >
              Vazgeç
            </button>
            <button
              onClick={handleProcessPayment}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition"
            >
              Hesabı Kapat
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Void Line / Satır İptal */}
      <Modal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        title="Sipariş Satırı İptali"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>İptal gerekçesi sisteme kalıcı olarak kaydedilecektir.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">İptal Gerekçesi *</label>
            <textarea
              rows={3}
              placeholder="Örn: Müşteri siparişi değiştirdi..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsVoidModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100"
            >
              Vazgeç
            </button>
            <button
              onClick={handleConfirmVoid}
              disabled={!voidReason.trim()}
              className="flex-1 py-2.5 rounded-xl bg-burgundy-800 text-white font-bold text-sm hover:bg-burgundy-900 disabled:opacity-50"
            >
              İptali Onayla
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Add Table / Masa Ekle */}
      <Modal
        isOpen={isNewTableModalOpen}
        onClose={() => setIsNewTableModalOpen(false)}
        title="Yeni Masa Ekle"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newTableAreaId) return;
            const finalNumber = newTableNumber.trim() || suggestedTableNumber;
            try {
              await api.createTable(newTableAreaId, finalNumber, 4);
              setIsNewTableModalOpen(false);
              setNewTableNumber('');
              await loadTables();
            } catch (err) {
              console.error(err);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Masa Adı / Numarası</label>
            <input
              type="text"
              placeholder={`Örn: ${suggestedTableNumber} (Boş bırakılırsa otomatik verilir)`}
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-burgundy-800"
            />
            <div className="text-[11px] text-slate-400 mt-1">
              Boş bırakılırsa otomatik numara atanır: <strong className="text-burgundy-800 font-bold">{suggestedTableNumber}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Bölüm / Salon *</label>
            <select
              value={newTableAreaId}
              onChange={(e) => setNewTableAreaId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-burgundy-800"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNewTableModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-burgundy-800 hover:bg-burgundy-900 text-white font-bold text-xs shadow-md"
            >
              Masa Ekle
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Masayı Taşı */}
      <Modal
        isOpen={isMoveTableModalOpen}
        onClose={() => setIsMoveTableModalOpen(false)}
        title={`Masayı Taşı – ${selectedTable?.tableNumber || ''}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
            Müşteri başka bir masaya geçtiğinde mevcut açık adisyonu ve masadaki siparişleri yeni masaya taşıyabilirsiniz.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Hedef Masayı Seçin:</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
              {areas
                .flatMap((a) => a.tables)
                .filter((t) => t.id !== selectedTable?.id)
                .sort((a, b) =>
                  a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: 'base' })
                )
                .map((t) => {
                  const isSelected = targetTableId === t.id;
                  const isEmpty = t.status === 'Empty';

                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setTargetTableId(t.id)}
                      className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'border-burgundy-800 bg-burgundy-50 ring-2 ring-burgundy-800'
                          : isEmpty
                          ? 'border-slate-200 bg-white hover:border-slate-300'
                          : 'border-slate-200 bg-slate-50 opacity-60'
                      }`}
                    >
                      <span className="text-sm font-black text-slate-800">{t.tableNumber}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isEmpty ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {isEmpty ? 'Boş' : 'Dolu'}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsMoveTableModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={!targetTableId || isSubmittingTransfer}
              onClick={handleTransferTable}
              className="flex-1 py-2.5 rounded-xl bg-burgundy-800 hover:bg-burgundy-900 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
            >
              {isSubmittingTransfer ? 'Taşınıyor...' : 'Masayı Taşı'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
