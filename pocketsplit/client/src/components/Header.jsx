import React from 'react';

export default function Header({ group, onGroupChange, groups, onNewGroup, members = [], currentUser, onUserSelect }) {
  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(8px)',
      position: 'sticky', top: 0, zIndex: 50,
      padding: '0 24px'
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6c63ff, #8b84ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16
          }}>₹</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
            Pocket<span style={{ color: 'var(--accent-light)' }}>Split</span>
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Group Selector */}
        {groups && groups.length > 0 && (
          <select
            value={group?.id || ''}
            onChange={e => {
              const g = groups.find(x => x.id === parseInt(e.target.value));
              if (g) onGroupChange(g);
            }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 12px',
              color: 'var(--text-primary)', fontSize: 13,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
              outline: 'none'
            }}
          >
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}

        {/* User Selector */}
        <select
          value={currentUser?.id || ''}
          onChange={e => {
            const val = e.target.value;
            if (!val) {
              onUserSelect(null);
            } else {
              const u = members.find(m => m.id === parseInt(val));
              if (u) onUserSelect(u);
            }
          }}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px',
            color: 'var(--text-primary)', fontSize: 13,
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
            outline: 'none',
            maxWidth: 140
          }}
        >
          <option value="">👤 Guest</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>🎭 {m.name}</option>
          ))}
        </select>

        <button className="btn btn-secondary btn-sm" onClick={onNewGroup}>
          + New Group
        </button>
      </div>
    </header>
  );
}