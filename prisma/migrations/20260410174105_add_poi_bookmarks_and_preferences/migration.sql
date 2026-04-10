-- CreateEnum
CREATE TYPE "MealPreference" AS ENUM ('RESTAURANT', 'SELF_COOK', 'MIXED');

-- CreateEnum
CREATE TYPE "SleepPreference" AS ENUM ('HOTEL', 'CAMPING', 'MOTORHOME', 'MIXED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SegmentType" ADD VALUE 'SHOWER';
ALTER TYPE "SegmentType" ADD VALUE 'LAUNDRY';

-- AlterTable
ALTER TABLE "trip_segments" ADD COLUMN     "is_day_endpoint" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linked_poi_id" TEXT,
ADD COLUMN     "poi_data" TEXT;

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "auto_suggest_pois" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "meal_preference" "MealPreference" NOT NULL DEFAULT 'RESTAURANT',
ADD COLUMN     "sleep_preference" "SleepPreference" NOT NULL DEFAULT 'HOTEL';

-- CreateTable
CREATE TABLE "poi_bookmarks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "poi_id" TEXT NOT NULL,
    "poi_name" TEXT NOT NULL,
    "poi_type" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "poi_data" TEXT NOT NULL,
    "tags" TEXT[],
    "notes" TEXT,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poi_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poi_comments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "poi_id" TEXT NOT NULL,
    "poi_name" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "rating" INTEGER,
    "visit_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poi_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "poi_bookmarks_user_id_poi_id_key" ON "poi_bookmarks"("user_id", "poi_id");

-- AddForeignKey
ALTER TABLE "poi_bookmarks" ADD CONSTRAINT "poi_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poi_comments" ADD CONSTRAINT "poi_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
