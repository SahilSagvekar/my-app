/*
  Warnings:

  - You are about to drop the column `read` on the `Notification` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Notification" DROP COLUMN "read",
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false;
