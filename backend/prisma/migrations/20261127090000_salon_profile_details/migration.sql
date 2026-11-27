-- Salon kartı için: tür, fotoğraf galerisi, WhatsApp
CREATE TYPE "SalonKind" AS ENUM ('WOMEN', 'MEN', 'UNISEX', 'BEAUTY');

ALTER TABLE "Salon" ADD COLUMN "kind" "SalonKind" NOT NULL DEFAULT 'WOMEN',
ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "whatsapp" TEXT;

-- Var olan kapak görseli galerinin ilk fotoğrafı olur
UPDATE "Salon" SET "photos" = ARRAY["coverImageUrl"] WHERE "coverImageUrl" IS NOT NULL;
