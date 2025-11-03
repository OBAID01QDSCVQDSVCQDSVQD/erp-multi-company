export const config = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company',
  },
  nextauth: {
    url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-here',
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'ERP Multi-Entreprises',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  },
};
