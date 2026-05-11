import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import ExpenseTimeline from './components/ExpenseTimeline';
import SettlementSuggestions from './components/SettlementSuggestions';
import SettlementHistory from './components/SettlementHistory';
import AddExpenseModal from './components/AddExpenseModal';
import GroupManager from './components/GroupManager';
import { fetchGroups, fetchExpenses, fetchBalances, fetchMembers, fetchSettlements } from './api/api';

export default function App() {
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balanceData, setBalanceData] = useState({ balances: [], simplified_debts: [] });
  const [members, setMembers] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [groupManagerMode, setGroupManagerMode] = useState('edit');
  const [activeTab, setActiveTab] = useState('timeline');
  const [refreshKey, setRefreshKey] = useState(0);

  // Load groups on mount
  useEffect(() => {
    loadGroups();
  }, []);

  // Load group data when currentGroup changes
  useEffect(() => {
    if (currentGroup) loadGroupData();
  }, [currentGroup, refreshKey]);

  async function loadGroups() {
    try {
      const data = await fetchGroups();
      setGroups(data);
      if (data.length > 0) setCurrentGroup(data[0]);
    } catch (e) {
      console.error('Failed to load groups', e);
    }
  }

  async function loadGroupData() {
    setLoading(true);
    try {
      const [exps, bal, mems, setts] = await Promise.all([
        fetchExpenses(currentGroup.id),
        fetchBalances(currentGroup.id),
        fetchMembers(currentGroup.id),
        fetchSettlements(currentGroup.id)
      ]);
      setExpenses(exps);
      setBalanceData(bal);
      setMembers(mems);
      setSettlements(setts);
    } catch (e) {
      console.error('Failed to load group data', e);
    } finally {
      setLoading(false);
    }
  }

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  function handleGroupRefresh() {
    loadGroups();
    if (currentGroup) refresh();
  }

  const tabs = [
    { key: 'timeline', label: '📋 Expenses' },
    { key: 'balances', label: '⚖ Balances' },
    { key: 'settlements', label: '🤝 History' }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header
        group={currentGroup}
        groups={groups}
        onGroupChange={g => { setCurrentGroup(g); }}
        onNewGroup={() => { setGroupManagerMode('create'); setShowGroupManager(true); }}
      />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        {!currentGroup ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💸</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Welcome to PocketSplit</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Smart expense splitting for roommates</p>
            <button className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 15 }}
              onClick={() => { setGroupManagerMode('create'); setShowGroupManager(true); }}>
              Create Your First Group
            </button>
          </div>
        ) : (
          <>
            {/* Group Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>{currentGroup.name}</h1>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {members.length} member{members.length !== 1 ? 's' : ''} •{' '}
                  {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { setGroupManagerMode('edit'); setShowGroupManager(true); }}>
                  ⚙ Manage
                </button>
                <button className="btn btn-primary btn-sm"
                  onClick={() => setShowAddExpense(true)}
                  disabled={members.length === 0}>
                  + Add Expense
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Loading...</div>
            ) : (
              <>
                <SummaryCards balances={balanceData.balances} expenses={expenses} />

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                  {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                      padding: '10px 18px', fontSize: 13, fontWeight: 600,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: activeTab === tab.key ? 'var(--accent-light)' : 'var(--text-secondary)',
                      borderBottom: `2px solid ${activeTab === tab.key ? 'var(--accent)' : 'transparent'}`,
                      transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                      marginBottom: -1
                    }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'timeline' && (
                  <ExpenseTimeline expenses={expenses} onRefresh={refresh} />
                )}

                {activeTab === 'balances' && (
                  <SettlementSuggestions
                    data={balanceData}
                    groupId={currentGroup.id}
                    onRefresh={refresh}
                  />
                )}

                {activeTab === 'settlements' && (
                  <SettlementHistory settlements={settlements} />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showAddExpense && currentGroup && (
        <AddExpenseModal
          groupId={currentGroup.id}
          members={members}
          onClose={() => setShowAddExpense(false)}
          onCreated={() => { setShowAddExpense(false); refresh(); }}
        />
      )}

      {showGroupManager && (
        <GroupManager
          group={groupManagerMode === 'edit' ? currentGroup : null}
          mode={groupManagerMode}
          onClose={() => setShowGroupManager(false)}
          onRefresh={handleGroupRefresh}
        />
      )}
    </div>
  );
}