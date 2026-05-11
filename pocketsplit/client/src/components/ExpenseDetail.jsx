import React, { useState, useEffect } from 'react';
import { fetchExpenseDetail, markPaid, updateExpense } from '../api/api';
import { formatAmount, formatDate, toPaise, formatDateKey } from '../utils';

export default function ExpenseDetail({ expenseId, onClose, onUpdated }) {
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', amount: '', note: '', date: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [expenseId]);

  async function loadDetail() {
    setLoading(true);
    try {
      const data = await fetchExpenseDetail(expenseId);
      setExpense(data);
    } catch (e) {
      setError('Failed to load expense details');
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setEditForm({
      title: expense.title,
      amount: (expense.total_amount / 100).toString(),
      note: expense.note || '',
      date: formatDateKey(expense.created_at)
    });
    setIsEditing(true);
  }

  async function handleUpdate() {
    setSaving(true);
    setError('');
    const totalPaise = toPaise(editForm.amount);
    if (!totalPaise) return setError('Invalid amount');

    try {
      await updateExpense(expenseId, {
        title: editForm.title,
        total_amount: totalPaise,
        note: editForm.note,
        date: editForm.date,
        paid_by: expense.paid_by,
        split_type: expense.split_type,
        participants: expense.shares.map(s => s.user_id),
        shares: expense.shares.map(s => ({ user_id: s.user_id, share_amount: s.share_amount })) // Simplified
      });
      setIsEditing(false);
      await loadDetail();
      onUpdated();
    } catch (e) {
      setError(e.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(userId) {
    setMarkingPaid(userId);
    setError('');
    try {
      await markPaid(expenseId, userId);
      await loadDetail();
      onUpdated();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to mark as paid');
    } finally {
      setMarkingPaid(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Expense Details</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {!loading && expense && (
              <button className="btn btn-secondary btn-sm" onClick={() => isEditing ? setIsEditing(false) : startEditing()}>
                {isEditing ? 'Cancel' : '✎ Edit'}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading...</div>
        ) : !expense ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--red)' }}>Expense not found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header info */}
            <div style={{
              padding: '16px', borderRadius: 10,
              background: 'var(--bg)', border: '1px solid var(--border)'
            }}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Title</label>
                    <input className="input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Amount (₹)</label>
                      <input className="input" type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Date</label>
                      <input className="input" type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Note</label>
                    <input className="input" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} />
                  </div>
                  <button className="btn btn-primary" onClick={handleUpdate} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{expense.title}</div>
                      <span className="txn-chip">{expense.transaction_id}</span>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700,
                      color: 'var(--accent-light)'
                    }}>
                      {formatAmount(expense.total_amount)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
                    <span>Paid by <strong style={{ color: 'var(--text-primary)' }}>{expense.paid_by_name}</strong></span>
                    <span>Split: <strong style={{ color: 'var(--text-primary)' }}>{expense.split_type === 'equal' ? '⚖ Equal' : '✂ Custom'}</strong></span>
                    <span>{formatDate(expense.created_at)}</span>
                  </div>
                  {expense.note && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      📝 {expense.note}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Shares breakdown */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10
              }}>
                Share Breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(expense.shares || []).map(share => {
                  const isPaid = share.is_paid === 1 || share.is_paid === true;
                  return (
                    <div key={share.user_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 8,
                      background: isPaid ? 'var(--green-dim)' : 'var(--bg)',
                      border: `1px solid ${isPaid ? 'rgba(34,197,94,0.15)' : 'var(--border)'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: isPaid ? 'rgba(34,197,94,0.2)' : 'var(--accent-dim)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                          color: isPaid ? 'var(--green)' : 'var(--accent-light)'
                        }}>
                          {share.name?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{share.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {isPaid ? `✓ Paid${share.paid_at ? ' • ' + formatDate(share.paid_at) : ''}` : '○ Pending'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                          color: isPaid ? 'var(--green)' : 'var(--text-primary)'
                        }}>
                          {formatAmount(share.share_amount)}
                        </span>
                        {!isPaid && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleMarkPaid(share.user_id)}
                            disabled={markingPaid === share.user_id}
                            style={{ padding: '4px 10px', fontSize: 11 }}
                          >
                            {markingPaid === share.user_id ? '...' : '✓ Mark Paid'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--red-dim)', color: 'var(--red)', fontSize: 13
              }}>
                ⚠ {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
