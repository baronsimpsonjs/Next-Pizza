import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/lib/utils';
import dynamic from 'next/dynamic';

const Spinner = dynamic(
  () => import('../animations/spinner').then((mod) => mod.Spinner),
  { ssr: false },
);

const size = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
};
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md active:translate-y-[1px] text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-primary text-primary bg-transparent hover:bg-secondary',
        secondary: 'bg-secondary text-primary hover:bg-secondary/50',
        ghost: 'hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size,
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export const mobileButtonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-primary text-primary bg-transparent',
        secondary: 'bg-secondary text-primary',
        ghost: '',
        link: 'text-primary underline-offset-4',
      },
      size,
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  disabledStyles?: string;
  isMobile?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      children,
      disabled,
      loading,
      disabledStyles = 'bg-gray-500',
      isMobile = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        disabled={isDisabled}
        className={cn(
          (isMobile ? mobileButtonVariants : buttonVariants)({ variant, size }),
          className,
          isDisabled && disabledStyles,
        )}
        ref={ref}
        {...props}
      >
        {!loading ? children : <Spinner size="sm" strokeColor="#ffff" />}
      </Comp>
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
