CREATE TABLE `yamnet_model_comparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alarm_record_id` int NOT NULL,
	`baseline_model_id` int NOT NULL,
	`compare_model_id` int NOT NULL,
	`baseline_event_type` varchar(20),
	`baseline_confidence` int,
	`baseline_processing_time` int,
	`compare_event_type` varchar(20),
	`compare_confidence` int,
	`compare_processing_time` int,
	`confidence_diff` int,
	`processing_time_diff` int,
	`is_consistent` boolean,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `yamnet_model_comparisons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `yamnet_model_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`model_id` int NOT NULL,
	`total_inferences` int NOT NULL DEFAULT 0,
	`avg_processing_time` int,
	`avg_confidence` int,
	`fall_count` int DEFAULT 0,
	`scream_count` int DEFAULT 0,
	`cough_count` int DEFAULT 0,
	`moan_count` int DEFAULT 0,
	`high_confidence_count` int DEFAULT 0,
	`medium_confidence_count` int DEFAULT 0,
	`low_confidence_count` int DEFAULT 0,
	`period_start` timestamp NOT NULL,
	`period_end` timestamp NOT NULL,
	`last_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `yamnet_model_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `yamnet_models` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`model_path` varchar(255) NOT NULL,
	`checksum_hash` varchar(64),
	`avg_processing_time` int,
	`avg_accuracy` int,
	`supported_labels` int DEFAULT 521,
	`is_active` boolean NOT NULL DEFAULT false,
	`is_default` boolean NOT NULL DEFAULT false,
	`release_notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deprecated_at` timestamp,
	CONSTRAINT `yamnet_models_id` PRIMARY KEY(`id`),
	CONSTRAINT `yamnet_models_version_unique` UNIQUE(`version`)
);
