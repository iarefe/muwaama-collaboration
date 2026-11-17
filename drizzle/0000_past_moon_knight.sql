CREATE TABLE `project_access` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`user` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `access_user_idx` ON `project_access` (`user`);--> statement-breakpoint
CREATE INDEX `access_project_idx` ON `project_access` (`project`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`space` text NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_space_idx` ON `projects` (`space`);--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`created` text NOT NULL
);
