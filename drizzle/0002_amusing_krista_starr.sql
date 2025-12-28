PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product_identifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productId` integer NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_product_identifiers`("id", "productId", "type", "value", "createdAt") SELECT "id", "productId", "type", "value", "createdAt" FROM `product_identifiers`;--> statement-breakpoint
DROP TABLE `product_identifiers`;--> statement-breakpoint
ALTER TABLE `__new_product_identifiers` RENAME TO `product_identifiers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;