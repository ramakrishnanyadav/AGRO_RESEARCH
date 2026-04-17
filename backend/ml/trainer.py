"""
trainer.py
==========
IEEE-Grade Multi-Model Training Pipeline.
  Model A: XGBoost  → predicts Market Price directly
  Model B: RandomForest (comparison baseline 1)
  Model C: Linear Regression (comparison baseline 2)

Saves:
  gb_model.pkl         ← XGBoost (primary production model)
  metrics.json         ← XGBoost metrics + 3-model comparison table
  predictions.csv      ← Full dataset with predictions & residuals
"""

import os
import pickle
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


def _evaluate(model, X_train, X_test, y_train, y_test, name):
    """Train a model and return its evaluation metrics dict."""
    model.fit(X_train, y_train)
    y_train_pred = model.predict(X_train)
    y_test_pred  = model.predict(X_test)

    r2_tr  = r2_score(y_train, y_train_pred)
    r2_te  = r2_score(y_test,  y_test_pred)
    mae_te = mean_absolute_error(y_test, y_test_pred)
    rmse   = float(np.sqrt(mean_squared_error(y_test, y_test_pred)))

    cv = cross_val_score(model, X_train, y_train, cv=5, scoring="r2")

    print(f"  [{name}] R2={r2_te:.4f}  MAE=Rs.{mae_te:.0f}  CV={cv.mean():.4f}+/-{cv.std():.4f}")
    return {
        "name": name,
        "r2_train": round(r2_tr, 4),
        "r2_test":  round(r2_te, 4),
        "mae_test": round(mae_te, 2),
        "rmse":     round(rmse, 2),
        "cv_r2":    round(float(cv.mean()), 4),
        "cv_std":   round(float(cv.std()),  4),
    }, model.predict(X_test)


def train_model(X_train, X_test, y_train, y_test, X_full, y_full, df_full):
    """
    Run 3-model comparison. Save best model (XGBoost) as production model.
    Returns (xgb_model, metrics_dict)
    """
    # ── Model A: XGBoost (primary model) ──────────────────────────────────────
    xgb_model = xgb.XGBRegressor(
        n_estimators=1000, learning_rate=0.05, max_depth=8,
        min_child_weight=3, subsample=0.8, colsample_bytree=0.8,
        random_state=42, n_jobs=-1
    )

    # ── Model B: Random Forest (comparison baseline 1) ─────────────────────
    rf_model = RandomForestRegressor(
        n_estimators=500, max_depth=10, random_state=42, n_jobs=-1
    )

    # ── Model C: Linear Regression (comparison baseline 2) ─────────────────
    lr_model = LinearRegression()

    print("  Training 3-model comparison pipeline...")
    xgb_metrics, xgb_preds = _evaluate(xgb_model, X_train, X_test, y_train, y_test, "XGBoost")
    rf_metrics,  rf_preds  = _evaluate(rf_model,  X_train, X_test, y_train, y_test, "Random Forest")
    lr_metrics,  lr_preds  = _evaluate(lr_model,  X_train, X_test, y_train, y_test, "Linear Regression")

    model_comparison = [xgb_metrics, rf_metrics, lr_metrics]
    model_comparison.sort(key=lambda x: x["r2_test"], reverse=True)

    # ── Feature Importance (XGBoost built-in) ─────────────────────────────────
    feature_names = [
        "Crop name", "Crop category", "Season",
        "Year", "Arrival volume", "Diesel price", "MSP", "Supply shock"
    ]
    importances = xgb_model.feature_importances_

    # ── Save XGBoost as the primary production model ──────────────────────────
    model_path = os.path.join(MODELS_DIR, "gb_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(xgb_model, f)
    print(f"  [OK] XGBoost (primary) saved -> {model_path}")

    # ── Save metrics JSON ──────────────────────────────────────────────────────
    metrics = {
        # Primary model (XGBoost) KPIs
        "r2_train":      xgb_metrics["r2_train"],
        "r2_test":       xgb_metrics["r2_test"],
        "mae_train":     round(float(mean_absolute_error(y_train, xgb_model.predict(X_train))), 2),
        "mae_test":      xgb_metrics["mae_test"],
        "rmse_test":     xgb_metrics["rmse"],
        "cv_r2_mean":    xgb_metrics["cv_r2"],
        "cv_r2_std":     xgb_metrics["cv_std"],
        "train_samples": int(len(X_train)),
        "test_samples":  int(len(X_test)),
        "total_samples": int(len(X_full)),
        "target": "market_price",
        "model_params": {
            "algorithm":    "XGBoost Regressor (Direct Price Predictor)",
            "n_estimators": 1000,
            "learning_rate": 0.05,
            "max_depth":    8,
            "subsample":    0.8,
            "train_split":  "80%",
            "test_split":   "20%",
        },
        "feature_importance": {
            name: round(float(imp), 4)
            for name, imp in zip(feature_names, importances)
        },
        # 3-model comparison (IEEE Table II)
        "model_comparison": model_comparison,
    }

    metrics_path = os.path.join(MODELS_DIR, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  [OK] Metrics saved -> {metrics_path}")

    # ── Save predictions CSV ─────────────────────────────────────────────────
    df_full = df_full.copy()
    df_full["predicted_market_price"] = xgb_model.predict(X_full)
    df_full["predicted_margin"]  = ((df_full["predicted_market_price"] - df_full["msp"]) / df_full["msp"]) * 100
    df_full["residual"] = df_full["broker_margin_pct"] - df_full["predicted_margin"]

    pred_path = os.path.join(MODELS_DIR, "..", "data", "processed", "predictions.csv")
    os.makedirs(os.path.dirname(pred_path), exist_ok=True)
    df_full.to_csv(pred_path, index=False)
    print(f"  [OK] Predictions saved -> {pred_path}")

    return xgb_model, metrics


def load_model():
    """Load saved model from disk."""
    model_path = os.path.join(MODELS_DIR, "gb_model.pkl")
    with open(model_path, "rb") as f:
        return pickle.load(f)