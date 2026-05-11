import React from 'react';
import { formatAmount, formatDate } from '../utils';

export default function SettlementHistory({ settlements }) {
  if (!settlements || settlements.length === 0) return null;

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Settlement History
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {settlements.map(s => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', borderRadius: 8,
            background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="txn-chip">{s.transaction_id}</span>
              <span style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{s.payer_name}</span>
                <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>paid</span>
                <span style={{ fontWeight: 700 }}>{s.receiver_name}</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)' }}>
                {formatAmount(s.amount)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(s.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}