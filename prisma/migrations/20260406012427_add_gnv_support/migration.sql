-- AlterEnum
ALTER TYPE "FuelType" ADD VALUE 'GNV';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "gnv_consumption" DOUBLE PRECISION,
ADD COLUMN     "gnv_tank_capacity" DOUBLE PRECISION;
