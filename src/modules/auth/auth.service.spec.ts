import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { DatabaseService } from '@/database/database.service';
import { RegisterDto, LoginDto } from './dto';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let databaseService: DatabaseService;
  let jwtService: JwtService;

  const mockDatabaseService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserResponse = {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    it('should register a new user successfully', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockDatabaseService.user.create.mockResolvedValue(mockUserResponse);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.register(registerDto);

      expect(result).toEqual({
        user: mockUserResponse,
        accessToken: 'jwt-token',
      });
      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
        data: {
          name: registerDto.name,
          email: registerDto.email,
          password: 'hashed-password',
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUserResponse.id,
        email: mockUserResponse.email,
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Email already registered',
      );
      expect(mockDatabaseService.user.create).not.toHaveBeenCalled();
    });

    it('should hash password with bcrypt', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockDatabaseService.user.create.mockResolvedValue(mockUserResponse);
      mockJwtService.sign.mockReturnValue('jwt-token');

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully with valid credentials', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        user: mockUserResponse,
        accessToken: 'jwt-token',
      });
      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('should return user data when user exists', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUserResponse);

      const result = await service.getMe(mockUser.id);

      expect(result).toEqual(mockUserResponse);
      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe(mockUser.id)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getMe(mockUser.id)).rejects.toThrow(
        'User not found',
      );
    });
  });
});
