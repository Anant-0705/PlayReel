import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind classes safely, handling conflicts beautifully.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
