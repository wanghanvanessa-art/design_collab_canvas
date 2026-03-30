CREATE TABLE `idea_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ideaId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('useful','discuss','question') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idea_reactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `idea_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ideaId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`modules` json,
	`versionNum` int NOT NULL DEFAULT 1,
	`changeNote` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idea_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `idea_comments` ADD `parentId` int;--> statement-breakpoint
ALTER TABLE `idea_comments` ADD `replyToUser` varchar(100);--> statement-breakpoint
ALTER TABLE `idea_comments` ADD `emoji` varchar(10);