import React from 'react';
import Icon from './Icons';
import { PORTALS, portalStyleVars } from './portals';

/* Home-page spotlight: makes the three work portals impossible to miss. */
export default function PortalShowcase({ onOpen }) {
  return (
    <section className="portal-showcase" id="portals" aria-labelledby="portals-title">
      <div className="portal-showcase-head">
        <span className="kicker">بوابات العمل</span>
        <h2 id="portals-title">منظومة متكاملة لكل أطراف العيادة</h2>
        <p>اختر البوابة المناسبة لدورك وابدأ العمل فورًا</p>
      </div>

      <div className="portal-cards">
        {PORTALS.map((p) => (
          <article key={p.id} className="portal-card" style={portalStyleVars(p)}>
            <div className="portal-card-top">
              <span className="portal-card-icon">
                <Icon name={p.icon} size={28} strokeWidth={1.7} />
              </span>
              <span className="portal-card-tag">{p.tagline}</span>
            </div>

            <h3>{p.name}</h3>
            <p className="portal-card-desc">{p.desc}</p>

            <ul className="portal-card-features">
              {p.features.map((f) => (
                <li key={f}>
                  <span className="tick"><Icon name="check" size={12} strokeWidth={2.6} /></span>
                  {f}
                </li>
              ))}
            </ul>

            <button type="button" className="portal-card-cta" onClick={() => onOpen(p.id)}>
              <span>دخول {p.name}</span>
              <Icon name="arrowLeft" size={18} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

