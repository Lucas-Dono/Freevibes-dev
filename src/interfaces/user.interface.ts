export interface UserPreferences {
    theme: 'light' | 'dark' | 'system';
    audioQuality: 'normal' | 'high' | 'ultra';
    language: string;
  }
  
  export enum Role {
    USER = 'user',
    PREMIUM = 'premium',
    ADMIN = 'admin',
  }
  
  export interface User {
    id: string;
    email: string;
    passwordHash?: string;
    name: string;
    avatarUrl?: string;
    createdAt: Date;
    updatedAt: Date;
    lastLogin: Date;
    preferences: UserPreferences;
    roles: Role[];
    isActive: boolean;
    spotify: {
      connected: boolean;
      refreshToken?: string;
      tokenExpiresAt?: Date;
      userId?: string;
    };
    youtube: {
      connected: boolean;
      refreshToken?: string;
      tokenExpiresAt?: Date;
      channelId?: string;
    };
  }
  
  export interface Session {
    id: string;
    userId: string;
    refreshToken: string;
    expiresAt: Date;
    deviceInfo: {
      ip: string;
      userAgent: string;
      deviceId: string;
    };
    isValid: boolean;
    lastActive: Date;
  }

export type UserWithoutPassword = Omit<User, 'passwordHash'>;