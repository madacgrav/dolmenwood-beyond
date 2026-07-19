'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface PageHeader {
  title?: string;
  /** true = router.back(); string = push to that href */
  back?: boolean | string;
  action?: ReactNode;
}

interface ContextValue {
  header: PageHeader;
  setHeader: (h: PageHeader) => void;
}

const PageHeaderCtx = createContext<ContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeader>({});
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <PageHeaderCtx.Provider value={value}>{children}</PageHeaderCtx.Provider>;
}

/**
 * Declare the app-bar contents for the current page. Pass a stable/memoized
 * `action` node — it is part of the effect deps by identity.
 */
export function usePageHeader(header: PageHeader) {
  const ctx = useContext(PageHeaderCtx);
  if (!ctx) throw new Error('usePageHeader must be used inside PageHeaderProvider');
  const { setHeader } = ctx;
  useEffect(() => {
    setHeader(header);
    return () => setHeader({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.title, header.back, header.action, setHeader]);
}

export function usePageHeaderValue(): PageHeader {
  const ctx = useContext(PageHeaderCtx);
  return ctx?.header ?? {};
}

/** For server-component pages: render this client child to set the app-bar title. */
export function SetPageHeader({ title, back }: { title: string; back?: boolean | string }) {
  usePageHeader({ title, back });
  return null;
}
