import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

/** Returns the pack list (product entries) for a given holiday. */
export function usePackListForHoliday(holidayId: string | undefined) {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.packListForHoliday(holidayId ?? ""),
    enabled: ready && !!db && !!holidayId,
    queryFn: () => repo!.getHolidayPackList(holidayId!),
  });
}
