import { useDatabase } from "@/db";
import { ProductIdentifier } from "@/db/schema";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { productIdentifiersRepo } from "../productIdentifiersRepo";

export function useFindIdentifierByValue() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? productIdentifiersRepo(db) : null), [db]);

  return useMutation({
    mutationKey: ["identifierLookup"],
    mutationFn: ({ value, type }: { value: string; type?: ProductIdentifier["type"] | null }) => {
      if (type) {
        return repo!.findMatchingIdentifier(type, value);
      }

      return repo!.findByValue(value);
    },
  });
}
