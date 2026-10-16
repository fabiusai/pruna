// Application limits, shared by the browser and the upload endpoint.
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MEDIA_FORMATS = {
  image: { label: 'JPG, PNG o WebP', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
  video: { label: 'MP4', extensions: ['mp4'] },
  audio: { label: 'MP3, WAV o FLAC', extensions: ['mp3', 'wav', 'flac'] }
};
const mimeTypes = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac'
};
const aliases = {
  'audio/mp3': 'audio/mpeg', 'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav', 'audio/x-flac': 'audio/flac'
};
export function mediaType(name, suppliedType = '') {
  const extension = name.toLowerCase().split('.').pop();
  const expected = mimeTypes[extension];
  const supplied = suppliedType.toLowerCase().split(';')[0].trim();
  if (!expected || (supplied && supplied !== 'application/octet-stream' && (aliases[supplied] || supplied) !== expected)) return null;
  return expected;
}
export function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
