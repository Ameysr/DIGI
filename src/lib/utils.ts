import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CURRENCY, CURRENCY_LOCALE } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format an integer amount held in the smallest currency unit.
 *
 * 49900 -> "₹499.00". Amounts are always integers so no rounding surprises can
 * creep in; the division happens only for display.
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: CURRENCY,
  }).format(cents / 100)
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/** Inclusive list of the integers from `min` to `max`. */
export function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index)
}

/**
 * Today as `YYYY-MM-DD` in the user's own timezone.
 *
 * `new Date().toISOString()` would use UTC, so anyone east of Greenwich would
 * see yesterday's date late in the evening and be unable to log a round they
 * played today.
 */
export function todayIsoDate(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
