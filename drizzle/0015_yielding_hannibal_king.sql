CREATE TABLE `stock_events` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`packId` text,
	`type` text NOT NULL,
	`deltaUnits` integer NOT NULL,
	`occurredAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`relatedEventId` text,
	`note` text,
	`meta` text,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`packId`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE no action
);
