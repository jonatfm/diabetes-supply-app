CREATE TABLE `app_warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`type` text NOT NULL,
	`timeInAdvance` integer NOT NULL,
	`createdAt` integer NOT NULL
);
