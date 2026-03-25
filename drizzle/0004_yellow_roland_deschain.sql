CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(100),
	`type` enum('todo_done','idea_posted','review_passed','interview_added','knowledge_added','inspiration_added') NOT NULL,
	`title` varchar(255) NOT NULL,
	`detail` text,
	`refId` int,
	`refType` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
