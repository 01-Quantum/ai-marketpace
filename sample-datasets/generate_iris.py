#!/usr/bin/env python3
"""Generate Iris logistic and decision-tree exports for Model Builder Studio."""

from __future__ import annotations

import argparse
from pathlib import Path

from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier

from studio_io import (
    build_logistic_model,
    build_normalized_sample_rows,
    build_studio_export,
    export_decision_tree,
    normalize_features,
    write_csv,
    write_json,
)

FEATURE_NAMES = ("sepal_length", "sepal_width", "petal_length", "petal_width")
POSITIVE_CLASS = "virginica"
NEGATIVE_CLASS = "other"
POSITIVE_INDEX = 2


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Iris studio-compatible model exports.")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--max-rows", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    iris = load_iris()
    labels = (iris.target == POSITIVE_INDEX).astype(int)
    label_list = labels.tolist()
    feature_names = list(FEATURE_NAMES)
    normalized_features = normalize_features(iris.data)

    logistic_model = LogisticRegression().fit(normalized_features, labels)
    tree_model = DecisionTreeClassifier(max_depth=4, random_state=42).fit(normalized_features, labels)

    sample_rows = build_normalized_sample_rows(
        normalized_features,
        feature_names,
        label_list,
        POSITIVE_CLASS,
        NEGATIVE_CLASS,
        args.max_rows,
        args.seed,
    )

    logistic_model_json = build_logistic_model(
        feature_names,
        float(logistic_model.intercept_[0]),
        [float(weight) for weight in logistic_model.coef_[0]],
        [POSITIVE_CLASS, NEGATIVE_CLASS],
    )
    tree_model_json = export_decision_tree(
        tree_model,
        feature_names,
        [NEGATIVE_CLASS, POSITIVE_CLASS],
        "species",
    )

    logistic_json_path = args.output_dir / "iris-logistic-regression.json"
    logistic_csv_path = args.output_dir / "iris-logistic-regression-sample-data.csv"
    tree_json_path = args.output_dir / "iris-decision-tree.json"
    tree_csv_path = args.output_dir / "iris-decision-tree-sample-data.csv"
    fieldnames = [*feature_names, "expected"]

    write_json(
        logistic_json_path,
        build_studio_export(
            "Iris Logistic Regression",
            "logistic",
            logistic_model_json,
            sample_rows,
            feature_names,
        ),
    )
    write_json(
        tree_json_path,
        build_studio_export(
            "Iris Decision Tree",
            "tree",
            tree_model_json,
            sample_rows,
            feature_names,
        ),
    )
    write_csv(logistic_csv_path, fieldnames, sample_rows)
    write_csv(tree_csv_path, fieldnames, sample_rows)

    print(f"Wrote {logistic_json_path}")
    print(f"Wrote {logistic_csv_path} ({len(sample_rows)} rows, features in [-1, 1])")
    print(f"Wrote {tree_json_path}")
    print(f"Wrote {tree_csv_path} ({len(sample_rows)} rows, features in [-1, 1])")


if __name__ == "__main__":
    main()
