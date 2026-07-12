import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.4px] text-txt2', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
