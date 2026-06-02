export interface CoefficientFeature {
  name: string;
  weight: number;
}

export type CoefficientFeatureFilter = 'all' | 'top' | 'positive' | 'negative';

export interface CoefficientDesignerConfig {
  outputVar: string;
  outputDescription: string;
  /** Appended after feature count, e.g. "+" for "30+ features". */
  featureBadgeSuffix?: string;
  footnote: string;
  exportFileName: string;
}
