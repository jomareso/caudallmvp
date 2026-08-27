-- CreateTable
CREATE TABLE "national_benchmark_records" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "studyYear" INTEGER,
    "sourceLabel" TEXT NOT NULL,
    "sex" TEXT,
    "ageBand" TEXT,
    "educationLevel" TEXT,
    "employmentStatus" TEXT,
    "dependents" TEXT,
    "incomeRangeRaw" TEXT,
    "controlScore" DOUBLE PRECISION NOT NULL,
    "savingScore" DOUBLE PRECISION NOT NULL,
    "debtScore" DOUBLE PRECISION NOT NULL,
    "planningScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "condition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "national_benchmark_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "national_benchmark_records_version_idx" ON "national_benchmark_records"("version");

-- CreateIndex
CREATE INDEX "national_benchmark_records_ageBand_idx" ON "national_benchmark_records"("ageBand");

-- CreateIndex
CREATE INDEX "national_benchmark_records_employmentStatus_idx" ON "national_benchmark_records"("employmentStatus");

-- CreateIndex
CREATE INDEX "national_benchmark_records_educationLevel_idx" ON "national_benchmark_records"("educationLevel");

