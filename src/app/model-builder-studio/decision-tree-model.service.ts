import { Injectable } from '@angular/core';
import { of, shareReplay } from 'rxjs';
import { DecisionTreeModel } from './decision-tree-model.types';
import { LibraryModel } from './model-builder.types';

const IRIS_DECISION_TREE_MODEL: DecisionTreeModel = {
  features: [
    'sepal length (cm)',
    'sepal width (cm)',
    'petal length (cm)',
    'petal width (cm)',
  ],
  classes: ['setosa', 'versicolor', 'virginica'],
  tree: {
    type: 'split',
    feature_index: 2,
    threshold: 2.449999988079071,
    left: {
      type: 'leaf',
      class_index: 0,
    },
    right: {
      type: 'split',
      feature_index: 3,
      threshold: 1.6500000357627869,
      left: {
        type: 'split',
        feature_index: 2,
        threshold: 4.950000047683716,
        left: {
          type: 'leaf',
          class_index: 1,
        },
        right: {
          type: 'leaf',
          class_index: 2,
        },
      },
      right: {
        type: 'split',
        feature_index: 2,
        threshold: 4.8500001430511475,
        left: {
          type: 'leaf',
          class_index: 2,
        },
        right: {
          type: 'leaf',
          class_index: 2,
        },
      },
    },
  },
};

@Injectable({ providedIn: 'root' })
export class DecisionTreeModelService {
  readonly model$ = of(IRIS_DECISION_TREE_MODEL).pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  getModel(): DecisionTreeModel {
    return IRIS_DECISION_TREE_MODEL;
  }

  getLibraryEntry(): LibraryModel {
    return {
      id: 'iris-dt',
      name: 'Iris Decision Tree',
      version: 'v1.2.0',
      updated: 'Updated 2d ago',
      iconKind: 'tree',
      type: 'tree',
    };
  }
}
