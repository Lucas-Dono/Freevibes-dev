import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectToDatabase } from '@/lib/db/mongodb';
import { compare } from 'bcryptjs';

/**
 * Opciones de configuración para NextAuth
 * Esta configuración se usa en ambos [...nextauth].ts y en el API de historia
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email y contraseña son requeridos');
        }

        try {
          const dbConnection = await connectToDatabase();
          
          if (!dbConnection || !dbConnection.db) {
            throw new Error('Error de conexión a la base de datos');
          }
          
          const { db } = dbConnection;
          const user = await db.collection('users').findOne({ email: credentials.email });

          if (!user) {
            throw new Error('Usuario no encontrado');
          }

          // Verificar contraseña solo si existe en el usuario (puede usar otro método de verificación según su implementación)
          if (user.password) {
            const isPasswordValid = await compare(credentials.password, user.password);
            
            if (!isPasswordValid) {
              throw new Error('Contraseña incorrecta');
            }
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name || user.email.split('@')[0],
            image: user.image || null
          };
        } catch (error) {
          console.error('Error de autenticación:', error);
          throw new Error('Error de autenticación');
        }
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development'
};

export default NextAuth(authOptions); 