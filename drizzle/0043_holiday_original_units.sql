ALTER TABLE `packs_for_holiday` ADD `originalUnits` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `packs_for_holiday` SET `originalUnits` = `units`;
