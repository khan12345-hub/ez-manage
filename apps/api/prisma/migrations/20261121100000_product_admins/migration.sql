-- Per-product Administrators: full admin of one entire product, nothing else.
CREATE TABLE "product_admins" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "product" VARCHAR(20) NOT NULL,
  "grantedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_admins_userId_product_key" ON "product_admins" ("userId", "product");
CREATE INDEX "product_admins_userId_idx" ON "product_admins" ("userId");
