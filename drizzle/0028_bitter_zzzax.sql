PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_colored_dots` (
	`id` text PRIMARY KEY NOT NULL,
	`color` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_colored_dots`("id", "color", "active") SELECT "id", "color", "active" FROM `colored_dots`;--> statement-breakpoint
DROP TABLE `colored_dots`;--> statement-breakpoint
ALTER TABLE `__new_colored_dots` RENAME TO `colored_dots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`expiry` text,
	`productionDate` text,
	`createdAt` integer NOT NULL,
	`unitsRemaining` integer NOT NULL,
	`ais` text,
	`active` integer DEFAULT true,
	`dateSetManually` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_packs`("id", "productId", "expiry", "productionDate", "createdAt", "unitsRemaining", "ais", "active", "dateSetManually") SELECT "id", "productId", "expiry", "productionDate", "createdAt", "unitsRemaining", "ais", "active", "dateSetManually" FROM `packs`;--> statement-breakpoint
DROP TABLE `packs`;--> statement-breakpoint
ALTER TABLE `__new_packs` RENAME TO `packs`;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`imageUri` text,
	`unitsPerPackDefault` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`canHaveExpiry` integer DEFAULT true NOT NULL,
	`isSessionBased` integer DEFAULT false NOT NULL,
	`nominalSessionTimeDays` integer,
	`useColoredDots` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "imageUri", "unitsPerPackDefault", "active", "canHaveExpiry", "isSessionBased", "nominalSessionTimeDays", "useColoredDots") SELECT "id", "name", "imageUri", "unitsPerPackDefault", "active", "canHaveExpiry", "isSessionBased", "nominalSessionTimeDays", "useColoredDots" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;