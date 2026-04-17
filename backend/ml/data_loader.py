"""
data_loader.py
==============
Loads and merges all AGMARKNET seasonal price CSVs (2021-26) with
MSP values and PPAC Mumbai diesel prices.

Produces a long-format DataFrame with columns:
  year, crop, category, season, msp, market_price,
  arrival_volume, diesel_price, broker_margin_pct
"""

import os
import pandas as pd
import numpy as np
from openpyxl import load_workbook

# ── file registry ──────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "datasets")

CSV_FILES = {
    "2021-22": "Season_Price_Arrival_21-22.csv",
    "2022-23": "Season_Price_Arrival_22-23.csv",
    "2023-24": "Season_Price_Arrival_23-24.csv",
    # Timestamped downloads — rename to match if these are 2024-25 and 2025-26
    "2024-25": "Season_Price_Arrival_22-03-2026_07-38-33_PM.csv",
    "2025-26": "Season_Price_Arrival_22-03-2026_07-39-24_PM.csv",
}

PPAC_FILE = "ppac_diesel.xlsx"

# Canonical crop → category mapping (handles minor name variations)
# CSV categories: Cereals, Fibre Crops, Oil Seeds, Others, Pulses
CROP_CATEGORY_MAP = {
    # Cereals
    "Bajra(Pearl Millet/Cumbu)":      "Cereal",
    "Jowar(Sorghum)":                  "Cereal",
    "Maize":                           "Cereal",
    "Paddy(Common)":                   "Cereal",
    "Ragi(Finger Millet)":             "Cereal",
    "Wheat":                           "Cereal",
    # Cash / Fibre crops
    "Cotton":                          "Cash",
    "Sugarcane":                       "Cash",
    "Jute":                            "Cash",
    # Oil Seeds
    "Groundnut":                       "Oil Seed",
    "Mustard":                         "Oil Seed",
    "Niger Seed(Ramtil)":              "Oil Seed",
    "Safflower":                       "Oil Seed",
    "Sesamum(Sesame,Gingelly,Til)":    "Oil Seed",
    'Sesamum(Sesame,Gingelly,Til)':    "Oil Seed",   # alternate quote style
    "Soyabean":                        "Oil Seed",
    "Sunflower":                       "Oil Seed",
    # Pulses
    "Arhar(Tur/Red Gram)(Whole)":      "Pulse",
    "Bengal Gram(Gram)(Whole)":        "Pulse",
    "Black Gram(Urd Beans)(Whole)":    "Pulse",
    "Green Gram(Moong)(Whole)":        "Pulse",
    "Lentil(Masur)(Whole)":            "Pulse",
}

# Year → annual average Mumbai diesel price (Rs./Litre)
# Derived from PPAC Table 1 (Mumbai column) — yearly average
DIESEL_YEAR_MAP = {
    "2021-22": 86.72,
    "2022-23": 89.97,
    "2023-24": 92.15,
    "2024-25": 93.50,
    "2025-26": 103.54,
}


def _parse_one_csv(filepath: str, year_label: str) -> pd.DataFrame:
    """Parse a single AGMARKNET CSV into rows of kharif + rabi records."""
    df_raw = pd.read_csv(filepath, header=None, skiprows=2)
    df_raw.columns = [
        "category", "crop", "msp",
        "kharif_price", "kharif_arrival",
        "rabi_price",   "rabi_arrival"
    ]
    # Drop header row if it crept in
    df_raw = df_raw[df_raw["crop"] != "Commodity"].copy()
    df_raw = df_raw[df_raw["crop"].notna()].copy()

    records = []
    for _, row in df_raw.iterrows():
        crop     = str(row["crop"]).strip()
        category = CROP_CATEGORY_MAP.get(crop, str(row["category"]).strip())
        msp      = _to_float(row["msp"])
        if msp is None:
            continue

        # Kharif row
        kp = _to_float(row["kharif_price"])
        ka = _to_float(row["kharif_arrival"])
        if kp is not None and ka is not None and ka > 0:
            records.append({
                "year": year_label,
                "crop": crop,
                "category": category,
                "season": "Kharif",
                "msp": msp,
                "market_price": kp,
                "arrival_volume": ka,
            })

        # Rabi row
        rp = _to_float(row["rabi_price"])
        ra = _to_float(row["rabi_arrival"])
        if rp is not None and ra is not None and ra > 0:
            records.append({
                "year": year_label,
                "crop": crop,
                "category": category,
                "season": "Rabi",
                "msp": msp,
                "market_price": rp,
                "arrival_volume": ra,
            })

    return pd.DataFrame(records)


def _to_float(val) -> float | None:
    """Convert cell value to float; return None for '-', NaN, empty."""
    if val is None:
        return None
    s = str(val).strip()
    if s in ("-", "", "nan", "NaN", "None"):
        return None
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return None


def load_all_data() -> pd.DataFrame:
    """
    Main entry point.
    Returns clean DataFrame ready for feature engineering.
    """
    frames = []
    for year_label, fname in CSV_FILES.items():
        fpath = os.path.join(DATA_DIR, fname)
        if not os.path.exists(fpath):
            print(f"  [WARN] Missing file: {fpath}")
            continue
        df = _parse_one_csv(fpath, year_label)
        frames.append(df)
        print(f"  [OK] {year_label}: {len(df)} records loaded")

    df_all = pd.concat(frames, ignore_index=True)

    # Join annual diesel price
    df_all["diesel_price"] = df_all["year"].map(DIESEL_YEAR_MAP)

    # Compute target variable
    df_all["broker_margin_pct"] = (
        (df_all["market_price"] - df_all["msp"]) / df_all["msp"]
    ) * 100

    # Year as integer for ML
    df_all["year_int"] = df_all["year"].apply(lambda y: int(y.split("-")[0]))

    print(f"\n  Total records: {len(df_all)}")
    print(f"  Crops: {sorted(df_all['crop'].unique())}")
    print(f"  Categories: {df_all['category'].unique()}")
    print(f"  Seasons: {df_all['season'].unique()}")
    print(f"  Years: {sorted(df_all['year'].unique())}")
    print(f"  broker_margin_pct range: {df_all['broker_margin_pct'].min():.1f}% to {df_all['broker_margin_pct'].max():.1f}%")

    return df_all


if __name__ == "__main__":
    df = load_all_data()
    print("\nSample rows:")
    print(df[["year","crop","category","season","msp","market_price","arrival_volume","diesel_price","broker_margin_pct"]].head(10).to_string())