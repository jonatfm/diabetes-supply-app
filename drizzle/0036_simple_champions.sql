ALTER TABLE `app_warnings_for_product` RENAME TO `app_warnings_for_products`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_app_warnings_for_products` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`type` text NOT NULL,
	`timeInAdvance` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_app_warnings_for_products`("id", "productId", "type", "timeInAdvance", "createdAt") SELECT "id", "productId", "type", "timeInAdvance", "createdAt" FROM `app_warnings_for_products`;--> statement-breakpoint
DROP TABLE `app_warnings_for_products`;--> statement-breakpoint
ALTER TABLE `__new_app_warnings_for_products` RENAME TO `app_warnings_for_products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;