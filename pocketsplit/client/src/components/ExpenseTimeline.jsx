import React, { useState } from 'react';
import { formatAmount, formatDateDisplay, formatDateKey, groupByDate } from '../utils';
import { deleteExpense } from '../api/api';
import ExpenseDetail from './ExpenseDetail';

export default function ExpenseTimeline({ expenses, onRefresh, currentUser }) {
  const [expandedDays, setExpandedDays] = useState(new Set());

  const [selectedExpense, setSelectedExpense] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Auto-expand the first day on initial load
  React.useEffect(() => {
    if (expenses.length > 0 && expandedDays.size === 0) {
      setExpandedDays(new Set([formatDateKey(expenses[0].created_at)]));
    }
  }, [expenses, expandedDays.size]);

  const grouped = groupByDate(expenses);
  const days = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  function toggleDay(key) {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!window.confirm('Delete this expense? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteExpense(id);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  }

  function getStatusBadge(status) {
    if (status === 'paid') return <span className="badge badge-green">✓ Paid</span>;
    if (status === 'partial') return <span className="badge badge-orange">◑ Partial</span>;
    return <span className="badge badge-red">○ Pending</span>;
  }

  if (expenses.length === 0) {
    return (
      <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No expenses yet</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Add your first expense to get started</div>
      </div>
    );
  }

  return (
    <div>
      {days.map(day => {
        const dayExpenses = grouped[day];
        const isExpanded = expandedDays.has(day);
        const dayTotal = dayExpenses.reduce((s, e) => s + e.total_amount, 0);

        return (
          <div key={day} style={{ marginBottom: 8 }}>
            {/* Day Header */}
            <button
              onClick={() => toggleDay(day)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderRadius: 10,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.15s',
                color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{isExpanded ? '▾' : '▸'}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDateDisplay(day)}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {dayExpenses.length} expense{dayExpenses.length !== 1 ? 's' : ''} — {dayExpenses.map(e => e.title).join(', ').substring(0, 50)}...
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent-light)' }}>
                {formatAmount(dayTotal)}
              </span>
            </button>

            {/* Day Expenses Table */}
            {isExpanded && (
              <div className="card animate-in" style={{ marginTop: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Expense', 'Paid By', 'Split', 'Amount', 'Status', 'Txn ID', ''].map((h, i) => (
                        <th key={i} style={{
                          padding: '10px 14px', textAlign: 'left', fontSize: 11,
                          fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em'
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayExpenses.map((exp, i) => (
                      <tr
                        key={exp.id}
                        onClick={() => setSelectedExpense(exp.id)}
                        style={{
                          borderBottom: i < dayExpenses.length - 1 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer', transition: 'background 0.12s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>{exp.title}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{exp.paid_by_name}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span className={`badge badge-${exp.split_type === 'equal' ? 'blue' : 'gray'}`}>
                            {exp.split_type === 'equal' ? '⚖ Equal' : '✂ Custom'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                          {formatAmount(exp.total_amount)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>{getStatusBadge(exp.status)}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span className="txn-chip">{exp.transaction_id}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }} onClick={ev => ev.stopPropagation()}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={ev => handleDelete(ev, exp.id)}
                            disabled={deletingId === exp.id}
                            style={{ padding: '4px 10px', fontSize: 11 }}
                          >
                            {deletingId === exp.id ? '...' : '🗑'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {selectedExpense && (
        <ExpenseDetail
          expenseId={selectedExpense}
          currentUser={currentUser}
          onClose={() => setSelectedExpense(null)}
          onUpdated={() => { onRefresh(); }}
        />
      )}
    </div>
  );
}