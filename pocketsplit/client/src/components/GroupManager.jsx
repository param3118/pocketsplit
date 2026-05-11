import React, { useState, useEffect } from 'react';
import { fetchMembers, addMember, removeMember, createGroup, updateGroup, deleteGroup } from '../api/api';

export default function GroupManager({ group, mode, onClose, onRefresh }) {
  const [name, setName] = useState(group?.name || '');
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (group && mode !== 'create') loadMembers();
  }, [group]);

  async function loadMembers() {
    try {
      const data = await fetchMembers(group.id);
      setMembers(data);
    } catch {}
  }

  async function handleSaveName() {
    if (!name.trim()) return setError('Group name is required');
    setLoading(true); setError('');
    try {
      if (mode === 'create') {
        await createGroup({ name: name.trim() });
        onRefresh(); onClose();
      } else {
        await updateGroup(group.id, { name: name.trim() });
        setSuccess('Group name updated!');
        onRefresh();
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember() {
    if (!newMember.trim()) return;
    setError('');
    try {
      await addMember({ group_id: group?.id, name: newMember.trim() });
      setNewMember('');
      setSuccess(`${newMember} added!`);
      await loadMembers();
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to add member');
    }
  }

  async function handleRemoveMember(uid, uname) {
    if (!window.confirm(`Remove ${uname} from the group?`)) return;
    setError('');
    try {
      await removeMember(group.id, uid);
      await loadMembers();
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to remove member');
    }
  }

  async function handleDeleteGroup() {
    if (!window.confirm(`Delete group "${group.name}"? All expenses will be soft-deleted.`)) return;
    try {
      await deleteGroup(group.id);
      onRefresh(); onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete group');
    }
  }

  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-in" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            {mode === 'create' ? '✦ Create Group' : `⚙ Manage: ${group?.name}`}
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--red-dim)', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--green-dim)', color: 'var(--green)', fontSize: 13, marginBottom: 16 }}>
            ✓ {success}
          </div>
        )}

        {/* Group Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Group Name</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Flat 4B Squad" onKeyDown={e => e.key === 'Enter' && handleSaveName()} />
            <button className="btn btn-primary" onClick={handleSaveName} disabled={loading}>
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </div>

        {/* Members (only when editing) */}
        {mode !== 'create' && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Members ({members.length})</label>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input className="input" placeholder="Member name..." value={newMember}
                onChange={e => setNewMember(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMember()} />
              <button className="btn btn-primary" onClick={handleAddMember}>+ Add</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: 'var(--accent-dim)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent-light)'
                    }}>{m.name[0]}</div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                  </div>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => handleRemoveMember(m.id, m.name)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete Group */}
        {mode !== 'create' && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button className="btn btn-danger" onClick={handleDeleteGroup} style={{ width: '100%', justifyContent: 'center' }}>
              🗑 Delete Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}