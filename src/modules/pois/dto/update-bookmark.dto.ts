import { IsString, IsArray, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateBookmarkDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;
}
