# Sample datasets

Generate Model Builder Studio compatible exports for Iris and credit card fraud.

Each generator writes **two JSON files** and **two CSV files** (10 rows by default). All feature values are normalized to **[-1, 1]** for both model training and test data.

| JSON (import in studio) | CSV (optional re-import of test rows) |
|-------------------------|---------------------------------------|
| `*-logistic-regression.json` | `*-logistic-regression-sample-data.csv` |
| `*-decision-tree.json` | `*-decision-tree-sample-data.csv` |

JSON files are ready to import. They include `name`, `type`, `model_json`, and `sample_data`.

## Setup

```bash
cd sample-datasets
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Iris

```bash
python generate_iris.py
```

Outputs:

- `iris-logistic-regression.json` — virginica vs other
- `iris-logistic-regression-sample-data.csv`
- `iris-decision-tree.json` — virginica vs other
- `iris-decision-tree-sample-data.csv`

## Credit card fraud

Download the [Kaggle dataset](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) once:

```bash
python generate_creditcard.py --download
```

Then generate files:

```bash
python generate_creditcard.py
```

Outputs:

- `creditcard-logistic-regression.json` — fraud vs legitimate
- `creditcard-logistic-regression-sample-data.csv`
- `creditcard-decision-tree.json` — fraud vs legitimate
- `creditcard-decision-tree-sample-data.csv`

## Import in Model Builder Studio

1. Open **Model Builder Studio**.
2. Import the `.json` file from the library panel.
3. Run the batch test in the sidebar to verify predictions.

The bundled `sample_data` is loaded automatically. You can also import the matching CSV separately if needed.

## Options

```bash
python generate_iris.py --max-rows 10
python generate_creditcard.py --max-rows 10 --output-dir ./out
```
