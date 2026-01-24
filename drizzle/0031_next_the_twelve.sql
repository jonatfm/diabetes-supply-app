ALTER TABLE `usual_items_for_holiday` RENAME TO `usual_products_for_holiday`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_usual_products_for_holiday` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_usual_products_for_holiday`("id", "productId") SELECT "id", "productId" FROM `usual_products_for_holiday`;--> statement-breakpoint
DROP TABLE `usual_products_for_holiday`;--> statement-breakpoint
ALTER TABLE `__new_usual_products_for_holiday` RENAME TO `usual_products_for_holiday`;--> statement-breakpoint
PRAGMA foreign_keys=ON;