CREATE TABLE `packs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productId` integer NOT NULL,
	`identifierId` integer NOT NULL,
	`identifierIdType` text NOT NULL,
	`lot` text,
	`expiry` text,
	`productionDate` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
