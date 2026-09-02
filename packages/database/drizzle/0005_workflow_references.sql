ALTER TABLE "shopping_proposals" ADD COLUMN "workflow_provider" varchar(32);--> statement-breakpoint
ALTER TABLE "shopping_proposals" ADD COLUMN "workflow_thread_id" varchar(255);--> statement-breakpoint
ALTER TABLE "shopping_proposals" ADD COLUMN "workflow_run_id" varchar(255);--> statement-breakpoint
ALTER TABLE "shopping_proposals" ADD COLUMN "workflow_status" varchar(32);--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_proposals_workflow_thread_uq" ON "shopping_proposals" USING btree ("workflow_provider","workflow_thread_id");
