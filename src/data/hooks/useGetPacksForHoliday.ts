import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

export function useGetPacksForHoliday(holidayId: string) {
  const {db, ready} = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.packsForHoliday(holidayId),
    enabled: ready && !!db,
    queryFn: () => repo!.getPacksForHoliday(holidayId),
  })
}