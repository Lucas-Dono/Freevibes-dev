import NextAuth from "next-auth";
import { Session, User } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extiende la interfaz de Session para incluir propiedades personalizadas
   */
  interface Session {
    accessToken?: string;
    error?: string;
    user: User;
  }

  /**
   * Extiende la interfaz User para incluir propiedades personalizadas
   */
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    // Propiedades específicas de Spotify
    display_name?: string;
    country?: string;
    product?: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extiende la interfaz JWT para incluir propiedades personalizadas
   */
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
    user?: User;
  }
} 