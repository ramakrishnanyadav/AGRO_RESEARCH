/**
 * PredictMargin.js — Live Prediction Page
 * Form: select crop, season, year, volume → shows predicted broker_margin_%
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'https://agro-research.onrender.com';

const CATEGORY_FOR_CROP = {
  'Bajra(Pearl Millet/Cumbu)': 'Cereal',
  'Jowar(Sorghum)': 'Cereal',
  'Maize': 'Cereal',
  'Paddy(Common)': 'Cereal',
  'Ragi(Finger Millet)': 'Cereal',
  'Wheat': 'Cereal',
  'Cotton': 'Cash',
  'Sugarcane': 'Cash',
  'Jute': 'Cash',
  'Groundnut': 'Oil Seed',
  'Mustard': 'Oil Seed',
  'Niger Seed(Ramtil)': 'Oil Seed',
  'Safflower': 'Oil Seed',
  'Sesamum(Sesame,Gingelly,Til)': 'Oil Seed',
  'Soyabean': 'Oil Seed',
  'Sunflower': 'Oil Seed',
  'Arhar(Tur/Red Gram)(Whole)': 'Pulse',
  'Bengal Gram(Gram)(Whole)': 'Pulse',
  'Black Gram(Urd Beans)(Whole)': 'Pulse',
  'Green Gram(Moong)(Whole)': 'Pulse',
  'Lentil(Masur)(Whole)': 'Pulse',
};

export default function PredictMargin() {
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState({
    crop: '', category: '', season: 'Kharif',
    year: '2024-25', arrival_volume: '', diesel_price: '',
    msp: '', market_price: '',
  });
  const [result, setResult] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/crops`)
      .then(r => {
        setOptions(r.data);
        if (r.data.crops?.length) {
          const firstCrop = r.data.crops[0];
          const currYear = '2024-25';
          const defaultMsp = r.data.msp_by_crop_year?.[firstCrop]?.[currYear] || '';
          setForm(f => ({
            ...f,
            crop: firstCrop,
            category: CATEGORY_FOR_CROP[firstCrop] || 'Cereal',
            diesel_price: r.data.diesel_by_year?.[currYear] || '',
            msp: defaultMsp,
          }));
        }
      })
      .catch(() => setOptions({ crops: Object.keys(CATEGORY_FOR_CROP), seasons: ['Kharif', 'Rabi'], years: ['2021-22','2022-23','2023-24','2024-25','2025-26'], diesel_by_year: {} }));
  }, []);

  const diesel_map = options?.diesel_by_year || {};
  const msp_map = options?.msp_by_crop_year || {};

  const handleCropChange = (crop) => {
    const defaultMsp = msp_map[crop]?.[form.year] || '';
    setForm(f => ({
      ...f,
      crop,
      category: CATEGORY_FOR_CROP[crop] || f.category,
      msp: defaultMsp,
    }));
  };

  const handleYearChange = (year) => {
    const defaultMsp = msp_map[form.crop]?.[year] || '';
    setForm(f => ({
      ...f,
      year,
      diesel_price: diesel_map[year] || f.diesel_price,
      msp: defaultMsp,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPredicting(true);
    setResult(null);
    setError(null);

    try {
      const payload = {
        ...form,
        arrival_volume: parseFloat(form.arrival_volume),
        diesel_price: parseFloat(form.diesel_price),
        msp: parseFloat(form.msp),
      };
      const r = await axios.post(`${API}/api/predict`, payload);
      setResult(r.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setPredicting(false);
    }
  };

  if (!options) return (
    <div className="page-wrapper"><div className="loading-state"><div className="spinner" /><span>Loading options...</span></div></div>
  );

  const isPositive = result && result.predicted_margin >= 0;

  return (
    <div className="page-wrapper page-enter">
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-accent">Predict</span> Price Deviation
        </h1>
        <p className="page-subtitle">
          Enter crop, season, year and volume. The ML model instantly predicts the Market Price. <br/>
          The deterministic engine then calculates the exact Price Deviation (%) from the government MSP.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '640px 1fr', gap: 28, alignItems: 'start' }}>
        <div className="form-card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 24 }}>
              <div className="callout callout-amber" style={{ marginBottom: 0 }}>
                <div className="callout-title">How it works</div>
                The ML model accurately predicts the raw Market Price from these variables.
                The system then computes the resulting Price Deviation.
              </div>
            </div>

            <div className="form-grid">
              {/* Crop */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label" htmlFor="crop-select">Crop</label>
                <select
                  id="crop-select"
                  className="form-control"
                  value={form.crop}
                  onChange={e => handleCropChange(e.target.value)}
                  required
                >
                  <option value="">— Select crop —</option>
                  {(options.crops || []).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Category (Strict classification based on Crop) */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
                  Category
                  <span style={{ color: '#059669', marginLeft: 8, fontSize: 10, fontWeight: 800, background: '#d1fae5', padding: '2px 8px', borderRadius: 12 }}>
                    ← DERIVED
                  </span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={form.category || '—'}
                  readOnly
                  style={{ background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>

              {/* Season */}
              <div className="form-group">
                <label className="form-label" htmlFor="season-select">Season</label>
                <select
                  id="season-select"
                  className="form-control"
                  value={form.season}
                  onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                  required
                >
                  {(options.seasons || ['Kharif','Rabi']).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div className="form-group">
                <label className="form-label" htmlFor="year-select">Agricultural Year</label>
                <select
                  id="year-select"
                  className="form-control"
                  value={form.year}
                  onChange={e => handleYearChange(e.target.value)}
                  required
                >
                  {(options.years || []).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Arrival Volume */}
              <div className="form-group">
                <label className="form-label" htmlFor="arrival-input">Arrival Volume (Qtl)</label>
                <input
                  id="arrival-input"
                  type="number"
                  min="0"
                  step="100"
                  className="form-control"
                  placeholder="e.g. 5000"
                  value={form.arrival_volume}
                  onChange={e => setForm(f => ({ ...f, arrival_volume: e.target.value }))}
                  required
                />
              </div>

              {/* Diesel Price */}
              <div className="form-group">
                <label className="form-label" htmlFor="diesel-input">
                  Diesel Price (₹/litre)
                  {form.year && diesel_map[form.year] && (
                    <span style={{ color: '#22c55e', marginLeft: 6, fontSize: 10 }}>
                      ← auto-filled for {form.year}
                    </span>
                  )}
                </label>
                <input
                  id="diesel-input"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  placeholder="e.g. 93.50"
                  value={form.diesel_price}
                  onChange={e => setForm(f => ({ ...f, diesel_price: e.target.value }))}
                  required
                />
              </div>

              {/* MSP */}
              <div className="form-group">
                <label className="form-label" htmlFor="msp-input" style={{ display: 'flex', alignItems: 'center' }}>
                  Minimum Support Price (₹/Qtl)
                  {form.msp !== '' && (
                    <span style={{ color: '#059669', marginLeft: 8, fontSize: 10, fontWeight: 800, background: '#d1fae5', padding: '2px 8px', borderRadius: 12 }}>
                      ← AUTO-FILLED
                    </span>
                  )}
                </label>
                <input
                  id="msp-input"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  placeholder="e.g. 2500"
                  value={form.msp}
                  onChange={e => setForm(f => ({ ...f, msp: e.target.value }))}
                  readOnly={form.msp !== ''}
                  style={form.msp !== '' ? { background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' } : {}}
                  required
                />
              </div>

            </div>

            {error && <div className="error-state">⚠️ {error}</div>}

            <button
              type="submit"
              id="predict-btn"
              className="btn btn-primary"
              disabled={predicting}
              style={{ width: '100%', justifyContent: 'center', fontSize: 16 }}
            >
              {predicting ? 'Predicting...' : 'Predict Market Price & Deviation'}
            </button>
          </form>

          {/* Result */}
          {result && (
            <div className="result-box">
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Estimated Price Deviation (vs. MSP)
              </div>
              <div className={`result-value ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '+' : ''}{result.predicted_margin}%
              </div>
              <div className="result-note" style={{ marginTop: 12 }}>
                <div>{result.confidence_note}</div>
                <div style={{ marginTop: 12, fontSize: 18, color: '#0f172a', fontWeight: 800 }}>
                  Predicted Market Price: <span style={{ fontFamily: 'JetBrains Mono' }}>₹{result.predicted_market_price}</span> / Qtl
                </div>
              </div>
              <div style={{
                marginTop: 16, padding: '16px 20px',
                background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
                fontSize: 13, color: '#475569', lineHeight: 1.7
              }}>
                <strong style={{ color: '#0f172a' }}>Inputs used:</strong><br />
                {form.crop} · {form.category} · {form.season} · {form.year}<br />
                Volume: {form.arrival_volume} Qtl · Diesel: ₹{form.diesel_price}/L<br />
                Baseline MSP: ₹{form.msp}
              </div>
            </div>
          )}
        </div>

        {/* Side info panel */}
        <div>
          <div className="chart-card" style={{ marginBottom: 16 }}>
            <div className="chart-title" style={{ marginBottom: 12 }}>Year → Diesel Price</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: '#475569', fontSize: 11, fontWeight: 600, paddingBottom: 8, textTransform: 'uppercase' }}>Year</th>
                  <th style={{ textAlign: 'right', color: '#475569', fontSize: 11, fontWeight: 600, paddingBottom: 8, textTransform: 'uppercase' }}>₹/Litre</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(diesel_map).map(([yr, price]) => (
                  <tr key={yr}>
                    <td style={{ color: form.year === yr ? '#22c55e' : '#94a3b8', padding: '6px 0', fontWeight: form.year === yr ? 700 : 400 }}>{yr}</td>
                    <td style={{ color: form.year === yr ? '#22c55e' : '#64748b', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chart-card">
            <div className="chart-title" style={{ marginBottom: 12 }}>Deterministic Formula</div>
            <div style={{
              background: '#f8fafc', borderRadius: 8, padding: '16px 20px', border: '1px solid #e2e8f0',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#475569', lineHeight: 1.8
            }}>
              Price_Deviation_%<br />
              = (Predicted_Market_Price − MSP)<br />
              &nbsp;&nbsp;÷ MSP × 100
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
              <strong style={{ color: '#0f172a' }}>Positive value</strong> means market price
              exceeds MSP — farmers gained profitable pricing leverage.<br /><br />
              <strong style={{ color: '#ef4444' }}>Negative value</strong> means farmers are
              paid below the guaranteed minimum support price (potential broker exploitation).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
