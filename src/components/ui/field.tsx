import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

const fieldClassName =
  'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-950 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-accent focus:ring-4 focus:ring-accent-soft disabled:cursor-not-allowed disabled:bg-slate-100';

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-sm font-medium text-slate-800', className)}
      {...props}
    />
  );
}

export function FieldError({
  children,
  id,
}: {
  children?: string;
  id?: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <p className="mt-1.5 text-sm text-red-700" id={id}>
      {children}
    </p>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className, ...props }, ref) {
  return (
    <input ref={ref} className={cn(fieldClassName, className)} {...props} />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(fieldClassName, className)} {...props} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldClassName, className)} {...props} />
  );
});

export function Checkbox({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'size-4 rounded border-slate-300 text-accent focus:ring-accent',
        className,
      )}
      type="checkbox"
      {...props}
    />
  );
}
