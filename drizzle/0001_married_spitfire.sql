CREATE TABLE `blindbox_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('case','knowledge','tip','quote') NOT NULL DEFAULT 'knowledge',
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`imageUrl` text,
	`source` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blindbox_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `design_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`designUrl` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`parentId` int,
	`businessLogicScore` float,
	`interactionScore` float,
	`accessibilityScore` float,
	`overallScore` float,
	`reviewComments` json DEFAULT ('[]'),
	`suggestions` json DEFAULT ('[]'),
	`status` enum('uploading','reviewing','done','error') NOT NULL DEFAULT 'uploading',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `design_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `idea_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ideaId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idea_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`tags` json DEFAULT ('[]'),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`likesCount` int NOT NULL DEFAULT 0,
	`commentsCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspiration_boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inspiration_boards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspiration_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`boardId` int,
	`type` enum('text','image','link','screenshot') NOT NULL DEFAULT 'text',
	`title` varchar(500),
	`content` text,
	`imageUrl` text,
	`url` text,
	`posX` float DEFAULT 0,
	`posY` float DEFAULT 0,
	`width` float DEFAULT 200,
	`height` float DEFAULT 150,
	`styleTags` json DEFAULT ('[]'),
	`linkedTodoId` int,
	`linkedInterviewId` int,
	`color` varchar(20) DEFAULT '#ffffff',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inspiration_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`interviewee` varchar(255),
	`date` timestamp,
	`content` text,
	`audienceLabels` json DEFAULT ('[]'),
	`painPoints` json DEFAULT ('[]'),
	`designSolutions` json DEFAULT ('[]'),
	`status` enum('draft','analyzing','done') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`tags` json DEFAULT ('[]'),
	`version` int NOT NULL DEFAULT 1,
	`parentId` int,
	`category` varchar(100),
	`collaborators` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`audioUrl` text,
	`transcript` text,
	`summary` text,
	`keyInsights` json DEFAULT ('[]'),
	`status` enum('uploading','transcribing','analyzing','done','error') NOT NULL DEFAULT 'uploading',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`priority` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`assignee` varchar(255),
	`dueDate` timestamp,
	`completed` boolean NOT NULL DEFAULT false,
	`sourceType` enum('meeting','manual','idea') NOT NULL DEFAULT 'manual',
	`sourceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `todos_id` PRIMARY KEY(`id`)
);
