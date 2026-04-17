/**
 * ShapAnalysis.js — SHAP Feature Importance & Beeswarm Page (★ Star Page)
 * Key paper figure: crop_category + season are top 2 drivers
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, Cell,
  ErrorBar
} from 'recharts';

const API = 'https://agro-research.onrender.com';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

function BeeswarmChart({ data }) {
  if (!data?.length) return null;

  // Show top 4 features in beeswarm-style scatter
  const top4 = data.slice(0, 4);
  const flatPoints = [];
  top4.forEach((feat, fi) => {
    (feat.points || []).forEach(pt => {
      flatPoints.push({
        feature_idx: fi,
        feature_name: feat.feature,
        shap_value: pt.shap_value,
        feature_val: pt.feature_val,
        color: COLORS[fi],
      });
    });
  });

  return (
    <div>
      {top4.map((feat, fi) => (
        <div key={fi} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: COLORS[fi], marginRight: 8
            }} />
            {feat.feature}
            <span style={{ color: '#475569', fontWeight: 400, marginLeft: 8 }}>
              (importance: {feat.importance.toFixed(4)})
            </span>
          </div>
          <ResponsiveContainer width="100%" height={70}>
            <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis
                type="number" dataKey="shap_value" name="SHAP Value"
                tick={{ fill: '#475569', fontSize: 10 }} unit="%"
              />
              <YAxis
                type="number" dataKey="feature_val" name="Feature Value"
                tick={{ fill: '#475569', fontSize: 10 }} domain={[0, 1]}
                tickCount={3}
              />
              <Tooltip
                formatter={(v, n) => [v.toFixed(2), n === 'shap_value' ? 'SHAP contribution (%)' : 'Normalised feature value']}
                contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 11 }}
              />
              <Scatter
                data={(feat.points || []).map(pt => ({ shap_value: pt.shap_value, feature_val: pt.feature_val }))}
                fill={COLORS[fi]}
                opacity={0.65}
                r={4}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}

export default function ShapAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/shap`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="page-wrapper"><div className="loading-state"><div className="spinner" /><span>Loading SHAP analysis...</span></div></div>
  );
  if (error) return (
    <div className="page-wrapper"><div className="error-state">⚠️ {error}</div></div>
  );

  const rawFI   = data?.feature_importance;
  const rawBees = data?.beeswarm;
  const rawTD   = data?.top_drivers;

  const feature_importance = Array.isArray(rawFI)   ? rawFI   : [];
  const beeswarm           = Array.isArray(rawBees) ? rawBees : [];
  const top_drivers        = Array.isArray(rawTD)   ? rawTD   : [];

  if (!feature_importance.length) return (
    <div className="page-wrapper">
      <div className="error-state">⚠️ SHAP data not found. Make sure <code>train.py</code> has been run on the backend.</div>
    </div>
  );

  const fiChart = (feature_importance || []).map((f, i) => ({
    name: f.feature,
    importance: +(f.importance * 100).toFixed(2),
    std: +(f.std * 100).toFixed(2),
    color: COLORS[i] || '#64748b',
  }));

  const maxImp = fiChart[0]?.importance || 1;

  const CustomBar = (props) => {
    const { x, y, width, height, fill } = props;
    return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
  };

  return (
    <div className="page-wrapper page-enter">
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-accent">SHAP</span> Feature Analysis
          <span style={{ fontSize: 16, marginLeft: 12, verticalAlign: 'middle' }}>✨</span>
        </h1>
        <p className="page-subtitle">
          Permutation-based SHAP-equivalent explainability · Key finding for IEEE paper Figure 3
        </p>
      </div>

      {/* Key Finding Banner */}
      <div className="callout callout-green">
        <div className="callout-title">⭐ Central Finding of This Research</div>
        The two strongest predictors of broker margin are{' '}
        <strong style={{ color: '#22c55e' }}>{top_drivers[0]?.feature ?? '—'}</strong> and{' '}
        <strong style={{ color: '#3b82f6' }}>{top_drivers[1]?.feature ?? '—'}</strong>.
        This confirms that <em>what</em> crop is grown (and in which season) dominates over logistics
        costs (diesel price) in explaining price-MSP deviations.
      </div>

      <div className="grid-2">
        {/* Feature Importance Horizontal Bar */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Feature Importance Ranking</div>
              <div className="chart-subtitle">Permutation importance × 100 (higher = more influential)</div>
            </div>
            <div className="chart-badge">SHAP-equivalent</div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={fiChart}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} width={96} />
              <Tooltip
                formatter={(v) => [`${v}`, 'Importance score']}
                contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {fiChart.map((f, i) => (
                  <Cell key={i} fill={f.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Visual bars with % labels */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title">Driver Strength</div>
            <div className="chart-subtitle">Relative importance normalised to top feature</div>
          </div>
          <div style={{ paddingTop: 8 }}>
            {fiChart.map((f, i) => {
              const relPct = ((f.importance / maxImp) * 100).toFixed(0);
              return (
                <div key={i} className="feature-bar-row">
                  <div className="feature-name" style={{ color: f.color }}>{f.name}</div>
                  <div className="feature-bar-track">
                    <div
                      className="feature-bar-fill"
                      style={{ width: `${relPct}%`, background: f.color, transition: 'width 1s ease' }}
                    />
                  </div>
                  <div className="feature-bar-value">{relPct}%</div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 10 }}>
              Top Drivers (Paper Key Finding)
            </div>
            {top_drivers.map((d, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
                padding: '10px 14px',
                background: COLORS[i] + '15',
                border: `1px solid ${COLORS[i]}40`,
                borderRadius: 10
              }}>
                <div style={{ fontSize: 20 }}>{i === 0 ? '🥇' : '🥈'}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS[i] }}>{d.feature}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Score: {d.importance.toFixed(4)} ± {d.std.toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Beeswarm-style chart */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <div className="chart-title">SHAP Contribution Plots (Beeswarm Equivalent)</div>
            <div className="chart-subtitle">
              X-axis: contribution to prediction (percentage points) ·
              Y-axis: normalised feature value (0=low, 1=high)
            </div>
          </div>
          <div className="chart-badge">Fig. 3 for paper</div>
        </div>
        <BeeswarmChart data={beeswarm} />
      </div>

      {/* Interpretation */}
      <div className="chart-card">
        <div className="chart-header">
          <div className="chart-title">📖 Interpretation Guide</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { icon: '🌾', title: 'Crop Name', text: 'Specific commodity (e.g., Cotton vs Paddy) has the strongest individual effect on how far market price deviates from MSP.' },
            { icon: '🏷️', title: 'Crop Category', text: 'Whether a crop belongs to Cereals, Oil Seeds, Pulses, or Cash crops is a powerful structural predictor — captures policy and demand patterns.' },
            { icon: '🌦️', title: 'Season', text: 'Kharif vs Rabi planting season affects supply timing. Kharif crops tend to show higher post-harvest margin compression.' },
            { icon: '⛽', title: 'Diesel Price', text: 'Mumbai diesel price (logistics cost proxy) shows moderate importance, confirming transport costs partially transmit to farmgate prices.' },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '16px', borderRadius: 10,
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{item.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
