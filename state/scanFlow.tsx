import type { BarcodeResult } from '@/modules/frame-processor-v2/src';
import type { GS1Data } from '@/scripts/gs1';
import { getConvenienceFields, parseGS1Unified } from '@/scripts/gs1';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ConvenienceFields = {
  gtin: string;
  lot: string;
  expiry: string;
  serial: string;
  productionDate: string;
};

export type ScanFlowContextValue = {
  lastBarcodeResult: BarcodeResult | null;
  gs1: GS1Data | null;
  convenience: ConvenienceFields | null;
  selectedProductId?: number;
  setScanResult: (barcode: BarcodeResult) => void;
  reset: () => void;
  setSelectedProduct: (id: number | undefined) => void;
};

const ScanFlowContext = createContext<ScanFlowContextValue | undefined>(undefined);

export function ScanFlowProvider({ children }: { children: React.ReactNode }) {
  const [lastBarcodeResult, setLastBarcodeResult] = useState<BarcodeResult | null>(null);
  const [gs1, setGs1] = useState<GS1Data | null>(null);
  const [convenience, setConvenience] = useState<ConvenienceFields | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(undefined);

  const setScanResult = useCallback((barcode: BarcodeResult) => {
    setLastBarcodeResult(barcode);
    const parsed = parseGS1Unified(barcode.text ?? '');
    setGs1(parsed);
    const conv = getConvenienceFields(parsed);
    setConvenience(conv);
  }, []);

  const reset = useCallback(() => {
    setLastBarcodeResult(null);
    setGs1(null);
    setConvenience(null);
    setSelectedProductId(undefined);
  }, []);

  const value = useMemo<ScanFlowContextValue>(() => ({
    lastBarcodeResult,
    gs1,
    convenience,
    selectedProductId,
    setScanResult,
    reset,
    setSelectedProduct: setSelectedProductId,
  }), [lastBarcodeResult, gs1, convenience, selectedProductId, setScanResult, reset]);

  return (
    <ScanFlowContext.Provider value={value}>
      {children}
    </ScanFlowContext.Provider>
  );
}

export function useScanFlow(): ScanFlowContextValue {
  const ctx = useContext(ScanFlowContext);
  if (!ctx) {
    throw new Error('useScanFlow must be used within a ScanFlowProvider');
  }
  return ctx;
}
