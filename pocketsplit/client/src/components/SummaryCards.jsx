import React from 'react';
import { formatAmount } from '../utils';

export default function SummaryCards({ balances, expenses }) {
  const totalExpenses = expenses.reduce((sum, e) => sum + e.total_amount, 0);
  const pendingCount = expenses.reduce((cnt, e) =>
    cnt + (e.shares || []).filter(s => !s.is_paid).length, 0);

  const totalOwe = balances
    .filter(b => b.balance < 0)
    .reduce((sum, b) => sum + Math.abs(b.balance), 0);

  const totalReceive = balances
    .filter(b => b.balance > 0)
    .reduce((sum, b) => sum + b.balance, 0);

  const cards = [
    {
      label: 'Total Expenses',
      value: formatAmount(totalExpenses),
      icon: '💳',
      color: 'var(--accent-light)',
      bg: 'var(--accent-dim)'
    },
    {
      label: 'Total Owed',
      value: formatAmount(totalOwe),
      icon: '📤',
      color: 'var(--red)',
      bg: 'var(--red-dim)'
    },
    {
      label: 'To Receive',
      value: formatAmount(totalReceive),
      icon: '📥',
      color: 'var(--green)',
      bg: 'var(--green-dim)'
    },
    {
      label: 'Pending Payments',
      value: pendingCount,
      icon: '⏳',
      color: 'var(--orange)',
      bg: 'var(--orange-dim)'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 14,
      marginBottom: 24
    }}>
      {cards.map((card, i) => (
        <div key={i} className="card animate-in" style={{
          padding: '18px 20px',
          animationDelay: `${i * 0.06}s`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {card.label}
            </span>
            <span style={{
              width: 30, height: 30, borderRadius: 8,
              background: card.bg, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 14
            }}>{card.icon}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: card.color, fontFamily: 'var(--font-mono)' }}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
