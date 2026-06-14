"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, HeldOrder, PaymentMethod } from "@/types";
import { createInvoiceNumber, totals } from "@/lib/utils";

type PosState = {
  invoiceNumber: string;
  customerId?: string;
  items: CartItem[];
  heldOrders: HeldOrder[];
  paymentMethod: PaymentMethod;
  discountType: "flat" | "percentage";
  discountValue: number;
  paidAmount: number;
  addItem: (item: CartItem) => void;
  setCustomer: (customerId?: string) => void;
  setPaymentMethod: (paymentMethod: PaymentMethod) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  holdOrder: (name: string) => void;
  resumeOrder: (id: string) => void;
  voidOrder: () => void;
  setDiscount: (type: "flat" | "percentage", value: number) => void;
  setPaidAmount: (amount: number) => void;
  ensureInvoiceNumber: () => void;
  computed: () => ReturnType<typeof totals> & { changeDue: number };
};

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      invoiceNumber: "",
      items: [],
      heldOrders: [],
      paymentMethod: "cash",
      discountType: "flat",
      discountValue: 0,
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
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      updateQuantity: (productId, quantity) => set((state) => ({ items: state.items.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stockAvailable)) } : item)) })),
      removeItem: (productId) => set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      holdOrder: (name) => set((state) => ({ heldOrders: [...state.heldOrders, { id: crypto.randomUUID(), name, customerId: state.customerId, items: state.items, discountType: state.discountType, discountValue: state.discountValue, createdAt: new Date().toISOString() }], items: [], invoiceNumber: createInvoiceNumber() })),
      resumeOrder: (id) => set((state) => {
        const order = state.heldOrders.find((held) => held.id === id);
        if (!order) return state;
        return { items: order.items, customerId: order.customerId, discountType: order.discountType, discountValue: order.discountValue, heldOrders: state.heldOrders.filter((held) => held.id !== id) };
      }),
      voidOrder: () => set({ invoiceNumber: createInvoiceNumber(), customerId: undefined, items: [], discountType: "flat", discountValue: 0, paidAmount: 0 }),
      setDiscount: (discountType, discountValue) => set({ discountType, discountValue }),
      setPaidAmount: (paidAmount) => set({ paidAmount }),
      ensureInvoiceNumber: () => {
        if (!get().invoiceNumber) {
          set({ invoiceNumber: createInvoiceNumber() });
        }
      },
      computed: () => {
        const state = get();
        const subtotal = state.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const orderDiscount = state.discountType === "percentage" ? (subtotal * state.discountValue) / 100 : state.discountValue;
        const result = totals(state.items, orderDiscount);
        return { ...result, changeDue: Math.max(state.paidAmount - result.grandTotal, 0) };
      },
    }),
    {
      name: "shopkeeper-pos-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ invoiceNumber: state.invoiceNumber, customerId: state.customerId, items: state.items, heldOrders: state.heldOrders, paymentMethod: state.paymentMethod, discountType: state.discountType, discountValue: state.discountValue, paidAmount: state.paidAmount }),
    },
  ),
);
