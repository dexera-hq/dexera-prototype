import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/35 bg-primary/12 text-primary',
        secondary: 'border-border bg-secondary/75 text-secondary-foreground',
        outline: 'border-border bg-background/45 text-muted-foreground',
        success: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
        warm: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
        danger: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
