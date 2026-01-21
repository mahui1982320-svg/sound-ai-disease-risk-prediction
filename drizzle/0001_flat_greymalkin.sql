CREATE TABLE `alarm_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`elderly_id` int NOT NULL,
	`event_type` enum('fall','scream','cough','moan') NOT NULL,
	`confidence_score` int NOT NULL,
	`audio_url` text NOT NULL,
	`review_status` enum('pending','confirmed','falseAlarm') NOT NULL DEFAULT 'pending',
	`reviewed_by` int,
	`reviewed_at` timestamp,
	`review_notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alarm_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `elderly` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`roomNumber` varchar(50) NOT NULL,
	`emergencyContact` varchar(100),
	`emergencyPhone` varchar(20),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `elderly_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alarm_record_id` int NOT NULL,
	`user_id` int NOT NULL,
	`action` enum('confirmed','falseAlarm') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_logs_id` PRIMARY KEY(`id`)
);
