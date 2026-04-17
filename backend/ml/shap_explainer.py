"""
shap_explainer.py
=================
Computes SHAP-equivalent explainability using sklearn's
permutation importance + manual partial dependence analysis.

Produces:
  - feature_importance.json   → bar chart data
  - shap_summary.json         → beeswarm-equivalent dot plot data
  - heatmap_data.json         → crop × season price-deviation matrix
  - crop_analysis.json        → per-crop breakdown
  - season_analysis.json      → per-season breakdown
  - year_trend.json           → year × category trend series
  - kpis.json                 → overview headline numbers

(If xgboost + shap are installed, swap in TreeExplainer for true SHAP values.)
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance

MODELS_DIR    = os.path.join(os.path.dirname(__file__), "..", "models")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")

# ── CRITICAL: must match preprocessor.py FEATURE_COLS order exactly ───────────
# FEATURE_COLS = [
#   "crop_enc", "category_enc", "season_enc", "year_int",
#   "arrival_volume_scaled", "diesel_price_scaled", "msp_scaled", "low_supply_flag"
# ]
FEATURE_NAMES = [
    "Crop name",        # crop_enc
    "Crop category",    # category_enc
    "Season",           # season_enc
    "Year trend",       # year_int
    "Arrival volume",   # arrival_volume_scaled
    "Diesel price",     # diesel_price_scaled
    "MSP",              # msp_scaled
    "Low supply",     # low_supply_flag
]


def compute_explanations(model, X: np.ndarray, y: np.ndarray, df: pd.DataFrame):
    """
    Compute all explainability outputs and save to JSON files.
    """
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    # ── 1. Permutation Feature Importance ─────────────────────────────────────
    print("  Computing permutation importance (30 repeats)...")
    perm = permutation_importance(model, X, y, n_repeats=30, random_state=42, n_jobs=-1)

    fi_data = []
    for i, name in enumerate(FEATURE_NAMES):
        fi_data.append({
            "feature":    name,
            "importance": round(float(perm.importances_mean[i]), 4),
            "std":        round(float(perm.importances_std[i]),  4),
        })
    fi_data.sort(key=lambda x: x["importance"], reverse=True)

    with open(os.path.join(MODELS_DIR, "feature_importance.json"), "w") as f:
        json.dump(fi_data, f, indent=2)
    print("  [OK] feature_importance.json saved")

    # ── 2. SHAP-equivalent summary data (beeswarm) ────────────────────────────
    print("  Computing beeswarm summary data...")
    predictions = model.predict(X)
    summary_data = []

    for i, name in enumerate(FEATURE_NAMES):
        feat_vals = X[:, i]
        fmin, fmax = feat_vals.min(), feat_vals.max()
        norm_vals = (feat_vals - fmin) / (fmax - fmin + 1e-9)
        # Approximate contribution: prediction delta when feature is fixed at mean
        X_perm = X.copy()
        X_perm[:, i] = feat_vals.mean()
        base_pred = model.predict(X_perm)
        contrib   = predictions - base_pred

        n   = min(len(contrib), 80)
        idx = np.random.choice(len(contrib), n, replace=False)
        summary_data.append({
            "feature":    name,
            "importance": round(float(perm.importances_mean[i]), 4),
            "points": [
                {
                    "shap_value":  round(float(contrib[j]), 2),
                    "feature_val": round(float(norm_vals[j]), 3),
                }
                for j in idx
            ],
        })

    summary_data.sort(key=lambda x: x["importance"], reverse=True)
    with open(os.path.join(MODELS_DIR, "shap_summary.json"), "w") as f:
        json.dump(summary_data, f, indent=2)
    print("  [OK] shap_summary.json saved")

    # ── 3. Crop × Season Heatmap (price-deviation from MSP) ──────────────────
    print("  Computing crop × season price-deviation heatmap...")
    pivot = df.groupby(["crop", "season"])["broker_margin_pct"].mean().reset_index()
    pivot_wide = pivot.pivot(index="crop", columns="season", values="broker_margin_pct")
    pivot_wide = pivot_wide.fillna(0).round(2)

    heatmap = {
        "crops":   list(pivot_wide.index),
        "seasons": list(pivot_wide.columns),
        "values":  pivot_wide.values.tolist(),
    }
    with open(os.path.join(MODELS_DIR, "heatmap_data.json"), "w") as f:
        json.dump(heatmap, f, indent=2)
    print("  [OK] heatmap_data.json saved")

    # ── 4. Crop-level analysis ────────────────────────────────────────────────
    crop_stats = df.groupby(["crop", "category"]).agg(
        avg_margin   =("broker_margin_pct", "mean"),
        max_margin   =("broker_margin_pct", "max"),
        min_margin   =("broker_margin_pct", "min"),
        records      =("broker_margin_pct", "count"),
        avg_arrival  =("arrival_volume", "mean"),
        avg_price    =("market_price", "mean"),
        avg_msp      =("msp", "mean"),
    ).reset_index().round(2)

    crop_list = crop_stats.to_dict(orient="records")
    crop_list.sort(key=lambda x: x["avg_margin"], reverse=True)
    with open(os.path.join(MODELS_DIR, "crop_analysis.json"), "w") as f:
        json.dump(crop_list, f, indent=2)
    print("  [OK] crop_analysis.json saved")

    # ── 5. Season-level analysis ──────────────────────────────────────────────
    season_stats = df.groupby(["season", "category"]).agg(
        avg_margin=("broker_margin_pct", "mean"),
        avg_price =("market_price", "mean"),
        avg_msp   =("msp", "mean"),
        records   =("broker_margin_pct", "count"),
    ).reset_index().round(2)

    with open(os.path.join(MODELS_DIR, "season_analysis.json"), "w") as f:
        json.dump(season_stats.to_dict(orient="records"), f, indent=2)
    print("  [OK] season_analysis.json saved")

    # ── 6. Year trend ─────────────────────────────────────────────────────────
    year_trend = df.groupby(["year", "category"]).agg(
        avg_margin=("broker_margin_pct", "mean"),
        avg_msp   =("msp", "mean"),
        avg_price =("market_price", "mean"),
    ).reset_index().round(2)

    with open(os.path.join(MODELS_DIR, "year_trend.json"), "w") as f:
        json.dump(year_trend.to_dict(orient="records"), f, indent=2)
    print("  [OK] year_trend.json saved")

    # ── 7. Overview KPIs ──────────────────────────────────────────────────────
    above_msp = (df["broker_margin_pct"] > 0).sum()
    kpis = {
        "total_records":         int(len(df)),
        "total_crops":           int(df["crop"].nunique()),
        "years_covered":         sorted(df["year"].unique().tolist()),
        "avg_price_deviation":   round(float(df["broker_margin_pct"].mean()), 2),
        "max_price_deviation":   round(float(df["broker_margin_pct"].max()), 2),
        "min_price_deviation":   round(float(df["broker_margin_pct"].min()), 2),
        "pct_above_msp":         round(float(above_msp / len(df) * 100), 1),
        "highest_margin_crop":   str(df.loc[df["broker_margin_pct"].idxmax(), "crop"]),
        "lowest_margin_crop":    str(df.loc[df["broker_margin_pct"].idxmin(), "crop"]),
        "top_driver_1":          fi_data[0]["feature"] if fi_data else "",
        "top_driver_2":          fi_data[1]["feature"] if len(fi_data) > 1 else "",
        # Legacy aliases for frontend compatibility
        "avg_broker_margin":     round(float(df["broker_margin_pct"].mean()), 2),
        "max_broker_margin":     round(float(df["broker_margin_pct"].max()), 2),
        "min_broker_margin":     round(float(df["broker_margin_pct"].min()), 2),
    }
    with open(os.path.join(MODELS_DIR, "kpis.json"), "w") as f:
        json.dump(kpis, f, indent=2)
    print("  [OK] kpis.json saved")

    return fi_data, summary_data, heatmap