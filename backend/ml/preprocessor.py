"""
preprocessor.py
===============
Encodes categorical features and scales numeric features.
Saves encoder mappings + arrival median for use by Flask API at prediction time.

Feature vector (8 elements, matching FEATURE_NAMES in shap_explainer.py):
  [crop_enc, category_enc, season_enc, year_int,
   arrival_volume_scaled, diesel_price_scaled, msp_scaled, low_supply_flag]

Target: market_price (₹/quintal) — predicted directly by the model.
Margin = (predicted_market_price - MSP) / MSP × 100  [derived, not predicted]
"""

import os
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, MinMaxScaler

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ── Feature columns — order MUST match FEATURE_NAMES in shap_explainer.py ─────
FEATURE_COLS = [
    "crop_enc",               # Label-encoded crop name
    "category_enc",           # Label-encoded crop category
    "season_enc",             # Label-encoded season
    "year_int",               # Year as integer (2021–2025) — captures inflation trend
    "arrival_volume_scaled",  # MinMax-scaled arrival volume
    "diesel_price_scaled",    # MinMax-scaled diesel price (logistics cost proxy)
    "msp_scaled",             # MinMax-scaled Minimum Support Price
    "low_supply_flag",      # 1 if arrival < median (low supply → high margin)
]

TARGET_COL = "market_price"  # Predict raw price; derive margin in post-processing


def build_features(df: pd.DataFrame):
    """
    Encode and scale raw DataFrame with rigorous train-test splitting (IEEE standard).

    Returns:
        X_train, X_test, y_train, y_test,  — train/test arrays (80/20 split)
        X, y,                               — full dataset arrays
        encoders_dict,                      — fitted LabelEncoder objects
        scaler,                             — fitted MinMaxScaler
        df_encoded                          — DataFrame with all encoded columns
    """
    from sklearn.model_selection import train_test_split
    df = df.copy()

    # ── Label Encoding ──────────────────────────────────────────────────────────
    crop_enc     = LabelEncoder()
    category_enc = LabelEncoder()
    season_enc   = LabelEncoder()

    df["crop_enc"]     = crop_enc.fit_transform(df["crop"])
    df["category_enc"] = category_enc.fit_transform(df["category"])
    df["season_enc"]   = season_enc.fit_transform(df["season"])

    # ── Supply Shock Feature ────────────────────────────────────────────────────
    # Low arrival volume (below training median) → supply shock → higher broker leverage
    arrival_median = float(df["arrival_volume"].median())
    df["low_supply_flag"] = (df["arrival_volume"] < arrival_median).astype(int)

    # ── Train-Test Split BEFORE scaling (IEEE data-leakage prevention) ─────────
    train_idx, test_idx = train_test_split(df.index, test_size=0.20, random_state=42)

    # ── Min-Max Scaling — FIT ONLY ON TRAIN SET ────────────────────────────────
    scaler = MinMaxScaler()
    scaler.fit(df.loc[train_idx, ["arrival_volume", "diesel_price", "msp"]])

    df[["arrival_volume_scaled", "diesel_price_scaled", "msp_scaled"]] = scaler.transform(
        df[["arrival_volume", "diesel_price", "msp"]]
    )

    X_train = df.loc[train_idx, FEATURE_COLS].values
    X_test  = df.loc[test_idx,  FEATURE_COLS].values
    y_train = df.loc[train_idx, TARGET_COL].values
    y_test  = df.loc[test_idx,  TARGET_COL].values

    X = df[FEATURE_COLS].values
    y = df[TARGET_COL].values

    encoders = {
        "crop":     crop_enc,
        "category": category_enc,
        "season":   season_enc,
    }

    # ── Persist all mappings needed for inference ──────────────────────────────
    encoder_maps = {
        "crop":              {cls: int(i) for i, cls in enumerate(crop_enc.classes_)},
        "category":          {cls: int(i) for i, cls in enumerate(category_enc.classes_)},
        "season":            {cls: int(i) for i, cls in enumerate(season_enc.classes_)},
        "crop_classes":      list(crop_enc.classes_),
        "category_classes":  list(category_enc.classes_),
        "season_classes":    list(season_enc.classes_),
        "scaler_min":        list(scaler.data_min_),
        "scaler_max":        list(scaler.data_max_),
        "feature_cols":      FEATURE_COLS,
        # ── NEW: median threshold needed to reproduce low_supply_flag at inference
        "arrival_median":    arrival_median,
    }

    maps_path = os.path.join(MODELS_DIR, "encoder_maps.json")
    with open(maps_path, "w") as f:
        json.dump(encoder_maps, f, indent=2)

    scaler_path = os.path.join(MODELS_DIR, "scaler.pkl")
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)

    print(f"  [OK] Encoder maps saved -> {maps_path}")
    print(f"  [OK] Scaler saved       -> {scaler_path}")
    print(f"  Arrival median (supply shock threshold): {arrival_median:.0f} quintals")
    print(f"  Feature matrix shape: {X.shape}  (Train: {len(X_train)}, Test: {len(X_test)})")
    print(f"  Target range: Rs.{y.min():.0f} to Rs.{y.max():.0f} per quintal")

    return X_train, X_test, y_train, y_test, X, y, encoders, scaler, df


def encode_single(crop, category, season, year_int, arrival_volume, diesel_price, msp):
    """
    Encode a single prediction request using saved encoder maps + scaler.
    Returns numpy array of shape (1, 8) ready for model.predict().

    Args:
        crop, category, season — string labels
        year_int               — integer year (e.g. 2024)
        arrival_volume         — float, quintals
        diesel_price           — float, ₹/litre
        msp                    — float, ₹/quintal
    """
    maps_path   = os.path.join(MODELS_DIR, "encoder_maps.json")
    scaler_path = os.path.join(MODELS_DIR, "scaler.pkl")

    with open(maps_path) as f:
        em = json.load(f)
    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)

    crop_enc_val     = em["crop"].get(crop, 0)
    category_enc_val = em["category"].get(category, 0)
    season_enc_val   = em["season"].get(season, 0)

    # Scale the 3 numeric features (same order as training)
    numeric = np.array([[arrival_volume, diesel_price, msp]])
    scaled  = scaler.transform(numeric)

    # Reproduce supply shock flag using stored training median
    arrival_median    = em.get("arrival_median", 5000.0)
    low_supply_flag = 1 if arrival_volume < arrival_median else 0

    return np.array([[
        crop_enc_val,
        category_enc_val,
        season_enc_val,
        year_int,
        scaled[0][0],   # arrival_volume_scaled
        scaled[0][1],   # diesel_price_scaled
        scaled[0][2],   # msp_scaled
        low_supply_flag,
    ]])