"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbContextValue {
  items: BreadcrumbItem[];
  setItems: (items: BreadcrumbItem[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  items: [],
  setItems: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[]>([]);

  useEffect(() => {
    if (items.length > 0) {
      const trail = items.map((i) => i.label).join(" > ");
      document.title = `${trail} - Gateway`;
    }
  }, [items]);

  return <BreadcrumbContext.Provider value={{ items, setItems }}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbs(items?: BreadcrumbItem[]) {
  const ctx = useContext(BreadcrumbContext);
  const { setItems } = ctx;
  const itemsKey = items ? JSON.stringify(items) : "";
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (itemsRef.current) setItems(itemsRef.current);
  }, [itemsKey, setItems]);

  return ctx;
}
