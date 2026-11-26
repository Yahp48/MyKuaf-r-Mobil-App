-- Müşteriye gösterilen işletme adı (ticari unvandan ayrı)
ALTER TABLE "Business" ADD COLUMN "displayName" TEXT;
UPDATE "Business" SET "displayName" = "legalName" WHERE "displayName" IS NULL;
ALTER TABLE "Business" ALTER COLUMN "displayName" SET NOT NULL;
