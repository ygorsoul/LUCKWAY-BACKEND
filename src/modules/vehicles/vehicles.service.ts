import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';

@Injectable()
export class VehiclesService {
  constructor(private db: DatabaseService) {}

  async create(userId: string, dto: CreateVehicleDto) {
    const vehicle = await this.db.vehicle.create({
      data: {
        ...dto,
        userId,
      },
    });

    return vehicle;
  }

  async findAll(userId: string) {
    return this.db.vehicle.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const vehicle = await this.db.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.userId !== userId) {
      throw new ForbiddenException('You do not have access to this vehicle');
    }

    return vehicle;
  }

  async update(userId: string, id: string, dto: UpdateVehicleDto) {
    // Verify ownership
    await this.findOne(userId, id);

    const vehicle = await this.db.vehicle.update({
      where: { id },
      data: dto,
    });

    return vehicle;
  }

  async remove(userId: string, id: string) {
    // Verify ownership
    await this.findOne(userId, id);

    await this.db.vehicle.delete({
      where: { id },
    });

    return { message: 'Vehicle deleted successfully' };
  }
}
