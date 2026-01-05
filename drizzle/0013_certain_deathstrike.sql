PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`expiry` text,
	`productionDate` text,
	`createdAt` integer NOT NULL,
	`unitsInPack` integer NOT NULL,
	`ais` text,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `__new_product_identifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`imageUri` text,
	`unitsPerPackDefault` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`canHaveExpiry` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
-- Migrate products with UUID generation
INSERT INTO `__new_products` (`id`, `name`, `imageUri`, `unitsPerPackDefault`, `active`, `canHaveExpiry`)
SELECT 
  lower(hex(randomblob(16))),
  `name`,
  `imageUri`,
  `unitsPerPackDefault`,
  `active`,
  `canHaveExpiry`
FROM `products`;
--> statement-breakpoint
-- Create a temporary mapping table
CREATE TABLE `id_mapping` (
  `old_id` INTEGER PRIMARY KEY,
  `new_id` TEXT NOT NULL
);
--> statement-breakpoint
-- Populate mapping by matching on name (assuming names are unique)
INSERT INTO `id_mapping` (`old_id`, `new_id`)
SELECT p.id, np.id FROM products p JOIN __new_products np ON p.name = np.name;
--> statement-breakpoint
-- Migrate product_identifiers
INSERT INTO `__new_product_identifiers` (`id`, `productId`, `type`, `value`, `createdAt`)
SELECT 
  lower(hex(randomblob(16))),
  (SELECT new_id FROM id_mapping WHERE old_id = pi.productId),
  pi.type,
  pi.value,
  pi.createdAt
FROM `product_identifiers` pi;
--> statement-breakpoint
-- Migrate packs
INSERT INTO `__new_packs` (`id`, `productId`, `expiry`, `productionDate`, `createdAt`, `unitsInPack`, `ais`)
SELECT 
  lower(hex(randomblob(16))),
  (SELECT new_id FROM id_mapping WHERE old_id = p.productId),
  p.expiry,
  p.productionDate,
  p.createdAt,
  p.unitsInPack,
  p.ais
FROM `packs` p;
--> statement-breakpoint
DROP TABLE `id_mapping`;
--> statement-breakpoint
DROP TABLE `packs`;
--> statement-breakpoint
DROP TABLE `product_identifiers`;
--> statement-breakpoint
DROP TABLE `products`;
--> statement-breakpoint
ALTER TABLE `__new_packs` RENAME TO `packs`;
--> statement-breakpoint
ALTER TABLE `__new_product_identifiers` RENAME TO `product_identifiers`;
--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;