import { IsString, IsNotEmpty } from 'class-validator';

export class UnlinkPOIFromSegmentDto {
  @IsString()
  @IsNotEmpty()
  segmentId: string;
}
