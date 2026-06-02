import { DecisionNode, TreeNode } from './model-builder.types';
import { SampleDataRow, sampleRowFields } from './sample-data.types';

/** Numeric/input column names from sample data (excludes id and expected). */
export function sampleFeatureFields(rows: SampleDataRow[]): string[] {
  if (rows.length === 0) return [];
  return sampleRowFields(rows[0]).filter((field) => field !== 'expected');
}

/** Feature names available for decision nodes: sample columns plus tree nodes. */
export function collectFeatureOptions(
  nodes: TreeNode[],
  sampleRows: SampleDataRow[],
  currentFeature?: string,
): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const feature of sampleFeatureFields(sampleRows)) {
    if (seen.has(feature)) continue;
    seen.add(feature);
    options.push(feature);
  }

  for (const feature of collectTreeFeatures(nodes)) {
    if (seen.has(feature)) continue;
    seen.add(feature);
    options.push(feature);
  }

  if (currentFeature && !seen.has(currentFeature)) {
    options.unshift(currentFeature);
  }

  return options;
}

export function defaultTreeFeature(nodes: TreeNode[], sampleRows: SampleDataRow[]): string {
  const options = collectFeatureOptions(nodes, sampleRows);
  return options[0] ?? 'feature';
}

/** Collect unique feature names used by decision nodes (first-seen order). */
export function collectTreeFeatures(nodes: TreeNode[]): string[] {
  const seen = new Set<string>();
  const features: string[] = [];

  for (const node of nodes) {
    if (node.type !== 'decision') continue;
    const feature = (node as DecisionNode).feature;
    if (seen.has(feature)) continue;
    seen.add(feature);
    features.push(feature);
  }

  return features;
}

export function randomUnitValue(): number {
  return Math.random();
}

export function randomFeatureInputs(features: string[]): Record<string, number> {
  return Object.fromEntries(features.map((feature) => [feature, randomUnitValue()]));
}

export function createRandomSampleRow(
  features: string[],
  id: number,
  expected = '',
): SampleDataRow {
  const row: SampleDataRow = { id, expected };
  for (const feature of features) {
    row[feature] = randomUnitValue();
  }
  return row;
}

export function sampleRowToFeatureInputs(row: SampleDataRow): Record<string, number> {
  const inputs: Record<string, number> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'id' || key === 'expected') continue;
    if (typeof value === 'number') {
      inputs[key] = value;
      continue;
    }
    const parsed = Number.parseFloat(String(value));
    if (!Number.isNaN(parsed)) inputs[key] = parsed;
  }
  return inputs;
}
