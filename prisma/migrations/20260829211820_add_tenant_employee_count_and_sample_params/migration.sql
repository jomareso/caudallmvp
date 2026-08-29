-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "sampleConfidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
ADD COLUMN     "sampleMarginOfError" DOUBLE PRECISION NOT NULL DEFAULT 0.05;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "employeeCount" INTEGER;
