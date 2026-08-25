-- Portfolio UI settings (How It Works visibility, etc.)
-- Apply with Neon SQL editor or:
--   npx prisma db execute --file scripts/sql/create-portfolio-ui-setting.sql --schema prisma/schema.prisma
CREATE TABLE IF NOT EXISTS "PortfolioUiSetting" (
    "id" TEXT NOT NULL,
    "howItWorksVisible" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioUiSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PortfolioUiSetting" ("id", "howItWorksVisible", "updatedAt")
VALUES ('default', true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
