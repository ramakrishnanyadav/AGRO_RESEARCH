"""
app.py
======
Flask REST API for the AGRO_RESEARCH Price Deviation from MSP system.
Serves pre-computed ML results and handles live predictions.

Architecture:
  Model A (XGBoost) → predicts Market Price directly (₹/quintal)
  Model B (derived) → Price Deviation = (predicted - MSP) / MSP × 100

Endpoints:
  GET  /api/overview       → KPIs + year trend data
  GET  /api/model          → R², MAE, feature importance + 3-model comparison
  POST /api/predict        → Live price + deviation prediction
  GET  /api/shap           → Beeswarm + feature importance data
  GET  /api/heatmap        → Crop × season deviation matrix
  GET  /api/download       → Full predictions CSV download
  GET  /api/crops          → All crop analysis records
  GET  /api/trends         → Year × category trend series
  GET  /api/explorer       → Full dataset (paginated, filterable)

Usage:
    cd backend
    python app.py
"""

import os
import json
import pickle
import csv
import io
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS
from functools import lru_cache

# ── Path constants ─────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(__file__)
MODELS_DIR    = os.path.join(BASE_DIR, "models")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")

app = Flask(__name__)
CORS(app)  # Allow React dev server on :3000


# ── Helper: safe JSON file reader ──────────────────────────────────────────────
@lru_cache(maxsize=None)
def _load_json(filename: str):
    """Load a JSON file from models directory; raise 503 if missing."""
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


@lru_cache(maxsize=None)
def _load_encoder_maps():
    """Load encoder maps JSON."""
    return _load_json("encoder_maps.json")


@lru_cache(maxsize=None)
def _load_model():
    """Load trained model from pickle."""
    path = os.path.join(MODELS_DIR, "gb_model.pkl")
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


@lru_cache(maxsize=None)
def _load_scaler():
    """Load MinMaxScaler from pickle."""
    path = os.path.join(MODELS_DIR, "scaler.pkl")
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


# ── Endpoint 1: Overview / Dashboard ──────────────────────────────────────────
@app.route("/api/overview", methods=["GET"])
def get_overview():
    """
    Returns:
      - kpis: headline numbers
      - year_trend: avg margin per year per category
      - category_breakdown: avg margin per crop category
    """
    kpis = _load_json("kpis.json")
    year_trend = _load_json("year_trend.json")

    if kpis is None or year_trend is None:
        return jsonify({"error": "Model not trained yet. Run backend/train.py first."}), 503

    # Build category breakdown from crop_analysis
    crop_analysis = _load_json("crop_analysis.json") or []
    category_map = {}
    for rec in crop_analysis:
        cat = rec.get("category", "Unknown")
        if cat not in category_map:
            category_map[cat] = []
        category_map[cat].append(rec.get("avg_margin", 0))

    category_breakdown = [
        {"category": cat, "avg_margin": round(sum(vals) / len(vals), 2)}
        for cat, vals in category_map.items()
    ]
    category_breakdown.sort(key=lambda x: x["avg_margin"], reverse=True)

    return jsonify({
        "kpis": kpis,
        "year_trend": year_trend,
        "category_breakdown": category_breakdown,
    })


# ── Endpoint 2: Model Performance ─────────────────────────────────────────────
@app.route("/api/model", methods=["GET"])
def get_model_metrics():
    """
    Returns:
      - metrics: XGBoost R², MAE (₹), RMSE, CV scores, model params
      - feature_importance: sorted list [{feature, importance, std}]
      - model_comparison: 3-model IEEE comparison table
      - predictions_sample: sample rows from predictions.csv for residual scatter
    """
    metrics = _load_json("metrics.json")

    if metrics is None:
        return jsonify({"error": "Model not trained yet. Run backend/train.py first."}), 503

    # Feature importance: load from dedicated file (sorted list format)
    # Falls back to converting the dict stored in metrics.json
    fi_list = _load_json("feature_importance.json")
    if fi_list is None:
        fi_dict = metrics.get("feature_importance", {})
        fi_list = sorted(
            [{"feature": k, "importance": v, "std": 0} for k, v in fi_dict.items()],
            key=lambda x: x["importance"], reverse=True
        )

    # 3-model comparison table
    model_comparison = metrics.get("model_comparison", [])

    # Load a sample of predictions for the residual scatter plot
    pred_path = os.path.join(PROCESSED_DIR, "predictions.csv")
    predictions_sample = []
    if os.path.exists(pred_path):
        df = pd.read_csv(pred_path)
        cols = ["crop", "season", "category", "year",
                "broker_margin_pct", "predicted_margin", "residual",
                "market_price", "predicted_market_price", "msp"]
        cols = [c for c in cols if c in df.columns]
        predictions_sample = df[cols].head(120).round(2).to_dict(orient="records")

    return jsonify({
        "metrics":           metrics,
        "feature_importance":fi_list,
        "model_comparison":  model_comparison,
        "predictions_sample":predictions_sample,
    })


# ── Endpoint 3: Live Prediction ────────────────────────────────────────────────
@app.route("/api/predict", methods=["POST"])
def predict():
    """
    IEEE Dual-Model Architecture:
      Model A (XGBoost) → predicts market_price directly (₹/quintal)
      Model B (derived) → price_deviation_pct = (predicted - MSP) / MSP × 100

    Request body (JSON):
      { crop, category, season, year, arrival_volume, diesel_price, msp }

    Returns:
      { predicted_market_price, predicted_margin, confidence_note, inputs_used }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body supplied."}), 400

    required = ["crop", "category", "season", "year", "arrival_volume", "diesel_price", "msp"]
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    em     = _load_encoder_maps()
    model  = _load_model()
    scaler = _load_scaler()

    if em is None or model is None or scaler is None:
        return jsonify({"error": "Model not trained yet. Run backend/train.py first."}), 503

    try:
        crop_enc_val     = em["crop"].get(data["crop"], 0)
        category_enc_val = em["category"].get(data["category"], 0)
        season_enc_val   = em["season"].get(data["season"], 0)
        year_int         = int(str(data["year"]).split("-")[0])
        arrival          = float(data["arrival_volume"])
        diesel           = float(data["diesel_price"])
        msp_val          = float(data["msp"])

        # Validate: NaN/Inf would crash jsonify (JSON does not support NaN)
        import math
        for field, val in [("arrival_volume", arrival), ("diesel_price", diesel), ("msp", msp_val)]:
            if math.isnan(val) or math.isinf(val):
                return jsonify({"error": f"Invalid value for '{field}': must be a finite number."}), 400

        # Scale the 3 numeric features (arrival, diesel, msp) — same order as training
        numeric = np.array([[arrival, diesel, msp_val]])
        scaled  = scaler.transform(numeric)

        # Reproduce low_supply_flag using stored training-set median
        arrival_median    = float(em.get("arrival_median", 5000.0))
        low_supply_flag = 1 if arrival < arrival_median else 0

        # Build 8-element feature vector — MUST match preprocessor FEATURE_COLS order
        X = np.array([[
            crop_enc_val,     # crop_enc
            category_enc_val, # category_enc
            season_enc_val,   # season_enc
            year_int,         # year_int
            scaled[0][0],     # arrival_volume_scaled
            scaled[0][1],     # diesel_price_scaled
            scaled[0][2],     # msp_scaled
            low_supply_flag,# low_supply_flag
        ]])

        # Model A: predict market price directly
        predicted_market_price = float(model.predict(X)[0])

        # Model B: derive price deviation from MSP (deterministic formula)
        predicted_margin = ((predicted_market_price - msp_val) / msp_val) * 100

        # Build human-readable explanation
        direction = "above" if predicted_margin > 0 else "below"
        magnitude = abs(round(predicted_margin, 2))
        note = (
            f"Predicted market price ₹{predicted_market_price:.0f}/quintal is "
            f"{magnitude:.1f}% {direction} the MSP of ₹{msp_val:.0f}/quintal. "
            f"{'Below-MSP trade — farmers may be underpaid.' if predicted_margin < 0 else 'Positive price deviation — market price exceeds MSP guarantee.'}"
        )

        return jsonify({
            "predicted_market_price": round(predicted_market_price, 2),
            "predicted_margin":       round(predicted_margin, 2),
            "confidence_note":        note,
            "low_supply_active":    bool(low_supply_flag),
            "inputs_used": {
                "crop":           data["crop"],
                "category":       data["category"],
                "season":         data["season"],
                "year":           data["year"],
                "arrival_volume": arrival,
                "diesel_price":   diesel,
                "msp":            msp_val,
            },
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Endpoint 4: SHAP Analysis ──────────────────────────────────────────────────
@app.route("/api/shap", methods=["GET"])
def get_shap():
    """
    Returns:
      - feature_importance: sorted list with importance + std
      - beeswarm: array of {feature, importance, points[{shap_value, feature_val}]}
      - top_drivers: top 2 features (key finding for paper)
    """
    fi = _load_json("feature_importance.json")
    beeswarm = _load_json("shap_summary.json")

    if fi is None:
        return jsonify({"error": "SHAP data not found. Run backend/train.py first."}), 503

    top_drivers = fi[:2] if len(fi) >= 2 else fi

    return jsonify({
        "feature_importance": fi,
        "beeswarm": beeswarm or [],
        "top_drivers": top_drivers,
    })


# ── Endpoint 5: Crop × Season Heatmap ─────────────────────────────────────────
@app.route("/api/heatmap", methods=["GET"])
def get_heatmap():
    """
    Returns:
      - heatmap: {crops, seasons, values}
      - crop_analysis: per-crop stats sorted by avg_margin
    """
    heatmap = _load_json("heatmap_data.json")
    crop_analysis = _load_json("crop_analysis.json")

    if heatmap is None:
        return jsonify({"error": "Heatmap data not found. Run backend/train.py first."}), 503

    # Key finding annotations
    flat = []
    if heatmap:
        crops = heatmap["crops"]
        seasons = heatmap["seasons"]
        values = heatmap["values"]
        for ci, crop in enumerate(crops):
            for si, season in enumerate(seasons):
                flat.append({
                    "crop": crop,
                    "season": season,
                    "margin": values[ci][si]
                })

    # Identify highest and lowest margins
    if flat:
        highest = max(flat, key=lambda x: x["margin"])
        lowest  = min(flat, key=lambda x: x["margin"])
    else:
        highest = lowest = {}

    return jsonify({
        "heatmap": heatmap,
        "crop_analysis": crop_analysis or [],
        "key_finding": {
            "highest": highest,
            "lowest": lowest,
        }
    })


# ── Endpoint 6: Download CSV ───────────────────────────────────────────────────
@app.route("/api/download", methods=["GET"])
def download_csv():
    """
    Returns full predictions.csv as file download.
    Query param: ?type=predictions|raw
    """
    file_type = request.args.get("type", "predictions")

    if file_type == "predictions":
        path = os.path.join(PROCESSED_DIR, "predictions.csv")
        filename = "broker_margin_predictions.csv"
    else:
        return jsonify({"error": "Unknown file type."}), 400

    if not os.path.exists(path):
        return jsonify({"error": "File not found. Run backend/train.py first."}), 503

    return send_file(
        path,
        mimetype="text/csv",
        as_attachment=True,
        download_name=filename
    )


# ── Endpoint 7: Crops List ─────────────────────────────────────────────────────
@app.route("/api/crops", methods=["GET"])
def get_crops():
    """
    Returns all available crop names, categories, and seasons
    for populating the Predict form dropdowns.
    """
    em = _load_encoder_maps()
    if em is None:
        # Fallback: return hardcoded crop list from data_loader
        crops = [
            "Bajra(Pearl Millet/Cumbu)", "Jowar(Sorghum)", "Maize",
            "Paddy(Common)", "Ragi(Finger Millet)", "Wheat",
            "Cotton", "Sugarcane", "Jute", "Groundnut", "Mustard",
            "Niger Seed(Ramtil)", "Safflower", "Sesamum(Sesame,Gingelly,Til)",
            "Soyabean", "Sunflower", "Arhar(Tur/Red Gram)(Whole)",
            "Bengal Gram(Gram)(Whole)", "Black Gram(Urd Beans)(Whole)",
            "Green Gram(Moong)(Whole)", "Lentil(Masur)(Whole)"
        ]
        categories = ["Cash", "Cereal", "Oil Seed", "Pulse"]
        seasons = ["Kharif", "Rabi"]
    else:
        crops     = em.get("crop_classes", [])
        categories = em.get("category_classes", [])
        seasons   = em.get("season_classes", [])

    # Diesel prices per year for Predict form context
    diesel_map = {
        "2021-22": 86.72, "2022-23": 89.97,
        "2023-24": 92.15, "2024-25": 93.50, "2025-26": 103.54,
    }
    years = list(diesel_map.keys())

    # Build MSP map dynamically from processed predictions to remove UX friction
    pred_path = os.path.join(PROCESSED_DIR, "predictions.csv")
    msp_map = {}
    if os.path.exists(pred_path):
        df_pred = pd.read_csv(pred_path)
        if "crop" in df_pred.columns and "year" in df_pred.columns and "msp" in df_pred.columns:
            for _, row in df_pred.iterrows():
                c, y, m = row["crop"], row["year"], row["msp"]
                if c not in msp_map: msp_map[c] = {}
                msp_map[c][y] = float(m)

    return jsonify({
        "crops": sorted(crops),
        "categories": sorted(categories),
        "seasons": sorted(seasons),
        "years": years,
        "diesel_by_year": diesel_map,
        "msp_by_crop_year": msp_map,
    })


# ── Endpoint 8: Year Trends ────────────────────────────────────────────────────
@app.route("/api/trends", methods=["GET"])
def get_trends():
    """
    Returns year × category trend data for the Overview line chart.
    Also returns season analysis.
    """
    year_trend    = _load_json("year_trend.json")
    season_stats  = _load_json("season_analysis.json")

    if year_trend is None:
        return jsonify({"error": "Trend data not found. Run backend/train.py first."}), 503

    return jsonify({
        "year_trend": year_trend,
        "season_analysis": season_stats or [],
    })


# ── Endpoint 9: Data Explorer ──────────────────────────────────────────────────
@app.route("/api/explorer", methods=["GET"])
def get_explorer():
    """
    Returns paginated, filterable rows from predictions.csv.
    Query params:
      page (int, default 1)
      page_size (int, default 25, max 100)
      crop (str)
      season (str)
      year (str)
      category (str)
      sort_by (str, default broker_margin_pct)
      sort_dir (asc|desc, default desc)
    """
    pred_path = os.path.join(PROCESSED_DIR, "predictions.csv")
    if not os.path.exists(pred_path):
        return jsonify({"error": "Data not found. Run backend/train.py first."}), 503

    df = pd.read_csv(pred_path)

    # Apply filters
    crop_filter     = request.args.get("crop")
    season_filter   = request.args.get("season")
    year_filter     = request.args.get("year")
    category_filter = request.args.get("category")

    if crop_filter:
        df = df[df["crop"].str.lower().str.contains(crop_filter.lower(), na=False)]
    if season_filter:
        df = df[df["season"] == season_filter]
    if year_filter:
        df = df[df["year"] == year_filter]
    if category_filter:
        df = df[df["category"] == category_filter]

    # Sorting
    sort_by  = request.args.get("sort_by", "broker_margin_pct")
    sort_dir = request.args.get("sort_dir", "desc")
    asc = sort_dir == "asc"
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=asc)

    # Pagination
    total = len(df)
    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = min(100, max(1, int(request.args.get("page_size", 25))))
    except ValueError:
        page, page_size = 1, 25

    start = (page - 1) * page_size
    end   = start + page_size
    page_df = df.iloc[start:end]

    # Select display columns
    cols = ["crop", "category", "season", "year", "msp", "market_price",
            "arrival_volume", "diesel_price", "broker_margin_pct",
            "predicted_margin", "residual"]
    cols = [c for c in cols if c in page_df.columns]
    records = page_df[cols].round(2).to_dict(orient="records")

    return jsonify({
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "data": records,
    })


# ── Health check & Root ─────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "message": "AGRO_RESEARCH API Backend is running.",
        "docs": "Endpoints available under /api/*",
        "status": "online"
    })

@app.route("/api/health", methods=["GET"])
def health():
    models_ready = os.path.exists(os.path.join(MODELS_DIR, "gb_model.pkl"))
    return jsonify({
        "status": "ok",
        "models_ready": models_ready,
        "message": "AGRO_RESEARCH Broker Margin API v1.0"
    })


# ── Dev server ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n  AGRO_RESEARCH Flask API")
    print("  Starting on http://localhost:5000")
    print("  Ensure you have run: python train.py\n")
    # use_reloader=False prevents watchdog from reloading on stdlib file changes
    # which was causing frequent 404s during active development
    app.run(debug=True, port=5000, host="0.0.0.0", use_reloader=False)
