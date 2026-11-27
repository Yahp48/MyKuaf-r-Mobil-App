-- MyKuaför yalnızca kadınlara hizmet verir: erkek ve unisex salon türleri kaldırıldı.
UPDATE "Salon" SET "kind" = 'WOMEN' WHERE "kind" IN ('MEN', 'UNISEX');

ALTER TYPE "SalonKind" RENAME TO "SalonKind_old";
CREATE TYPE "SalonKind" AS ENUM ('WOMEN', 'BEAUTY');
ALTER TABLE "Salon" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Salon" ALTER COLUMN "kind" TYPE "SalonKind" USING ("kind"::text::"SalonKind");
ALTER TABLE "Salon" ALTER COLUMN "kind" SET DEFAULT 'WOMEN';
DROP TYPE "SalonKind_old";
