import { Capacitor, registerPlugin } from '@capacitor/core';
import { getSupabaseClient } from '@/lib/supabaseClient';

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
  open(options?: {
    accessToken?: string | null;
    expiresAt?: number | null;
    refreshToken?: string | null;
    trips?: NativeMapTrip[];
  }): Promise<void>;
}

export const NativeMap = registerPlugin<NativeMapPlugin>('NativeMap');

export function canOpenNativeMap() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export async function openNativeMap(trips: NativeMapTrip[] = []) {
  if (!canOpenNativeMap()) {
    return false;
  }

  const { data } = await getSupabaseClient().auth.getSession();
  const session = data.session;
  await NativeMap.open({
    accessToken: session?.access_token ?? null,
    expiresAt: session?.expires_at ?? null,
    refreshToken: session?.refresh_token ?? null,
    trips
  });
  return true;
}
