#!/usr/bin/env python3
"""Generate credit card fraud logistic and decision-tree exports for Model Builder Studio."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
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

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_PATH = SCRIPT_DIR / "data" / "creditcard.csv"
KAGGLE_DATASET = "mlg-ulb/creditcardfraud"
POSITIVE_CLASS = "fraud"
NEGATIVE_CLASS = "legitimate"


def resolve_data_path(data_path: Path, download: bool) -> Path:
    if download:
        import kagglehub

        cache_path = Path(kagglehub.dataset_download(KAGGLE_DATASET))
        source = cache_path / "creditcard.csv"
        if not source.is_file():
            raise FileNotFoundError(f"Expected creditcard.csv in Kaggle download: {cache_path}")
        data_path.parent.mkdir(parents=True, exist_ok=True)
        data_path.write_bytes(source.read_bytes())
        return data_path

    if data_path.is_file():
        return data_path

    try:
        import kagglehub

        cached = Path(kagglehub.dataset_download(KAGGLE_DATASET)) / "creditcard.csv"
        if cached.is_file():
            return cached
    except Exception:
        pass

    raise FileNotFoundError(
        f"Credit card dataset not found at {data_path}. Run with --download or place creditcard.csv there."
    )


def load_dataset(data_path: Path) -> tuple[pd.DataFrame, list[str]]:
    dataframe = pd.read_csv(data_path)
    if "Class" not in dataframe.columns:
        raise ValueError("Expected a Class column in creditcard.csv")
    feature_names = [column for column in dataframe.columns if column != "Class"]
    return dataframe, feature_names


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate credit card studio-compatible model exports.")
    parser.add_argument("--output-dir", type=Path, default=SCRIPT_DIR)
    parser.add_argument("--data-path", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--max-rows", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    data_path = resolve_data_path(args.data_path, args.download)
    dataframe, feature_names = load_dataset(data_path)
    labels = dataframe["Class"].astype(int)
    label_list = labels.tolist()
    normalized_features = normalize_features(dataframe[feature_names].to_numpy())

    logistic_model = LogisticRegression(max_iter=1000).fit(normalized_features, labels)
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
        "class",
    )

    logistic_json_path = args.output_dir / "creditcard-logistic-regression.json"
    logistic_csv_path = args.output_dir / "creditcard-logistic-regression-sample-data.csv"
    tree_json_path = args.output_dir / "creditcard-decision-tree.json"
    tree_csv_path = args.output_dir / "creditcard-decision-tree-sample-data.csv"
    fieldnames = [*feature_names, "expected"]

    write_json(
        logistic_json_path,
        build_studio_export(
            "Credit Card Logistic Regression",
            "logistic",
            logistic_model_json,
            sample_rows,
            feature_names,
        ),
    )
    write_json(
        tree_json_path,
        build_studio_export(
            "Credit Card Decision Tree",
            "tree",
            tree_model_json,
            sample_rows,
            feature_names,
        ),
    )
    write_csv(logistic_csv_path, fieldnames, sample_rows)
    write_csv(tree_csv_path, fieldnames, sample_rows)

    print(f"Using dataset: {data_path}")
    print(f"Wrote {logistic_json_path}")
    print(f"Wrote {logistic_csv_path} ({len(sample_rows)} rows, features in [-1, 1])")
    print(f"Wrote {tree_json_path}")
    print(f"Wrote {tree_csv_path} ({len(sample_rows)} rows, features in [-1, 1])")


if __name__ == "__main__":
    main()
