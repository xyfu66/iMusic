import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.imusic.app',
  appName: 'iMusic',
  webDir: 'out',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['*'],
    ...(process.env.NODE_ENV === 'development' && {
      hostname: '10.0.2.2',
      url: 'http://10.0.2.2:50003',
    }),
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: "#ffffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
