import sys
sys.path.insert(0, r"c:\Users\Ramakrishna\OneDrive\Pictures\java\Documents\Projects\AGRO_RESEARCH\backend")

from ml.data_loader import load_all_data
from ml.preprocessor import build_features
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score
import xgboost as xgb

df = load_all_data()
X_train, X_test, y_train, y_test, X, y, encoders, scaler, df_encoded = build_features(df)

# XGB Baseline
model_xgb = xgb.XGBRegressor(n_estimators=1000, learning_rate=0.05, max_depth=8, random_state=42)
model_xgb.fit(X_train, y_train)
print(f"XGB Test R2: {r2_score(y_test, model_xgb.predict(X_test)):.4f}")

# RF Baseline
model_rf = RandomForestRegressor(n_estimators=500, random_state=42)
model_rf.fit(X_train, y_train)
print(f"RF Test R2: {r2_score(y_test, model_rf.predict(X_test)):.4f}")

# What if we include msp and market_price in features?
df["msp_scaled"] = scaler.fit_transform(df[["msp"]]) if "msp" in df else df["msp"]
df["market_price_scaled"] = scaler.fit_transform(df[["market_price"]]) if "market_price" in df else df["market_price"]
