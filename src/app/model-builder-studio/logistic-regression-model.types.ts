export interface LogisticFeature {
  name: string;
  weight: number;
  inputValue: number;
}

export interface LogisticFeatureView extends LogisticFeature {
  contribution: number;
}

export interface LogisticRegressionModel {
  intercept: number;
  features: LogisticFeature[];
  classes: string[];
  threshold: number;
}

export interface LogisticPrediction {
  linearScore: number;
  probability: number;
  className: string;
  classIndex: number;
}

export type FeatureFilter = import('./coefficient-regression.types').CoefficientFeatureFilter;
