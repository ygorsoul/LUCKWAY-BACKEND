import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { DatabaseService } from '@/database/database.service';
import { CreateVehicleDto, UpdateVehicleDto, VehicleType, FuelType } from './dto';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    vehicle: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUserId = 'user-123';
  const mockVehicleId = 'vehicle-123';

  const mockVehicle = {
    id: mockVehicleId,
    userId: mockUserId,
    name: 'My Car',
    type: 'CAR',
    fuelType: 'GASOLINE',
    avgConsumption: 12.5,
    tankCapacity: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
    databaseService = module.get<DatabaseService>(DatabaseService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a vehicle successfully', async () => {
      const createDto: CreateVehicleDto = {
        name: 'My Car',
        type: VehicleType.CAR,
        fuelType: FuelType.GASOLINE,
        averageConsumption: 12.5,
        tankCapacity: 50,
      };

      mockDatabaseService.vehicle.create.mockResolvedValue(mockVehicle);

      const result = await service.create(mockUserId, createDto);

      expect(result).toEqual(mockVehicle);
      expect(mockDatabaseService.vehicle.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          userId: mockUserId,
        },
      });
      expect(mockDatabaseService.vehicle.create).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const createDto: CreateVehicleDto = {
        name: 'My Car',
        type: VehicleType.CAR,
        fuelType: FuelType.GASOLINE,
        averageConsumption: 12.5,
        tankCapacity: 50,
      };

      mockDatabaseService.vehicle.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findAll', () => {
    it('should return all vehicles for a user', async () => {
      const mockVehicles = [mockVehicle, { ...mockVehicle, id: 'vehicle-456' }];
      mockDatabaseService.vehicle.findMany.mockResolvedValue(mockVehicles);

      const result = await service.findAll(mockUserId);

      expect(result).toEqual(mockVehicles);
      expect(mockDatabaseService.vehicle.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockDatabaseService.vehicle.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when user has no vehicles', async () => {
      mockDatabaseService.vehicle.findMany.mockResolvedValue([]);

      const result = await service.findAll(mockUserId);

      expect(result).toEqual([]);
      expect(mockDatabaseService.vehicle.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a vehicle when found and user is owner', async () => {
      mockDatabaseService.vehicle.findUnique.mockResolvedValue(mockVehicle);

      const result = await service.findOne(mockUserId, mockVehicleId);

      expect(result).toEqual(mockVehicle);
      expect(mockDatabaseService.vehicle.findUnique).toHaveBeenCalledWith({
        where: { id: mockVehicleId },
      });
    });

    it('should throw NotFoundException when vehicle does not exist', async () => {
      mockDatabaseService.vehicle.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(mockUserId, mockVehicleId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne(mockUserId, mockVehicleId),
      ).rejects.toThrow('Vehicle not found');
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      const differentUserVehicle = {
        ...mockVehicle,
        userId: 'different-user',
      };
      mockDatabaseService.vehicle.findUnique.mockResolvedValue(
        differentUserVehicle,
      );

      await expect(
        service.findOne(mockUserId, mockVehicleId),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.findOne(mockUserId, mockVehicleId),
      ).rejects.toThrow('You do not have access to this vehicle');
    });
  });

  describe('update', () => {
    it('should update a vehicle successfully', async () => {
      const updateDto: UpdateVehicleDto = {
        name: 'Updated Car',
        averageConsumption: 13.0,
      };

      const updatedVehicle = {
        ...mockVehicle,
        ...updateDto,
      };

      mockDatabaseService.vehicle.findUnique.mockResolvedValue(mockVehicle);
      mockDatabaseService.vehicle.update.mockResolvedValue(updatedVehicle);

      const result = await service.update(mockUserId, mockVehicleId, updateDto);

      expect(result).toEqual(updatedVehicle);
      expect(mockDatabaseService.vehicle.update).toHaveBeenCalledWith({
        where: { id: mockVehicleId },
        data: updateDto,
      });
    });

    it('should throw NotFoundException when vehicle does not exist', async () => {
      mockDatabaseService.vehicle.findUnique.mockResolvedValue(null);

      await expect(
        service.update(mockUserId, mockVehicleId, { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      const differentUserVehicle = {
        ...mockVehicle,
        userId: 'different-user',
      };
      mockDatabaseService.vehicle.findUnique.mockResolvedValue(
        differentUserVehicle,
      );

      await expect(
        service.update(mockUserId, mockVehicleId, { name: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete a vehicle successfully', async () => {
      mockDatabaseService.vehicle.findUnique.mockResolvedValue(mockVehicle);
      mockDatabaseService.vehicle.delete.mockResolvedValue(mockVehicle);

      const result = await service.remove(mockUserId, mockVehicleId);

      expect(result).toEqual({ message: 'Vehicle deleted successfully' });
      expect(mockDatabaseService.vehicle.delete).toHaveBeenCalledWith({
        where: { id: mockVehicleId },
      });
    });

    it('should throw NotFoundException when vehicle does not exist', async () => {
      mockDatabaseService.vehicle.findUnique.mockResolvedValue(null);

      await expect(
        service.remove(mockUserId, mockVehicleId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      const differentUserVehicle = {
        ...mockVehicle,
        userId: 'different-user',
      };
      mockDatabaseService.vehicle.findUnique.mockResolvedValue(
        differentUserVehicle,
      );

      await expect(
        service.remove(mockUserId, mockVehicleId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
