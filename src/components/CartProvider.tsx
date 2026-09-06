"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CartItem {
  slug: string;
  packets: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  add: (slug: string, packets: number) => void;
  setQty: (slug: string, packets: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  ready: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "nn_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) setItems(parsed.filter((i) => i.packets > 0));
      }
    } catch {
      /* corrupted cart — start fresh */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* private mode etc. */
    }
  }, [items, ready]);

  const add = useCallback((slug: string, packets: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.slug === slug);
      if (existing) {
        return prev.map((i) =>
          i.slug === slug ? { ...i, packets: i.packets + packets } : i
        );
      }
      return [...prev, { slug, packets }];
    });
  }, []);

  const setQty = useCallback((slug: string, packets: number) => {
    setItems((prev) =>
      packets <= 0
        ? prev.filter((i) => i.slug !== slug)
        : prev.map((i) => (i.slug === slug ? { ...i, packets } : i))
    );
  }, []);

  const remove = useCallback((slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.packets, 0),
      add,
      setQty,
      remove,
      clear,
      ready,
    }),
    [items, add, setQty, remove, clear, ready]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
