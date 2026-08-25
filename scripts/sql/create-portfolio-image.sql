-- Portfolio photography gallery
-- Apply with: prisma db execute / your usual SQL migration path
CREATE TABLE IF NOT EXISTS "PortfolioImage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'photography',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PortfolioImage_category_idx" ON "PortfolioImage"("category");
CREATE INDEX IF NOT EXISTS "PortfolioImage_category_order_idx" ON "PortfolioImage"("category", "order");
CREATE INDEX IF NOT EXISTS "PortfolioImage_isActive_idx" ON "PortfolioImage"("isActive");
