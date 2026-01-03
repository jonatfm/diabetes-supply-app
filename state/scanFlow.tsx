import type { BarcodeResult } from '@/modules/frame-processor-v2/src';
import type { GS1Data } from '@/scripts/gs1';
import { detectBarcodeFormat, getConvenienceFields, parseGS1Unified } from '@/scripts/gs1';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ConvenienceFields = {
  identifier: string;
  identifierType: 'GTIN' | 'EAN13' | null;
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
    const text = barcode.text ?? '';
    console.log('setScanResult - text:', text);
    const detected = detectBarcodeFormat(text);
    console.log('setScanResult - detected:', detected);
    
    if (detected.format === 'GS1') {
      const parsed = parseGS1Unified(text);
      console.log('setScanResult - parsed GS1:', parsed);
      setGs1(parsed);
      const conv = getConvenienceFields(parsed);
      console.log('setScanResult - conv:', conv);
      setConvenience(conv);
    } else if (detected.format === 'EAN13') {
      setGs1(null);
      const conv = getConvenienceFields(text);
      console.log('setScanResult - conv (EAN13):', conv);
      setConvenience(conv);
    } else {
      setGs1(null);
      setConvenience(null);
    }
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
