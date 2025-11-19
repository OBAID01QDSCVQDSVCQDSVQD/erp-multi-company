import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from './mongodb';
import User from './models/User';
import Company from './models/Company';

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
          return null;
        }

        await connectDB();

        // First, find user without populate to check if exists
        const userRaw = await (User as any).findOne({ 
          email: credentials.email.toLowerCase().trim(),
          isActive: true 
        }).lean();

        if (!userRaw) {
          return null;
        }

        // Now populate companyId
        let userDoc;
        try {
          userDoc = await (User as any).findById(userRaw._id).populate('companyId');
        } catch (error) {
          console.error('Error during populate:', error);
          // Fallback: use raw user data
          userDoc = userRaw;
        }
        
        if (!userDoc) {
          return null;
        }
        
        // Convert to plain object
        let user;
        try {
          user = userDoc.toObject ? userDoc.toObject() : userDoc;
        } catch (error) {
          console.error('Error converting to plain object:', error);
          user = userDoc;
        }
        
        // Check if companyId exists (could be ObjectId or populated object)
        if (!user.companyId) {
          console.error('ERROR: companyId is missing for user:', user.email);
          return null;
        }
        
        // If companyId is not populated (still ObjectId), fetch company separately
        let companyId: string;
        let companyName: string = 'Unknown Company';
        
        if (typeof user.companyId === 'object' && user.companyId._id) {
          // Populated
          companyId = user.companyId._id.toString();
          companyName = user.companyId.name || companyName;
        } else if (typeof user.companyId === 'object' && user.companyId.toString) {
          // ObjectId
          companyId = user.companyId.toString();
          // Try to fetch company name
          try {
            const company = await (Company as any).findById(companyId).lean();
            if (company) {
              companyName = company.name || companyName;
            }
          } catch (err) {
            console.warn('Could not fetch company name:', err);
          }
        } else {
          // String
          companyId = user.companyId.toString();
        }
        
        if (!companyId) {
          console.error('ERROR: Cannot get companyId for user:', user.email);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Mettre à jour la dernière connexion
        await (User as any).findByIdAndUpdate(user._id, { lastLogin: new Date() });
        
        const payload = {
          id: user._id.toString(),
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          companyId: companyId,
          companyName: companyName,
          permissions: user.permissions || [],
        };
        return payload;
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
        token.permissions = (user as any).permissions || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.companyId = token.companyId as string;
        session.user.companyName = token.companyName as string;
        session.user.permissions = (token.permissions as string[]) || [];
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};
