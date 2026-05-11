import React, { useState } from 'react';
import { formatAmount } from '../utils';
import { createSettlement } from '../api/api';

export default function SettlementSuggestions({ data, groupId, onRefresh }) {
  const { balances = [], simplified_debts = [] } = data || {};
  const [settling, setSettling] = useState(null);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  async function handleSettle(debt) {
    setSettling(`${debt.from.id}-${debt.to.id}`);
    setError('');
    try {
      await createSettlement({
        group_id: groupId,
        payer_id: debt.from.id,
        receiver_id: debt.to.id,
        amount: debt.amount,
        note: `Settled via suggestion`
      });
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create settlement');
    } finally {
      setSettling(null);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {/* Net Balances */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Net Balances
        </div>
        {balances.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No members yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {balances.map(b => {
              const positive = b.balance > 0;
              const zero = b.balance === 0;
              return (
                <div key={b.userId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 8,
                  background: zero ? 'transparent' : positive ? 'var(--green-dim)' : 'var(--red-dim)',
                  border: `1px solid ${zero ? 'var(--border)' : positive ? 'rgba(34,197,94,0.15)' : 'rgba(244,63,94,0.15)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)'
                    }}>{b.name?.[0]}</div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                      color: zero ? 'var(--text-secondary)' : positive ? 'var(--green)' : 'var(--red)'
                    }}>
                      {zero ? '✓ Settled' : `${positive ? '+' : '-'}${formatAmount(Math.abs(b.balance))}`}
                    </div>
                    {!zero && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {positive ? 'should receive' : 'owes'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Simplified Debts */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Suggested Settlements
          </div>
          {simplified_debts.length > 0 && (
            <span className="badge badge-blue">{simplified_debts.length} transaction{simplified_debts.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {simplified_debts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>All settled up!</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>No pending debts in this group</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {simplified_debts.map((debt, i) => {
              const key = `${debt.from.id}-${debt.to.id}`;
              return (
                <div key={i} className="card" style={{
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{debt.from.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span style={{ fontWeight: 700 }}>{debt.to.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--orange)' }}>
                      {formatAmount(debt.amount)}
                    </span>
                  </div>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleSettle(debt)}
                    disabled={settling === key}
                    style={{ flexShrink: 0 }}
                  >
                    {settling === key ? '...' : '✓ Settle'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'var(--red-dim)', color: 'var(--red)', fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}