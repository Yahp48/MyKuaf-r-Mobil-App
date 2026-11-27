-- AlterEnum
ALTER TYPE "PaymentPurpose" ADD VALUE 'CARD_VERIFY';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "saveCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "savedCardId" UUID;

-- CreateTable
CREATE TABLE "SavedCard" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "cardUserKey" TEXT NOT NULL,
    "cardToken" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "association" TEXT,
    "bankName" TEXT,
    "last4" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedCard_cardToken_key" ON "SavedCard"("cardToken");

-- CreateIndex
CREATE INDEX "SavedCard_userId_idx" ON "SavedCard"("userId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_savedCardId_fkey" FOREIGN KEY ("savedCardId") REFERENCES "SavedCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCard" ADD CONSTRAINT "SavedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
