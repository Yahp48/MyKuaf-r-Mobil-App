-- Kuaförün yanında güzellik merkezi, tırnak, cilt bakımı, masaj ve spa, kaş-kirpik ve makyaj işletmeleri
ALTER TYPE "SalonKind" RENAME VALUE 'WOMEN' TO 'HAIR';
ALTER TYPE "SalonKind" ADD VALUE IF NOT EXISTS 'NAIL';
ALTER TYPE "SalonKind" ADD VALUE IF NOT EXISTS 'SKIN';
ALTER TYPE "SalonKind" ADD VALUE IF NOT EXISTS 'MASSAGE';
ALTER TYPE "SalonKind" ADD VALUE IF NOT EXISTS 'BROW_LASH';
ALTER TYPE "SalonKind" ADD VALUE IF NOT EXISTS 'MAKEUP';
ALTER TABLE "Salon" ALTER COLUMN "kind" SET DEFAULT 'HAIR';

-- Hizmet menüsünde gruplama
ALTER TABLE "Service" ADD COLUMN "category" TEXT;
