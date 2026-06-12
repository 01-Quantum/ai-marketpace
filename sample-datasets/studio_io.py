"""Shared helpers for Model Builder Studio compatible exports."""

from __future__ import annotations

import csv
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sklearn.tree import DecisionTreeClassifier, _tree

NODE_WIDTH = 220
HORIZONTAL_GAP = 260
VERTICAL_GAP = 146
TOP_START = 60


def round4(value: float) -> float:
    return round(float(value), 4)


def format_feature_value(value: float) -> str:
    return f"{value:g}"


def select_balanced_indices(labels: list[int], max_rows: int, seed: int) -> list[int]:
    import random

    positive = [index for index, label in enumerate(labels) if label == 1]
    negative = [index for index, label in enumerate(labels) if label == 0]
    positive_count = min(len(positive), max_rows // 2)
    negative_count = min(len(negative), max_rows - positive_count)

    rng = random.Random(seed)
    selected = rng.sample(positive, positive_count) + rng.sample(negative, negative_count)
    return sorted(selected)


def select_balanced_correct_indices(
    labels: list[int],
    predictions,
    max_rows: int,
    seed: int,
) -> list[int]:
    import random

    positive = [
        index
        for index, (label, prediction) in enumerate(zip(labels, predictions, strict=True))
        if label == 1 and prediction == 1
    ]
    negative = [
        index
        for index, (label, prediction) in enumerate(zip(labels, predictions, strict=True))
        if label == 0 and prediction == 0
    ]
    positive_count = min(len(positive), max_rows // 2)
    negative_count = min(len(negative), max_rows - positive_count)

    rng = random.Random(seed)
    selected = rng.sample(positive, positive_count) + rng.sample(negative, negative_count)
    return sorted(selected)


def normalize_features(values):
    from sklearn.preprocessing import MinMaxScaler

    scaler = MinMaxScaler(feature_range=(-1, 1))
    return scaler.fit_transform(values)


def build_normalized_sample_rows(
    normalized_features,
    feature_names: list[str],
    labels: list[int],
    positive_class: str,
    negative_class: str,
    max_rows: int,
    seed: int,
    predictions=None,
) -> list[dict[str, float | str]]:
    if predictions is None:
        indices = select_balanced_indices(labels, max_rows, seed)
    else:
        indices = select_balanced_correct_indices(labels, predictions, max_rows, seed)

    rows: list[dict[str, float | str]] = []

    for index in indices:
        row = {
            name: float(normalized_features[index][position])
            for position, name in enumerate(feature_names)
        }
        row["expected"] = positive_class if labels[index] == 1 else negative_class
        rows.append(row)

    return rows


def write_json(path: Path, document: dict) -> None:
    path.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, float | str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(fieldnames)
        for row in rows:
            writer.writerow(
                [format_feature_value(row[name]) for name in fieldnames[:-1]] + [row["expected"]]
            )


def to_sample_data_document(rows: list[dict[str, float | str]], feature_names: list[str]) -> dict:
    sample_rows: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        entry: dict[str, Any] = {"id": index, "expected": row["expected"]}
        for name in feature_names:
            entry[name] = row[name]
        sample_rows.append(entry)
    return {"rows": sample_rows}


def build_studio_export(
    name: str,
    model_type: str,
    model_json: dict,
    sample_rows: list[dict[str, float | str]],
    feature_names: list[str],
    version: str = "v1.0.0",
) -> dict:
    return {
        "name": name,
        "type": model_type,
        "version": version,
        "model_json": model_json,
        "sample_data": to_sample_data_document(sample_rows, feature_names),
        "exported_at": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }


def build_logistic_model(
    feature_names: list[str],
    intercept: float,
    weights: list[float],
    classes: list[str],
) -> dict:
    return {
        "intercept": round4(intercept),
        "features": [
            {"name": name, "weight": round4(weight), "inputValue": 0}
            for name, weight in zip(feature_names, weights)
        ],
        "classes": classes,
        "threshold": 0.5,
    }


def export_decision_tree(
    model: DecisionTreeClassifier,
    feature_names: list[str],
    class_names: list[str],
    label_prefix: str,
) -> dict:
    tree = model.tree_
    nodes: list[dict] = []
    next_id = 1

    def build(sklearn_index: int) -> int:
        nonlocal next_id
        node_id = next_id
        next_id += 1

        if tree.feature[sklearn_index] == _tree.TREE_UNDEFINED:
            values = tree.value[sklearn_index][0]
            class_index = int(values.argmax())
            nodes.append(
                {
                    "id": node_id,
                    "type": "leaf",
                    "label": f"{label_prefix} = {class_names[class_index]}",
                    "layout": {"top": 0, "left": 0, "width": NODE_WIDTH},
                }
            )
            return node_id

        feature = feature_names[tree.feature[sklearn_index]]
        threshold = float(tree.threshold[sklearn_index])
        left_id = build(tree.children_left[sklearn_index])
        right_id = build(tree.children_right[sklearn_index])
        nodes.append(
            {
                "id": node_id,
                "type": "decision",
                "feature": feature,
                "threshold": threshold,
                "leftBranchId": left_id,
                "rightBranchId": right_id,
                "layout": {"top": 0, "left": 0, "width": NODE_WIDTH},
            }
        )
        return node_id

    root_id = build(0)
    assign_layouts(nodes, root_id)
    return {"nodes": nodes}


def assign_layouts(nodes: list[dict], root_id: int) -> None:
    by_id = {node["id"]: node for node in nodes}

    def subtree_width(node_id: int) -> int:
        node = by_id[node_id]
        if node["type"] == "leaf":
            return 1
        return subtree_width(node["leftBranchId"]) + subtree_width(node["rightBranchId"])

    def place(node_id: int, depth: int, slot: int) -> int:
        node = by_id[node_id]
        top = TOP_START + depth * VERTICAL_GAP

        if node["type"] == "leaf":
            node["layout"] = {"top": top, "left": slot * HORIZONTAL_GAP, "width": NODE_WIDTH}
            return slot + 1

        left_width = subtree_width(node["leftBranchId"])
        next_slot = place(node["leftBranchId"], depth + 1, slot)
        next_slot = place(node["rightBranchId"], depth + 1, slot + left_width)

        left_child = by_id[node["leftBranchId"]]
        right_child = by_id[node["rightBranchId"]]
        center = (left_child["layout"]["left"] + right_child["layout"]["left"]) / 2
        node["layout"] = {"top": top, "left": int(center), "width": NODE_WIDTH}
        return next_slot

    place(root_id, 0, 0)
