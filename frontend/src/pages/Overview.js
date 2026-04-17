/**
 * Overview.js — Dashboard / Home Page
 * Shows KPIs, 5-year trend chart, and category breakdown
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

const API = '';  // uses proxy

const CATEGORY_COLORS = {
  Cereal:    '#22c55e',
  'Oil Seed':'#3b82f6',
  Pulse:     '#f59e0b',
  Cash:      '#a855f7',
  Fibre:     '#ec4899',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #cbd5e1',
      borderRadius: 10, padding: '12px 16px', fontSize: 12
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 3 }}>
          {p.name}: <strong>{p.value?.toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
};

export default function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/overview`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span>Loading dashboard...</span></div>
    </div>
  );

  if (error) return (
    <div className="page-wrapper">
      <div className="error-state">⚠️ {error} — Make sure Flask is running on port 5000 and train.py has been executed.</div>
    </div>
  );

  const { kpis, year_trend, category_breakdown } = data;

  // Pivot year_trend into chart-friendly format: [{year, Cereal, Oil Seed, Pulse, Cash}]
  const years = [...new Set(year_trend.map(r => r.year))].sort();
  const categories = [...new Set(year_trend.map(r => r.category))];
  const trendChartData = years.map(yr => {
    const row = { year: yr };
    categories.forEach(cat => {
      const match = year_trend.find(r => r.year === yr && r.category === cat);
      row[cat] = match ? +match.avg_margin.toFixed(1) : null;
    });
    return row;
  });

  return (
    <div className="page-wrapper page-enter">
      <div className="page-header animate-fade-in stagger-1">
        <h1 className="page-title">
          <span className="page-title-accent">Broker Margin</span> Analysis
        </h1>
        <p className="page-subtitle">
          Maharashtra Agricultural Markets · 21 crops · 2021–2026 · Gradient Boosting ML
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid animate-fade-in stagger-2">
        <div className="kpi-card">
          <div className="kpi-label">Avg Broker Margin</div>
          <div className={`kpi-value ${kpis.avg_broker_margin >= 0 ? 'positive' : 'negative'}`}>
            {kpis.avg_broker_margin > 0 ? '+' : ''}{kpis.avg_broker_margin}%
          </div>
          <div className="kpi-sub">Market price vs MSP</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">% Records Above MSP</div>
          <div className="kpi-value highlight">{kpis.pct_above_msp}%</div>
          <div className="kpi-sub">of {kpis.total_records} records</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Peak Margin</div>
          <div className="kpi-value positive">+{kpis.max_broker_margin}%</div>
          <div className="kpi-sub" style={{ fontSize: 10, lineHeight: 1.4, marginTop: 4 }}>
            {kpis.highest_margin_crop}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Lowest Margin</div>
          <div className="kpi-value negative">{kpis.min_broker_margin}%</div>
          <div className="kpi-sub" style={{ fontSize: 10, lineHeight: 1.4, marginTop: 4 }}>
            {kpis.lowest_margin_crop}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Crops</div>
          <div className="kpi-value blue">{kpis.total_crops}</div>
          <div className="kpi-sub">Across 4 categories</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Years Covered</div>
          <div className="kpi-value blue">{kpis.years_covered?.length}</div>
          <div className="kpi-sub">{kpis.years_covered?.[0]} – {kpis.years_covered?.at(-1)}</div>
        </div>
      </div>

      {/* Key Finding Callout */}
      <div className="callout callout-green animate-fade-in stagger-3">
        <div className="callout-title">Key Finding</div>
        Top drivers of broker margin: <strong>{kpis.top_driver_1}</strong> and <strong>{kpis.top_driver_2}</strong>
        (identified via permutation feature importance — see SHAP Analysis page).
      </div>

      {/* Year Trend Chart */}
      <div className="chart-card animate-fade-in stagger-4">
        <div className="chart-header">
          <div>
            <div className="chart-title">5-Year Average Broker Margin Trend</div>
            <div className="chart-subtitle">By crop category · broker_margin_% = (market_price − MSP) / MSP × 100</div>
          </div>
          <div className="chart-badge">2021–2026</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
            <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 11 }} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            {categories.map(cat => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={CATEGORY_COLORS[cat] || '#64748b'}
                strokeWidth={2.5}
                dot={{ fill: CATEGORY_COLORS[cat], r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown Bar Chart */}
      <div className="grid-2 animate-fade-in stagger-5">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Avg Margin by Crop Category</div>
              <div className="chart-subtitle">Which category earns highest broker markup?</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={category_breakdown} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="category" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg_margin" radius={[4, 4, 0, 0]} name="Avg Margin">
                {category_breakdown.map((entry, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[entry.category] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary table */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title">Category Summary</div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Avg Margin</th>
                </tr>
              </thead>
              <tbody>
                {category_breakdown.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: CATEGORY_COLORS[row.category] + '22',
                          color: CATEGORY_COLORS[row.category] || '#64748b'
                        }}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td className={row.avg_margin >= 0 ? 'badge-green' : 'badge-red'}
                        style={{ fontWeight: 700 }}>
                      {row.avg_margin > 0 ? '+' : ''}{row.avg_margin}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
