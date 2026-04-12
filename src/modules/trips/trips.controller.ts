import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto, UpdateTripDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RoutePOIIntegrationService } from '../pois/route-poi-integration.service';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly routePOIIntegrationService: RoutePOIIntegrationService,
  ) {}

  @Post()
  create(@GetUser() user: any, @Body() dto: CreateTripDto) {
    return this.tripsService.create(user.id, dto);
  }

  @Get()
  findAll(@GetUser() user: any) {
    return this.tripsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@GetUser() user: any, @Param('id') id: string) {
    return this.tripsService.findOne(user.id, id);
  }

  @Patch(':id')
  update(@GetUser() user: any, @Param('id') id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(user.id, id, dto);
  }

  @Patch(':id/start')
  startTrip(@GetUser() user: any, @Param('id') id: string) {
    return this.tripsService.startTrip(user.id, id);
  }

  @Patch(':id/segments/:segmentId/check')
  checkSegment(
    @GetUser() user: any,
    @Param('id') id: string,
    @Param('segmentId') segmentId: string,
  ) {
    return this.tripsService.checkSegment(user.id, id, segmentId);
  }

  @Patch(':id/segments/:segmentId/uncheck')
  uncheckSegment(
    @GetUser() user: any,
    @Param('id') id: string,
    @Param('segmentId') segmentId: string,
  ) {
    return this.tripsService.uncheckSegment(user.id, id, segmentId);
  }

  @Delete(':id')
  remove(@GetUser() user: any, @Param('id') id: string) {
    return this.tripsService.remove(user.id, id);
  }

  /**
   * Sugere POIs automaticamente baseado na rota planejada
   * @param user Usuário autenticado
   * @param id ID da viagem
   * @returns Sugestões de POIs organizadas por prioridade
   */
  @Post(':id/suggest-pois')
  @HttpCode(HttpStatus.OK)
  async suggestPOIs(@GetUser() user: any, @Param('id') id: string) {
    return this.routePOIIntegrationService.suggestPOIsForTrip(user.id, id);
  }
}
