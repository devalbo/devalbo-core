export enum RuntimePlatform {
  NodeJS = 'nodejs',
  Browser = 'browser',
  Worker = 'worker'
}

export interface RuntimeEnv {
  platform: RuntimePlatform;
  hasSharedArrayBuffer: boolean;
  hasOPFS: boolean;
  hasFSWatch: boolean;
}
