CREATE TABLE `packs_for_holiday` (
	`id` text PRIMARY KEY NOT NULL,
	`holidayId` text NOT NULL,
	`packId` text NOT NULL,
	FOREIGN KEY (`holidayId`) REFERENCES `holidays`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`packId`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE no action
);
