import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { CreateBookmarkDto, UpdateBookmarkDto, CreateCommentDto } from './dto';

@Injectable()
export class POIBookmarksService {
  private readonly logger = new Logger(POIBookmarksService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Criar uma marcação (bookmark) de POI
   */
  async createBookmark(userId: string, dto: CreateBookmarkDto) {
    this.logger.log(`Criando bookmark para POI ${dto.poiId} - usuário ${userId}`);

    // Verificar se já existe
    const existing = await this.db.pOIBookmark.findUnique({
      where: {
        userId_poiId: {
          userId,
          poiId: dto.poiId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Você já marcou este POI');
    }

    return this.db.pOIBookmark.create({
      data: {
        userId,
        poiId: dto.poiId,
        poiName: dto.poiName,
        poiType: dto.poiType,
        latitude: dto.latitude,
        longitude: dto.longitude,
        poiData: dto.poiData,
        tags: dto.tags || [],
        notes: dto.notes,
        rating: dto.rating,
      },
    });
  }

  /**
   * Listar todas as marcações do usuário
   */
  async getUserBookmarks(userId: string, poiType?: string) {
    this.logger.log(`Listando bookmarks do usuário ${userId}`);

    return this.db.pOIBookmark.findMany({
      where: {
        userId,
        ...(poiType && { poiType }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Obter uma marcação específica
   */
  async getBookmark(userId: string, bookmarkId: string) {
    const bookmark = await this.db.pOIBookmark.findUnique({
      where: { id: bookmarkId },
    });

    if (!bookmark || bookmark.userId !== userId) {
      throw new NotFoundException('Marcação não encontrada');
    }

    return bookmark;
  }

  /**
   * Atualizar uma marcação
   */
  async updateBookmark(userId: string, bookmarkId: string, dto: UpdateBookmarkDto) {
    const bookmark = await this.getBookmark(userId, bookmarkId);

    return this.db.pOIBookmark.update({
      where: { id: bookmark.id },
      data: {
        tags: dto.tags,
        notes: dto.notes,
        rating: dto.rating,
      },
    });
  }

  /**
   * Remover uma marcação
   */
  async deleteBookmark(userId: string, bookmarkId: string) {
    const bookmark = await this.getBookmark(userId, bookmarkId);

    await this.db.pOIBookmark.delete({
      where: { id: bookmark.id },
    });

    return { message: 'Marcação removida com sucesso' };
  }

  /**
   * Criar um comentário sobre um POI
   */
  async createComment(userId: string, dto: CreateCommentDto) {
    this.logger.log(`Criando comentário para POI ${dto.poiId} - usuário ${userId}`);

    return this.db.pOIComment.create({
      data: {
        userId,
        poiId: dto.poiId,
        poiName: dto.poiName,
        comment: dto.comment,
        rating: dto.rating,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : null,
      },
    });
  }

  /**
   * Listar comentários de um POI
   */
  async getPOIComments(poiId: string) {
    return this.db.pOIComment.findMany({
      where: { poiId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Listar comentários do usuário
   */
  async getUserComments(userId: string) {
    return this.db.pOIComment.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Deletar um comentário
   */
  async deleteComment(userId: string, commentId: string) {
    const comment = await this.db.pOIComment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.userId !== userId) {
      throw new NotFoundException('Comentário não encontrado');
    }

    await this.db.pOIComment.delete({
      where: { id: commentId },
    });

    return { message: 'Comentário removido com sucesso' };
  }

  /**
   * Verificar se usuário marcou um POI
   */
  async isBookmarked(userId: string, poiId: string): Promise<boolean> {
    const bookmark = await this.db.pOIBookmark.findUnique({
      where: {
        userId_poiId: {
          userId,
          poiId,
        },
      },
    });

    return !!bookmark;
  }
}
