import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { POIBookmarksService } from './poi-bookmarks.service';
import { CreateBookmarkDto, UpdateBookmarkDto, CreateCommentDto } from './dto';

@Controller('poi-bookmarks')
@UseGuards(JwtAuthGuard)
export class POIBookmarksController {
  constructor(private readonly bookmarksService: POIBookmarksService) {}

  // ========== BOOKMARKS ==========

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBookmark(
    @GetUser('id') userId: string,
    @Body() dto: CreateBookmarkDto,
  ) {
    return this.bookmarksService.createBookmark(userId, dto);
  }

  @Get()
  async getUserBookmarks(
    @GetUser('id') userId: string,
    @Query('type') type?: string,
  ) {
    return this.bookmarksService.getUserBookmarks(userId, type);
  }

  @Get(':id')
  async getBookmark(
    @GetUser('id') userId: string,
    @Param('id') bookmarkId: string,
  ) {
    return this.bookmarksService.getBookmark(userId, bookmarkId);
  }

  @Patch(':id')
  async updateBookmark(
    @GetUser('id') userId: string,
    @Param('id') bookmarkId: string,
    @Body() dto: UpdateBookmarkDto,
  ) {
    return this.bookmarksService.updateBookmark(userId, bookmarkId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteBookmark(
    @GetUser('id') userId: string,
    @Param('id') bookmarkId: string,
  ) {
    return this.bookmarksService.deleteBookmark(userId, bookmarkId);
  }

  @Get('check/:poiId')
  async checkBookmark(
    @GetUser('id') userId: string,
    @Param('poiId') poiId: string,
  ) {
    const isBookmarked = await this.bookmarksService.isBookmarked(userId, poiId);
    return { isBookmarked };
  }

  // ========== COMMENTS ==========

  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @GetUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.bookmarksService.createComment(userId, dto);
  }

  @Get('comments/poi/:poiId')
  async getPOIComments(@Param('poiId') poiId: string) {
    return this.bookmarksService.getPOIComments(poiId);
  }

  @Get('comments/my')
  async getUserComments(@GetUser('id') userId: string) {
    return this.bookmarksService.getUserComments(userId);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @GetUser('id') userId: string,
    @Param('id') commentId: string,
  ) {
    return this.bookmarksService.deleteComment(userId, commentId);
  }
}
