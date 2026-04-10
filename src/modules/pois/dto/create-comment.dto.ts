import { IsString, IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  poiId: string;

  @IsString()
  poiName: string;

  @IsString()
  comment: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsDateString()
  @IsOptional()
  visitDate?: string;
}
