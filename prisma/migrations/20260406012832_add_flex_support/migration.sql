-- AlterEnum
ALTER TYPE "FuelType" ADD VALUE 'FLEX';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "ethanol_consumption" DOUBLE PRECISION;
