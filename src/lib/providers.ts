import type { ProviderId } from './types';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  url: string;
  apiUrl: string;
  tagline: string;
  maxSize: number;
  supportsForever: boolean;
  limits: string;
  parseResponse: (xhr: XMLHttpRequest) => string;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  tmpfiles: {
    id: 'tmpfiles',
    name: 'tmpfiles.org',
    url: 'https://tmpfiles.org',
    apiUrl: 'https://tmpfiles.org/api/v1/upload',
    tagline: 'Temporary file hosting',
    maxSize: 100 * 1024 * 1024,
    supportsForever: false,
    limits: '100 MB per file',
    parseResponse(xhr) {
      let json: { status?: string; message?: string; data?: { url?: string } } | null = null;
      try { json = JSON.parse(xhr.responseText); } catch { json = null; }
      if (xhr.status >= 200 && xhr.status < 300 && json?.status === 'success' && json.data?.url) {
        return json.data.url.replace(/^http:\/\//, 'https://');
      }
      throw new Error(json?.message || `Server responded ${xhr.status || 'with an error'}`);
    },
  },
  onlyfiles: {
    id: 'onlyfiles',
    name: 'OnlyFiles',
    url: 'https://onlyfiles.com',
    apiUrl: 'https://api.onlyfiles.com/v1/upload',
    tagline: 'Permanent & temporary hosting',
    maxSize: 100 * 1024 * 1024,
    supportsForever: true,
    limits: '100 MB · 500/hr · 5K/day',
    parseResponse(xhr) {
      let json: { status?: boolean; data?: { file?: { url?: { full?: string } } }; error?: { message?: string } } | null = null;
      try { json = JSON.parse(xhr.responseText); } catch { json = null; }
      if (xhr.status >= 200 && xhr.status < 300 && json?.status === true && json.data?.file?.url?.full) {
        return json.data.file.url.full;
      }
      throw new Error(json?.error?.message || `Server responded ${xhr.status || 'with an error'}`);
    },
  },
};

export const PROVIDER_IDS: ProviderId[] = ['tmpfiles', 'onlyfiles'];

export function getProvider(id: ProviderId): ProviderConfig {
  return PROVIDERS[id] || PROVIDERS.tmpfiles;
}
