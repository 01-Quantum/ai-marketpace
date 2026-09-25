export const CIFAR10_CLASSES = [
  'airplane',
  'automobile',
  'bird',
  'cat',
  'deer',
  'dog',
  'frog',
  'horse',
  'ship',
  'truck',
] as const;

export const IMAGE_DETECTION_MODEL_ID = 91000;
export const IMAGE_DETECTION_MODEL_NAME = 'CIFAR-10 Image Detection (ResNet-20) -mocked';
export const IMAGE_DETECTION_MOCK_LIBRARY_ID = 'mock-image-resnet20';

/** Live ResNet-20 served by the GPU FHE image API. */
export const IMAGE_DETECTION_GPU_MODEL_ID = 92000;
export const IMAGE_DETECTION_GPU_MODEL_NAME = 'CIFAR-10 Image Detection (ResNet-20)';
export const IMAGE_DETECTION_GPU_LIBRARY_ID = 'gpu-image-resnet20';

/** CIFAR-10 ResNet-20 parameter count. */
export const IMAGE_DETECTION_PARAMS_COUNT = 270_000;

export interface ImageClassScore {
  id: number;
  name: string;
  score: number;
}

export interface ImageDetectionPrediction {
  classId: number;
  className: string;
  logits: ImageClassScore[];
}

/** Fixed mock scores so the decrypt screen matches the design (cat wins). */
export const MOCK_CAT_PREDICTION: ImageDetectionPrediction = {
  classId: 3,
  className: 'cat',
  logits: [
    { id: 3, name: 'cat', score: 0.892 },
    { id: 5, name: 'dog', score: 0.071 },
    { id: 8, name: 'horse', score: 0.012 },
    { id: 6, name: 'frog', score: 0.008 },
    { id: 1, name: 'automobile', score: 0.006 },
    { id: 7, name: 'ship', score: 0.004 },
    { id: 0, name: 'airplane', score: 0.003 },
    { id: 9, name: 'truck', score: 0.002 },
    { id: 4, name: 'deer', score: 0.001 },
    { id: 2, name: 'bird', score: 0.001 },
  ],
};

export function mockPredictionForFile(fileName: string): ImageDetectionPrediction {
  const stem = fileName.replace(/\.[^.]+$/, '').toLowerCase();
  const match = CIFAR10_CLASSES.find((name) => stem.includes(name));
  if (!match || match === 'cat') return MOCK_CAT_PREDICTION;

  const classId = CIFAR10_CLASSES.indexOf(match);
  const logits = CIFAR10_CLASSES.map((name, id) => ({
    id,
    name,
    score: id === classId ? 0.86 : Number((0.14 / 9).toFixed(3)),
  })).sort((a, b) => b.score - a.score);

  return { classId, className: match, logits };
}
