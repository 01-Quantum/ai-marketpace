export type WorkflowRole = 'data' | 'model';
export type WorkflowStep = 1 | 2 | 3 | 4;

/** Model type chosen on the landing page for encrypted inference. */
export type InferenceModelChoice = 'tree' | 'logistic';

export const INFERENCE_MODEL_LABELS: Record<InferenceModelChoice, string> = {
  tree: 'Decision Tree',
  logistic: 'Logistic Regression',
};

export function parseInferenceModelChoice(value: string | null | undefined): InferenceModelChoice {
  return value === 'logistic' ? 'logistic' : 'tree';
}
