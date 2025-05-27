import { Schema, Document } from 'mongoose';
import { User, Role } from '../interfaces/user.interface';

export interface UserDocument extends Omit<User, 'id'>, Document {}

export const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    lastLogin: { type: Date },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system'
      },
      audioQuality: {
        type: String,
        enum: ['normal', 'high', 'ultra'],
        default: 'normal'
      },
      language: { type: String, default: 'es' },
    },
    roles: [{
      type: String,
      enum: Object.values(Role),
      default: [Role.USER]
    }],
    isActive: { type: Boolean, default: true },
    spotify: {
      connected: { type: Boolean, default: false },
      refreshToken: { type: String },
      tokenExpiresAt: { type: Date },
      userId: { type: String },
    },
    youtube: {
      connected: { type: Boolean, default: false },
      refreshToken: { type: String },
      tokenExpiresAt: { type: Date },
      channelId: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Índices para mejorar performance
UserSchema.index({ email: 1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ 'spotify.connected': 1 });
UserSchema.index({ 'youtube.connected': 1 });
