const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { checkGroupAccess } = require('../middleware/auth');

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
router.post('/groups/:id/verify', asyncHandler(checkGroupAccess), asyncHandler(groupCtrl.verifyPasskey));

// Members (secured)
router.get('/members/:groupId', asyncHandler(checkGroupAccess), asyncHandler(memberCtrl.getMembers));
router.post('/members', asyncHandler(checkGroupAccess), asyncHandler(memberCtrl.addMember));
router.delete('/members/:groupId/:userId', asyncHandler(checkGroupAccess), asyncHandler(memberCtrl.removeMember));

// Expenses (secured)
router.get('/expenses/:groupId', asyncHandler(checkGroupAccess), asyncHandler(expenseCtrl.getExpenses));
router.get('/expense/detail/:id', asyncHandler(checkGroupAccess), asyncHandler(expenseCtrl.getExpenseDetail));
router.post('/expenses', asyncHandler(checkGroupAccess), asyncHandler(expenseCtrl.createExpense));
router.put('/expenses/:id', asyncHandler(checkGroupAccess), asyncHandler(expenseCtrl.updateExpense));
router.delete('/expenses/:id', asyncHandler(checkGroupAccess), asyncHandler(expenseCtrl.deleteExpense));
router.post('/expenses/:id/mark-sent', asyncHandler(checkGroupAccess), asyncHandler(expenseCtrl.markSent));
router.post('/expenses/:id/mark-paid', asyncHandler(checkGroupAccess), asyncHandler(expenseCtrl.markPaid));

// Balances & Debt Simplification (secured)
router.get('/balances/:groupId', asyncHandler(checkGroupAccess), asyncHandler(balanceCtrl.getBalances));

// Settlements (secured)
router.post('/settlements', asyncHandler(checkGroupAccess), asyncHandler(balanceCtrl.createSettlement));
router.get('/settlements/:groupId', asyncHandler(checkGroupAccess), asyncHandler(balanceCtrl.getSettlements));

module.exports = router;