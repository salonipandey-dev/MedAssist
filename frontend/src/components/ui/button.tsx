import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ButtonHTMLAttributes } from 'react';
const variants=cva('btn',{variants:{variant:{primary:'btn-primary',secondary:'btn-secondary',ghost:'btn-ghost',danger:'btn-danger'},size:{default:'',sm:'btn-sm',icon:'btn-icon'}},defaultVariants:{variant:'primary',size:'default'}});
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>,VariantProps<typeof variants>{asChild?:boolean}
export function Button({className,variant,size,asChild=false,...props}:ButtonProps){const Component=asChild?Slot:'button';return <Component className={twMerge(clsx(variants({variant,size}),className))} {...props}/>;}
