-- AlterTable
ALTER TABLE "AppointmentService" ADD COLUMN     "listPriceCents" INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "discountEndsOn" DATE,
ADD COLUMN     "discountPercent" INTEGER,
ADD COLUMN     "discountStartsOn" DATE,
ADD COLUMN     "priceRaisedAt" TIMESTAMPTZ(3);
