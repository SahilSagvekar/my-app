/*
  Warnings:

  - Changed the type of `createdBy` on the `Task` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."Task" DROP COLUMN "createdBy",
ADD COLUMN     "createdBy" INTEGER NOT NULL;
