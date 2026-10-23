export type ProviderId = 'tmpfiles' | 'onlyfiles';

export type Category = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other';

export type ExpirySeconds = 0 | 3600 | 21600 | 86400 | 172800;

/** Sentinel timestamp for "forever" files — year 9999. */
export const FOREVER_TS = 253402300800000;

export const EXPIRY_OPTIONS: { value: ExpirySeconds; label: string; short: string; forever?: boolean }[] = [
  { value: 3600, label: '60 minutes', short: '1h' },
  { value: 21600, label: '6 hours', short: '6h' },
  { value: 86400, label: '24 hours', short: '24h' },
  { value: 172800, label: '48 hours', short: '48h' },
  { value: 0, label: 'Forever', short: '∞', forever: true },
];

export const CATEGORIES: Category[] = ['image', 'video', 'audio', 'document', 'archive', 'code', 'other'];

export interface TrackedFile {
  id: string;
  name: string;
  label: string;
  size: number;
  mime: string;
  category: Category;
  url: string;
  uploadedAt: number;
  expiresAt: number;
  expiry: ExpirySeconds;
  sha256?: string;
  thumb?: string;
  tags: string[];
  note: string;
  pinned: boolean;
  provider?: ProviderId;
}

export type QueueStatus = 'queued' | 'preparing' | 'uploading' | 'done' | 'error' | 'canceled';

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: QueueStatus;
  loaded: number;
  speed: number;
  error?: string;
  expiry: ExpirySeconds;
  fileId?: string;
  reused?: boolean;
  provider: ProviderId;
}
