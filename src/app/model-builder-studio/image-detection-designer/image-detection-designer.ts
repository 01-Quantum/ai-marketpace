import { Component } from '@angular/core';
import { Box, Database, Image, Lock, LucideAngularModule, ShieldCheck } from 'lucide-angular';
import { CIFAR10_CLASSES, IMAGE_DETECTION_MODEL_NAME } from '../../image-detection/image-detection.mock';

@Component({
  selector: 'app-image-detection-designer',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './image-detection-designer.html',
  styleUrl: './image-detection-designer.css',
})
export class ImageDetectionDesigner {
  readonly modelName = IMAGE_DETECTION_MODEL_NAME;
  readonly classes = CIFAR10_CLASSES;
  readonly ImageIcon = Image;
  readonly BoxIcon = Box;
  readonly DatabaseIcon = Database;
  readonly LockIcon = Lock;
  readonly ShieldIcon = ShieldCheck;
}
