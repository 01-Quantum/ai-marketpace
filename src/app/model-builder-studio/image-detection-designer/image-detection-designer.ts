import { Component, input } from '@angular/core';
import { Box, Database, Image, Lock, LucideAngularModule, ShieldCheck } from 'lucide-angular';
import { CIFAR10_CLASSES, IMAGE_DETECTION_GPU_MODEL_NAME } from '../../image-detection/image-detection.mock';

@Component({
  selector: 'app-image-detection-designer',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './image-detection-designer.html',
  styleUrl: './image-detection-designer.css',
})
export class ImageDetectionDesigner {
  readonly modelName = input(IMAGE_DETECTION_GPU_MODEL_NAME);
  readonly mocked = input(false);
  readonly classes = CIFAR10_CLASSES;
  readonly ImageIcon = Image;
  readonly BoxIcon = Box;
  readonly DatabaseIcon = Database;
  readonly LockIcon = Lock;
  readonly ShieldIcon = ShieldCheck;
}
