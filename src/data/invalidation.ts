import { QueryClient } from "@tanstack/react-query";
import { qk } from "./queryKeys";

export async function invalidateProductInventory(qc: QueryClient, productId: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.packs(productId) }),
    qc.invalidateQueries({ queryKey: qk.totalUnits(productId) }),
    qc.invalidateQueries({ queryKey: qk.history(productId) }),
  ]);
}

export async function invalidateProductUsageStats(qc: QueryClient, productId: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.sessionOutcomeStatsByProduct(productId) }),
    qc.invalidateQueries({ queryKey: qk.averageTimeBetweenTakes(productId) }),
    qc.invalidateQueries({ queryKey: qk.takeEventStatistics(productId) }),
    qc.invalidateQueries({ queryKey: qk.sessionStatistics(productId) }),
    qc.invalidateQueries({ queryKey: qk.daysUntilOutOfStock(productId) }),
  ]);
}

export async function invalidateProductSessions(qc: QueryClient, productId: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.session(productId) }),
    qc.invalidateQueries({ queryKey: qk.sessions() }),
  ]);
}

export async function invalidateProductIdentity(qc: QueryClient, productId: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.product(productId) }),
    qc.invalidateQueries({ queryKey: qk.identifiers(productId) }),
  ]);
}

export async function invalidateHolidayReservations(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.activeHoliday() }),
    qc.invalidateQueries({ queryKey: qk.packsForHolidayRoot() }),
  ]);
}
