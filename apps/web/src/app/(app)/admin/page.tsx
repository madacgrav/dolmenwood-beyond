import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface AdminAccount {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_admin: boolean;
  created_at: string;
}

interface AdminCharacter {
  id: string;
  name: string;
  character_class: string;
  level: number;
  xp: number;
  kindred: string;
  is_active: boolean;
  created_at: string;
  owner_display_name: string;
  owner_email: string;
}

interface AdminCampaign {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  referee_display_name: string;
  referee_email: string;
  member_count: number;
}

interface AdminStats {
  total_accounts: number;
  total_characters: number;
  active_characters: number;
  total_campaigns: number;
}

interface AdminData {
  accounts: AdminAccount[];
  characters: AdminCharacter[];
  campaigns: AdminCampaign[];
  stats: AdminStats;
}

const TABLE_HEADER: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  fontSize: '0.72rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: '700',
  borderBottom: '2px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)',
};

const TABLE_CELL: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '0.82rem',
  color: 'var(--color-text)',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'middle',
};

const MUTED_CELL: React.CSSProperties = {
  ...TABLE_CELL,
  color: 'var(--color-text-muted)',
  fontSize: '0.75rem',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display), Georgia, serif',
      fontSize: '1.1rem',
      color: 'var(--color-text)',
      margin: '0 0 0.75rem',
    }}>
      {children}
    </h2>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '10px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
    }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-primary)', fontFamily: 'var(--font-display), Georgia, serif' }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data, error } = await supabase.rpc('get_admin_data');

  if (error || !data) {
    const isAccessDenied = error?.message?.toLowerCase().includes('access denied');
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{isAccessDenied ? '🛡️' : '⚠️'}</div>
          <h1 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-danger)', margin: '0 0 0.5rem' }}>
            {isAccessDenied ? 'Access Denied' : 'Error Loading Dashboard'}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {isAccessDenied
              ? 'You do not have administrator access.'
              : `An error occurred: ${error?.message ?? 'Unknown error. Please try again.'}`}
          </p>
        </div>
      </div>
    );
  }

  const adminData = data as AdminData;
  const { accounts, characters, campaigns, stats } = adminData;

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', paddingBottom: '5rem' }}>
      <div style={{ padding: '1.25rem 1rem 0', maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.75rem',
          color: 'var(--color-primary)',
          margin: '0 0 0.25rem',
        }}>
          Admin Dashboard
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 1.5rem' }}>
          Super-administrator view
        </p>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
          <KpiCard label="Total Users" value={stats.total_accounts} />
          <KpiCard label="Total Characters" value={stats.total_characters} />
          <KpiCard label="Active Characters" value={stats.active_characters} />
          <KpiCard label="Campaigns" value={stats.total_campaigns} />
        </div>

        {/* Accounts Table */}
        <section style={{ marginBottom: '2rem' }}>
          <SectionTitle>Accounts ({accounts?.length ?? 0})</SectionTitle>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TABLE_HEADER}>Name</th>
                  <th style={TABLE_HEADER}>Email</th>
                  <th style={TABLE_HEADER}>Role</th>
                  <th style={TABLE_HEADER}>Admin</th>
                  <th style={TABLE_HEADER}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {(accounts ?? []).map((acc, i) => (
                  <tr key={acc.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--color-border) 20%, transparent)' }}>
                    <td style={TABLE_CELL}>{acc.display_name || '—'}</td>
                    <td style={MUTED_CELL}>{acc.email}</td>
                    <td style={MUTED_CELL}>{acc.role}</td>
                    <td style={TABLE_CELL}>{acc.is_admin ? '🛡️' : '—'}</td>
                    <td style={MUTED_CELL}>{new Date(acc.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Characters Table */}
        <section style={{ marginBottom: '2rem' }}>
          <SectionTitle>Characters ({characters?.length ?? 0})</SectionTitle>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TABLE_HEADER}>Name</th>
                  <th style={TABLE_HEADER}>Owner</th>
                  <th style={TABLE_HEADER}>Class</th>
                  <th style={TABLE_HEADER}>Level</th>
                  <th style={TABLE_HEADER}>XP</th>
                  <th style={TABLE_HEADER}>Kindred</th>
                  <th style={TABLE_HEADER}>Active</th>
                </tr>
              </thead>
              <tbody>
                {(characters ?? []).map((ch, i) => (
                  <tr key={ch.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--color-border) 20%, transparent)' }}>
                    <td style={TABLE_CELL}>{ch.name}</td>
                    <td style={MUTED_CELL}>{ch.owner_display_name}</td>
                    <td style={MUTED_CELL}>{ch.character_class}</td>
                    <td style={{ ...TABLE_CELL, textAlign: 'center' }}>{ch.level}</td>
                    <td style={MUTED_CELL}>{ch.xp.toLocaleString()}</td>
                    <td style={MUTED_CELL}>{ch.kindred}</td>
                    <td style={{ ...TABLE_CELL, textAlign: 'center' }}>{ch.is_active ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Campaigns Table */}
        <section style={{ marginBottom: '2rem' }}>
          <SectionTitle>Campaigns ({campaigns?.length ?? 0})</SectionTitle>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TABLE_HEADER}>Name</th>
                  <th style={TABLE_HEADER}>Referee</th>
                  <th style={TABLE_HEADER}>Members</th>
                  <th style={TABLE_HEADER}>Invite Code</th>
                  <th style={TABLE_HEADER}>Created</th>
                </tr>
              </thead>
              <tbody>
                {(campaigns ?? []).map((camp, i) => (
                  <tr key={camp.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--color-border) 20%, transparent)' }}>
                    <td style={TABLE_CELL}>{camp.name}</td>
                    <td style={MUTED_CELL}>{camp.referee_display_name}</td>
                    <td style={{ ...TABLE_CELL, textAlign: 'center' }}>{camp.member_count}</td>
                    <td style={{ ...TABLE_CELL, fontFamily: 'monospace', color: 'var(--color-gold)', letterSpacing: '0.1em' }}>{camp.invite_code}</td>
                    <td style={MUTED_CELL}>{new Date(camp.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
