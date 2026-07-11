ALTER TABLE `holidays` ADD `packedAt` integer;
--> statement-breakpoint
ALTER TABLE `holidays` ADD `startedAt` integer;
--> statement-breakpoint
ALTER TABLE `holidays` ADD `completedAt` integer;
--> statement-breakpoint
UPDATE `holidays`
SET `state` = 'COMPLETE', `startedAt` = `updatedAt`, `completedAt` = `updatedAt`
WHERE `state` = 'ACTIVE'
  AND `id` NOT IN (
    SELECT `id` FROM `holidays` WHERE `state` = 'ACTIVE' ORDER BY `updatedAt` DESC LIMIT 1
  );
--> statement-breakpoint
UPDATE `holidays`
SET `packedAt` = `updatedAt`
WHERE `state` IN ('PACKED', 'ACTIVE', 'COMPLETE');
--> statement-breakpoint
UPDATE `holidays`
SET `startedAt` = `updatedAt`
WHERE `state` IN ('ACTIVE', 'COMPLETE') AND `startedAt` IS NULL;
--> statement-breakpoint
UPDATE `holidays`
SET `completedAt` = `updatedAt`
WHERE `state` = 'COMPLETE' AND `completedAt` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `pack_list_for_holiday_trip_product_unique`
ON `pack_list_for_holiday` (`holidayId`, `productId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `packs_for_holiday_trip_pack_unique`
ON `packs_for_holiday` (`holidayId`, `packId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `holidays_single_active_unique`
ON `holidays` ((1)) WHERE `state` = 'ACTIVE';
