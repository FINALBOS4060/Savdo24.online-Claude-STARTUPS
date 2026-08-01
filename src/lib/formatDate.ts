export function formatDate(dateInput: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...options
  };

  return date.toLocaleDateString('uz-UZ', defaultOptions);
}

export function formatDateTime(dateInput: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };

  return date.toLocaleString('uz-UZ', defaultOptions);
}
