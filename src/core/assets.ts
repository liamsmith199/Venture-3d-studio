import type { Asset } from './types';
import { newId } from '../templates/kit';

const MAX_SIDE = 2048;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/** Reads an uploaded image into a self-contained asset, shrinking very large files. */
export async function assetFromFile(file: File): Promise<Asset> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error(`"${file.name}" is not supported. Please use a PNG, JPG or WebP image.`);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`"${file.name}" could not be opened as an image.`));
      el.src = url;
    });
    const fit = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * fit));
    const height = Math.max(1, Math.round(img.naturalHeight * fit));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    // PNG keeps the transparency logos need. Everything else is smaller as JPEG.
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return { id: newId(), name: file.name, mime, dataUrl: canvas.toDataURL(mime, 0.9), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
