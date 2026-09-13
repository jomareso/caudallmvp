-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('LOGO_INSTITUCION', 'FOTO_EVENTO', 'INFORME', 'OTRO');

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "category" "MediaCategory";
