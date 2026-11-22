import React from 'react';

export default function Logo({ onClick, compact = false }) {
  return (
    <div className="logo" onClick={onClick} style={{ cursor: 'pointer' }}>
      <span className="logo-mark">
        <span />
      </span>
      {!compact && (
        <span>
          <b>دوري</b>
          <small>DAWRY</small>
        </span>
      )}
    </div>
  );
}
