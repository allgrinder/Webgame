declare module 'zzfx' {
  export const ZZFX: {
    sampleRate: number;
    audioContext: AudioContext;
    buildSamples(...params: (number | undefined)[]): number[];
  };
  export function zzfx(...params: (number | undefined)[]): unknown;
}
