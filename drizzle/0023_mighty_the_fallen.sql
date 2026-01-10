CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`packId` text,
	`startedAt` integer NOT NULL,
	`endedAt` integer,
	`outcome` text,
	`reason` text,
	`note` text,
	`meta` text,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`packId`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE no action
);
