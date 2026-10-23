export async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const THUMB = 320;

function drawToDataUrl(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(1, THUMB / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no ctx');
  ctx.drawImage(source, 0, 0, cw, ch);
  return canvas.toDataURL('image/webp', 0.72);
}

export async function makeThumb(file: File): Promise<string | undefined> {
  if (file.type.startsWith('image/') && file.type !== 'image/svg+xml' && file.size < 40 * 1024 * 1024) {
    const bmp = await createImageBitmap(file);
    const url = drawToDataUrl(bmp, bmp.width, bmp.height);
    bmp.close();
    return url;
  }
  if (file.type.startsWith('video/')) {
    return videoFrame(file);
  }
  return undefined;
}

function videoFrame(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    const done = (v: string | undefined) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = setTimeout(() => done(undefined), 6000);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 4);
    };
    video.onseeked = () => {
      try {
        done(drawToDataUrl(video, video.videoWidth, video.videoHeight));
      } catch {
        done(undefined);
      }
    };
    video.onerror = () => done(undefined);
  });
}
