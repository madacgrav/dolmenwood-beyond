export default function Loading() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem',
        gap: '0.75rem',
        paddingBottom: '5rem',
      }}
    >
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '10px',
            height: '80px',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
