import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  History,
  Loader2,
  Package,
  Search,
  Truck,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Order, OrderItem, InventoryProduct, SteadfastCustomerFraudCheckResult } from '../types/order';
import {
  processOrderAI,
  checkPhonePreviousOrders,
  createOrder,
  fetchInventory,
  fetchSteadfastCustomerRating,
} from '../api';
import { ProductSearchSelectModal } from './ProductSearchSelectModal';

interface OrderReviewPageProps {
  rawText: string;
  onOrderConfirmed: () => void;
  onBackToInput: () => void;
}

export const OrderReviewPage: React.FC<OrderReviewPageProps> = ({
  rawText,
  onOrderConfirmed,
  onBackToInput,
}) => {
  // Loading & extraction state
  const [isExtracting, setIsExtracting] = useState(true);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Saved inventory products for selection
  const [inventoryList, setInventoryList] = useState<InventoryProduct[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Editable Order Fields (Order ID, Customer Name, Phone, Full Address, Note)
  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  // Multiple Products List
  const [products, setProducts] = useState<OrderItem[]>([
    {
      productName: '',
      quantity: 1,
      color: '',
      price: 0,
    },
  ]);

  // Manual total override state
  const [manualTotal, setManualTotal] = useState<number | null>(null);

  // 1. Phone Number Previous Orders Check
  const [previousOrders, setPreviousOrders] = useState<Partial<Order>[]>([]);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [hasCheckedPhone, setHasCheckedPhone] = useState(false);
  const [showPrevOrderDetails, setShowPrevOrderDetails] = useState(false);

  // 2. STEADFAST ONLY: Customer Courier Rating & History
  const [steadfastRating, setSteadfastRating] = useState<SteadfastCustomerFraudCheckResult | null>(null);
  const [isLoadingRating, setIsLoadingRating] = useState(false);

  // Saving / Confirmation state
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Generate unique Order ID
  const generateOrderId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.floor(100 + Math.random() * 900);
    return `ORD-${timestamp}-${random}`;
  };

  // Load inventory on mount
  useEffect(() => {
    fetchInventory()
      .then((items) => setInventoryList(items))
      .catch((err) => console.error('Failed to load inventory:', err));
  }, []);

  // Send pasted text to AI extraction system immediately on mount
  const hasExtractedRef = useRef(false);
  useEffect(() => {
    if (hasExtractedRef.current) return;
    hasExtractedRef.current = true;

    async function runExtraction() {
      setIsExtracting(true);
      setExtractionError(null);
      setOrderId(generateOrderId());

      try {
        const extracted = await processOrderAI(rawText);

        setCustomerName(extracted.customerName || '');
        setPhone(extracted.phone || '');
        setAddress(extracted.address || '');
        setNote(extracted.note || '');

        if (Array.isArray(extracted.products) && extracted.products.length > 0) {
          setProducts(
            extracted.products.map((p) => ({
              productName: p.productName || '',
              quantity: Math.max(1, Number(p.quantity) || 1),
              color: p.color || '',
              price: Math.max(0, Number(p.price) || 0),
            }))
          );
        } else if (extracted.product) {
          setProducts([
            {
              productName: extracted.product,
              quantity: Math.max(1, Number(extracted.quantity) || 1),
              color: extracted.color || '',
              price: Math.max(0, Number(extracted.price) || 0),
            },
          ]);
        }
      } catch (err: any) {
        console.error('AI extraction error:', err);
        setExtractionError(
          err.message || 'AI extraction failed. You can still manually enter or edit the fields.'
        );
      } finally {
        setIsExtracting(false);
      }
    }

    runExtraction();
  }, [rawText]);

  // Automatic Previous Order Check & Steadfast Customer Rating Check whenever phone changes
  useEffect(() => {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 5) {
      setPreviousOrders([]);
      setHasCheckedPhone(false);
      setSteadfastRating(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingPhone(true);
      setIsLoadingRating(true);
      try {
        const [prevRes, stRes] = await Promise.all([
          checkPhonePreviousOrders(cleanPhone),
          fetchSteadfastCustomerRating(cleanPhone),
        ]);
        setPreviousOrders(prevRes.orders || []);
        setHasCheckedPhone(true);
        setSteadfastRating(stRes);
      } catch (err) {
        console.error('Phone checks failed:', err);
      } finally {
        setIsCheckingPhone(false);
        setIsLoadingRating(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [phone]);

  // Product Row Handlers
  const handleRemoveProduct = (index: number) => {
    if (products.length <= 1) {
      setProducts([
        {
          productName: '',
          quantity: 1,
          color: '',
          price: 0,
        },
      ]);
      return;
    }
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateProduct = (index: number, field: keyof OrderItem, value: any) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const handleConfirmProductSelection = (
    selectedItems: { name: string; defaultPrice: number }[]
  ) => {
    if (selectedItems.length === 0) return;

    setProducts((prev) => {
      const existingNonEmpty = prev.filter((p) => p.productName.trim() !== '');
      const updatedList: OrderItem[] = [];

      selectedItems.forEach((sel) => {
        const existing = existingNonEmpty.find(
          (p) => p.productName.trim().toLowerCase() === sel.name.trim().toLowerCase()
        );

        if (existing) {
          updatedList.push(existing);
        } else {
          updatedList.push({
            productName: sel.name,
            quantity: 1,
            color: '',
            price: sel.defaultPrice || 0,
          });
        }
      });

      return updatedList.length > 0
        ? updatedList
        : [
            {
              productName: '',
              quantity: 1,
              color: '',
              price: 0,
            },
          ];
    });
  };

  // Inventory price lookup for selected products (no stock tracking)
  const inventoryInfo = useMemo(() => {
    return products.map((item) => {
      if (!item.productName.trim()) return null;
      const trimmed = item.productName.trim().toLowerCase();

      const matched = inventoryList.find(
        (p) =>
          p.name.trim().toLowerCase() === trimmed ||
          trimmed.includes(p.name.trim().toLowerCase()) ||
          p.name.trim().toLowerCase().includes(trimmed)
      );

      if (!matched) return null;

      return {
        matchedName: matched.name,
        defaultPrice: matched.defaultPrice,
      };
    });
  }, [products, inventoryList]);

  // Order Total Calculation: Sum of (Product Price × Quantity) for each product
  const calculatedTotal = useMemo(() => {
    return products.reduce((acc, p) => {
      const price = Number(p.price) || 0;
      const qty = Number(p.quantity) || 1;
      return acc + price * qty;
    }, 0);
  }, [products]);

  // Effective Total: manual override if user edited it, otherwise calculated
  const effectiveTotal = manualTotal !== null ? manualTotal : calculatedTotal;

  // Total quantity
  const totalQuantity = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
  }, [products]);

  // Confirm Order Handler
  const handleConfirmOrder = async () => {
    if (!customerName.trim() && !phone.trim() && products.every((p) => !p.productName.trim())) {
      setConfirmError('Please enter at least customer name, phone number, or a product.');
      return;
    }

    const validProducts = products.filter(
      (p) => p.productName.trim() || p.price > 0 || p.color.trim()
    );

    if (validProducts.length === 0) {
      setConfirmError('Please select or specify at least one product.');
      return;
    }

    setIsConfirming(true);
    setConfirmError(null);

    try {
      const summaryProduct = validProducts
        .map((p) => `${p.productName}${p.quantity > 1 ? ` (${p.quantity} pcs)` : ''}`)
        .join(', ');
      const summaryColor = validProducts
        .map((p) => p.color)
        .filter(Boolean)
        .join(', ');

      await createOrder({
        orderId: orderId.trim() || generateOrderId(),
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        products: validProducts,
        product: summaryProduct,
        quantity: totalQuantity,
        color: summaryColor,
        price: effectiveTotal,
        note: note.trim(),
      });

      // Saved permanently to database, inventory reduced, moves to ON HOLD
      onOrderConfirmed();
    } catch (err: any) {
      console.error('Confirmation error:', err);
      setConfirmError(err.message || 'Failed to confirm order.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToInput}
          className="flex items-center text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Text Input
        </button>

        <div className="text-right">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Order Review / Verification
          </span>
          <p className="text-xs font-mono font-bold text-slate-700">{orderId}</p>
        </div>
      </div>

      {/* Extraction in progress loader */}
      {isExtracting && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center space-x-3 text-emerald-800">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Extracting customer order details...</p>
            <p className="text-xs text-emerald-600">AI is identifying customer name, phone, address, and products.</p>
          </div>
        </div>
      )}

      {/* Extraction Error Notice */}
      {extractionError && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center space-x-2.5 text-amber-800 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{extractionError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PHONE NUMBER PREVIOUS ORDER HISTORY (VERY FIRST AT TOP) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              1. Customer History Check
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-600" />
              <span>এই নাম্বারে আগেও আমাদের এখানে অর্ডার ছিল কি না</span>
            </h3>
          </div>

          {isCheckingPhone && (
            <div className="flex items-center space-x-1.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Searching...</span>
            </div>
          )}
        </div>

        <div className="mt-3">
          {!phone.trim() ? (
            <div className="text-xs text-slate-400 italic py-1">
              ফোন নাম্বার এক্সট্রাক্ট অথবা এন্ট্রি করা হলে পূর্বের অর্ডার হিস্টরি এখানে দেখাবে।
            </div>
          ) : hasCheckedPhone && previousOrders.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                <div className="flex items-center space-x-2.5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
                    Previous Order: YES
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-950">
                    এই নাম্বারে আগের অর্ডার: <span className="text-emerald-700 font-extrabold">{previousOrders.length}টি</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPrevOrderDetails(!showPrevOrderDetails)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                >
                  {showPrevOrderDetails ? 'হিস্টরি লুকান' : 'হিস্টরি দেখুন (Show Details)'}
                </button>
              </div>

              {/* Previous Orders Detailed List */}
              <div className="space-y-2">
                {previousOrders.map((pOrder, idx) => (
                  <div
                    key={pOrder.id || idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-mono font-bold text-slate-800">
                        Order ID: {pOrder.orderId || pOrder.id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] tracking-wide ${
                          pOrder.status === 'DELIVERED'
                            ? 'bg-teal-100 text-teal-700'
                            : pOrder.status === 'SHIPPING'
                            ? 'bg-purple-100 text-purple-700'
                            : pOrder.status === 'COURIER ASSIGN'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pOrder.status || 'ON HOLD'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-slate-600 text-[11px]">
                      <div>
                        <strong>Date:</strong> {pOrder.confirmDate || 'N/A'} {pOrder.confirmTime || ''}
                      </div>
                      <div>
                        <strong>Steadfast Parcel ID:</strong>{' '}
                        {pOrder.steadfastParcelId ? (
                          <span className="font-mono text-emerald-700 font-bold">
                            {pOrder.steadfastParcelId}
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </div>
                      <div>
                        <strong>Total:</strong> ৳{pOrder.price || 0}
                      </div>
                    </div>

                    {showPrevOrderDetails && pOrder.product && (
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                        <strong>Products:</strong> {pOrder.product}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : hasCheckedPhone && previousOrders.length === 0 ? (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white">
                  নতুন অর্ডার
                </span>
                <span className="text-xs sm:text-sm font-semibold text-blue-950">
                  এই নাম্বারে কোনো আগের অর্ডার নেই (New Customer)
                </span>
              </div>
              <span className="text-[11px] text-blue-700 font-mono hidden sm:inline">
                0 previous records
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STEADFAST ONLY: COURIER CUSTOMER RATING / INFORMATION */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              2. Courier Customer Rating (Steadfast Only)
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-emerald-600" />
              <span>STEADFAST CUSTOMER COURIER RATING</span>
            </h3>
          </div>

          {isLoadingRating && (
            <div className="flex items-center space-x-1.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Checking Steadfast records...</span>
            </div>
          )}
        </div>

        <div className="mt-3.5">
          {steadfastRating && steadfastRating.isAvailable && steadfastRating.isRealData ? (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-300 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-md text-xs font-black bg-emerald-700 text-white tracking-wide">
                    STEADFAST
                  </span>
                  <span className="text-xs font-bold text-emerald-900">
                    STEADFAST CUSTOMER RATING: <span className="font-extrabold text-emerald-800">{steadfastRating.rating}</span>
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded text-[10px] font-bold font-mono">
                  [REAL DATA - {steadfastRating.source === 'official_api' ? 'Official API' : 'Shop Records'}]
                </span>
              </div>

              {/* Real Steadfast Parcel Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/80">
                <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200 text-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Previous Steadfast Orders</span>
                  <strong className="text-sm text-slate-800">
                    {steadfastRating.totalParcels !== null && steadfastRating.totalParcels !== undefined
                      ? `${steadfastRating.totalParcels} parcels`
                      : 'Data unavailable'}
                  </strong>
                </div>

                <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200 text-center">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block">Successful Deliveries</span>
                  <strong className="text-sm text-emerald-700">
                    {steadfastRating.deliveredParcels !== null && steadfastRating.deliveredParcels !== undefined
                      ? `${steadfastRating.deliveredParcels} delivered`
                      : 'Data unavailable'}
                  </strong>
                </div>

                <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200 text-center">
                  <span className="text-[10px] text-rose-700 font-bold uppercase block">Cancelled / Returned</span>
                  <strong className="text-sm text-rose-700">
                    {steadfastRating.cancelledParcels !== null && steadfastRating.cancelledParcels !== undefined
                      ? `${steadfastRating.cancelledParcels} returned`
                      : 'Data unavailable'}
                  </strong>
                </div>

                <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200 text-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Fraud / Reports</span>
                  <strong className="text-sm text-slate-700">
                    {steadfastRating.fraudReports !== null && steadfastRating.fraudReports !== undefined
                      ? `${steadfastRating.fraudReports} reports`
                      : 'Data unavailable'}
                  </strong>
                </div>
              </div>

              {/* Warning remark if present */}
              {steadfastRating.warningRemark && (
                <div className="p-2 bg-amber-100/90 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{steadfastRating.warningRemark}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-xs font-black bg-slate-800 text-white tracking-wide">
                    STEADFAST
                  </span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold text-xs rounded-md">
                    Rating unavailable
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {phone.trim()
                    ? 'Steadfast অফিসিয়াল মার্চেন্ট সিস্টেমে এই নম্বরের কোনো রেটিং হিস্টরি পাওয়া যায়নি (বা মার্চেন্ট অ্যাকাউন্ট এখনও কানেক্ট করা হয়নি)।'
                    : 'ফোন নম্বর প্রদান করলে স্টেডফাস্ট হিস্টরি এখানে যাচাই করা হবে।'}
                </p>
              </div>

              <div className="text-right text-[11px] text-slate-400 font-mono">
                Real Courier Data Only • No Fake Rating
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3, 4, 5. CUSTOMER NAME, PHONE NUMBER, FULL ADDRESS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            3, 4, 5. Customer Information
          </span>
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Customer Details (কাস্টমার তথ্য)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* 3. CUSTOMER NAME */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              CUSTOMER NAME (কাস্টমার নাম)
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. রহিম চৌধুরী"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* 4. PHONE NUMBER */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              PHONE NUMBER (মোবাইল নাম্বার)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 01711223344"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* 5. FULL ADDRESS */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            FULL ADDRESS (পূর্ণ ঠিকানা)
          </label>
          <textarea
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. বাড়ি# ১২, রোড# ৫, সেক্টর# ৩, উত্তরা, ঢাকা"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-y"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. PRODUCT SELECTION & 7-10. SELECTED PRODUCTS (QTY, COLOR, PRICE) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              6, 7, 8, 9, 10. Products & Inventory
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>Product Selection & Details</span>
            </h3>
          </div>

          {/* 6. PRODUCT SELECTION BUTTON (Searchable Multi-Select Modal) */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Select from Inventory (প্রোডাক্ট খুঁজুন)</span>
            </button>
          </div>
        </div>

        {/* Selected Products List */}
        <div className="space-y-3">
          {products.map((item, idx) => {
            const invItem = inventoryInfo[idx];
            const rowTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);

            return (
              <div
                key={idx}
                className="p-3.5 sm:p-4 rounded-xl border transition-all bg-slate-50/80 border-slate-200"
              >
                <div className="grid grid-cols-12 gap-2 sm:gap-3 items-start">
                  {/* PRODUCT NAME (Col 1-5) */}
                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Product Name (প্রোডাক্ট)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => handleUpdateProduct(idx, 'productName', e.target.value)}
                        placeholder="Type or select product..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {invItem && (
                      <div className="flex items-center space-x-2 mt-1 text-[11px]">
                        <span className="text-slate-500 font-medium">
                          Default Inventory Price: <strong>৳{invItem.defaultPrice || 0}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 8. QUANTITY / PIECES (Col 6-7) */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Qty / Pcs (পরিমাণ)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateProduct(idx, 'quantity', Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 9. COLOR (Col 8-9) */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Color (কালার)
                    </label>
                    <input
                      type="text"
                      value={item.color}
                      onChange={(e) => handleUpdateProduct(idx, 'color', e.target.value)}
                      placeholder="e.g. Blue"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 10. PRICE (Col 10-11) */}
                  <div className="col-span-3 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Unit Price (মূল্য ৳)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={item.price}
                      onChange={(e) =>
                        handleUpdateProduct(idx, 'price', Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-right focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* REMOVE BUTTON (Col 12) */}
                  <div className="col-span-1 sm:col-span-1 flex items-center justify-end pt-5">
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(idx)}
                      title="Remove product"
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subtotal */}
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-end text-xs">
                  <div className="text-slate-600">
                    Row Total: ৳{item.price || 0} × {item.quantity || 1} ={' '}
                    <strong className="text-slate-900 font-extrabold text-sm">৳{rowTotal}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 11. TOTAL PRICE (Calculated Product Price × Quantity with manual override capability) */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                11. Order Total Calculation
              </span>
              <p className="text-xs text-emerald-900 font-medium">
                Calculated from Product Price × Quantity for all items
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-600">TOTAL PRICE:</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-emerald-700">
                  ৳
                </span>
                <input
                  type="number"
                  min={0}
                  value={effectiveTotal}
                  onChange={(e) => setManualTotal(Math.max(0, Number(e.target.value) || 0))}
                  className="w-32 pl-7 pr-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-base font-black text-emerald-900 text-right focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Breakdown summary */}
          <div className="text-[11px] text-emerald-800/80 flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-emerald-200/50">
            {products
              .filter((p) => p.productName.trim())
              .map((p, i) => (
                <span key={i}>
                  {p.productName}: ৳{p.price} × {p.quantity} = ৳{Number(p.price) * Number(p.quantity)}
                </span>
              ))}
            {manualTotal !== null && manualTotal !== calculatedTotal && (
              <button
                type="button"
                onClick={() => setManualTotal(null)}
                className="text-emerald-700 underline font-semibold ml-auto cursor-pointer"
              >
                Reset to calculated total (৳{calculatedTotal})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 12. NOTE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          12. Delivery Note
        </span>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          NOTE (নোট বা বিশেষ নির্দেশনা)
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. বাসায় দিয়ে যাবেন, পার্সেল খুলে দেখতে দিন"
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-y"
        />
      </div>

      {/* Confirmation error notice */}
      {confirmError && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl flex items-center space-x-2.5 text-rose-800 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{confirmError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 13. CONFIRM ORDER BUTTON */}
      {/* ========================================================================= */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleConfirmOrder}
          disabled={isConfirming}
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
        >
          {isConfirming ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving Order...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-6 h-6" />
              <span>CONFIRM ORDER (অর্ডার কনফার্ম করুন)</span>
            </>
          )}
        </button>
        <p className="text-center text-xs text-slate-400 mt-2">
          কনফার্ম করলে অর্ডারটি পার্মানেন্টলি সেভ হবে এবং স্ট্যাটাস হবে ON HOLD।
        </p>
      </div>

      {/* Searchable Multi-Product Selection Modal */}
      <ProductSearchSelectModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        inventoryList={inventoryList}
        currentlySelectedNames={products.map((p) => p.productName)}
        onConfirmSelection={handleConfirmProductSelection}
      />
    </div>
  );
};
