const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');

const groupCtrl = require('../controllers/groupController');
const memberCtrl = require('../controllers/memberController');
const expenseCtrl = require('../controllers/expenseController');
const balanceCtrl = require('../controllers/balanceController');

// Groups
router.get('/groups', asyncHandler(groupCtrl.getAllGroups));
router.get('/groups/:id', asyncHandler(groupCtrl.getGroup));
router.post('/groups', asyncHandler(groupCtrl.createGroup));
router.put('/groups/:id', asyncHandler(groupCtrl.updateGroup));
router.delete('/groups/:id', asyncHandler(groupCtrl.deleteGroup));

// Members
router.get('/members/:groupId', asyncHandler(memberCtrl.getMembers));
router.post('/members', asyncHandler(memberCtrl.addMember));
router.delete('/members/:groupId/:userId', asyncHandler(memberCtrl.removeMember));

// Expenses
router.get('/expenses/:groupId', asyncHandler(expenseCtrl.getExpenses));
router.get('/expense/detail/:id', asyncHandler(expenseCtrl.getExpenseDetail));
router.post('/expenses', asyncHandler(expenseCtrl.createExpense));
router.put('/expenses/:id', asyncHandler(expenseCtrl.updateExpense));
router.delete('/expenses/:id', asyncHandler(expenseCtrl.deleteExpense));
router.post('/expenses/:id/mark-paid', asyncHandler(expenseCtrl.markPaid));

// Balances & Debt Simplification
router.get('/balances/:groupId', asyncHandler(balanceCtrl.getBalances));

// Settlements
router.post('/settlements', asyncHandler(balanceCtrl.createSettlement));
router.get('/settlements/:groupId', asyncHandler(balanceCtrl.getSettlements));

module.exports = router;