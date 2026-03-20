ALTER TABLE `devices` ADD `cpu_temp` float;--> statement-breakpoint
ALTER TABLE `devices` ADD `cpu_usage` float;--> statement-breakpoint
ALTER TABLE `devices` ADD `memory_usage` float;--> statement-breakpoint
ALTER TABLE `devices` ADD `uptime` int;--> statement-breakpoint
ALTER TABLE `devices` ADD `last_offline_notified_at` timestamp;