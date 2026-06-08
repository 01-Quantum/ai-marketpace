export const MAX_CSV_UPLOAD_BYTES = 50 * 1024 * 1024;

export function isCsvFile(file: File): boolean {
  if (file.name.toLowerCase().endsWith('.csv')) return true;
  const type = file.type.toLowerCase();
  return type === 'text/csv' || type === 'application/vnd.ms-excel';
}

export function validateCsvFile(file: File): string | null {
  if (!isCsvFile(file)) return 'Only CSV files are allowed.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_CSV_UPLOAD_BYTES) return 'File must be 50 MB or smaller.';
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
