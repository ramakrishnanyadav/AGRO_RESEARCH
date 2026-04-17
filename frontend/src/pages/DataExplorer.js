/**
 * DataExplorer.js — Research Data Explorer Page
 * Sortable, filterable, paginated table of the full dataset
 * With export-to-CSV button
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = '';

const SEASONS = ['', 'Kharif', 'Rabi'];
const YEARS = ['', '2021-22', '2022-23', '2023-24', '2024-25', '2025-26'];
const CATEGORIES = ['', 'Cash', 'Cereal', 'Oil Seed', 'Pulse'];

function MarginBadge({ value }) {
  if (value === null || value === undefined) return '—';
  const v = parseFloat(value);
  const cls = v >= 10 ? 'badge-green' : v >= 0 ? 'badge-amber' : 'badge-red';
  return <span className={`badge ${cls}`}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>;
}

export default function DataExplorer() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [cropFilter, setCropFilter]    = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [yearFilter, setYearFilter]    = useState('');
  const [catFilter, setCatFilter]      = useState('');
  const [sortBy, setSortBy]            = useState('broker_margin_pct');
  const [sortDir, setSortDir]          = useState('desc');
  const [page, setPage]                = useState(1);
  const PAGE_SIZE = 20;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = {
      page, page_size: PAGE_SIZE, sort_by: sortBy, sort_dir: sortDir,
    };
    if (cropFilter)   params.crop     = cropFilter;
    if (seasonFilter) params.season   = seasonFilter;
    if (yearFilter)   params.year     = yearFilter;
    if (catFilter)    params.category = catFilter;

    axios.get(`${API}/api/explorer`, { params })
      .then(r => {
        setRows(r.data.data || []);
        setTotal(r.data.total || 0);
        setTotalPages(r.data.total_pages || 1);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [page, sortBy, sortDir, cropFilter, seasonFilter, yearFilter, catFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset to page 1 on filter change
  const handleFilterChange = (setter) => (val) => {
    setPage(1);
    setter(val);
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const sortIndicator = (col) => {
    if (sortBy !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const handleDownload = () => {
    window.open(`${API}/api/download?type=predictions`, '_blank');
  };

  const CATEGORY_COLORS = { Cereal: 'badge-green', 'Oil Seed': 'badge-blue', Pulse: 'badge-amber', Cash: 'badge-purple' };

  return (
    <div className="page-wrapper page-enter">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Data <span className="page-title-accent">Explorer</span></h1>
          <p className="page-subtitle">
            Full predictions dataset · {total} records · Filter, sort, and export for research
          </p>
        </div>
        <button className="btn btn-outline" id="download-csv-btn" onClick={handleDownload}>
          ⬇️ Download Full CSV
        </button>
      </div>

      {error && <div className="error-state">⚠️ {error}</div>}

      {/* Filter Bar */}
      <div className="search-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            id="crop-search-input"
            placeholder="Search crop name..."
            value={cropFilter}
            onChange={e => handleFilterChange(setCropFilter)(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ minWidth: 120 }}
          value={seasonFilter}
          onChange={e => handleFilterChange(setSeasonFilter)(e.target.value)}
        >
          <option value="">All Seasons</option>
          {SEASONS.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          className="form-control"
          style={{ minWidth: 120 }}
          value={yearFilter}
          onChange={e => handleFilterChange(setYearFilter)(e.target.value)}
        >
          <option value="">All Years</option>
          {YEARS.slice(1).map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          className="form-control"
          style={{ minWidth: 130 }}
          value={catFilter}
          onChange={e => handleFilterChange(setCatFilter)(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          className="btn btn-secondary"
          onClick={() => {
            setCropFilter(''); setSeasonFilter(''); setYearFilter(''); setCatFilter('');
            setSortBy('broker_margin_pct'); setSortDir('desc'); setPage(1);
          }}
        >
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="data-table-wrap" style={{ borderRadius: 0, border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('crop')}>Crop{sortIndicator('crop')}</th>
                <th>Category</th>
                <th onClick={() => handleSort('season')}>Season{sortIndicator('season')}</th>
                <th onClick={() => handleSort('year')}>Year{sortIndicator('year')}</th>
                <th onClick={() => handleSort('msp')}>MSP ₹{sortIndicator('msp')}</th>
                <th onClick={() => handleSort('market_price')}>Market ₹{sortIndicator('market_price')}</th>
                <th onClick={() => handleSort('arrival_volume')}>Arrival Qtl{sortIndicator('arrival_volume')}</th>
                <th onClick={() => handleSort('broker_margin_pct')}>Actual Margin{sortIndicator('broker_margin_pct')}</th>
                <th onClick={() => handleSort('predicted_margin')}>Predicted{sortIndicator('predicted_margin')}</th>
                <th onClick={() => handleSort('residual')}>Residual{sortIndicator('residual')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
                    No records found for the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.crop}
                    </td>
                    <td>
                      <span className={`badge ${CATEGORY_COLORS[row.category] || 'badge-blue'}`}>
                        {row.category}
                      </span>
                    </td>
                    <td>{row.season}</td>
                    <td>{row.year}</td>
                    <td>₹{row.msp?.toLocaleString()}</td>
                    <td>₹{row.market_price?.toLocaleString()}</td>
                    <td>{row.arrival_volume?.toLocaleString()}</td>
                    <td><MarginBadge value={row.broker_margin_pct} /></td>
                    <td><MarginBadge value={row.predicted_margin} /></td>
                    <td style={{ color: Math.abs(row.residual) > 5 ? '#f59e0b' : '#94a3b8' }}>
                      {row.residual?.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination" style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
          <div className="pagination-info">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of <strong>{total}</strong> records
          </div>
          <div className="pagination-controls">
            <button className="page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>

            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  className={`page-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}

            <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</button>
            <button className="page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
          </div>
        </div>
      </div>
    </div>
  );
}
