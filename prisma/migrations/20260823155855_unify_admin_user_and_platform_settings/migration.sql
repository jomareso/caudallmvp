/*
  Warnings:

  - You are about to drop the `platform_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenant_admins` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AdminProfileType" AS ENUM ('ADM', 'EMPRESA', 'FUNCIONAL');

-- CreateEnum
CREATE TYPE "FunctionalRole" AS ENUM ('METHODOLOGIST', 'PRODUCT_ADMIN', 'ANALYST', 'VIEWER');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_whoId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_admins" DROP CONSTRAINT "tenant_admins_tenantId_fkey";

-- DropTable
DROP TABLE "platform_users";

-- DropTable
DROP TABLE "tenant_admins";

-- DropEnum
DROP TYPE "PlatformRole";

-- DropEnum
DROP TYPE "TenantAdminRole";

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profileType" "AdminProfileType" NOT NULL,
    "functionalRole" "FunctionalRole",
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "logoData" BYTEA,
    "logoMimeType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_tenantId_idx" ON "admin_users"("tenantId");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_whoId_fkey" FOREIGN KEY ("whoId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
