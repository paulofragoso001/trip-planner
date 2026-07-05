import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeMapTrip {
  dateRange?: string | null;
  destination?: string | null;
  href?: string | null;
  id: string;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
  status?: string | null;
}

export interface NativeMapPlugin {
  open(options?: { trips?: NativeMapTrip[] }): Promise<void>;
}

export const NativeMap = registerPlugin<NativeMapPlugin>('NativeMap');

export function canOpenNativeMap() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export async function openNativeMap(trips: NativeMapTrip[] = []) {
  if (!canOpenNativeMap()) {
    return false;
  }

  await NativeMap.open({ trips });
  return true;
}
