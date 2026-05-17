CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "roadmaps" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::text,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "total_weeks" INTEGER NOT NULL,
    "current_week" INTEGER NOT NULL DEFAULT 1,
    "phase" VARCHAR(50) NOT NULL,
    "calendar_id" VARCHAR(255),
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "roadmaps_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "roadmaps_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "roadmaps_total_weeks_check"
        CHECK ("total_weeks" BETWEEN 1 AND 52),
    CONSTRAINT "roadmaps_current_week_check"
        CHECK ("current_week" >= 1),
    CONSTRAINT "roadmaps_phase_check"
        CHECK ("phase" IN ('Foundation', 'Building', 'Projects', 'Ready'))
);

CREATE TABLE "roadmap_weeks" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::text,
    "roadmap_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "phase" VARCHAR(100) NOT NULL,
    "topic_name" VARCHAR(255) NOT NULL,
    "why_it_matters" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "video_url" VARCHAR(500),
    "video_title" VARCHAR(255),
    "notebook_code" TEXT,
    "notebook_language" VARCHAR(20),
    "mini_project" TEXT NOT NULL,
    "starter_code" TEXT,
    "estimated_hours" INTEGER NOT NULL,
    "difficulty" VARCHAR(20) NOT NULL,
    "encouragement_note" TEXT,
    "mobile_fill_blanks" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'LOCKED',
    "calendar_event_id" VARCHAR(255),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_weeks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "roadmap_weeks_roadmap_id_fkey"
        FOREIGN KEY ("roadmap_id") REFERENCES "roadmaps"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "roadmap_weeks_week_number_check"
        CHECK ("week_number" >= 1),
    CONSTRAINT "roadmap_weeks_notebook_language_check"
        CHECK ("notebook_language" IS NULL OR "notebook_language" IN ('javascript', 'python', 'html', 'css', 'sql')),
    CONSTRAINT "roadmap_weeks_estimated_hours_check"
        CHECK ("estimated_hours" > 0),
    CONSTRAINT "roadmap_weeks_difficulty_check"
        CHECK ("difficulty" IN ('easy', 'medium', 'hard')),
    CONSTRAINT "roadmap_weeks_status_check"
        CHECK ("status" IN ('LOCKED', 'ACTIVE', 'COMPLETE', 'STUCK')),
    CONSTRAINT "roadmap_weeks_roadmap_id_week_number_key"
        UNIQUE ("roadmap_id", "week_number")
);

CREATE INDEX "idx_roadmap_weeks_roadmap_id"
    ON "roadmap_weeks"("roadmap_id");

CREATE INDEX "idx_roadmap_weeks_week_number"
    ON "roadmap_weeks"("week_number");

CREATE INDEX "idx_roadmap_weeks_status"
    ON "roadmap_weeks"("status");
