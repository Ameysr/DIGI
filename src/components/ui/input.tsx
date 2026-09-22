import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const fieldStyles =
  'w-full rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted/60 focus:border-accent/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldStyles, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldStyles, 'min-h-24 resize-y', className)} {...props} />
}
