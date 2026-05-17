-- AlterTable
ALTER TABLE "onboarding_answers" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()::text;

-- AlterTable
ALTER TABLE "roadmap_weeks" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()::text;

-- AlterTable
ALTER TABLE "roadmaps" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()::text;
