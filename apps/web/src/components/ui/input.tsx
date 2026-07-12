import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-[12px] border border-glass-brd bg-glass px-3.5 text-[13px] text-txt outline-none',
        'placeholder:text-txt3 focus:border-green/60 focus:ring-2 focus:ring-green/20',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
