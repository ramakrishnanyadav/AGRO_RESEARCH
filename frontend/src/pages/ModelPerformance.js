/**
 * ModelPerformance.js — ML Results Page
 * R², MAE, RMSE cards, feature importance bar chart, residual scatter plot
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, Line,
  LineChart, ReferenceLine
} from 'recharts';

const API = '';

const MetricCard = ({ label, value, unit, sub, color }) => (
  <div className="metric-chip">
    <div className="metric-chip-label">{label}</div>
    <div className="metric-chip-value" style={color ? { color } : {}}>
      {value}{unit}
    </div>
    <div className="metric-chip-sub">{sub}</div>
  </div>
);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      borderRadius: 10, padding: '16px 20px', fontSize: 13
    }}>
      <div style={{ color: '#64748b', marginBottom: 6, fontWeight: 600 }}>{d?.crop} · {d?.season}</div>
      <div style={{ color: '#0f172a' }}>Actual: <strong>{d?.broker_margin_pct?.toFixed(1)}%</strong></div>
      <div style={{ color: '#059669' }}>Predicted: <strong>{d?.predicted_margin?.toFixed(1)}%</strong></div>
      <div style={{ color: '#d97706' }}>Residual: <strong>{d?.residual?.toFixed(1)}%</strong></div>
    </div>
  );
};

export default function ModelPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/model`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="page-wrapper"><div className="loading-state"><div className="spinner" /><span>Loading model results...</span></div></div>
  );
  if (error) return (
    <div className="page-wrapper"><div className="error-state">⚠️ {error}</div></div>
  );

  const { metrics, feature_importance, predictions_sample, model_comparison } = data;
  const m = metrics;

  // Feature importance chart data
  const fiChartData = (feature_importance || []).map(f => ({
    name: f.feature,
    importance: +(f.importance * 100).toFixed(2),
  }));

  // Residual scatter: actual vs predicted
  const scatterData = (predictions_sample || []).map(p => ({
    ...p,
    x: p.broker_margin_pct,
    y: p.predicted_margin,
  }));

  // Perfect prediction line
  const allVals = scatterData.flatMap(d => [d.x, d.y]);
  const minV = Math.min(...allVals, -30);
  const maxV = Math.max(...allVals, 50);
  const perfectLine = [{ x: minV, y: minV }, { x: maxV, y: maxV }];

  return (
    <div className="page-wrapper page-enter">
      <div className="page-header">
        <h1 className="page-title">Model <span className="page-title-accent">Performance</span></h1>
        <p className="page-subtitle">
          Dual-Model Architecture: XGBoost predicts Market Price (₹/Qtl) · Deterministic Engine calculates Deviation
        </p>
      </div>

      {/* Metric Chips */}
      <div className="metric-row animate-fade-in stagger-1">
        <MetricCard label="R² Test"      value={m.r2_test}      unit=""  sub="Variance explained"     color="#059669" />
        <MetricCard label="MAE Test"     value={m.mae_test}     unit="%" sub="Mean absolute error"    color="#2563eb" />
        <MetricCard label="RMSE Test"    value={m.rmse_test}    unit="%" sub="Root mean square error" color="#d97706" />
        <MetricCard label="CV R² Mean"   value={m.cv_r2_mean}   unit=""  sub={`± ${m.cv_r2_std?.toFixed(4)} (5-fold)`} color="#7c3aed" />
        <MetricCard label="R² Train"     value={m.r2_train}     unit=""  sub="Training score"         color="#059669" />
        <MetricCard label="Train N"      value={m.train_samples} unit="" sub={`/ ${m.total_samples} total`} color="#64748b" />
      </div>

      {/* Model Parameters callout */}
      <div className="callout callout-green animate-fade-in stagger-2" style={{ marginBottom: 24 }}>
        <div className="callout-title">Model Configuration</div>
        Algorithm: <strong>{m.model_params?.algorithm}</strong> ·
        n_estimators: <strong>{m.model_params?.n_estimators}</strong> ·
        learning_rate: <strong>{m.model_params?.learning_rate}</strong> ·
        max_depth: <strong>{m.model_params?.max_depth}</strong> ·
        subsample: <strong>{m.model_params?.subsample}</strong>
      </div>

      {/* R2 Justification Note */}
      <div className="callout callout-blue animate-fade-in stagger-2" style={{ marginBottom: 24 }}>
        <div className="callout-title">Validation Note</div>
        The high R² is attributed to structured agricultural patterns and strong feature correlations, though further validation on larger datasets is required.
      </div>

      <div className="grid-2 animate-fade-in stagger-3">
        {/* Feature Importance Bar Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Feature Importance</div>
              <div className="chart-subtitle">Permutation importance (30 repeats)</div>
            </div>
            <div className="chart-badge">Top drivers</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={fiChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 110 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fill: '#334155', fontSize: 13, fontWeight: 600 }} width={100} />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Importance']}
                contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="importance" fill="#059669" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Actual vs Predicted Scatter */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Actual vs Predicted</div>
              <div className="chart-subtitle">Closer to diagonal = better fit</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis
                type="number" dataKey="x" name="Actual"
                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }} unit="%" label={{ value: 'Actual %', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                type="number" dataKey="y" name="Predicted"
                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }} unit="%"
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Perfect prediction line */}
              <Scatter name="Predictions" data={scatterData} fill="#2563eb" opacity={0.7} />
              <Line
                type="linear"
                dataKey="y"
                data={perfectLine}
                stroke="#059669"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                legendType="none"
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#475569', marginTop: 4 }}>
            <span style={{ color: '#22c55e' }}>— </span>Perfect prediction line
          </div>
        </div>
      </div>

      {/* Feature importance table */}
      <div className="chart-card animate-fade-in stagger-4">
        <div className="chart-header">
          <div className="chart-title">Feature Importance Table</div>
          <div className="chart-subtitle">For IEEE paper Table II</div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Feature</th>
                <th>Importance Score</th>
                <th>Std Dev</th>
                <th>Relative Weight</th>
              </tr>
            </thead>
            <tbody>
              {(feature_importance || []).map((f, i) => {
                const maxImp = feature_importance[0]?.importance || 1;
                const pct = ((f.importance / maxImp) * 100).toFixed(0);
                return (
                  <tr key={i}>
                    <td style={{ color: i < 2 ? '#059669' : '#64748b', fontWeight: 800 }}>#{i + 1}</td>
                    <td style={{ color: '#0f172a', fontWeight: 600 }}>{f.feature}</td>
                    <td style={{ color: '#059669', fontWeight: 700 }}>{f.importance.toFixed(4)}</td>
                    <td style={{ color: '#64748b' }}>± {f.std.toFixed(4)}</td>
                    <td>
                      <div className="feature-bar-track" style={{ width: 120, display: 'inline-block' }}>
                        <div
                          className="feature-bar-fill"
                          style={{ width: `${pct}%`, background: i === 0 ? '#059669' : i === 1 ? '#2563eb' : '#94a3b8' }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-Model Comparison Table */}
      {model_comparison && model_comparison.length > 0 && (
        <div className="chart-card animate-fade-in stagger-5">
          <div className="chart-header">
            <div className="chart-title">Algorithm Comparison Comparison</div>
            <div className="chart-subtitle">For IEEE paper Table III</div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Test R²</th>
                  <th>Train R²</th>
                  <th>MAE (₹/Qtl)</th>
                  <th>RMSE (₹/Qtl)</th>
                  <th>5-Fold CV R²</th>
                </tr>
              </thead>
              <tbody>
                {model_comparison.map((comp, i) => (
                  <tr key={i} style={comp.name === 'XGBoost' ? { background: '#f0fdf4' } : {}}>
                    <td style={{ color: comp.name === 'XGBoost' ? '#059669' : '#0f172a', fontWeight: comp.name === 'XGBoost' ? 800 : 600 }}>
                      {comp.name} {comp.name === 'XGBoost' && '(Selected)'}
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{comp.r2_test.toFixed(4)}</td>
                    <td style={{ color: '#475569' }}>{comp.r2_train.toFixed(4)}</td>
                    <td style={{ color: '#475569', fontFamily: 'JetBrains Mono' }}>{comp.mae_test.toFixed(2)}</td>
                    <td style={{ color: '#475569', fontFamily: 'JetBrains Mono' }}>{comp.rmse.toFixed(2)}</td>
                    <td style={{ color: '#475569' }}>{comp.cv_r2.toFixed(4)} ± {comp.cv_std.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
