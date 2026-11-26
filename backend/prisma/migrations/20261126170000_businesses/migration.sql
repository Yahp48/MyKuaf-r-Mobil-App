-- İşletmeler (kuaför / satıcı), satıcıya bağlı ürün ve siparişler, gelir-gider kayıtları.

-- Mevcut veriler korunur: sahipsiz ürün/siparişler bir 'platform satıcısı'na bağlanır.

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('SALON', 'SELLER');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('APP', 'MANUAL');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'BUSINESS_OWNER';

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL,
    "type" "BusinessType" NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "legalName" TEXT NOT NULL,
    "taxNumber" TEXT NOT NULL,
    "taxOffice" TEXT NOT NULL,
    "mersisNo" TEXT,
    "kepAddress" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "postalCode" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "iban" TEXT,
    "shippingFeeCents" INTEGER NOT NULL DEFAULT 2999,
    "freeShippingThresholdCents" INTEGER NOT NULL DEFAULT 50000,
    "returnPolicy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "type" "LedgerType" NOT NULL,
    "category" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable: önce boş bırakılabilir sütunlar
ALTER TABLE "Appointment" ADD COLUMN "businessNote" TEXT,
ADD COLUMN "completedAt" TIMESTAMPTZ(3),
ADD COLUMN "source" "AppointmentSource" NOT NULL DEFAULT 'APP';

ALTER TABLE "Order" ADD COLUMN "cancelReason" TEXT,
ADD COLUMN "carrier" TEXT,
ADD COLUMN "deliveredAt" TIMESTAMPTZ(3),
ADD COLUMN "paymentId" UUID,
ADD COLUMN "sellerId" UUID,
ADD COLUMN "shippedAt" TIMESTAMPTZ(3);

ALTER TABLE "Payment" ADD COLUMN "refundedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "returnUrl" TEXT;

ALTER TABLE "Product" ADD COLUMN "sellerId" UUID,
ADD COLUMN "sku" TEXT;

ALTER TABLE "Salon" ADD COLUMN "businessId" UUID;
ALTER TABLE "User" ADD COLUMN "businessId" UUID;

-- Veri taşıma: sahipsiz ürün/sipariş varsa platform satıcısı oluştur ve bağla
INSERT INTO "Business" ("id", "type", "legalName", "taxNumber", "taxOffice", "address", "city", "district", "phone", "email", "updatedAt")
SELECT gen_random_uuid(), 'SELLER', 'MyKuaför Mağaza', '0000000000', 'Belirtilmedi', 'Belirtilmedi', 'Belirtilmedi', 'Belirtilmedi', '0000000000', 'magaza@mykuafor.test', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Product") OR EXISTS (SELECT 1 FROM "Order");

UPDATE "Product" SET "sellerId" = (SELECT "id" FROM "Business" WHERE "taxNumber" = '0000000000') WHERE "sellerId" IS NULL;
UPDATE "Order" SET "sellerId" = (SELECT "id" FROM "Business" WHERE "taxNumber" = '0000000000') WHERE "sellerId" IS NULL;
UPDATE "Order" o SET "paymentId" = p."id" FROM "Payment" p WHERE p."orderId" = o."id";

ALTER TABLE "Product" ALTER COLUMN "sellerId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "sellerId" SET NOT NULL;

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";
ALTER TABLE "Payment" DROP COLUMN "orderId";

-- CreateIndex
CREATE UNIQUE INDEX "Business_taxNumber_key" ON "Business"("taxNumber");

-- CreateIndex
CREATE INDEX "LedgerEntry_businessId_date_idx" ON "LedgerEntry"("businessId", "date");

-- CreateIndex
CREATE INDEX "Order_sellerId_createdAt_idx" ON "Order"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_sellerId_idx" ON "Product"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Salon_businessId_key" ON "Salon"("businessId");

-- CreateIndex
CREATE INDEX "User_businessId_idx" ON "User"("businessId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salon" ADD CONSTRAINT "Salon_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Elle eklenen kurallar
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "Business" ADD CONSTRAINT "Business_tax_number_format" CHECK ("taxNumber" ~ '^[0-9]{10,11}$');
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refund_range" CHECK ("refundedCents" >= 0 AND "refundedCents" <= "amountCents");
