import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.almidy.premium',
  appName: 'Almidy',
  plugins: {
    DeepLinks: {
      schemes: ['app.almidy.premium']
    }
  },
  server: {
    cleartext: false,
    url: 'https://almidy.app'
  },
  webDir: 'public'
};

export default config;
