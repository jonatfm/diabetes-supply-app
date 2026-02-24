import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

/** Returns the currently active holiday, or null if none is active. */
export function useActiveHoliday() {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.activeHoliday(),
    enabled: ready && !!db,
    queryFn: () => repo!.getActiveHoliday(),
  });
}
