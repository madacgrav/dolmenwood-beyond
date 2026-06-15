'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteAccount } from '@/lib/data/account';
import { sectionStyle, sectionHeaderStyle } from './styles';
import { DeleteAccountModal } from './DeleteAccountModal';

interface DangerZoneSectionProps {
  supabase: SupabaseClient;
}

export function DangerZoneSection({ supabase }: DangerZoneSectionProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      const error = await deleteAccount(supabase);
      if (error) throw new Error(error);
      // Sign out — ignore errors since the account is already deleted
      await supabase.auth.signOut().catch(() => undefined);
      router.push('/sign-in');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete account');
      setDeleting(false);
    }
  }

  return (
    <>
      <section style={{ ...sectionStyle, borderColor: 'var(--color-danger)', marginBottom: '2rem' }}>
        <h2 style={{ ...sectionHeaderStyle, color: 'var(--color-danger)' }}>Danger Zone</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.875rem' }}>
          Permanently delete your account and all associated characters, inventory, and data. This cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{ padding: '0.625rem 1.25rem', backgroundColor: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', minHeight: '44px' }}
        >
          Delete Account
        </button>
      </section>

      {showDeleteConfirm && (
        <DeleteAccountModal
          deleteConfirmText={deleteConfirmText}
          setDeleteConfirmText={setDeleteConfirmText}
          deleting={deleting}
          deleteError={deleteError}
          onCancel={() => { setShowDeleteConfirm(false); setDeleteError(''); setDeleteConfirmText(''); }}
          onConfirm={handleDeleteAccount}
        />
      )}
    </>
  );
}
