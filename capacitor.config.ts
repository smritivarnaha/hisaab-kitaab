import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fundslogger.app',
  appName: 'Funds Logger',
  webDir: 'dist',
  server: {
    url: 'https://hisaab-kitab-dusky.vercel.app',
    cleartext: false
  }
};

export default config;
