-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('UPLOADED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "PerformanceStatus" AS ENUM ('ABOVE_STANDARD', 'NEAR_STANDARD', 'BELOW_STANDARD', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'UPLOADED',
    "rawRows" JSONB,
    "errorLog" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "siteType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultStandard" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_site_budgets" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "siteId" TEXT NOT NULL,
    "uploadedFileId" TEXT,
    "contractValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossCollection" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salaries" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "operatingExpenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "standard" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "collectionAfter14" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vat14Value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "varianceVsStandard" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "standardAchievementPercentage" DECIMAL(9,2),
    "netMarginPercentage" DECIMAL(9,2),
    "collectionGap" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "PerformanceStatus" NOT NULL DEFAULT 'CRITICAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_site_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_items" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" "ExpenseType" NOT NULL DEFAULT 'ONE_TIME',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_summaries" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalContractValue" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalGrossCollection" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalCollectionAfter14" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalSalaries" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalOperatingExpenses" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalStandard" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalVarianceVsStandard" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "standardAchievementPercentage" DECIMAL(9,2),
    "totalGeneralExpenses" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "finalNetAfterGeneral" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "siteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standards_history" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "standardValue" DECIMAL(14,2) NOT NULL,
    "changeReason" TEXT,
    "createdById" TEXT,
    "changeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standards_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "uploaded_files_year_month_idx" ON "uploaded_files"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "sites_name_key" ON "sites"("name");

-- CreateIndex
CREATE INDEX "monthly_site_budgets_year_month_idx" ON "monthly_site_budgets"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_site_budgets_siteId_year_month_key" ON "monthly_site_budgets"("siteId", "year", "month");

-- CreateIndex
CREATE INDEX "expense_items_year_month_idx" ON "expense_items"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_summaries_year_month_key" ON "monthly_summaries"("year", "month");

-- CreateIndex
CREATE INDEX "standards_history_siteId_year_month_idx" ON "standards_history"("siteId", "year", "month");

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_site_budgets" ADD CONSTRAINT "monthly_site_budgets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_site_budgets" ADD CONSTRAINT "monthly_site_budgets_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "uploaded_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standards_history" ADD CONSTRAINT "standards_history_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standards_history" ADD CONSTRAINT "standards_history_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
