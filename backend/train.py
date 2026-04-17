"""
train.py
========
Master training script. Run this once to:
  1. Load and merge all data
  2. Encode and scale features
  3. Train Gradient Boosting model
  4. Compute SHAP-equivalent explanations
  5. Save all model artifacts

Usage:
    cd backend
    python train.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ml.data_loader    import load_all_data
from ml.preprocessor   import build_features
from ml.trainer        import train_model
from ml.shap_explainer import compute_explanations


def run_pipeline():
    print("\n" + "="*60)
    print("  IEEE DUAL-MODEL PRICE PREDICTION PIPELINE")
    print("  Maharashtra Agricultural Markets 2021–2026")
    print("="*60)

    print("\n[1/4] Loading data...")
    df = load_all_data()

    print("\n[2/4] Building features...")
    X_train, X_test, y_train, y_test, X, y, encoders, scaler, df_encoded = build_features(df)

    print("\n[3/4] Training model...")
    model, metrics = train_model(X_train, X_test, y_train, y_test, X, y, df_encoded)

    print("\n[4/4] Computing explanations...")
    compute_explanations(model, X, y, df)

    print("\n" + "="*60)
    print("  PIPELINE COMPLETE")
    print(f"  R2 (test)  : {metrics['r2_test']}")
    print(f"  MAE (test) : Rs.{metrics['mae_test']}/Qtl")
    print(f"  RMSE (test): Rs.{metrics['rmse_test']}/Qtl")
    print(f"  CV R2      : {metrics['cv_r2_mean']} +/- {metrics['cv_r2_std']}")
    print("="*60 + "\n")


if __name__ == "__main__":
    run_pipeline()