CREATE TABLE `product_identifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productId` integer NOT NULL,
	`createdAt` integer DEFAULT 1766268480748,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`imageUri` text,
	`defaultUnit` text NOT NULL,
	`unitsPerPackDefault` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
