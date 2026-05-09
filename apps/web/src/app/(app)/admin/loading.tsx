export default function AdminLoading() {
  const pulse: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '8px',
    animation: 'pulse 1.5s ease-in-out infinite',
  };

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', paddingBottom: '5rem' }}>
      <div style={{ padding: '1.25rem 1rem 0', maxWidth: '900px', margin: '0 auto' }}>
        {/* Title skeleton */}
        <div style={{ ...pulse, height: '2rem', width: '200px', marginBottom: '1.5rem' }} />

        {/* KPI cards skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ ...pulse, height: '80px', borderRadius: '10px' }} />
          ))}
        </div>

        {/* Three table sections skeleton */}
        {[1, 2, 3].map(section => (
          <div key={section} style={{ marginBottom: '2rem' }}>
            <div style={{ ...pulse, height: '1.2rem', width: '120px', marginBottom: '0.75rem' }} />
            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
              {[1, 2, 3, 4].map(row => (
                <div key={row} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '1rem' }}>
                  <div style={{ ...pulse, height: '1rem', flex: 2 }} />
                  <div style={{ ...pulse, height: '1rem', flex: 1 }} />
                  <div style={{ ...pulse, height: '1rem', flex: 1 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
