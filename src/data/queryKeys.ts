
export const qk = {
  products: () => ["products"] as const,
  product: (id: string) => ["product", id] as const,
  identifiers: (id: string) => ["productIdentifiers", id] as const,
  identifierLookup: (value: string) => ["identifierLookup", value] as const,
  packs: (id: string) => ["packs", id] as const,
  totalUnits: (id: string) => ["totalUnits", id] as const,
  history: (id: string) => ["stockHistory", id] as const,
};
