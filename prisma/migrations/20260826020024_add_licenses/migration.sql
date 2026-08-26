-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('UNUSED', 'ACTIVE', 'EXPIRED');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "licenseId" TEXT;

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'UNUSED',
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licenses_code_key" ON "licenses"("code");

-- CreateIndex
CREATE INDEX "licenses_tenantId_idx" ON "licenses"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_licenseId_key" ON "employees"("licenseId");

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

