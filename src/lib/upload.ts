import type { ExpirySeconds, ProviderId } from './types';
import { safeUploadName } from './format';
import { getProvider } from './providers';

export class UploadAbort extends Error {
  constructor() {
    super('Upload canceled');
  }
}

export function uploadFile(
  providerId: ProviderId,
  file: File,
  expire: ExpirySeconds,
  onProgress: (loaded: number, total: number) => void,
): { promise: Promise<string>; abort: () => void } {
  const provider = getProvider(providerId);
  const xhr = new XMLHttpRequest();
  const promise = new Promise<string>((resolve, reject) => {
    const data = new FormData();
    data.append('file', file, safeUploadName(file.name));
    data.append('expire', String(expire));

    xhr.open('POST', provider.apiUrl);
    xhr.responseType = 'text';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      try {
        resolve(provider.parseResponse(xhr));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error — check your connection'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.onabort = () => reject(new UploadAbort());
    xhr.send(data);
  });
  return { promise, abort: () => xhr.abort() };
}
