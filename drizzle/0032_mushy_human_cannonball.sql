DROP TABLE `usual_products_for_holiday`;--> statement-breakpoint
ALTER TABLE `products` ADD `requiredForHoliday` integer DEFAULT false NOT NULL;