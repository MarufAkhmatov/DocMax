import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass rounded-[20px] p-8 shadow-lifted', className)} {...props} />;
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-[12px] border border-red/30 bg-red/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-red">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-[12px] border border-green/30 bg-green-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-green-text">
      {message}
    </p>
  );
}
