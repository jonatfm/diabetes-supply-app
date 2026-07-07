import { Product } from "@/db/schema";
import { SessionStatistics, TakeEventStatistics } from "@/src/data/statisticsRepo";

export function estimateDaysUntilOutOfStock(params: {
  product: Product;
  totalUnits: number;
  sessionStats?: SessionStatistics | null;
  takeStats?: TakeEventStatistics | null;
}) {
  const { product, totalUnits, sessionStats, takeStats } = params;

  if (totalUnits === 0) {
    return 0;
  }

  if (product.isSessionBased) {
    if (!sessionStats || sessionStats.totalCompletedSessions < 2) {
      return null;
    }

    const daysPerUnit = sessionStats.averageSessionDurationDays + sessionStats.averageTimeBetweenSessionsDays;
    return daysPerUnit > 0 ? totalUnits * daysPerUnit : null;
  }

  if (!takeStats || takeStats.eventCount < 2) {
    return null;
  }

  return takeStats.averageDays > 0 ? totalUnits * takeStats.averageDays : null;
}
