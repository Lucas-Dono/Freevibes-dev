import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { UserDocument } from '../schemas/user.schema';
import { SessionDocument } from '../schemas/session.schema';
import { User, Role, UserWithoutPassword } from '../interfaces/user.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('User') private userModel: Model<UserDocument>,
    @InjectModel('Session') private sessionModel: Model<SessionDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserWithoutPassword | null> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      return null;
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }
    
    const { passwordHash, ...result } = user.toObject();
    return { ...result, id: (user._id as Types.ObjectId).toString() };
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
  }): Promise<UserWithoutPassword> {
    const { email, password, name } = userData;
    
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new UnauthorizedException('El correo electrónico ya está registrado');
    }
    
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const newUser = new this.userModel({
      email,
      passwordHash,
      name,
      roles: [Role.USER],
      preferences: {
        theme: 'system',
        audioQuality: 'normal',
        language: 'es',
      },
      spotify: {
        connected: false,
      },
      youtube: {
        connected: false,
      },
      isActive: true,
    });
    
    const savedUser = await newUser.save();
    const { passwordHash: _, ...userWithoutPassword } = savedUser.toObject();
    return { ...userWithoutPassword, id: (savedUser._id as Types.ObjectId).toString() };
  }

  async login(user: UserDocument, deviceInfo: any) {
    const userId = (user._id as Types.ObjectId).toString();
    const payload = { email: user.email, sub: userId };
    
    const jwtExpiration = this.configService.get<string>('JWT_EXPIRATION') ?? '1h';
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: jwtExpiration,
    });
    
    const refreshToken = uuidv4();
    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7';
    const expiresInDays = parseInt(refreshExpiration);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    await this.sessionModel.create({
      userId,
      refreshToken,
      expiresAt,
      deviceInfo,
      isValid: true,
      lastActive: new Date(),
    });
    
    await this.userModel.updateOne(
      { _id: userId },
      { lastLogin: new Date() }
    );
    
    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        roles: user.roles,
        spotify: {
          connected: user.spotify?.connected || false,
        },
        youtube: {
          connected: user.youtube?.connected || false,
        },
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const session = await this.sessionModel.findOne({
      refreshToken,
      isValid: true,
      expiresAt: { $gt: new Date() },
    });
    
    if (!session) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    
    const user = await this.userModel.findById(session.userId) as UserDocument;
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    
    session.lastActive = new Date();
    await session.save();
    
    const payload = { email: user.email, sub: session.userId };
    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: this.configService.get<string>('JWT_EXPIRATION') ?? '1h',
      }),
      user: {
        id: (user._id as Types.ObjectId).toString(),
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    };
  }
} 