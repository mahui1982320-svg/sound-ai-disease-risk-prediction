CREATE TABLE `yamnet_inferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alarm_record_id` int NOT NULL,
	`top_labels` text NOT NULL,
	`raw_scores` text NOT NULL,
	`mapped_event_type` enum('fall','scream','cough','moan'),
	`mapping_confidence` int,
	`audio_length` int,
	`processing_time` int,
	`model_version` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `yamnet_inferences_id` PRIMARY KEY(`id`)
);
