import "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  /**
   * Extender la interfaz User
   */
  interface User {
    id: string
    email: string
    name?: string
    image?: string
  }

  /**
   * Extender la interfaz Session
   */
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  /**
   * Extender la interfaz JWT
   */
  interface JWT {
    id: string
    email?: string
  }
} 