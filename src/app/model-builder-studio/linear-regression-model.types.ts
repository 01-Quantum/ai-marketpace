export interface LinearFeature {
  name: string;
  weight: number;
}

export interface LinearRegressionModel {
  intercept: number;
  features: LinearFeature[];
  target: string;
  rSquared: number;
}

export interface LinearPrediction {
  value: number;
  contributions: { name: string; weight: number; input: number; contribution: number }[];
}

export type LinearFeatureFilter = 'all' | 'top' | 'positive' | 'negative';
