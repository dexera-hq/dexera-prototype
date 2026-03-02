import * as React from 'react';
import { cn } from '@/lib/utils';

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  decorative?: boolean;
  orientation?: 'horizontal' | 'vertical';
};

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, decorative = true, orientation = 'horizontal', ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? undefined : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        'shrink-0 bg-border/70',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  ),
);

Separator.displayName = 'Separator';

export { Separator };
