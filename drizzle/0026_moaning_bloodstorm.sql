CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_settings_key_unique` ON `app_settings` (`key`);--> statement-breakpoint
CREATE TABLE `colored_dot_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`packId` text NOT NULL,
	`dotIds` text,
	FOREIGN KEY (`packId`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_colored_dots` (
	`id` text PRIMARY KEY NOT NULL,
	`color` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_colored_dots`("id", "color", "active") SELECT "id", "color", "active" FROM `colored_dots`;--> statement-breakpoint
DROP TABLE `colored_dots`;--> statement-breakpoint
ALTER TABLE `__new_colored_dots` RENAME TO `colored_dots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;