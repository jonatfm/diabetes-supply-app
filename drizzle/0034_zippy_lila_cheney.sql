PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_app_warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text,
	`type` text NOT NULL,
	`timeInAdvance` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_app_warnings`("id", "productId", "type", "timeInAdvance", "createdAt") SELECT "id", "productId", "type", "timeInAdvance", "createdAt" FROM `app_warnings`;--> statement-breakpoint
DROP TABLE `app_warnings`;--> statement-breakpoint
ALTER TABLE `__new_app_warnings` RENAME TO `app_warnings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;