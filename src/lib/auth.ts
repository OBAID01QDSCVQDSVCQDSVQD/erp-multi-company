import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from './mongodb';
import User from './models/User';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials');
          return null;
        }

        console.log('Attempting login for:', credentials.email);
        await connectDB();

        const user = await (User as any).findOne({ 
          email: credentials.email.toLowerCase().trim(),
          isActive: true 
        }).populate('companyId');
        
        console.log('User found:', user ? 'YES' : 'NO');
        if (user) {
          console.log('User details:', {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
            companyId: user.companyId
          });
        } else {
          console.log('No user found for email:', credentials.email);
          // Essayer de trouver l'utilisateur sans isActive
          const userWithoutActive = await (User as any).findOne({ 
            email: credentials.email.toLowerCase().trim()
          }).populate('companyId');
          console.log('User without isActive check:', userWithoutActive ? 'FOUND' : 'NOT FOUND');
        }

        if (!user) {
          console.log('User not found:', credentials.email);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          console.log('Invalid password for user:', credentials.email);
          return null;
        }

        // Mettre à jour la dernière connexion
        await (User as any).findByIdAndUpdate(user._id, { lastLogin: new Date() });

        console.log('Login successful for:', user.email);
        return {
          id: user._id.toString(),
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          companyId: user.companyId._id.toString(),
          companyName: user.companyId.name,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.companyId = token.companyId as string;
        session.user.companyName = token.companyName as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};
