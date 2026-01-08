PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_stock_events` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`packId` text,
	`type` text NOT NULL,
	`deltaUnits` integer,
	`occurredAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`relatedEventId` text,
	`note` text,
	`meta` text,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`packId`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_stock_events`("id", "productId", "packId", "type", "deltaUnits", "occurredAt", "createdAt", "relatedEventId", "note", "meta") SELECT "id", "productId", "packId", "type", "deltaUnits", "occurredAt", "createdAt", "relatedEventId", "note", "meta" FROM `stock_events`;--> statement-breakpoint
DROP TABLE `stock_events`;--> statement-breakpoint
ALTER TABLE `__new_stock_events` RENAME TO `stock_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;