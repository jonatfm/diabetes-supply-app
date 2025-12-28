PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product_identifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productId` integer NOT NULL,
	`createdAt` integer DEFAULT 1766273413751,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_product_identifiers`("id", "productId", "createdAt") SELECT "id", "productId", "createdAt" FROM `product_identifiers`;--> statement-breakpoint
DROP TABLE `product_identifiers`;--> statement-breakpoint
ALTER TABLE `__new_product_identifiers` RENAME TO `product_identifiers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;