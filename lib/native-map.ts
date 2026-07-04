import { registerPlugin } from '@capacitor/core';

export interface NativeMapPlugin {
  open(): Promise<void>;
}

export const NativeMap = registerPlugin<NativeMapPlugin>('NativeMap');
