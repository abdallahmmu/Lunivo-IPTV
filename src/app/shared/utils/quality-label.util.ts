/** Buckets a real ffprobe-reported video height into a familiar quality label. Never guesses when height is unknown. */
export function qualityLabelFor(height: number | null | undefined): string | null {
  if (!height || !Number.isFinite(height)) return null;
  if (height >= 2000) return '4K';
  if (height >= 1000) return 'Full HD';
  if (height >= 700) return 'HD';
  return 'SD';
}
