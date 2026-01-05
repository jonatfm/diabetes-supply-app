import { useDatabase } from "@/db";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { productIdentifiersRepo } from "../productIdentifiersRepo";

export function useFindIdentifierByValue() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? productIdentifiersRepo(db) : null), [db]);

  return useMutation({
    mutationKey: ["identifierLookup"],
    mutationFn: ({ value }: { value: string }) => repo!.findByValue(value),
  });
}
