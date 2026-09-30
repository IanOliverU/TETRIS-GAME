export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:music\.youtube\.com\/watch\?[^#]*v=)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return null;
}

export function youTubeEmbedUrl(videoId: string, muted: boolean): string {
  const params = new URLSearchParams({
    autoplay: "1",
    loop: "1",
    playlist: videoId,
    controls: "0",
    disablekb: "1",
    fs: "0",
    modestbranding: "1",
    rel: "0",
  });
  // Autoplay with sound is blocked by browsers until user interacts.
  // Start muted (allowed), let the player unmute after pressing START.
  if (muted) params.set("mute", "1");
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
