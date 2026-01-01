import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// ============================================
// Types
// ============================================

interface Group {
  id: number;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  member_count?: number;
  your_balance?: number;
}

interface GroupMember {
  id: number;
  group_id: number;
  user_id: string;
  user_email: string;
  nickname: string | null;
  joined_at: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
}

interface Expense {
  id: number;
  group_id: number;
  description: string;
  amount: number;
  currency: string;
  category_id: number;
  category_name?: string;
  category_icon?: string;
  paid_by: string;
  paid_by_email?: string;
  split_type: string;
  created_by: string;
  created_at: string;
  splits?: ExpenseSplit[];
}

interface ExpenseSplit {
  user_id: string;
  user_email: string;
  amount: number;
}

interface Settlement {
  id: number;
  group_id: number;
  from_user: string;
  from_email?: string;
  to_user: string;
  to_email?: string;
  amount: number;
  currency: string;
  note: string | null;
  created_at: string;
}

interface Balance {
  user_id: string;
  user_email: string;
  balance: number; // Positive = owed money, negative = owes money
}

interface Debt {
  from_user: string;
  from_email: string;
  to_user: string;
  to_email: string;
  amount: number;
}

// ============================================
// Helper Functions
// ============================================

function getDisplayName(email: string): string {
  return email.split('@')[0];
}

async function isGroupMember(db: D1Database, groupId: number, userId: string): Promise<boolean> {
  const member = await db.prepare(
    'SELECT id FROM sw_group_members WHERE group_id = ? AND user_id = ?'
  ).bind(groupId, userId).first();
  return !!member;
}

async function logActivity(
  db: D1Database,
  groupId: number,
  userId: string,
  action: string,
  targetType?: string,
  targetId?: number,
  details?: object
) {
  await db.prepare(`
    INSERT INTO sw_activity (group_id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(groupId, userId, action, targetType || null, targetId || null, details ? JSON.stringify(details) : null).run();
}

// Simplify debts using a greedy algorithm
function simplifyDebts(balances: Map<string, number>, emails: Map<string, string>): Debt[] {
  const debts: Debt[] = [];
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  // Separate into creditors and debtors
  balances.forEach((balance, userId) => {
    if (balance > 0.01) {
      creditors.push({ userId, amount: balance });
    } else if (balance < -0.01) {
      debtors.push({ userId, amount: -balance });
    }
  });

  // Sort by amount (descending)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Match debtors to creditors
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      debts.push({
        from_user: debtor.userId,
        from_email: emails.get(debtor.userId) || '',
        to_user: creditor.userId,
        to_email: emails.get(creditor.userId) || '',
        amount: Math.round(amount * 100) / 100
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return debts;
}

// ============================================
// Categories
// ============================================

app.get('/api/categories', async (c) => {
  const db = c.env.DB;
  const result = await db.prepare('SELECT * FROM sw_categories ORDER BY id').all<Category>();
  return c.json({ categories: result.results });
});

// ============================================
// Groups
// ============================================

// List user's groups
app.get('/api/groups', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');

  const result = await db.prepare(`
    SELECT g.*,
           (SELECT COUNT(*) FROM sw_group_members WHERE group_id = g.id) as member_count
    FROM sw_groups g
    JOIN sw_group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY g.updated_at DESC
  `).bind(user.id).all<Group>();

  return c.json({ groups: result.results });
});

// Get single group
app.get('/api/groups/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const group = await db.prepare('SELECT * FROM sw_groups WHERE id = ?').bind(groupId).first<Group>();
  if (!group) {
    return c.json({ error: 'Group not found' }, 404);
  }

  const members = await db.prepare(`
    SELECT * FROM sw_group_members WHERE group_id = ? ORDER BY joined_at
  `).bind(groupId).all<GroupMember>();

  return c.json({ group, members: members.results });
});

// Create group
app.post('/api/groups', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { name, description } = await c.req.json<{ name: string; description?: string }>();

  if (!name || name.trim().length === 0) {
    return c.json({ error: 'Name is required' }, 400);
  }

  // Create group
  const result = await db.prepare(`
    INSERT INTO sw_groups (name, description, created_by)
    VALUES (?, ?, ?)
    RETURNING *
  `).bind(name.trim(), description?.trim() || null, user.id).first<Group>();

  // Add creator as member
  await db.prepare(`
    INSERT INTO sw_group_members (group_id, user_id, user_email)
    VALUES (?, ?, ?)
  `).bind(result!.id, user.id, user.email).run();

  await logActivity(db, result!.id, user.id, 'group_created');

  return c.json({ group: result });
});

// Update group
app.put('/api/groups/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));
  const { name, description } = await c.req.json<{ name?: string; description?: string }>();

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const result = await db.prepare(`
    UPDATE sw_groups
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `).bind(name?.trim() || null, description?.trim() || null, groupId).first<Group>();

  return c.json({ group: result });
});

// Add member to group
app.post('/api/groups/:id/members', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));
  const { email, nickname } = await c.req.json<{ email: string; nickname?: string }>();

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  if (!email || !email.includes('@')) {
    return c.json({ error: 'Valid email is required' }, 400);
  }

  // Check if user exists, if not create them
  let targetUser = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first<{ id: string }>();

  if (!targetUser) {
    // Create a placeholder user (they'll get a real ID when they log in)
    const placeholderId = `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(placeholderId, email.toLowerCase()).run();
    targetUser = { id: placeholderId };
  }

  // Check if already a member
  const existing = await db.prepare(
    'SELECT id FROM sw_group_members WHERE group_id = ? AND user_email = ?'
  ).bind(groupId, email.toLowerCase()).first();

  if (existing) {
    return c.json({ error: 'User is already a member' }, 400);
  }

  const member = await db.prepare(`
    INSERT INTO sw_group_members (group_id, user_id, user_email, nickname)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `).bind(groupId, targetUser.id, email.toLowerCase(), nickname?.trim() || null).first<GroupMember>();

  await logActivity(db, groupId, user.id, 'member_added', 'member', member!.id, { email });

  return c.json({ member });
});

// Remove member from group
app.delete('/api/groups/:id/members/:memberId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));
  const memberId = parseInt(c.req.param('memberId'));

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const member = await db.prepare('SELECT * FROM sw_group_members WHERE id = ? AND group_id = ?').bind(memberId, groupId).first<GroupMember>();
  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  await db.prepare('DELETE FROM sw_group_members WHERE id = ?').bind(memberId).run();
  await logActivity(db, groupId, user.id, 'member_removed', 'member', memberId, { email: member.user_email });

  return c.json({ success: true });
});

// ============================================
// Expenses
// ============================================

// List expenses for a group
app.get('/api/groups/:id/expenses', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const expenses = await db.prepare(`
    SELECT e.*, c.name as category_name, c.icon as category_icon,
           u.email as paid_by_email
    FROM sw_expenses e
    JOIN sw_categories c ON e.category_id = c.id
    JOIN users u ON e.paid_by = u.id
    WHERE e.group_id = ? AND e.deleted_at IS NULL
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(groupId, limit, offset).all<Expense>();

  return c.json({ expenses: expenses.results });
});

// Get single expense with splits
app.get('/api/expenses/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const expenseId = parseInt(c.req.param('id'));

  const expense = await db.prepare(`
    SELECT e.*, c.name as category_name, c.icon as category_icon,
           u.email as paid_by_email
    FROM sw_expenses e
    JOIN sw_categories c ON e.category_id = c.id
    JOIN users u ON e.paid_by = u.id
    WHERE e.id = ? AND e.deleted_at IS NULL
  `).bind(expenseId).first<Expense>();

  if (!expense) {
    return c.json({ error: 'Expense not found' }, 404);
  }

  if (!await isGroupMember(db, expense.group_id, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const splits = await db.prepare(`
    SELECT es.user_id, es.amount, u.email as user_email
    FROM sw_expense_splits es
    JOIN users u ON es.user_id = u.id
    WHERE es.expense_id = ?
  `).bind(expenseId).all<ExpenseSplit>();

  expense.splits = splits.results;

  return c.json({ expense });
});

// Create expense
app.post('/api/groups/:id/expenses', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const body = await c.req.json<{
    description: string;
    amount: number;
    category_id?: number;
    paid_by?: string;
    split_type?: 'equal' | 'exact' | 'percentage';
    splits?: { user_id: string; amount: number }[];
  }>();

  if (!body.description || body.description.trim().length === 0) {
    return c.json({ error: 'Description is required' }, 400);
  }

  if (!body.amount || body.amount <= 0) {
    return c.json({ error: 'Amount must be positive' }, 400);
  }

  const paidBy = body.paid_by || user.id;
  const splitType = body.split_type || 'equal';
  const categoryId = body.category_id || 1;

  // Create expense
  const expense = await db.prepare(`
    INSERT INTO sw_expenses (group_id, description, amount, category_id, paid_by, split_type, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(groupId, body.description.trim(), body.amount, categoryId, paidBy, splitType, user.id).first<Expense>();

  // Create splits
  if (splitType === 'equal') {
    // Get all members
    const members = await db.prepare(
      'SELECT user_id FROM sw_group_members WHERE group_id = ?'
    ).bind(groupId).all<{ user_id: string }>();

    const splitAmount = Math.round((body.amount / members.results.length) * 100) / 100;

    for (const member of members.results) {
      await db.prepare(`
        INSERT INTO sw_expense_splits (expense_id, user_id, amount)
        VALUES (?, ?, ?)
      `).bind(expense!.id, member.user_id, splitAmount).run();
    }
  } else if (body.splits) {
    // Use provided splits
    for (const split of body.splits) {
      await db.prepare(`
        INSERT INTO sw_expense_splits (expense_id, user_id, amount)
        VALUES (?, ?, ?)
      `).bind(expense!.id, split.user_id, split.amount).run();
    }
  }

  await db.prepare(`UPDATE sw_groups SET updated_at = datetime('now') WHERE id = ?`).bind(groupId).run();
  await logActivity(db, groupId, user.id, 'expense_added', 'expense', expense!.id, {
    description: body.description,
    amount: body.amount
  });

  return c.json({ expense });
});

// Update expense
app.put('/api/expenses/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const expenseId = parseInt(c.req.param('id'));

  const existing = await db.prepare('SELECT * FROM sw_expenses WHERE id = ? AND deleted_at IS NULL').bind(expenseId).first<Expense>();
  if (!existing) {
    return c.json({ error: 'Expense not found' }, 404);
  }

  if (!await isGroupMember(db, existing.group_id, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const body = await c.req.json<{
    description?: string;
    amount?: number;
    category_id?: number;
    paid_by?: string;
    split_type?: string;
    splits?: { user_id: string; amount: number }[];
  }>();

  const expense = await db.prepare(`
    UPDATE sw_expenses
    SET description = COALESCE(?, description),
        amount = COALESCE(?, amount),
        category_id = COALESCE(?, category_id),
        paid_by = COALESCE(?, paid_by),
        split_type = COALESCE(?, split_type),
        updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `).bind(
    body.description?.trim() || null,
    body.amount || null,
    body.category_id || null,
    body.paid_by || null,
    body.split_type || null,
    expenseId
  ).first<Expense>();

  // Update splits if provided
  if (body.splits) {
    await db.prepare('DELETE FROM sw_expense_splits WHERE expense_id = ?').bind(expenseId).run();
    for (const split of body.splits) {
      await db.prepare(`
        INSERT INTO sw_expense_splits (expense_id, user_id, amount)
        VALUES (?, ?, ?)
      `).bind(expenseId, split.user_id, split.amount).run();
    }
  }

  await logActivity(db, existing.group_id, user.id, 'expense_updated', 'expense', expenseId);

  return c.json({ expense });
});

// Delete expense (soft delete)
app.delete('/api/expenses/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const expenseId = parseInt(c.req.param('id'));

  const existing = await db.prepare('SELECT * FROM sw_expenses WHERE id = ? AND deleted_at IS NULL').bind(expenseId).first<Expense>();
  if (!existing) {
    return c.json({ error: 'Expense not found' }, 404);
  }

  if (!await isGroupMember(db, existing.group_id, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  await db.prepare(`UPDATE sw_expenses SET deleted_at = datetime('now') WHERE id = ?`).bind(expenseId).run();
  await logActivity(db, existing.group_id, user.id, 'expense_deleted', 'expense', expenseId, {
    description: existing.description
  });

  return c.json({ success: true });
});

// ============================================
// Balances
// ============================================

// Get balances for a group
app.get('/api/groups/:id/balances', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  // Get all members
  const members = await db.prepare(`
    SELECT user_id, user_email FROM sw_group_members WHERE group_id = ?
  `).bind(groupId).all<{ user_id: string; user_email: string }>();

  const balances = new Map<string, number>();
  const emails = new Map<string, string>();

  for (const member of members.results) {
    balances.set(member.user_id, 0);
    emails.set(member.user_id, member.user_email);
  }

  // Calculate from expenses
  const expenses = await db.prepare(`
    SELECT e.id, e.amount, e.paid_by
    FROM sw_expenses e
    WHERE e.group_id = ? AND e.deleted_at IS NULL
  `).bind(groupId).all<{ id: number; amount: number; paid_by: string }>();

  for (const expense of expenses.results) {
    // Person who paid is owed money
    balances.set(expense.paid_by, (balances.get(expense.paid_by) || 0) + expense.amount);

    // Get splits for this expense
    const splits = await db.prepare(`
      SELECT user_id, amount FROM sw_expense_splits WHERE expense_id = ?
    `).bind(expense.id).all<{ user_id: string; amount: number }>();

    for (const split of splits.results) {
      // Each person who owes reduces their balance
      balances.set(split.user_id, (balances.get(split.user_id) || 0) - split.amount);
    }
  }

  // Account for settlements
  const settlements = await db.prepare(`
    SELECT from_user, to_user, amount FROM sw_settlements
    WHERE group_id = ? AND deleted_at IS NULL
  `).bind(groupId).all<{ from_user: string; to_user: string; amount: number }>();

  for (const settlement of settlements.results) {
    // from_user paid to_user, so from_user's balance goes up, to_user's goes down
    balances.set(settlement.from_user, (balances.get(settlement.from_user) || 0) + settlement.amount);
    balances.set(settlement.to_user, (balances.get(settlement.to_user) || 0) - settlement.amount);
  }

  // Format balances
  const balanceList: Balance[] = [];
  balances.forEach((balance, userId) => {
    balanceList.push({
      user_id: userId,
      user_email: emails.get(userId) || '',
      balance: Math.round(balance * 100) / 100
    });
  });

  // Calculate simplified debts
  const debts = simplifyDebts(balances, emails);

  return c.json({ balances: balanceList, debts });
});

// ============================================
// Settlements
// ============================================

// List settlements for a group
app.get('/api/groups/:id/settlements', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const settlements = await db.prepare(`
    SELECT s.*,
           u1.email as from_email,
           u2.email as to_email
    FROM sw_settlements s
    JOIN users u1 ON s.from_user = u1.id
    JOIN users u2 ON s.to_user = u2.id
    WHERE s.group_id = ? AND s.deleted_at IS NULL
    ORDER BY s.created_at DESC
  `).bind(groupId).all<Settlement>();

  return c.json({ settlements: settlements.results });
});

// Create settlement
app.post('/api/groups/:id/settlements', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const { from_user, to_user, amount, note } = await c.req.json<{
    from_user: string;
    to_user: string;
    amount: number;
    note?: string;
  }>();

  if (!from_user || !to_user || !amount || amount <= 0) {
    return c.json({ error: 'from_user, to_user, and positive amount are required' }, 400);
  }

  const settlement = await db.prepare(`
    INSERT INTO sw_settlements (group_id, from_user, to_user, amount, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(groupId, from_user, to_user, amount, note?.trim() || null, user.id).first<Settlement>();

  await db.prepare(`UPDATE sw_groups SET updated_at = datetime('now') WHERE id = ?`).bind(groupId).run();
  await logActivity(db, groupId, user.id, 'settlement_added', 'settlement', settlement!.id, { amount });

  return c.json({ settlement });
});

// Delete settlement
app.delete('/api/settlements/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const settlementId = parseInt(c.req.param('id'));

  const existing = await db.prepare('SELECT * FROM sw_settlements WHERE id = ? AND deleted_at IS NULL').bind(settlementId).first<Settlement>();
  if (!existing) {
    return c.json({ error: 'Settlement not found' }, 404);
  }

  if (!await isGroupMember(db, existing.group_id, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  await db.prepare(`UPDATE sw_settlements SET deleted_at = datetime('now') WHERE id = ?`).bind(settlementId).run();
  await logActivity(db, existing.group_id, user.id, 'settlement_deleted', 'settlement', settlementId);

  return c.json({ success: true });
});

// ============================================
// Activity
// ============================================

app.get('/api/groups/:id/activity', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const groupId = parseInt(c.req.param('id'));
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

  if (!await isGroupMember(db, groupId, user.id)) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const activity = await db.prepare(`
    SELECT a.*, u.email as user_email
    FROM sw_activity a
    JOIN users u ON a.user_id = u.id
    WHERE a.group_id = ?
    ORDER BY a.created_at DESC
    LIMIT ?
  `).bind(groupId, limit).all();

  return c.json({ activity: activity.results });
});

export default app;
