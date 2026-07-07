import { useDatabase } from "@/db";
import { refreshScheduledInventoryNotifications } from "@/src/services/notificationService";
import { useMutation } from "@tanstack/react-query";

export function useRefreshNotifications() {
  const { db, ready } = useDatabase();

  return useMutation({
    mutationFn: async () => {
      if (!db || !ready) {
        throw new Error("Database not ready");
      }

      return refreshScheduledInventoryNotifications(db);
    },
  });
}
