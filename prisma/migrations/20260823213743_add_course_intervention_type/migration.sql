-- AlterEnum
ALTER TYPE "InterventionType" ADD VALUE 'COURSE';

-- AlterTable
ALTER TABLE "interventions" ADD COLUMN     "videoUrl" TEXT;
