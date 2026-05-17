-- Enable UUID generation for onboarding answer IDs.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Pathio onboarding answers.
-- Existing users currently live in Prisma's "User" table with TEXT UUID strings,
-- so user_id matches that type to keep the foreign key valid.
CREATE TABLE "onboarding_answers" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::text,
    "user_id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "goal_category" VARCHAR(50) NOT NULL,
    "current_level" VARCHAR(20) NOT NULL,
    "hours_per_week" INTEGER NOT NULL,
    "preferred_days" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "preferred_time" VARCHAR(20) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "previous_stop" TEXT,
    "motivation" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_answers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "onboarding_answers_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "onboarding_answers_goal_category_check"
        CHECK ("goal_category" IN ('webdev', 'python', 'data', 'mobile', 'other')),
    CONSTRAINT "onboarding_answers_current_level_check"
        CHECK ("current_level" IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT "onboarding_answers_hours_per_week_check"
        CHECK ("hours_per_week" IN (5, 10, 15, 20)),
    CONSTRAINT "onboarding_answers_preferred_time_check"
        CHECK ("preferred_time" IN ('morning', 'afternoon', 'evening', 'night'))
);

CREATE INDEX "idx_onboarding_answers_user_id"
    ON "onboarding_answers"("user_id");

CREATE INDEX "idx_onboarding_answers_completed_at"
    ON "onboarding_answers"("completed_at");
