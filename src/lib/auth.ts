import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from './mongodb';
import User from './models/User';
import Company from './models/Company';
import { decode } from 'next-auth/jwt';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        impersonationToken: { label: 'Impersonation Token', type: 'text' }
      },
      async authorize(credentials) {
        await connectDB();

        // --- IMPERSONATION FLOW ---
        if (credentials?.impersonationToken) {
          try {
            const decoded = await decode({
              token: credentials.impersonationToken,
              secret: process.env.NEXTAUTH_SECRET!
            });

            if (decoded?.isImpersonation === true && decoded?.targetEmail) {
              const email = decoded.targetEmail as string;
              // Find user skipping password check
              const userRaw = await (User as any).findOne({ email: email.toLowerCase().trim() }).lean();
              if (!userRaw) return null;

              // Populate and return user (reuse logic below or extract it)
              // For brevity, I will duplicate the population logic here or rely on the flow falling through if I structure it right.
              // Let's copy-paste the populate logic for safety and clarity here to avoid messing up the main flow structure.

              let userDoc;
              try {
                userDoc = await (User as any).findById(userRaw._id).populate('companyId');
              } catch (error) {
                userDoc = userRaw;
              }
              if (!userDoc) return null;

              let user = userDoc.toObject ? userDoc.toObject() : userDoc;

              // Handle Company ID extraction (same as main flow)
              let companyId: string;
              let companyName: string = 'Unknown Company';
              if (typeof user.companyId === 'object' && user.companyId._id) {
                companyId = user.companyId._id.toString();
                companyName = user.companyId.name || companyName;
              } else if (typeof user.companyId === 'object' && user.companyId.toString) {
                companyId = user.companyId.toString();
                // Try fetch name
                try {
                  const comp = await (Company as any).findById(companyId).lean();
                  if (comp) companyName = comp.name || companyName;
                } catch (e) { }
              } else {
                companyId = user.companyId?.toString();
              }

              return {
                id: user._id.toString(),
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                role: user.role,
                companyId: companyId,
                companyName: companyName,
                permissions: user.permissions || [],
                // Custom flags for impersonation persistence
                ...(!decoded.isRevert ? {
                  isImpersonating: true,
                  adminEmail: decoded.adminEmail
                } : {})
              };
            }
          } catch (e) {
            console.error("Impersonation token invalid", e);
            return null;
          }
        }

        // --- STANDARD FLOW ---
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // First, find user without populate to check if exists
        const userRaw = await (User as any).findOne({
          email: credentials.email.toLowerCase().trim()
        }).lean();

        if (!userRaw) {
          return null;
        }

        if (!userRaw.isActive) {
          throw new Error("Compte désactivé");
        }

        // Check Maintenance Mode
        try {
          // Dynamic import to avoid circular dep issues or file structure shifts
          const SystemSettings = (await import('./models/SystemSettings')).default;
          const settings = await (SystemSettings as any).findOne();

          if (settings?.maintenanceMode && userRaw.role !== 'admin') {
            throw new Error("Maintenance en cours. Réessayez plus tard.");
          }
        } catch (e: any) {
          if (e.message?.includes('Maintenance')) throw e;
          // Ignore other setting fetch errors to avoid blocking login if DB issue for settings
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

        // Log Login
        try {
          const { logAction } = await import('./logger');
          // Mock a session object for the logger
          await logAction(
            { user: payload },
            'LOGIN',
            'Auth',
            `User ${payload.email} logged in (Role: ${payload.role})`,
            { companyId: payload.companyId }
          );
        } catch (e) { console.error('Login log error', e); }

        return payload;
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
        token.permissions = user.permissions || [];
        if (user.isImpersonating) {
          token.isImpersonating = true;
          token.adminEmail = user.adminEmail;
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.companyId = token.companyId as string;
        session.user.companyName = token.companyName as string;
        session.user.permissions = (token.permissions as string[]) || [];
        if (token.isImpersonating) {
          (session.user as any).isImpersonating = true;
          (session.user as any).adminEmail = token.adminEmail;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};
