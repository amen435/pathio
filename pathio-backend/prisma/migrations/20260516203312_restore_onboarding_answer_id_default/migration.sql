-- AlterTable
ALTER TABLE "onboarding_answers" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()::text;
