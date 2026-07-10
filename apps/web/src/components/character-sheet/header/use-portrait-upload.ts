'use client';
import { useState, useRef } from 'react';
import type { CharacterWithNotes } from '@dolmenwood/types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const extMap: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif',
};

export function usePortraitUpload(
  character: CharacterWithNotes,
  onUpdate: (updates: Partial<CharacterWithNotes>) => void | Promise<void>,
) {
  const [portraitUrl, setPortraitUrl] = useState<string | null>(character.portraitUrl ?? null);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePortraitSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Only JPEG, PNG, WebP, and GIF images are allowed.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('Image must be smaller than 5 MB.');
      return;
    }
    const ext = extMap[file.type] ?? 'jpg';

    setUploadError('');
    setPortraitUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('characterId', character.id);
      form.append('ext', ext);
      const res = await fetch('/api/portraits', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setUploadError(body?.error ?? 'Upload failed.');
        return;
      }
      const { publicUrl } = await res.json();
      setPortraitUrl(publicUrl);
      await onUpdate({ portraitUrl: publicUrl });
    } finally {
      setPortraitUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return {
    portraitUrl,
    portraitUploading,
    uploadError,
    fileInputRef,
    handlePortraitSelect,
  };
}
