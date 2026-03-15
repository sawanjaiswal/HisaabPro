import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hisaabpro.app',
  appName: 'HisaabPro',
  webDir: 'dist',
  server: {
    // During development: point to Vite dev server for live reload
    // Comment this out for production builds
    // url: 'http://10.67.252.234:3000',
    // cleartext: true,
    androidScheme: 'https',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#F8F7F4', // warm cream — NexoWallet bg
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#F8F7F4',
    },
  },
};

export default config;
