"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, HeldOrder, PaymentMethod, SaleType } from "@/types";
import { createInvoiceNumber } from "@/lib/utils";
import { computeSaleTotals, unitPriceFor } from "@/lib/pricing";

type PosState = {
  invoiceNumber: string;
  customerId?: string;
  saleType: SaleType;
  items: CartItem[];
  heldOrders: HeldOrder[];
  paymentMethod: PaymentMethod;
  discountType: "flat" | "percentage";
  discountValue: number;
  couponCode?: string;
  couponDiscount: number;
  paidAmount: number;
  addItem: (item: CartItem) => void;
  setCustomer: (customerId?: string) => void;
  setSaleType: (saleType: SaleType) => void;
  setPaymentMethod: (paymentMethod: PaymentMethod) => void;
  setCoupon: (code?: string, discount?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  holdOrder: (name: string) => void;
  resumeOrder: (id: string) => void;
  voidOrder: () => void;
  setDiscount: (type: "flat" | "percentage", value: number) => void;
  setPaidAmount: (amount: number) => void;
  ensureInvoiceNumber: () => void;
  computed: (extra?: { groupDiscountPercent?: number; pointsRedeemed?: number }) => ReturnType<typeof computeSaleTotals> & { changeDue: number };
};

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      invoiceNumber: "",
      saleType: "retail",
      items: [],
      heldOrders: [],
      paymentMethod: "cash",
      discountType: "flat",
      discountValue: 0,
      couponDiscount: 0,
      paidAmount: 0,
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((cartItem) => cartItem.productId === item.productId);
          const quantityToAdd = Math.max(1, item.quantity);
          if (existing) {
            return { items: state.items.map((cartItem) => (cartItem.productId === item.productId ? { ...cartItem, quantity: Math.min(cartItem.quantity + quantityToAdd, cartItem.stockAvailable) } : cartItem)) };
          }
          return { items: [...state.items, { ...item, quantity: Math.min(quantityToAdd, item.stockAvailable) }] };
        }),
      setCustomer: (customerId) => set({ customerId }),
      setSaleType: (saleType) =>
        set((state) => ({
          saleType,
          // Re-price the open cart so the toggle applies to lines already added.
          items: state.items.map((item) => ({ ...item, unitPrice: unitPriceFor(item, saleType) })),
        })),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setCoupon: (couponCode, couponDiscount = 0) => set({ couponCode, couponDiscount }),
      updateQuantity: (productId, quantity) => set((state) => ({ items: state.items.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stockAvailable)) } : item)) })),
      removeItem: (productId) => set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      holdOrder: (name) => set((state) => ({ heldOrders: [...state.heldOrders, { id: crypto.randomUUID(), name, customerId: state.customerId, items: state.items, saleType: state.saleType, discountType: state.discountType, discountValue: state.discountValue, createdAt: new Date().toISOString() }], items: [], invoiceNumber: createInvoiceNumber() })),
      resumeOrder: (id) => set((state) => {
        const order = state.heldOrders.find((held) => held.id === id);
        if (!order) return state;
        return { items: order.items, customerId: order.customerId, saleType: order.saleType ?? "retail", discountType: order.discountType, discountValue: order.discountValue, heldOrders: state.heldOrders.filter((held) => held.id !== id) };
      }),
      voidOrder: () => set({ invoiceNumber: createInvoiceNumber(), customerId: undefined, saleType: "retail", items: [], discountType: "flat", discountValue: 0, couponCode: undefined, couponDiscount: 0, paidAmount: 0 }),
      setDiscount: (discountType, discountValue) => set({ discountType, discountValue }),
      setPaidAmount: (paidAmount) => set({ paidAmount }),
      ensureInvoiceNumber: () => {
        if (!get().invoiceNumber) {
          set({ invoiceNumber: createInvoiceNumber() });
        }
      },
      computed: (extra) => {
        const state = get();
        const result = computeSaleTotals({
          items: state.items,
          discountType: state.discountType,
          discountValue: state.discountValue,
          couponDiscount: state.couponDiscount ?? 0,
          groupDiscountPercent: extra?.groupDiscountPercent ?? 0,
          pointsRedeemed: extra?.pointsRedeemed ?? 0,
        });
        return { ...result, changeDue: Math.max(state.paidAmount - result.grandTotal, 0) };
      },
    }),
    {
      name: "shopkeeper-pos-v1",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // Carts persisted before wholesale pricing have no sellingPrice or
      // wholesalePrice. Backfill from the price they were added at, so a
      // resumed cart keeps its total instead of re-pricing to zero.
      migrate: (persisted, version) => {
        const state = persisted as Partial<PosState> | undefined;
        if (!state || version >= 2) return state as PosState;
        const backfill = (item: CartItem): CartItem => ({
          ...item,
          sellingPrice: item.sellingPrice ?? item.unitPrice,
          wholesalePrice: item.wholesalePrice ?? 0,
        });
        return {
          ...state,
          saleType: state.saleType ?? "retail",
          items: (state.items ?? []).map(backfill),
          heldOrders: (state.heldOrders ?? []).map((order) => ({
            ...order,
            saleType: order.saleType ?? "retail",
            items: (order.items ?? []).map(backfill),
          })),
        } as PosState;
      },
      partialize: (state) => ({ invoiceNumber: state.invoiceNumber, customerId: state.customerId, saleType: state.saleType, items: state.items, heldOrders: state.heldOrders, paymentMethod: state.paymentMethod, discountType: state.discountType, discountValue: state.discountValue, couponCode: state.couponCode, couponDiscount: state.couponDiscount, paidAmount: state.paidAmount }),
      skipHydration: true,
    },
  ),
);

export function usePosStoreRehydration() {
  useEffect(() => {
    const finish = () => {
      usePosStore.getState().ensureInvoiceNumber();
    };

    const unsub = usePosStore.persist.onFinishHydration(finish);
    if (usePosStore.persist.hasHydrated()) {
      finish();
    } else {
      void usePosStore.persist.rehydrate();
    }

    return unsub;
  }, []);
}
