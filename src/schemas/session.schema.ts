import { Schema, Document } from 'mongoose';
import { Session } from '../interfaces/user.interface';

export interface SessionDocument extends Omit<Session, 'id'>, Document {}

export const SessionSchema = new Schema(
  {
    userId: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    deviceInfo: {
      ip: { type: String },
      userAgent: { type: String },
      deviceId: { type: String },
    },
    isValid: { type: Boolean, default: true },
    lastActive: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Índices para mejorar performance
SessionSchema.index({ userId: 1 });
SessionSchema.index({ refreshToken: 1 });
SessionSchema.index({ expiresAt: 1 });
SessionSchema.index({ isValid: 1 });