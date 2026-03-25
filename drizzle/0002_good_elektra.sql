ALTER TABLE `design_reviews` MODIFY COLUMN `reviewComments` json;--> statement-breakpoint
ALTER TABLE `design_reviews` MODIFY COLUMN `suggestions` json;--> statement-breakpoint
ALTER TABLE `ideas` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `inspiration_items` MODIFY COLUMN `styleTags` json;--> statement-breakpoint
ALTER TABLE `interviews` MODIFY COLUMN `audienceLabels` json;--> statement-breakpoint
ALTER TABLE `interviews` MODIFY COLUMN `painPoints` json;--> statement-breakpoint
ALTER TABLE `interviews` MODIFY COLUMN `designSolutions` json;--> statement-breakpoint
ALTER TABLE `knowledge_articles` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `knowledge_articles` MODIFY COLUMN `collaborators` json;--> statement-breakpoint
ALTER TABLE `meetings` MODIFY COLUMN `keyInsights` json;