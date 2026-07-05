import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeMapPlugin {
  open(): Promise<void>;
}

export const NativeMap = registerPlugin<NativeMapPlugin>('NativeMap');

export function canOpenNativeMap() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export async function openNativeMap() {
  if (!canOpenNativeMap()) {
    return false;
  }

  await NativeMap.open();
  return true;
}
