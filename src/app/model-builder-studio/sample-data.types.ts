export interface SampleDataRow {
  id: number;
  expected: string;
  [field: string]: number | string;
}

export interface SampleDataDocument {
  rows: SampleDataRow[];
}

export function parseSampleDataDocument(json: unknown): SampleDataRow[] {
  if (!json || typeof json !== 'object') return [];
  const rows = (json as SampleDataDocument).rows;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return structuredClone(rows);
}

export function toSampleDataDocument(rows: SampleDataRow[]): SampleDataDocument {
  return { rows: structuredClone(rows) };
}

export function sampleRowFields(row: SampleDataRow | undefined): string[] {
  if (!row) return [];
  return Object.keys(row).filter((key) => key !== 'id');
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

export function sampleDataToCsv(rows: SampleDataRow[]): string {
  if (!rows.length) return '';
  const fields = sampleRowFields(rows[0]);
  const header = fields.map(escapeCsvValue).join(',');
  const lines = rows.map((row) =>
    fields.map((field) => escapeCsvValue(row[field] ?? '')).join(','),
  );
  return [header, ...lines].join('\n');
}

export function parseSampleDataCsv(text: string): SampleDataRow[] {
  const normalized = text.replace(/^\uFEFF/, '').trim();
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).reduce<SampleDataRow[]>((rows, line, index) => {
    const values = parseCsvLine(line);
    if (values.every((value) => !value.trim())) return rows;

    const row: SampleDataRow = { id: rows.length + 1, expected: '' };

    headers.forEach((header, columnIndex) => {
      const value = (values[columnIndex] ?? '').trim();
      if (!header) return;
      if (header === 'id') {
        const parsedId = Number.parseInt(value, 10);
        if (!Number.isNaN(parsedId)) row.id = parsedId;
        return;
      }
      if (header === 'expected') {
        row.expected = value;
        return;
      }
      const parsed = Number.parseFloat(value);
      row[header] = Number.isNaN(parsed) ? value : parsed;
    });

    if (!row.expected && headers.includes('expected')) {
      row.expected = (values[headers.indexOf('expected')] ?? '').trim();
    }

    rows.push(row);
    return rows;
  }, []);
}
