export const env = {
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  appName: process.env.APP_NAME || 'AgroConnect Academy',
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
  contentDir: process.env.CONTENT_DIR || 'content',
};
