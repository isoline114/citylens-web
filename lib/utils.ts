import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeJsonStringify(value: unknown, space = 2): string {
  try {
    return JSON.stringify(value, null, space);
  } catch {
    return String(value);
  }
}
