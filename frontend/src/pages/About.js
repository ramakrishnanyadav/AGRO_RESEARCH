/**
 * About.js — About / Paper Page
 * Research summary, methodology, dataset info, team, IEEE citation format
 */
import React from 'react';

export default function About() {
  const citation = `@inproceedings{agro-broker-margin-2025,
  title     = {Machine Learning Analysis of Agricultural Broker
               Margins: Evidence from Maharashtra Markets 2021--2026},
  author    = {[Author Name(s)]},
  booktitle = {Proceedings of the IEEE International Conference on
               [Conference Name]},
  year      = {2025},
  pages     = {1--6},
  doi       = {10.1109/xxxxx},
  note      = {Gradient Boosting Regressor, SHAP explainability,
               AGMARKNET + MSP + PPAC data fusion}
}`;

  return (
    <div className="page-wrapper page-enter">
      <div className="page-header">
        <h1 className="page-title">
          About &amp; <span className="page-title-accent">Research Paper</span>
        </h1>
        <p className="page-subtitle">
          IEEE-publishable research summary · Methodology · Dataset · Citation
        </p>
      </div>

      <div className="about-section">

        {/* Abstract */}
        <div className="paper-block animate-fade-in stagger-1">
          <h2>Abstract</h2>
          <p>
            Agricultural price-formation in Indian commodity markets is mediated by intermediaries,
            and the gap between farmer-received prices (market/arrival price) and the government-set
            Minimum Support Price (MSP) represents the <em>broker margin</em>. This work presents a
            data-driven ML system that quantifies and predicts this margin using five years of
            AGMARKNET Maharashtra market data (2021–2026) across 21 commodities spanning Cereals,
            Oil Seeds, Pulses, and Cash crops.
          </p>
          <p>
            We train a Gradient Boosting Regressor (n=1000, lr=0.05) to predict raw Market Price directly.
            MSP is included as an exogenous policy feature influencing market price formation. The deviation metric is computed post-prediction and does not influence model training targets, thereby avoiding leakage.
            The model uses an 80/20 split and 5-fold cross-validation. SHAP-equivalent permutation importance reveals that
            <strong> Crop category</strong> and <strong>Season</strong> are the strongest predictors.
            A deterministic engine then calculates the exact Price Deviation from the guaranteed Minimum Support Price (MSP).
            The deviation ranges from −69.7% to +114.9%, confirming significant heterogeneity
            in farmer price realisation across crops and seasons.
          </p>
          <p>
            The system is deployed as a production-grade Flask REST API with a React dashboard
            featuring six interactive pages, enabling real-time prediction and SHAP visualisation
            for policy analysis and conference demonstration.
          </p>
        </div>

        {/* Methodology */}
        <div className="paper-block animate-fade-in stagger-2">
          <h2>Methodology</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: 16 }}>
            {[
              { step: '1', title: 'Data Fusion', desc: 'Merged AGMARKNET seasonal CSVs (Kharif + Rabi price/arrival), MSP table, and PPAC Mumbai diesel prices into a unified long-format DataFrame.' },
              { step: '2', title: 'Feature Engineering', desc: 'Label-encode crop name, category, season. MinMax-scale arrival volume, diesel price, and MSP. Added integer Year and binary Low Supply flag. Target: market_price (₹).' },
              { step: '3', title: 'Dual-Model Architecture', desc: 'Model A: XGBoost Regressor (n=1000) predicts Market Price. Model B: Deterministic engine calculates Price Deviation % = (Predicted - MSP) / MSP × 100.' },
              { step: '4', title: 'Explainability & Comparison', desc: '3-model comparison (Linear vs RF vs XGBoost). Permutation importance (30 repeats) as SHAP-equivalent. Beeswarm contribution plots.' },
            ].map(s => (
              <div key={s.step} style={{
                padding: '24px', borderRadius: 12,
                background: '#f0fdf4', border: '1px solid #bbf7d0'
              }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#059669', marginBottom: 8, opacity: 0.8 }}>0{s.step}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dataset */}
        <div className="paper-block animate-fade-in stagger-3">
          <h2>Dataset Details</h2>
          <div className="data-table-wrap" style={{ marginBottom: 14 }}>
            <table className="data-table">
              <thead>
                <tr><th>Field</th><th>Value</th></tr>
              </thead>
              <tbody>
                {[
                  ['Source',       'AGMARKNET (Maharashtra), MSP Gazette, PPAC'],
                  ['Coverage',     '2021-22 to 2025-26 (5 agricultural years)'],
                  ['Total Records','100 crop-season-year observations (after unpivoting Kharif + Rabi)'],
                  ['Crops',        '21 commodities: 6 Cereals, 7 Oil Seeds, 5 Pulses, 3 Cash crops'],
                  ['Markets',      'Maharashtra APMC wholesale markets'],
                  ['Price units',  '₹ per Quintal (market price, MSP)'],
                  ['Volume units', 'Quintals (arrival volume)'],
                  ['Diesel proxy', 'Mumbai retail diesel ₹/litre — PPAC Table 1'],
                  ['Target var',   'broker_margin_pct = (market_price − MSP) / MSP × 100'],
                  ['Range',        '−69.7% (below MSP) to +114.9% (above MSP)'],
                ].map(([k, v], i) => (
                  <tr key={i}>
                    <td style={{ color: '#475569', fontWeight: 600 }}>{k}</td>
                    <td style={{ color: '#0f172a' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: '#475569', fontStyle: 'italic', paddingLeft: 8 }}>
            Note: The dataset is limited in size due to publicly available constraints; however, the model demonstrates strong predictive consistency. Future work will extend this framework using larger multi-state datasets.
          </p>
        </div>

        {/* Key Findings */}
        <div className="paper-block animate-fade-in stagger-4">
          <h2>Key Findings</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
            {[
              { icon: '▸', title: 'Top predictor: Crop Category', text: 'Whether a crop is a Pulse, Cereal, Oil Seed, or Cash crop is the strongest structural predictor of broker margin, outweighing logistics costs.' },
              { icon: '▸', title: 'Season matters significantly', text: 'Kharif crops consistently exhibit different margin patterns than Rabi crops due to seasonal supply shocks and policy coverage differences.' },
              { icon: '▸', title: 'Diesel price has moderate effect', text: 'Mumbai diesel price (logistics cost proxy) explains some variance, confirming that transport cost increases partially transmit to farmgate pricing.' },
              { icon: '▸', title: 'Below-MSP trading is common', text: 'Negative broker_margin records exist across multiple crops, indicating farmers are not always realising government-guaranteed minimum prices.' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 16 }}>
                <div style={{ fontSize: 28, color: '#059669', flexShrink: 0, marginTop: -6 }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 15, color: '#475569', lineHeight: 1.6 }}>{f.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="paper-block animate-fade-in stagger-5">
          <h2>System Architecture</h2>
          <p>Production-grade full-stack system designed for IEEE reproducibility standards:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '20px 0' }}>
            {['Python 3.11','scikit-learn (GBR)','SHAP / permutation importance','pandas / numpy',
              'Flask REST API','Flask-CORS','React 18 (CRA)','React Router v6',
              'Recharts','Axios','Inter (Google Fonts)'].map(t => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
          <p>
            Layer 1 (Data): AGMARKNET CSVs → data_loader.py merger →<br />
            Layer 2 (ML):   preprocessor.py → trainer.py → shap_explainer.py →<br />
            Layer 3 (API):  Flask app.py with 9 REST endpoints →<br />
            Layer 4 (UI):   React 6-page dashboard
          </p>
        </div>

        {/* IEEE Citation */}
        <div className="paper-block animate-fade-in stagger-5">
          <h2>IEEE Citation Format</h2>
          <p>Copy and update with your author name(s) and conference details:</p>
          <pre className="cite-box">{citation}</pre>
          <div style={{ marginTop: 20, fontSize: 13, color: '#64748b', lineHeight: 1.7, fontWeight: 500 }}>
            Conference targets: IEEE ICCCNT, IEEE INDICON, IEEE ICAC3N, Springer LNCS journals
            on Smart Agriculture or Rural Informatics.
          </div>
        </div>

      </div>
    </div>
  );
}
