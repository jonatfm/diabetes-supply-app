import { products, sessions, stock_events } from "@/db/schema";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export interface SessionStatistics {
  averageSessionDurationMs: number;
  averageSessionDurationDays: number;
  averageTimeBetweenSessionsMs: number;
  averageTimeBetweenSessionsDays: number;
  totalCompletedSessions: number;
  periodInDays?: number;
}

export interface TakeEventStatistics {
  averageMs: number;
  averageHours: number;
  averageDays: number;
  eventCount: number;
  periodInDays?: number;
}

export function statisticsRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    /**
     * Get session statistics for session-based products
     * Calculates average session duration and average time between session end and next session start
     */
    async getSessionStatistics(productId: string, periodInDays?: number): Promise<SessionStatistics | null> {
      let conditions = [eq(sessions.productId, productId)];

      if (periodInDays) {
        const cutoffTime = Date.now() - (periodInDays * 24 * 60 * 60 * 1000);
        conditions.push(gte(sessions.startedAt, cutoffTime));
      }

      // Get all completed sessions (sessions with endedAt set)
      const completedSessions = await db
        .select({
          id: sessions.id,
          startedAt: sessions.startedAt,
          endedAt: sessions.endedAt,
          outcome: sessions.outcome,
        })
        .from(sessions)
        .where(and(...conditions, isNotNull(sessions.endedAt)))
        .orderBy(desc(sessions.startedAt));

      if (completedSessions.length === 0) {
        return null;
      }

      // Calculate average session duration
      const sessionDurations: number[] = [];
      for (const session of completedSessions) {
        if (session.endedAt && session.startedAt) {
          const duration = session.endedAt - session.startedAt;
          sessionDurations.push(duration);
        }
      }

      const averageSessionDurationMs = sessionDurations.length > 0
        ? sessionDurations.reduce((sum, dur) => sum + dur, 0) / sessionDurations.length
        : 0;

      // Calculate average time between sessions (from end of one session to start of next)
      const timeBetweenSessions: number[] = [];
      for (let i = 0; i < completedSessions.length - 1; i++) {
        const currentSessionEnd = completedSessions[i].endedAt!;
        const nextSessionStart = completedSessions[i + 1].startedAt;
        
        // Sessions are ordered DESC by startedAt, so [i] is more recent than [i+1]
        // Time between = start of current session - end of previous (older) session
        // But we need: end of older session to start of newer session
        // Since [i] is newer and [i+1] is older:
        // We want: startedAt[i] - endedAt[i+1]
        const olderSessionEnd = completedSessions[i + 1].endedAt;
        const newerSessionStart = completedSessions[i].startedAt;
        
        if (olderSessionEnd) {
          const timeBetween = newerSessionStart - olderSessionEnd;
          
          // Only count positive time differences (normal case)
          if (timeBetween > 0) {
            timeBetweenSessions.push(timeBetween);
          }
        }
      }

      const averageTimeBetweenSessionsMs = timeBetweenSessions.length > 0
        ? timeBetweenSessions.reduce((sum, time) => sum + time, 0) / timeBetweenSessions.length
        : 0;

      const MS_PER_DAY = 1000 * 60 * 60 * 24;

      return {
        averageSessionDurationMs,
        averageSessionDurationDays: averageSessionDurationMs / MS_PER_DAY,
        averageTimeBetweenSessionsMs,
        averageTimeBetweenSessionsDays: averageTimeBetweenSessionsMs / MS_PER_DAY,
        totalCompletedSessions: completedSessions.length,
        periodInDays,
      };
    },

    /**
     * Get TAKE event statistics for non-session-based products
     * Calculates average time between TAKE events, excluding periods with ADJUST events
     */
    async getTakeEventStatistics(productId: string, periodInDays?: number): Promise<TakeEventStatistics | null> {
      let conditions = [
        eq(stock_events.productId, productId),
        eq(stock_events.type, "TAKE")
      ];

      if (periodInDays) {
        const cutoffTime = Date.now() - (periodInDays * 24 * 60 * 60 * 1000);
        conditions.push(gte(stock_events.occurredAt, cutoffTime));
      }

      const takeEvents = await db
        .select({
          id: stock_events.id,
          occurredAt: stock_events.occurredAt,
        })
        .from(stock_events)
        .where(and(...conditions))
        .orderBy(desc(stock_events.occurredAt));

      if (takeEvents.length < 2) {
        return null; // Need at least 2 events to calculate an average
      }

      // Get all ADJUST events for this product to check for interference
      let adjustConditions = [
        eq(stock_events.productId, productId),
        eq(stock_events.type, "ADJUST")
      ];

      if (periodInDays) {
        const cutoffTime = Date.now() - (periodInDays * 24 * 60 * 60 * 1000);
        adjustConditions.push(gte(stock_events.occurredAt, cutoffTime));
      }

      const adjustEvents = await db
        .select({
          id: stock_events.id,
          occurredAt: stock_events.occurredAt,
        })
        .from(stock_events)
        .where(and(...adjustConditions))
        .orderBy(desc(stock_events.occurredAt));

      // Calculate time differences between consecutive TAKE events
      // Skip periods where an ADJUST event occurred in between
      const timeDifferences: number[] = [];
      for (let i = 0; i < takeEvents.length - 1; i++) {
        const newerTakeTime = takeEvents[i].occurredAt;
        const olderTakeTime = takeEvents[i + 1].occurredAt;
        
        // Check if there's an ADJUST event between these two TAKE events
        const hasAdjustBetween = adjustEvents.some(adjustEvent => 
          adjustEvent.occurredAt > olderTakeTime && adjustEvent.occurredAt < newerTakeTime
        );

        // Only include this time difference if there's no ADJUST event in between
        if (!hasAdjustBetween) {
          const diff = newerTakeTime - olderTakeTime;
          timeDifferences.push(diff);
        }
      }

      if (timeDifferences.length === 0) {
        return null; // No valid periods to calculate average
      }

      // Calculate average time difference in milliseconds
      const averageMs = timeDifferences.reduce((sum, diff) => sum + diff, 0) / timeDifferences.length;

      return {
        averageMs,
        averageHours: averageMs / (1000 * 60 * 60),
        averageDays: averageMs / (1000 * 60 * 60 * 24),
        eventCount: takeEvents.length,
        periodInDays,
      };
    },

    /**
     * Get average duration per item for any product type
     * - For non-session-based products: uses average time between TAKE events
     * - For session-based products: uses average session duration + average time between sessions
     */
    async getAverageDurationPerItem(productId: string, periodInDays?: number) {
      // Get product to determine if it's session-based
      const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      
      if (product.length === 0) {
        return null;
      }

      const isSessionBased = product[0].isSessionBased;

      if (isSessionBased) {
        const sessionStats = await this.getSessionStatistics(productId, periodInDays);
        
        if (!sessionStats) {
          return null;
        }

        // Average duration per item = average session duration + average time between sessions
        return sessionStats.averageSessionDurationDays + sessionStats.averageTimeBetweenSessionsDays;
      } else {
        const takeStats = await this.getTakeEventStatistics(productId, periodInDays);
        
        if (!takeStats) {
          return null;
        }

        return takeStats.averageDays;
      }
    }
  }
}
