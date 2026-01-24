CREATE TABLE `usual_items_for_holiday` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`destination` text NOT NULL,
	`startDate` text NOT NULL,
	`endDate` text NOT NULL
);
