import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { signalRManager } from '../../services/signalr';
import { Area, DiningTable, Category, Product, SessionDetail, CartLine, PaymentMethod, NoteTemplate, ProductPortion } from '../../types';
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
  AlertCircle,
  FileText,
  Check,
  Percent,
  Layers,
  Lock,
  Utensils,
  Users
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
  const [orderNote, setOrderNote] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Note Templates & Item Note Modal
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>([]);
  const [isItemNoteModalOpen, setIsItemNoteModalOpen] = useState(false);
  const [editingCartProductId, setEditingCartProductId] = useState<string | null>(null);
  const [itemNoteText, setItemNoteText] = useState('');

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

  // Merge Table Modal
  const [isMergeTableModalOpen, setIsMergeTableModalOpen] = useState(false);
  const [mergeTargetTableId, setMergeTargetTableId] = useState('');
  const [isSubmittingMerge, setIsSubmittingMerge] = useState(false);

  // Discount Modal
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('Müdür İndirimi');
  const [isSubmittingDiscount, setIsSubmittingDiscount] = useState(false);

  // Void Supervisor PIN
  const [voidSupervisorPin, setVoidSupervisorPin] = useState('');

  // Portions Modal
  const [isPortionModalOpen, setIsPortionModalOpen] = useState(false);
  const [portionProduct, setPortionProduct] = useState<Product | null>(null);

  // Split Bill / Payment Enhancements
  const [selectedSplitLineIds, setSelectedSplitLineIds] = useState<string[]>([]);
  const [cashGivenAmount, setCashGivenAmount] = useState('');

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
      const [cats, prods, payMethods, noteTemps] = await Promise.all([
        api.getCategories(),
        api.getProducts(),
        api.getPaymentMethods(),
        api.getNoteTemplates().catch(() => []),
      ]);
      setCategories(cats);
      setProducts(prods);
      setPaymentMethods(payMethods);
      if (noteTemps && Array.isArray(noteTemps)) {
        setNoteTemplates(noteTemps);
      }
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

    // SignalR Real-Time Synchronization across PC, Mobile and Tablet
    signalRManager.onTableStatusChanged(() => {
      loadTables();
    });

    signalRManager.onOrderAdded((data: any) => {
      loadTables();
      if (activeSession && data?.sessionId === activeSession.id) {
        api.getSession(activeSession.id).then((updated) => setActiveSession(updated)).catch(() => {});
      }
    });

    signalRManager.onPaymentReceived((data: any) => {
      loadTables();
      if (activeSession && data?.sessionId === activeSession.id) {
        api.getSession(activeSession.id).then((updated) => setActiveSession(updated)).catch(() => {});
      }
    });

    // Fallback sync interval every 6 seconds for network resilience
    const syncInterval = setInterval(() => {
      loadTables();
      if (activeSession) {
        api.getSession(activeSession.id).then((updated) => setActiveSession(updated)).catch(() => {});
      }
    }, 6000);

    return () => clearInterval(syncInterval);
  }, [activeSession?.id]);

  // Table selection
  const handleSelectTable = async (table: DiningTable) => {
    setSelectedTable(table);
    setCart([]);
    setOrderNote('');
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
    setOrderNote('');
    loadTables();
  };

  // Cart operations
  const handleAddToCart = (product: Product, portion?: ProductPortion) => {
    if (!product.isAvailable) return;

    if (!portion && product.portions && product.portions.length > 0) {
      setPortionProduct(product);
      setIsPortionModalOpen(true);
      return;
    }

    const price = portion ? portion.price : product.unitPrice;
    const name = portion ? `${product.name} (${portion.name})` : product.name;
    const portionName = portion?.name;

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && item.portionName === portionName
      );
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: name,
          unitPrice: price,
          quantity: 1,
          portionName,
        },
      ];
    });

    setIsPortionModalOpen(false);
  };

  const handleUpdateCartQuantity = (productId: string, delta: number, portionName?: string) => {
    setCart((prev) => {
      const targetIndex = prev.findIndex((item) =>
        item.productId === productId && (portionName !== undefined ? item.portionName === portionName : true)
      );
      if (targetIndex === -1) return prev;

      const newQty = prev[targetIndex].quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, idx) => idx !== targetIndex);
      }
      return prev.map((item, idx) => (idx === targetIndex ? { ...item, quantity: newQty } : item));
    });
  };

  const handleToggleComplimentary = (item: CartLine) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c === item) {
          const isComp = !c.isComplimentary;
          return {
            ...c,
            isComplimentary: isComp,
            complimentaryReason: isComp ? (c.complimentaryReason || 'Müdür İkramı') : undefined,
          };
        }
        return c;
      })
    );
  };

  const handleClearCart = () => {
    setCart([]);
    setOrderNote('');
  };

  // Note helpers
  const editingCartItem = useMemo(() => {
    return cart.find((c) => c.productId === editingCartProductId) || null;
  }, [cart, editingCartProductId]);

  const handleOpenItemNoteModal = (productId: string) => {
    const item = cart.find((c) => c.productId === productId);
    if (!item) return;
    setEditingCartProductId(productId);
    setItemNoteText(item.notes || '');
    setIsItemNoteModalOpen(true);
  };

  const handleSaveItemNote = () => {
    if (!editingCartProductId) return;
    const finalNote = itemNoteText.trim();
    setCart((prev) =>
      prev.map((c) =>
        c.productId === editingCartProductId
          ? { ...c, notes: finalNote || undefined }
          : c
      )
    );
    setIsItemNoteModalOpen(false);
  };

  const handleClearItemNote = (productId: string) => {
    setCart((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, notes: undefined } : c))
    );
  };

  const handleToggleNoteChip = (text: string) => {
    setItemNoteText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return text;
      if (trimmed.includes(text)) {
        return trimmed
          .replace(text, '')
          .replace(/^,\s*|,\s*$/g, '')
          .replace(/,\s*,/g, ', ')
          .trim();
      }
      return `${trimmed}, ${text}`;
    });
  };

  // Product quantity in cart
  const getProductCartCount = (productId: string) => {
    return cart
      .filter((c) => c.productId === productId)
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  // Send Order to Kitchen ("Tamam" or "Mutfağa Gönder")
  const handleSendToKitchen = async () => {
    if (!activeSession || cart.length === 0 || isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    try {
      const idempotencyKey = `order_${activeSession.id}_${Date.now()}`;
      const updatedSession = await api.addOrder(
        activeSession.id,
        cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          notes: c.notes,
          isComplimentary: c.isComplimentary,
          complimentaryReason: c.complimentaryReason,
          portionName: c.portionName,
          customUnitPrice: c.unitPrice,
        })),
        idempotencyKey,
        orderNote.trim() || undefined
      );
      setActiveSession(updatedSession);
      setCart([]);
      setOrderNote('');
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
    setVoidSupervisorPin('');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!activeSession || !lineToVoidId || !voidReason.trim()) return;
    try {
      const updatedSession = await api.voidLine(
        activeSession.id,
        lineToVoidId,
        voidReason,
        voidSupervisorPin.trim() || undefined
      );
      setActiveSession(updatedSession);
      setIsVoidModalOpen(false);
      setLineToVoidId(null);
      setVoidSupervisorPin('');
      await loadTables();
    } catch (err) {
      console.error('İptal yapılamadı:', err);
    }
  };

  // Discount
  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) return;

    try {
      setIsSubmittingDiscount(true);
      const data =
        discountType === 'percentage'
          ? { percentage: val, reason: discountReason }
          : { fixedAmount: val, reason: discountReason };

      const updated = await api.applyDiscount(activeSession.id, data);
      setActiveSession(updated);
      setIsDiscountModalOpen(false);
      setDiscountValue('');
    } catch (err) {
      console.error('İndirim uygulanamadı:', err);
    } finally {
      setIsSubmittingDiscount(false);
    }
  };

  const handleRemoveDiscount = async () => {
    if (!activeSession) return;
    try {
      setIsSubmittingDiscount(true);
      const updated = await api.applyDiscount(activeSession.id, { fixedAmount: 0, reason: 'İndirim kaldırıldı' });
      setActiveSession(updated);
      setIsDiscountModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingDiscount(false);
    }
  };

  // Merge Tables
  const handleMergeTables = async () => {
    if (!activeSession || !mergeTargetTableId || isSubmittingMerge) return;
    try {
      setIsSubmittingMerge(true);
      const updated = await api.mergeSessions(activeSession.id, mergeTargetTableId);
      setIsMergeTableModalOpen(false);

      const areaList = await api.getAreas();
      setAreas(areaList);
      const allTables = areaList.flatMap((a) => a.tables);
      const targetT = allTables.find((t) => t.id === mergeTargetTableId);
      if (targetT) {
        setSelectedTable(targetT);
        setActiveSession(updated);
      }
      setMergeTargetTableId('');
    } catch (err) {
      console.error('Masa birleştirme başarısız:', err);
    } finally {
      setIsSubmittingMerge(false);
    }
  };

  // Split Payment
  const handleToggleSplitLine = (lineId: string) => {
    setSelectedSplitLineIds((prev) => {
      const isSelected = prev.includes(lineId);
      const next = isSelected ? prev.filter((id) => id !== lineId) : [...prev, lineId];

      if (activeSession) {
        const allLines = activeSession.orders.flatMap((o) => o.lines).filter((l) => l.status !== 'Voided');
        const selectedSum = allLines
          .filter((l) => next.includes(l.id))
          .reduce((sum, l) => sum + l.lineTotal, 0);

        if (next.length > 0) {
          setPaymentAmount(Math.min(activeSession.remainingTotal, selectedSum).toFixed(2));
        } else {
          setPaymentAmount(activeSession.remainingTotal.toFixed(2));
        }
      }
      return next;
    });
  };

  const handleSplitByPerson = (count: number) => {
    if (!activeSession) return;
    const splitVal = Math.round((activeSession.remainingTotal / count) * 100) / 100;
    setPaymentAmount(splitVal.toFixed(2));
    setSelectedSplitLineIds([]);
  };

  const changeAmount = useMemo(() => {
    const given = parseFloat(cashGivenAmount);
    const toPay = parseFloat(paymentAmount);
    if (!isNaN(given) && !isNaN(toPay) && given > toPay) {
      return (given - toPay).toFixed(2);
    }
    return null;
  }, [cashGivenAmount, paymentAmount]);

  // Payment
  const handleOpenPaymentModal = () => {
    if (!activeSession) return;
    setPaymentAmount(activeSession.remainingTotal.toFixed(2));
    setSelectedSplitLineIds([]);
    setCashGivenAmount('');
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
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + (item.isComplimentary ? 0 : item.unitPrice * item.quantity), 0),
    [cart]
  );
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

              <button
                onClick={() => setIsMergeTableModalOpen(true)}
                className="flex items-center gap-1 hover:underline text-amber-800"
              >
                <Layers className="w-3.5 h-3.5" />
                Masayı birleştir
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
                            {p.portions && p.portions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleAddToCart(p)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition"
                              >
                                Porsiyonlar ({p.portions.length})
                              </button>
                            )}
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
                    key={`${item.productId}-${item.portionName || 'default'}-${item.isComplimentary ? 'comp' : 'std'}`}
                    className={`p-3.5 rounded-2xl border shadow-xs space-y-2.5 ${
                      item.isComplimentary
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-200/90 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>{item.productName}</span>
                        {item.portionName && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            {item.portionName}
                          </span>
                        )}
                        {item.isComplimentary && (
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                            İKRAM
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-slate-900 text-xs shrink-0">
                        {item.isComplimentary ? (
                          <div className="text-right">
                            <span className="line-through text-slate-400 mr-1.5 text-[11px]">
                              ₺{(item.unitPrice * item.quantity).toFixed(2)}
                            </span>
                            <span className="text-emerald-700 font-bold">₺0.00</span>
                          </div>
                        ) : (
                          `₺${(item.unitPrice * item.quantity).toFixed(2)}`
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      ₺{item.unitPrice.toFixed(2)} / adet
                    </div>

                    {/* Item Note Badge if added */}
                    {item.notes && (
                      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-xs text-amber-900">
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="font-semibold truncate">Not: {item.notes}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleOpenItemNoteModal(item.productId)}
                            className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearItemNote(item.productId)}
                            className="p-0.5 text-amber-600 hover:text-rose-600 rounded"
                            title="Notu kaldır"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      {/* Quantity pill */}
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 px-1 py-0.5">
                        <button
                          onClick={() => handleUpdateCartQuantity(item.productId, -1, item.portionName)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-black text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateCartQuantity(item.productId, 1, item.portionName)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* İkram toggle checkbox */}
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={!!item.isComplimentary}
                          onChange={() => handleToggleComplimentary(item)}
                          className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                        />
                        <span>İkram</span>
                      </label>

                      {/* Not Ekle / Değiştir butonu */}
                      <button
                        type="button"
                        onClick={() => handleOpenItemNoteModal(item.productId)}
                        className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition ${
                          item.notes
                            ? 'bg-amber-100/70 border-amber-300 text-amber-800'
                            : 'bg-slate-50 hover:bg-amber-50/80 border-slate-200 hover:border-amber-300 text-slate-600 hover:text-amber-900'
                        }`}
                      >
                        <FileText className="w-3 h-3 text-amber-600" />
                        <span>{item.notes ? 'Notu Değiştir' : '+ Not Ekle'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateCartQuantity(item.productId, -item.quantity, item.portionName)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Ürünü sepetten çıkar"
                        >
                          <X className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Genel Sipariş Notu Girişi */}
                {cart.length > 0 && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        Genel Sipariş / Mutfak Notu
                      </span>
                      {orderNote && (
                        <button
                          type="button"
                          onClick={() => setOrderNote('')}
                          className="text-[10px] text-amber-700 hover:text-rose-600 font-semibold hover:underline"
                        >
                          Temizle
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      placeholder="Örn: Acele edilsin, tüm yemekler aynı anda çıksın..."
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-amber-300/80 bg-white placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                {/* 2. Sent items already on table */}
                {activeSession && activeSession.orders.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Masadaki Siparişler
                    </div>
                    <div className="space-y-2">
                      {activeSession.orders.map((ord) => (
                        <div key={ord.id} className="space-y-1.5">
                          {ord.notes && (
                            <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold flex items-center gap-1.5">
                              <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Sipariş Notu: {ord.notes}</span>
                            </div>
                          )}
                          {ord.lines.map((line) => {
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
                                <div className="flex-1 pr-2">
                                  <span className="font-bold">{line.quantity}x </span>
                                  <span>{line.productName}</span>
                                  {line.portionName && (
                                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                      {line.portionName}
                                    </span>
                                  )}
                                  {line.isComplimentary && (
                                    <span className="ml-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      İKRAM {line.complimentaryReason ? `(${line.complimentaryReason})` : ''}
                                    </span>
                                  )}
                                  {line.notes && (
                                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/90 rounded px-1.5 py-0.5 mt-0.5 inline-block font-medium">
                                      📝 {line.notes}
                                    </div>
                                  )}
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
                      ))}
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

                {activeSession && activeSession.discountTotal > 0 && (
                  <div className="flex items-center justify-between text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-1.5">
                      <span>İndirim</span>
                      <button
                        type="button"
                        onClick={handleRemoveDiscount}
                        className="text-[11px] text-rose-600 hover:underline font-semibold ml-1"
                      >
                        (Kaldır)
                      </button>
                    </div>
                    <span>-₺{activeSession.discountTotal.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <span>Toplam</span>
                    <button
                      type="button"
                      onClick={() => setIsDiscountModalOpen(true)}
                      className="text-xs text-rose-600 hover:underline font-semibold"
                    >
                      {activeSession?.discountTotal ? 'İndirimi Düzenle' : 'İndirim'}
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
        title="Hesap Tahsilatı & Parçalı Ödeme"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* Kalan Bakiye Bilgisi */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">Kalan Bakiye:</span>
            <span className="text-2xl font-black text-slate-900">
              ₺{activeSession?.remainingTotal.toFixed(2)}
            </span>
          </div>

          {/* Alman Usulü / Kişi Başına Bölüş */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <span>Alman Usulü (Kişi Sayısına Böl):</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeSession) {
                    setPaymentAmount(activeSession.remainingTotal.toFixed(2));
                    setSelectedSplitLineIds([]);
                  }
                }}
                className="py-2 px-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
              >
                Tamamı
              </button>
              <button
                type="button"
                onClick={() => handleSplitByPerson(2)}
                className="py-2 px-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
              >
                1/2 (2 Kişi)
              </button>
              <button
                type="button"
                onClick={() => handleSplitByPerson(3)}
                className="py-2 px-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
              >
                1/3 (3 Kişi)
              </button>
              <button
                type="button"
                onClick={() => handleSplitByPerson(4)}
                className="py-2 px-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
              >
                1/4 (4 Kişi)
              </button>
            </div>
          </div>

          {/* Ürün Seçerek Ödeme (Parçalı Tahsilat) */}
          {activeSession && activeSession.orders.flatMap((o) => o.lines).filter((l) => l.status !== 'Voided').length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-amber-600" />
                  Ürün Seçerek Öde:
                </span>
                {selectedSplitLineIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSplitLineIds([]);
                      if (activeSession) {
                        setPaymentAmount(activeSession.remainingTotal.toFixed(2));
                      }
                    }}
                    className="text-[11px] text-rose-600 hover:underline font-semibold"
                  >
                    Seçimi Temizle
                  </button>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                {activeSession.orders
                  .flatMap((o) => o.lines)
                  .filter((l) => l.status !== 'Voided')
                  .map((line) => {
                    const isChecked = selectedSplitLineIds.includes(line.id);
                    return (
                      <label
                        key={line.id}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-amber-100/70 border border-amber-300 font-bold text-amber-950'
                            : 'bg-white border border-slate-200 hover:bg-slate-100/60 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSplitLine(line.id)}
                            className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                          />
                          <span>
                            {line.quantity}x {line.productName}
                            {line.portionName ? ` (${line.portionName})` : ''}
                          </span>
                        </div>
                        <span className="font-bold">₺{line.lineTotal.toFixed(2)}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Ödeme Yöntemi */}
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
                      ? 'border-burgundy-800 bg-rose-50 text-burgundy-900 ring-2 ring-burgundy-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tahsil Edilecek Tutar */}
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

          {/* Hızlı Nakit & Para Üstü */}
          <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <span>Hızlı Nakit Girişi & Para Üstü</span>
              {cashGivenAmount && (
                <button
                  type="button"
                  onClick={() => setCashGivenAmount('')}
                  className="text-[10px] text-amber-700 hover:text-rose-600 hover:underline"
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[100, 200, 500, 1000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCashGivenAmount(val.toString())}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-900 hover:bg-amber-100"
                >
                  ₺{val}
                </button>
              ))}
            </div>
            <div>
              <input
                type="number"
                placeholder="Müşteriden alınan nakit (₺)..."
                value={cashGivenAmount}
                onChange={(e) => setCashGivenAmount(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {changeAmount !== null && (
              <div className="p-2 rounded-lg bg-emerald-100/90 border border-emerald-300 flex items-center justify-between text-xs font-bold text-emerald-900">
                <span>Para Üstü Verilecek:</span>
                <span className="text-sm font-black">₺{changeAmount}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setIsPaymentModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100"
            >
              Vazgeç
            </button>
            <button
              onClick={handleProcessPayment}
              disabled={!selectedPaymentMethodId || !paymentAmount || parseFloat(paymentAmount) <= 0}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
            >
              {activeSession && parseFloat(paymentAmount) < activeSession.remainingTotal
                ? 'Parçalı Ödemeyi Al'
                : 'Hesabı Kapat'}
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
            <span>İptal gerekçesi ve iptal eden yetkili PIN doğrulaması sistem loglarına kalıcı kaydedilir.</span>
          </div>

          {/* Hızlı İptal Nedenleri */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Hızlı İptal Nedeni:</label>
            <div className="flex flex-wrap gap-1.5">
              {['Müşteri Vazgeçti', 'Hatalı Giriş', 'Mutfak Gecikmesi', 'Zayi / Kalite'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setVoidReason(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                    voidReason === r
                      ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">İptal Gerekçesi / Açıklama *</label>
            <textarea
              rows={2}
              placeholder="Örn: Müşteri siparişi iptal etmek istedi..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* 4 Haneli Yönetici PIN'i */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Yönetici PIN Kodu (Yetkili Onayı)</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Garson veya Mutfak rolüyle satır iptal etmek için 4 haneli müdür/yönetici PIN'i girilmelidir. (Varsayılan: 1234)
            </div>
            <input
              type="password"
              maxLength={6}
              value={voidSupervisorPin}
              onChange={(e) => setVoidSupervisorPin(e.target.value)}
              placeholder="•••• (Yönetici PIN)"
              className="w-full px-3 py-2 text-center text-base tracking-widest font-black rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
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

      {/* MODAL: İndirim Uygula */}
      <Modal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        title="Masaya İndirim Uygula"
      >
        <form onSubmit={handleApplyDiscount} className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            Adisyon ara toplamı: <strong>₺{(activeSession?.subTotal || 0).toFixed(2)}</strong>.
            İndirim uygulandığında toplam bakiye anında güncellenir.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">İndirim Türü:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('percentage')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  discountType === 'percentage'
                    ? 'border-burgundy-800 bg-rose-50 text-burgundy-900 ring-2 ring-burgundy-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Yüzde (%) İndirim</span>
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  discountType === 'fixed'
                    ? 'border-burgundy-800 bg-rose-50 text-burgundy-900 ring-2 ring-burgundy-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>₺ Sabit Tutar</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {discountType === 'percentage' ? 'İndirim Oranı (%)' : 'İndirim Tutarı (₺)'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={discountType === 'percentage' ? 100 : activeSession?.subTotal || 9999}
              required
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? 'Örn: 10' : 'Örn: 50'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          {/* Hızlı Neden Seçimi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">İndirim Gerekçesi:</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {['Müdür İndirimi', 'Personel İndirimi', 'Müşteri Memnuniyeti', 'Açılış / Kampanya'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDiscountReason(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                    discountReason === r
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDiscountModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
            >
              Vazgeç
            </button>
            {activeSession && activeSession.discountTotal > 0 && (
              <button
                type="button"
                onClick={handleRemoveDiscount}
                disabled={isSubmittingDiscount}
                className="px-3 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs"
              >
                İndirimi Kaldır
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmittingDiscount || !discountValue}
              className="flex-1 py-2.5 rounded-xl bg-burgundy-800 hover:bg-burgundy-900 text-white font-bold text-xs shadow-xs disabled:opacity-50"
            >
              {isSubmittingDiscount ? 'Uygulanıyor...' : 'İndirimi Uygula'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Masayı Birleştir */}
      <Modal
        isOpen={isMergeTableModalOpen}
        onClose={() => setIsMergeTableModalOpen(false)}
        title={`Masayı Birleştir – ${selectedTable?.tableNumber || ''}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
            <strong>Masa {selectedTable?.tableNumber}</strong> adisyonundaki tüm siparişler seçtiğiniz hedef masaya aktarılacak ve bu masa <strong>Boşaltılacaktır</strong>.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Hangi Dolu Masayla Birleştirmek İstiyorsunuz?
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
              {areas
                .flatMap((a) => a.tables)
                .filter((t) => t.id !== selectedTable?.id && t.status === 'Occupied')
                .sort((a, b) =>
                  a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: 'base' })
                )
                .map((t) => {
                  const isSelected = mergeTargetTableId === t.id;
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setMergeTargetTableId(t.id)}
                      className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-600 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="text-sm font-black text-slate-800">{t.tableNumber}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        ₺{t.activeSessionTotal ? t.activeSessionTotal.toFixed(2) : '0.00'}
                      </span>
                    </button>
                  );
                })}
            </div>
            {areas.flatMap((a) => a.tables).filter((t) => t.id !== selectedTable?.id && t.status === 'Occupied').length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400">
                Birleştirilebilecek başka dolu masa bulunamadı.
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsMergeTableModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={!mergeTargetTableId || isSubmittingMerge}
              onClick={handleMergeTables}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
            >
              {isSubmittingMerge ? 'Birleştiriliyor...' : 'Masaları Birleştir'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Porsiyon / Varyant Seçimi */}
      <Modal
        isOpen={isPortionModalOpen}
        onClose={() => setIsPortionModalOpen(false)}
        title={portionProduct ? `${portionProduct.name} – Porsiyon Seçimi` : 'Porsiyon Seçimi'}
      >
        <div className="space-y-4">
          <div className="text-xs text-slate-600">
            Lütfen istediğiniz porsiyon veya porsiyon büyüklüğünü seçiniz:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Standart taban porsiyon */}
            {portionProduct && (
              <button
                type="button"
                onClick={() => portionProduct && handleAddToCart(portionProduct, { name: 'Standart Porsiyon', price: portionProduct.unitPrice })}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 transition flex items-center justify-between text-left"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">Standart (1 Porsiyon)</div>
                  <div className="text-[11px] text-slate-400">Klasik taban porsiyon</div>
                </div>
                <div className="text-sm font-black text-amber-600">
                  ₺{portionProduct.unitPrice.toFixed(2)}
                </div>
              </button>
            )}

            {portionProduct?.portions?.map((prt) => (
              <button
                key={prt.name}
                type="button"
                onClick={() => portionProduct && handleAddToCart(portionProduct, prt)}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 transition flex items-center justify-between text-left"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">{prt.name}</div>
                  <div className="text-[11px] text-slate-400">Porsiyon seçeneği</div>
                </div>
                <div className="text-sm font-black text-amber-600">
                  ₺{prt.price.toFixed(2)}
                </div>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setIsPortionModalOpen(false)}
              className="py-2 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
            >
              Vazgeç
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

      {/* MODAL: Ürün Sipariş Notu Ekle / Düzenle */}
      <Modal
        isOpen={isItemNoteModalOpen}
        onClose={() => setIsItemNoteModalOpen(false)}
        title={
          editingCartItem
            ? `Sipariş Notu: ${editingCartItem.productName}`
            : 'Sipariş Notu Ekle'
        }
      >
        <div className="space-y-4">
          {/* Hızlı Şablonlar / Hazır Notlar */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Hızlı Not Seçimi (Tek dokunuşla ekleyin):
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
              {noteTemplates.length > 0 ? (
                noteTemplates.map((t) => {
                  const isSelected = itemNoteText.includes(t.title);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToggleNoteChip(t.title)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      <span>{t.title}</span>
                      {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </button>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 py-1 px-2">
                  Kayıtlı hızlı not şablonu bulunamadı.
                </div>
              )}
            </div>
          </div>

          {/* Serbest Not Yazma Alanı */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Özel Not / Açıklama:
            </label>
            <textarea
              rows={3}
              value={itemNoteText}
              onChange={(e) => setItemNoteText(e.target.value)}
              placeholder="Örn: Az pişmiş, ketçap mayonez olmasın, acı sos ayrı gelsin..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-burgundy-800"
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsItemNoteModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
            >
              Vazgeç
            </button>
            {editingCartItem?.notes && (
              <button
                type="button"
                onClick={() => {
                  if (editingCartProductId) {
                    handleClearItemNote(editingCartProductId);
                  }
                  setIsItemNoteModalOpen(false);
                }}
                className="px-3 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs"
              >
                Notu Kaldır
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveItemNote}
              className="flex-1 py-2.5 rounded-xl bg-burgundy-800 hover:bg-burgundy-900 text-white font-bold text-xs shadow-xs"
            >
              Kaydet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
