import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { packsRepo } from "../packsRepo";
import { productRepo } from "../productRepo";
import { qk } from "../queryKeys";
import { statisticsRepo } from "../statisticsRepo";

export interface DaysUntilOutOfStockResult {
  estimatedDaysUntilOOS: number | null;
  isSessionBased: boolean;
  totalUnits: number;
  
  // For non-session-based products
  averageTimeBetweenTakesDays?: number;
  takeEventCount?: number;
  
  // For session-based products
  averageSessionDurationDays?: number;
  averageTimeBetweenSessionsDays?: number;
  totalCompletedSessions?: number;
  
  periodInDays?: number;
}

/**
 * Hook to calculate days until out of stock for any product type
 * - For non-session-based products: uses average time between TAKE events
 * - For session-based products: uses average session duration + average time between sessions
 */
export function useDaysUntilOutOfStock(productId: string, periodInDays?: number) {
  const { db, ready } = useDatabase();
  const statsRepo = useMemo(() => (db ? statisticsRepo(db) : null), [db]);
  const packsRepository = useMemo(() => (db ? packsRepo(db) : null), [db]);
  const productRepository = useMemo(() => (db ? productRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.daysUntilOutOfStock(productId, periodInDays),
    enabled: ready && !!db && !!productId,
    staleTime: 0,
    queryFn: async (): Promise<DaysUntilOutOfStockResult | null> => {
      // Get product to determine if it's session-based
      const product = await productRepository!.getProductById(productId);
      if (!product) {
        return null;
      }

      // Get total units remaining
      const totalUnits = await packsRepository!.totalUnitsByProduct(productId);
      
      if (totalUnits === 0) {
        return {
          estimatedDaysUntilOOS: 0,
          isSessionBased: product.isSessionBased,
          totalUnits: 0,
          periodInDays,
        };
      }

      if (product.isSessionBased) {
        // For session-based products, calculate based on session statistics
        const sessionStats = await statsRepo!.getSessionStatistics(productId, periodInDays);
        
        if (!sessionStats || sessionStats.totalCompletedSessions < 2) {
          return {
            estimatedDaysUntilOOS: null,
            isSessionBased: true,
            totalUnits,
            periodInDays,
          };
        }

        // Days per unit = average session duration + average time between sessions
        const daysPerUnit = sessionStats.averageSessionDurationDays + sessionStats.averageTimeBetweenSessionsDays;
        const estimatedDaysUntilOOS = daysPerUnit > 0 ? totalUnits * daysPerUnit : null;

        return {
          estimatedDaysUntilOOS,
          isSessionBased: true,
          totalUnits,
          averageSessionDurationDays: sessionStats.averageSessionDurationDays,
          averageTimeBetweenSessionsDays: sessionStats.averageTimeBetweenSessionsDays,
          totalCompletedSessions: sessionStats.totalCompletedSessions,
          periodInDays,
        };
      } else {
        // For non-session-based products, calculate based on TAKE events
        const takeStats = await statsRepo!.getTakeEventStatistics(productId, periodInDays);
        
        if (!takeStats || takeStats.eventCount < 2) {
          return {
            estimatedDaysUntilOOS: null,
            isSessionBased: false,
            totalUnits,
            periodInDays,
          };
        }

        const estimatedDaysUntilOOS = takeStats.averageDays > 0 
          ? totalUnits * takeStats.averageDays 
          : null;

        return {
          estimatedDaysUntilOOS,
          isSessionBased: false,
          totalUnits,
          averageTimeBetweenTakesDays: takeStats.averageDays,
          takeEventCount: takeStats.eventCount,
          periodInDays,
        };
      }
    },
  });
}
