import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/app/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-dark",
        secondary: "bg-secondary text-white hover:bg-secondary/90",
        outline: "border border-primary/50 bg-transparent text-primary hover:bg-primary/10",
        ghost: "bg-transparent text-primary hover:bg-primary/10",
        gradient: "bg-gradient-to-r from-primary to-secondary text-white hover:brightness-110",
        glassmorphism: "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20",
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-4",
        md: "h-10 px-5",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
      },
      rounded: {
        default: "rounded-lg",
        full: "rounded-full",
        none: "rounded-none",
      },
      glow: {
        true: "shadow-glow hover:shadow-glow-lg",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      rounded: "default",
      glow: false,
    },
  }
);

// Definimos los tipos de propiedades conflictivas para omitirlas
type ConflictingTypes =
  | 'onAnimationStart'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDrag'
  | 'style'; // y otras propiedades que puedan causar conflicto

// Para el botón normal
export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, ConflictingTypes>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  animate?: boolean;
}

// Para el motion.button
export interface MotionButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'size'>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    rounded,
    glow, 
    isLoading = false, 
    leftIcon, 
    rightIcon, 
    children, 
    animate = true,
    ...props 
  }, ref) => {
    const buttonContent = (
      <>
        {isLoading && (
          <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </>
    );

    const buttonClasses = cn(
      buttonVariants({ variant, size, rounded, glow, className })
    );

    if (animate) {
      // Utilizamos as any para evitar errores de tipo en la transición entre tipos
      return (
        <motion.button
          ref={ref}
          className={buttonClasses}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          {...props as any}
        >
          {buttonContent}
        </motion.button>
      );
    }

    return (
      <button
        ref={ref}
        className={buttonClasses}
        {...props}
      >
        {buttonContent}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants }; 