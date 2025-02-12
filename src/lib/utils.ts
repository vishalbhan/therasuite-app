import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add a currency formatter utility
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateRandomColor(): string {
  // Array of pleasant, muted colors
  const colors = [
    '#FDA4AF', // rose-300
    '#FCA5A5', // red-300
    '#FDBA74', // orange-300
    '#FCD34D', // amber-300
    '#BEF264', // lime-300
    '#86EFAC', // green-300
    '#5EEAD4', // teal-300
    '#67E8F9', // cyan-300
    '#7DD3FC', // sky-300
    '#93C5FD', // blue-300
    '#C4B5FD', // violet-300
    '#F0ABFC', // fuchsia-300
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}
