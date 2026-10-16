import { MAX_FILE_BYTES, MEDIA_FORMATS, mediaType, formatBytes } from './media-config.mjs';

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};
const fileKey = file => [file.name, file.size, file.lastModified].join('\u0000');

export class MediaInputs {
  constructor(onChange) {
    this.drafts = new Map();
    this.active = new Map();
    this.busy = false;
    this.onChange = onChange;
  }

  state(id) {
    if (!this.drafts.has(id)) this.drafts.set(id, { source: 'files', files: [], urls: '' });
    return this.drafts.get(id);
  }

  beginRender() { this.active.clear(); }

  useUrl(id, url) {
    const state = this.state(id);
    state.source = 'url';
    state.urls = url;
  }

  has(id) {
    if (!this.active.has(id)) return false;
    const state = this.state(id);
    return state.source === 'files' ? state.files.length > 0 : !!state.urls.trim();
  }

  render(id, label, { kind = 'image', max = 1, optional = false, hint = '', maxDuration } = {}) {
    const state = this.state(id);
    const format = MEDIA_FORMATS[kind];
    const group = element('fieldset', 'media-field field');
    group.dataset.media = id;
    group.append(element('legend', '', label + (optional ? ' · opzionale' : '')));
    const sources = element('div', 'media-sources');
    sources.setAttribute('role', 'group');
    sources.setAttribute('aria-label', 'Sorgente per ' + label.toLowerCase());
    const localButton = element('button', '', max > 1 ? 'Carica immagini' : 'Carica file');
    const urlButton = element('button', '', max > 1 ? 'Usa link' : 'Usa un link');
    localButton.type = urlButton.type = 'button';
    sources.append(localButton, urlButton);
    group.append(sources);

    const localPane = element('div', 'media-local');
    const drop = element('label', 'drop-zone');
    const picker = element('input', 'file-picker visually-hidden');
    picker.id = id + 'Files';
    picker.type = 'file';
    picker.accept = format.extensions.map(ext => '.' + ext).join(',');
    picker.multiple = max > 1;
    picker.setAttribute('aria-label', 'Carica ' + label.toLowerCase());
    picker.setAttribute('aria-describedby', id + 'Hint');
    drop.htmlFor = picker.id;
    drop.append(picker, element('span', 'drop-icon', '↑'),
      element('strong', '', max > 1 ? 'Scegli o trascina le immagini' : 'Scegli o trascina un file'),
      element('span', '', 'Dal computer o dal telefono'));
    const limits = element('p', 'hint', format.label + ' · massimo 50 MB per file' + (max > 1 ? ' · fino a ' + max + ' immagini' : '') + (hint ? '. ' + hint : '.'));
    limits.id = id + 'Hint';
    const list = element('ul', 'media-list');
    list.setAttribute('aria-label', label + ' selezionati');
    localPane.append(drop, limits, list);

    const urlPane = element('div', 'media-urls');
    const urlLabel = element('label', '', max > 1 ? 'Link delle immagini · uno per riga' : 'Link del file');
    urlLabel.htmlFor = id;
    const urls = element(max > 1 ? 'textarea' : 'input');
    urls.id = id;
    if (max === 1) urls.type = 'url';
    urls.placeholder = 'https://…';
    urls.spellcheck = false;
    urls.value = state.urls;
    urls.setAttribute('aria-label', 'Link per ' + label.toLowerCase());
    urlPane.append(urlLabel, urls, element('p', 'hint', 'Usa un URL HTTPS pubblico o un URL file Pruna.'));
    const error = element('p', 'field-error hidden');
    error.id = id + 'Error';
    error.setAttribute('role', 'alert');
    group.append(localPane, urlPane, error);
    const showError = message => {
      error.textContent = message;
      error.classList.toggle('hidden', !message);
      for (const input of [picker, urls]) {
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
        input.setAttribute('aria-describedby', id + 'Hint' + (message ? ' ' + error.id : ''));
      }
    };

    const renderList = () => {
      list.replaceChildren();
      state.files.forEach((entry, index) => {
        const item = element('li', 'media-card');
        const preview = element(kind === 'image' ? 'img' : kind);
        preview.src = entry.preview;
        if (kind === 'image') preview.alt = 'Anteprima di ' + entry.file.name;
        else {
          preview.controls = true;
          preview.preload = 'metadata';
          preview.setAttribute('aria-label', 'Anteprima di ' + entry.file.name);
          if (kind === 'video') preview.playsInline = true;
          preview.addEventListener('loadedmetadata', () => { entry.duration = preview.duration; });
        }
        const info = element('div', 'media-info');
        info.append(element('strong', 'media-name', entry.file.name), element('span', '', formatBytes(entry.file.size)));
        const actions = element('div', 'media-card-actions');
        if (max > 1) {
          for (const [delta, text, name] of [[-1, '↑', 'prima'], [1, '↓', 'dopo']]) {
            const move = element('button', 'secondary', text);
            move.type = 'button';
            move.setAttribute('aria-label', 'Sposta ' + entry.file.name + ' ' + name);
            move.disabled = this.busy || index + delta < 0 || index + delta >= state.files.length;
            move.onclick = () => {
              if (this.busy) return;
              [state.files[index], state.files[index + delta]] = [state.files[index + delta], state.files[index]];
              renderList();
              this.onChange();
            };
            actions.append(move);
          }
        }
        const remove = element('button', 'secondary', 'Rimuovi');
        remove.type = 'button';
        remove.disabled = this.busy;
        remove.setAttribute('aria-label', 'Rimuovi ' + entry.file.name);
        remove.onclick = () => {
          if (this.busy) return;
          URL.revokeObjectURL(entry.preview);
          state.files.splice(index, 1);
          showError('');
          renderList();
          this.onChange();
          picker.focus();
        };
        actions.append(remove);
        item.append(preview, info, actions);
        list.append(item);
      });
    };
    const selectSource = source => {
      if (this.busy) return;
      state.source = source;
      localButton.setAttribute('aria-pressed', String(source === 'files'));
      urlButton.setAttribute('aria-pressed', String(source === 'url'));
      localPane.classList.toggle('hidden', source !== 'files');
      urlPane.classList.toggle('hidden', source !== 'url');
      // A hidden URL must not participate in native URL validation.
      urls.disabled = source !== 'url';
      showError('');
      this.onChange();
    };
    const addFiles = incoming => {
      if (this.busy || !incoming.length) return;
      const next = max === 1 ? [] : [...state.files];
      const seen = new Set(next.map(entry => fileKey(entry.file)));
      try {
        for (const file of incoming) {
          const type = mediaType(file.name, file.type);
          if (!type || !type.startsWith(kind + '/')) throw new Error('Formato non supportato. Scegli ' + format.label + '.');
          if (!file.size) throw new Error('Il file ' + file.name + ' è vuoto.');
          if (file.size > MAX_FILE_BYTES) throw new Error(file.name + ': supera il limite di 50 MB. Scegli un file più piccolo oppure usa un link.');
          if (!seen.has(fileKey(file))) {
            seen.add(fileKey(file));
            next.push({ file, type, preview: null });
          }
        }
        if (next.length > max) throw new Error('Puoi selezionare al massimo ' + max + (max === 1 ? ' file.' : ' immagini.'));
        if (max === 1) for (const entry of state.files) URL.revokeObjectURL(entry.preview);
        for (const entry of next) if (!entry.preview) entry.preview = URL.createObjectURL(entry.file);
        state.files = next;
        showError('');
        renderList();
        this.onChange();
      } catch (err) { showError(err.message); }
      picker.value = '';
    };
    picker.addEventListener('change', () => addFiles([...picker.files]));
    drop.addEventListener('dragover', event => {
      event.preventDefault();
      if (!this.busy) drop.classList.add('dragging');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop.addEventListener('drop', event => {
      event.preventDefault();
      drop.classList.remove('dragging');
      addFiles([...event.dataTransfer.files]);
    });
    localButton.onclick = () => { selectSource('files'); picker.focus(); };
    urlButton.onclick = () => { selectSource('url'); urls.focus(); };
    urls.addEventListener('input', () => { state.urls = urls.value; showError(''); this.onChange(); });
    renderList();
    // Initial render happens before all the other fields have been mounted.
    localButton.setAttribute('aria-pressed', String(state.source === 'files'));
    urlButton.setAttribute('aria-pressed', String(state.source === 'url'));
    localPane.classList.toggle('hidden', state.source !== 'files');
    urlPane.classList.toggle('hidden', state.source !== 'url');
    urls.disabled = state.source !== 'url';
    this.active.set(id, { state, label, max, maxDuration, picker, urls, showError, renderList, group });
    return group;
  }

  references(id, { min = 0, max } = {}) {
    const control = this.active.get(id);
    if (!control) return [];
    const { state, label, maxDuration } = control;
    const limit = max ?? control.max;
    try {
      let values;
      if (state.source === 'files') {
        values = state.files.map(entry => {
          if (maxDuration && entry.duration > maxDuration + 0.1) throw new Error('Il video deve durare al massimo ' + maxDuration + ' secondi.');
          return entry.file;
        });
      } else {
        values = state.urls.split('\n').map(url => url.trim()).filter(Boolean);
        for (const value of values) {
          let url;
          try { url = new URL(value); } catch { throw new Error('Inserisci un link completo, per esempio https://…'); }
          if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Usa link HTTPS senza credenziali.');
        }
      }
      if (values.length < min) throw new Error('Aggiungi ' + (min === 1 ? 'un file' : 'almeno ' + min + ' immagini') + ' per ' + label.toLowerCase() + '.');
      if (values.length > limit) throw new Error('Puoi usare al massimo ' + limit + (limit === 1 ? ' file.' : ' immagini.'));
      control.showError('');
      return values;
    } catch (err) {
      control.showError(err.message);
      (state.source === 'files' ? control.picker : control.urls).focus();
      throw err;
    }
  }

  setBusy(value) {
    this.busy = value;
    for (const { group, state, urls, renderList } of this.active.values()) {
      for (const control of group.querySelectorAll('button,input,textarea')) control.disabled = value;
      if (!value) { urls.disabled = state.source !== 'url'; renderList(); }
      group.setAttribute('aria-busy', String(value));
    }
  }

  async uploadInputs(body, key, signal, onProgress) {
    const files = new Map();
    const collect = value => {
      if (value instanceof File) files.set(value, null);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(body);
    let index = 0;
    for (const file of files.keys()) {
      signal.throwIfAborted();
      index++;
      const url = await this.uploadFile(file, key, signal, percent => onProgress(file.name, index, files.size, percent));
      files.set(file, url);
    }
    const replace = value => {
      if (value instanceof File) return files.get(value);
      if (Array.isArray(value)) return value.map(replace);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
      return value;
    };
    return replace(body);
  }

  uploadFile(file, key, signal, onProgress) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Interrotto', 'AbortError')); return; }
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const finish = callback => { signal.removeEventListener('abort', abort); callback(); };
      xhr.open('POST', '/api/upload');
      xhr.timeout = 45000;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Content-Type', mediaType(file.name, file.type));
      xhr.setRequestHeader('x-pruna-key', key);
      xhr.setRequestHeader('x-upload-name', encodeURIComponent(file.name));
      xhr.setRequestHeader('x-upload-size', String(file.size));
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
      };
      xhr.onload = () => finish(() => {
        const data = xhr.response;
        if (xhr.status < 200 || xhr.status >= 300) {
          const fallback = xhr.status === 413 ? 'Il file è troppo grande per il servizio di upload.' :
            xhr.status === 404 ? 'Il servizio di upload non è disponibile. Pubblica anche la nuova configurazione Netlify.' :
            'Caricamento non riuscito (' + xhr.status + '). Riprova.';
          reject(new Error(typeof data?.error === 'string' ? data.error : fallback));
          return;
        }
        try {
          const url = new URL(data?.urls?.get);
          // This reference is sent only as input to Pruna; the API key stays in headers of our own endpoints.
          if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.href.length > 8192) throw Error();
          resolve(url.href);
        } catch { reject(new Error('Pruna non ha restituito un riferimento valido per il file.')); }
      });
      xhr.onerror = () => finish(() => reject(new Error('Collegamento interrotto durante il caricamento. Controlla la connessione e riprova.')));
      xhr.ontimeout = () => finish(() => reject(new Error('Caricamento troppo lento. Riprova con un file più piccolo oppure usa un link.')));
      xhr.onabort = () => finish(() => reject(new DOMException('Interrotto', 'AbortError')));
      signal.addEventListener('abort', abort, { once: true });
      onProgress(0);
      xhr.send(file);
    });
  }

  dispose() {
    for (const state of this.drafts.values()) for (const entry of state.files) URL.revokeObjectURL(entry.preview);
  }
}
