/**
 * App.js — Root component with sidebar navigation and routing
 * 6 Pages: Overview, ModelPerformance, ShapAnalysis, PredictMargin, DataExplorer, About
 */
import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';

import Overview       from './pages/Overview';
import ModelPerformance from './pages/ModelPerformance';
import ShapAnalysis   from './pages/ShapAnalysis';
import PredictMargin  from './pages/PredictMargin';
import DataExplorer   from './pages/DataExplorer';
import About          from './pages/About';

import {
  DashboardIcon, ModelIcon, ShapIcon, PredictIcon, ExplorerIcon, AboutIcon, BrandIcon, BookIcon
} from './components/Icons';

const navItems = [
  { to: '/',          icon: <DashboardIcon />, label: 'Dashboard',       badge: null },
  { to: '/model',     icon: <ModelIcon />,     label: 'Model Results',   badge: null },
  { to: '/shap',      icon: <ShapIcon />,      label: 'SHAP Analysis',   badge: '★' },
  { to: '/predict',   icon: <PredictIcon />,   label: 'Predict Margin',  badge: null },
  { to: '/explorer',  icon: <ExplorerIcon />,  label: 'Data Explorer',   badge: null },
  { to: '/about',     icon: <AboutIcon />,     label: 'About / Paper',   badge: null },
];

function Sidebar() {
  return (
    <nav className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar-brand">
        <div className="brand-icon"><BrandIcon size={24} style={{ margin: 0 }} /></div>
        <div className="brand-title">Agro Broker Margin</div>
        <div className="brand-sub">Maharashtra 2021–2026</div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section-label">Analysis</div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </NavLink>
        ))}
      </div>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <BookIcon size={14} /> <span style={{ fontWeight: 700 }}>IEEE Research</span>
        </div>
        ML: Gradient Boosting<br />
        21 crops · 5 years
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/"         element={<Overview />} />
            <Route path="/model"    element={<ModelPerformance />} />
            <Route path="/shap"     element={<ShapAnalysis />} />
            <Route path="/predict"  element={<PredictMargin />} />
            <Route path="/explorer" element={<DataExplorer />} />
            <Route path="/about"    element={<About />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
