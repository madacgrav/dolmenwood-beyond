'use client';
import { useState, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CharacterWithNotes } from '@dolmenwood/types';
import { uploadPortrait } from '@/lib/data/portraits';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const extMap: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif',
};

export function usePortraitUpload(
  supabase: SupabaseClient,
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
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setUploadError('Could not verify user session. Please sign in again.');
        return;
      }
      const user = userData.user;
      const { publicUrl, error } = await uploadPortrait(supabase, user.id, character.id, file, ext);
      if (error || !publicUrl) {
        if (error) setUploadError(error);
        return;
      }
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
