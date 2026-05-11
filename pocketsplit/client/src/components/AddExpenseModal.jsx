import React, { useState } from 'react';
import { createExpense } from '../api/api';
import { toPaise, formatDateKey } from '../utils';

export default function AddExpenseModal({ groupId, members, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    amount: '',
    paid_by: members[0]?.id || '',
    split_type: 'equal',
    note: '',
    date: formatDateKey(new Date()),
    participants: members.map(m => m.id),
    customShares: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function toggleParticipant(uid) {
    setForm(prev => {
      const p = prev.participants;
      return {
        ...prev,
        participants: p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]
      };
    });
  }

  function setCustomShare(uid, val) {
    setForm(prev => ({ ...prev, customShares: { ...prev.customShares, [uid]: val } }));
  }

  async function handleSubmit() {
    setError('');
    const totalPaise = toPaise(form.amount);
    if (!totalPaise) return setError('Enter a valid amount (e.g. 500 or 99.50)');
    if (!form.title.trim()) return setError('Title is required');
    if (form.participants.length === 0) return setError('Select at least one participant');

    let shares = undefined;
    if (form.split_type === 'unequal') {
      shares = form.participants.map(uid => ({
        user_id: uid,
        share_amount: toPaise(form.customShares[uid] || '0') || 0
      }));
      const sum = shares.reduce((s, x) => s + x.share_amount, 0);
      if (sum !== totalPaise) {
        return setError(`Custom shares sum (₹${(sum/100).toFixed(2)}) must equal total (₹${(totalPaise/100).toFixed(2)})`);
      }
    }

    setLoading(true);
    try {
      await createExpense({
        group_id: groupId,
        title: form.title.trim(),
        total_amount: totalPaise,
        paid_by: parseInt(form.paid_by),
        split_type: form.split_type,
        note: form.note || undefined,
        participants: form.participants.map(Number),
        shares,
        date: form.date
      });
      onCreated();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  }

  const totalPaise = toPaise(form.amount) || 0;
  const equalShare = form.participants.length > 0
    ? Math.floor(totalPaise / form.participants.length)
    : 0;

  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-in" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add Expense</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input className="input" placeholder="e.g. Pizza Night, Electricity Bill..." value={form.title}
              onChange={e => setField('title', e.target.value)} />
          </div>

          {/* Amount + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Amount (₹) *</label>
              <input className="input" type="number" placeholder="0.00" step="0.01" min="0.01"
                value={form.amount} onChange={e => setField('amount', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Date *</label>
              <input className="input" type="date" value={form.date}
                onChange={e => setField('date', e.target.value)} />
            </div>
          </div>

          {/* Paid By */}
          <div>
            <label style={labelStyle}>Paid By *</label>
            <select className="input" value={form.paid_by} onChange={e => setField('paid_by', e.target.value)}>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Split Type */}
          <div>
            <label style={labelStyle}>Split Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['equal', 'unequal'].map(t => (
                <button key={t} className={`btn ${form.split_type === t ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setField('split_type', t)} style={{ flex: 1 }}>
                  {t === 'equal' ? '⚖ Equal Split' : '✂ Custom Split'}
                </button>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div>
            <label style={labelStyle}>Participants</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map(m => {
                const isSelected = form.participants.includes(m.id);
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 8,
                    background: isSelected ? 'var(--accent-dim)' : 'var(--bg)',
                    border: `1px solid ${isSelected ? 'rgba(108,99,255,0.3)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.15s'
                  }} onClick={() => toggleParticipant(m.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4,
                        background: isSelected ? 'var(--accent)' : 'var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: '#fff'
                      }}>{isSelected ? '✓' : ''}</div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                    </div>

                    {form.split_type === 'unequal' && isSelected && (
                      <div onClick={e => e.stopPropagation()}>
                        <input
                          className="input"
                          type="number" placeholder="0.00" step="0.01"
                          value={form.customShares[m.id] || ''}
                          onChange={e => setCustomShare(m.id, e.target.value)}
                          style={{ width: 100, padding: '5px 10px' }}
                        />
                      </div>
                    )}

                    {form.split_type === 'equal' && isSelected && equalShare > 0 && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-light)' }}>
                        ₹{(equalShare / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <label style={labelStyle}>Note (optional)</label>
            <input className="input" placeholder="Add a note..." value={form.note}
              onChange={e => setField('note', e.target.value)} />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--red-dim)', color: 'var(--red)', fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            {loading ? 'Adding...' : '+ Add Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}