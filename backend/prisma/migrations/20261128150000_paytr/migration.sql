-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'PAYTR';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "checkoutToken" TEXT;

