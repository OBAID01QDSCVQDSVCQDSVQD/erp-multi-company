import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      companyId: string;
      companyName: string;
    };
  }

  interface User {
    role: string;
    companyId: string;
    companyName: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
    companyId: string;
    companyName: string;
  }
}
