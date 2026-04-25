import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ elevated = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
        elevated && 'shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
