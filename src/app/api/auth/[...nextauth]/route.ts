import NextAuth from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Ampliar la sesión con propiedades personalizadas
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }
}

// Ampliar el token con propiedades personalizadas
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

// Crear y exportar los handlers
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 