/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Video` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Video" DROP COLUMN "createdAt",
ADD COLUMN     "category" TEXT,
ALTER COLUMN "tags" DROP NOT NULL;
