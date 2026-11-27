-- CreateTable
CREATE TABLE "AiTryonRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "hairStyle" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "providerTaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTryonRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiTryonRequest_providerTaskId_key" ON "AiTryonRequest"("providerTaskId");

-- CreateIndex
CREATE INDEX "AiTryonRequest_userId_createdAt_idx" ON "AiTryonRequest"("userId", "createdAt");

