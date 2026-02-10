PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`destination` text NOT NULL,
	`durationDays` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_holidays`("id", "destination", "durationDays", "state") SELECT "id", "destination", 0, 'PLANNED' FROM `holidays`;--> statement-breakpoint
DROP TABLE `holidays`;--> statement-breakpoint
ALTER TABLE `__new_holidays` RENAME TO `holidays`;--> statement-breakpoint
CREATE TABLE `pack_list_for_holiday` (
	`id` text PRIMARY KEY NOT NULL,
	`holidayId` text NOT NULL,
	`productId` text NOT NULL,
	`amountCalculationType` text NOT NULL,
	`amountCalculationAttributes` text NOT NULL,
	FOREIGN KEY (`holidayId`) REFERENCES `holidays`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=ON;