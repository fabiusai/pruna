import { MAX_FILE_BYTES, mediaType } from '../../media-config.mjs';

const json = (status, data) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

function matchesFormat(bytes, type) {
  const text = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
  if (type === 'image/webp') return text(0,4) === 'RIFF' && text(8,12) === 'WEBP';
  if (type === 'video/mp4') return text(4,8) === 'ftyp';
  if (type === 'audio/wav') return text(0,4) === 'RIFF' && text(8,12) === 'WAVE';
  if (type === 'audio/flac') return text(0,4) === 'fLaC';
  return type === 'audio/mpeg' && (text(0,3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
}

// Edge request streaming avoids the binary request limit of ordinary Functions.
// The destination is fixed: this endpoint cannot forward files or API keys elsewhere.
export default async function upload(request) {
  if (request.method !== 'POST') return json(405, { error: 'Metodo non consentito.' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'Origine della richiesta non consentita.' });
  const key = request.headers.get('x-pruna-key');
  if (!key) return json(401, { error: 'Inserisci la chiave API prima di caricare i file.' });
  let name;
  try { name = decodeURIComponent(request.headers.get('x-upload-name') || ''); }
  catch { return json(400, { error: 'Nome del file non valido.' }); }
  if (!name || name.length > 1024) return json(400, { error: 'Nome del file non valido.' });
  const type = mediaType(name, request.headers.get('content-type') || '');
  if (!type) return json(415, { error: 'Formato non supportato. Usa JPG, PNG, WebP, MP4, MP3, WAV o FLAC.' });
  const size = Number(request.headers.get('x-upload-size'));
  if (!Number.isSafeInteger(size) || size <= 0) return json(400, { error: 'Il file è vuoto o la dimensione non è valida.' });
  if (size > MAX_FILE_BYTES) return json(413, { error: 'Il file supera il limite di 50 MB. Riducilo oppure usa un link.' });
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && Number(contentLength) !== size) return json(400, { error: 'Dimensione del file non coerente.' });
  if (!request.body) return json(400, { error: 'Nessun file ricevuto.' });

  const reader = request.body.getReader();
  const controller = new AbortController();
  let tooLarge = false, incomplete = false, total = 0;
  const cancel = () => { controller.abort(); reader.cancel().catch(() => {}); };
  const timer = setTimeout(cancel, 35000);
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  try {
    // Read only a small prefix for format validation; the rest stays a stream.
    const initial = [];
    while (total < Math.min(16, size)) {
      const chunk = await reader.read();
      if (controller.signal.aborted) throw new Error('aborted');
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > size) return json(400, { error: 'Dimensione del file non coerente.' });
      initial.push(chunk.value);
    }
    const signature = new Uint8Array(Math.min(total, 16));
    let position = 0;
    for (const chunk of initial) {
      const bytes = chunk.subarray(0, signature.length - position);
      signature.set(bytes, position);
      position += bytes.length;
      if (position === signature.length) break;
    }
    if (!matchesFormat(signature, type)) return json(415, { error: 'Il contenuto del file non corrisponde al formato indicato.' });
    const boundary = 'pruna-' + crypto.randomUUID();
    const filename = name.split(/[\\/]/).pop().replace(/[^\x20-\x7e]|["\\]/g, '_');
    const encoder = new TextEncoder();
    const prefix = encoder.encode('--' + boundary + '\r\nContent-Disposition: form-data; name="content"; filename="' + filename + '"\r\nContent-Type: ' + type + '\r\n\r\n');
    const suffix = encoder.encode('\r\n--' + boundary + '--\r\n');
    let phase = 0, initialIndex = 0;
    const body = new ReadableStream({
      async pull(output) {
        if (phase === 0) { output.enqueue(prefix); phase = 1; return; }
        if (initialIndex < initial.length) { output.enqueue(initial[initialIndex++]); return; }
        try {
          const chunk = await reader.read();
          if (controller.signal.aborted) throw new Error('aborted');
          if (chunk.done) {
            if (total !== size) { incomplete = true; throw new Error('incomplete'); }
            output.enqueue(suffix);
            output.close();
          } else {
            total += chunk.value.byteLength;
            if (total > size || total > MAX_FILE_BYTES) { tooLarge = true; throw new Error('size'); }
            output.enqueue(chunk.value);
          }
        } catch (error) { output.error(error); }
      },
      cancel() { return reader.cancel(); }
    });
    const upstream = await fetch('https://api.pruna.ai/v1/files', {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'multipart/form-data; boundary=' + boundary },
      body,
      duplex: 'half',
      redirect: 'error',
      signal: controller.signal
    });
    if (!upstream.ok) {
      const messages = {
        401: 'Chiave API non valida.', 403: 'La chiave API non è autorizzata a caricare file.',
        413: 'Pruna ha rifiutato il file perché troppo grande. Riducilo oppure usa un link.',
        415: 'Pruna non accetta il formato di questo file.',
        429: 'Limite di caricamenti raggiunto. Attendi prima di riprovare.'
      };
      return json(upstream.status, { error: messages[upstream.status] || 'Pruna non ha accettato il file. Verifica il formato e riprova.' });
    }
    const data = await upstream.json();
    const url = new URL(data?.urls?.get);
    if (url.origin !== 'https://api.pruna.ai' || url.username || url.password || url.search || url.hash || !/^\/v1\/files\/[A-Za-z0-9_-]+$/.test(url.pathname)) throw new Error('invalid response');
    return json(201, { urls: { get: url.href } });
  } catch {
    if (tooLarge) return json(413, { error: 'Il file supera la dimensione consentita.' });
    if (incomplete) return json(400, { error: 'Il caricamento del file è incompleto. Riprova.' });
    return json(controller.signal.aborted ? 504 : 502, { error: 'Caricamento non completato. Riprova con un file più piccolo oppure usa un link.' });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
  }
}
