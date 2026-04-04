import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  create(@GetUser() user: any, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(user.id, dto);
  }

  @Get()
  findAll(@GetUser() user: any) {
    return this.vehiclesService.findAll(user.id);
  }

  @Get(':id')
  findOne(@GetUser() user: any, @Param('id') id: string) {
    return this.vehiclesService.findOne(user.id, id);
  }

  @Patch(':id')
  update(@GetUser() user: any, @Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@GetUser() user: any, @Param('id') id: string) {
    return this.vehiclesService.remove(user.id, id);
  }
}
