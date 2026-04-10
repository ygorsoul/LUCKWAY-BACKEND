import { IsNotEmpty, IsString } from 'class-validator';

export class GeocodeDto {
  @IsNotEmpty()
  @IsString()
  address: string;
}
