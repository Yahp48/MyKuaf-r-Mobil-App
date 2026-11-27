-- AlterTable
ALTER TABLE "Salon" ADD COLUMN     "dataSource" TEXT,
ADD COLUMN     "isListing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceRef" TEXT;
