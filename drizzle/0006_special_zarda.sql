CREATE TABLE `meeting_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(100),
	`content` text NOT NULL,
	`parentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meeting_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meetings` ADD `structuredMinutes` json;--> statement-breakpoint
ALTER TABLE `meetings` ADD `aiInsights` json;--> statement-breakpoint
ALTER TABLE `meetings` ADD `duration` int;--> statement-breakpoint
ALTER TABLE `meetings` ADD `attendees` json;