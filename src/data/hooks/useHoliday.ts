import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

export function useHoliday(id: string) {
    const {db, ready} = useDatabase();
    const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);

    return useQuery({
        queryKey: qk.holiday(id),
        enabled: ready && !!db && !!id,
        queryFn: () => repo!.getHoliday(id),
    })
}
