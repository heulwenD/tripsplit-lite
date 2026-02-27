const STORAGE_KEY = "tripsplit_lite_state_v1";

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function defaultState() {
  return { tripName: "TripSplit Lite", members: [], expenses: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const p = JSON.parse(raw);
    return {
      tripName: p.tripName ?? "TripSplit Lite",
      members: Array.isArray(p.members) ? p.members : [],
      expenses: Array.isArray(p.expenses) ? p.expenses : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}

let state = loadState();

// ===== elements =====
const tripNameInput = document.getElementById("tripNameInput");
const saveTripBtn = document.getElementById("saveTripBtn");
const resetBtn = document.getElementById("resetBtn");
const seedBtn = document.getElementById("seedBtn");
const statusText = document.getElementById("statusText");

const memberNameInput = document.getElementById("memberNameInput");
const addMemberBtn = document.getElementById("addMemberBtn");
const membersList = document.getElementById("membersList");

const expenseTitleInput = document.getElementById("expenseTitleInput");
const expenseAmountInput = document.getElementById("expenseAmountInput");
const payerSelect = document.getElementById("payerSelect");
const splitWithBox = document.getElementById("splitWithBox");
const addExpenseBtn = document.getElementById("addExpenseBtn");

const membersCount = document.getElementById("membersCount");
const expensesCount = document.getElementById("expensesCount");
const expensesList = document.getElementById("expensesList");

const summaryBody = document.getElementById("summaryBody");
const settleList = document.getElementById("settleList");
// ===== helpers =====
function setStatus(msg) {
  statusText.textContent = `Status: ${msg}`;
}

function fmtVND(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("vi-VN") + " ₫";
}

function memberNameById(id) {
  return state.members.find(m => m.id === id)?.name ?? "(unknown)";
}

function computeBalances() {
  // init map: memberId -> { paid, owed, net }
  const map = {};
  for (const m of state.members) {
    map[m.id] = { memberId: m.id, name: m.name, paid: 0, owed: 0, net: 0 };
  }

  for (const e of state.expenses) {
    if (!map[e.payerId]) continue;
    map[e.payerId].paid += Number(e.amount) || 0;

    const k = (e.splitWithIds || []).length;
    if (!k) continue;

    const amount = Number(e.amount) || 0;
    const base = Math.floor(amount / k);
    let rem = amount - base * k; // remainder in VND (ensures exact sum)

    for (const id of e.splitWithIds) {
      if (!map[id]) continue;
      const share = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
      map[id].owed += share;
    }
  }

  for (const id in map) {
    map[id].net = map[id].paid - map[id].owed;
  }

  return Object.values(map);
}

function computeSettlements(balances) {
  // debtors pay creditors
  const debtors = balances
    .filter(b => b.net < 0)
    .map(b => ({ id: b.memberId, name: b.name, amt: -b.net }));

  const creditors = balances
    .filter(b => b.net > 0)
    .map(b => ({ id: b.memberId, name: b.name, amt: b.net }));

  // optional: sort to make output stable
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const res = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) {
      res.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
      debtors[i].amt -= pay;
      creditors[j].amt -= pay;
    }
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }

  return res;
}
// ===== render =====
function renderMembers() {
  membersList.innerHTML = "";
  for (const m of state.members) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="itemLeft">
        <b>${escapeHtml(m.name)}</b>
        <span class="small">${m.id}</span>
      </div>
      <button class="btnGhost" data-remove-member="${m.id}">Remove</button>
    `;
    membersList.appendChild(li);
  }
}

function renderPayerSelect() {
  payerSelect.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "-- select payer --";
  payerSelect.appendChild(opt0);

  for (const m of state.members) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    payerSelect.appendChild(opt);
  }
}

function renderSplitWith() {
  splitWithBox.innerHTML = "";
  if (state.members.length === 0) {
    splitWithBox.innerHTML = `<span class="small">Add members first.</span>`;
    return;
  }

  for (const m of state.members) {
    const row = document.createElement("label");
    row.className = "checkRow";
    row.innerHTML = `
      <input type="checkbox" data-split-id="${m.id}" checked />
      <span>${escapeHtml(m.name)}</span>
    `;
    splitWithBox.appendChild(row);
  }
}

function renderExpenses() {
  expensesList.innerHTML = "";
  const sorted = [...state.expenses].sort((a, b) => b.createdAt - a.createdAt);

  for (const e of sorted) {
    const li = document.createElement("li");
    li.className = "item";
    const payerName = memberNameById(e.payerId);
    li.innerHTML = `
      <div class="itemLeft">
        <b>${escapeHtml(e.title)}</b>
        <span class="small">${fmtVND(e.amount)} • Paid by ${escapeHtml(payerName)} • Split ${e.splitWithIds.length} people</span>
      </div>
      <button class="btnGhost" data-remove-expense="${e.id}">Delete</button>
    `;
    expensesList.appendChild(li);
  }
}

function renderCounters() {
  membersCount.textContent = String(state.members.length);
  expensesCount.textContent = String(state.expenses.length);
}

function renderAll() {
  tripNameInput.value = state.tripName || "";
  renderMembers();
  renderPayerSelect();
  renderSplitWith();
  renderExpenses();
  renderCounters();
  renderSummaryAndSettle();
}

function renderSummaryAndSettle() {
  if (state.members.length === 0) {
    summaryBody.innerHTML = "";
    settleList.innerHTML = `<li class="small">Add members first.</li>`;
    return;
  }

  const balances = computeBalances();

  // Summary table
  summaryBody.innerHTML = "";
  for (const b of balances) {
    const tr = document.createElement("tr");
    const netClass = b.net >= 0 ? "netPos" : "netNeg";
    tr.innerHTML = `
      <td>${escapeHtml(b.name)}</td>
      <td>${fmtVND(b.paid)}</td>
      <td>${fmtVND(b.owed)}</td>
      <td class="${netClass}">${fmtVND(b.net)}</td>
    `;
    summaryBody.appendChild(tr);
  }

  // Settle list
  const settles = computeSettlements(balances);
  settleList.innerHTML = "";
  if (settles.length === 0) {
    settleList.innerHTML = `<li class="small">No settlements needed.</li>`;
    return;
  }
  for (const s of settles) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="itemLeft">
        <b>${escapeHtml(s.from)} → ${escapeHtml(s.to)}</b>
        <span class="small">${fmtVND(s.amount)}</span>
      </div>
    `;
    settleList.appendChild(li);
  }
}

// ===== actions =====
function addMember() {
  const name = (memberNameInput.value || "").trim();
  if (!name) return setStatus("Member name is empty");

  const member = { id: uid("m"), name };
  state.members.push(member);

  saveState(state);
  memberNameInput.value = "";
  setStatus(`Added member: ${name}`);
  renderAll();
}

function removeMember(memberId) {
  // remove member
  state.members = state.members.filter(m => m.id !== memberId);

  // clean expenses: remove expenses paid by this member + remove from splitWith
  state.expenses = state.expenses
    .filter(e => e.payerId !== memberId)
    .map(e => ({ ...e, splitWithIds: e.splitWithIds.filter(id => id !== memberId) }))
    .filter(e => e.splitWithIds.length > 0); // if no one left to split, drop it

  saveState(state);
  setStatus("Removed member + cleaned related expenses");
  renderAll();
}

function addExpense() {
  const title = (expenseTitleInput.value || "").trim();
  const amount = Number(expenseAmountInput.value);
  const payerId = payerSelect.value;

  if (state.members.length < 2) return setStatus("Need at least 2 members");
  if (!title) return setStatus("Expense title is empty");
  if (!amount || amount <= 0) return setStatus("Amount must be > 0");
  if (!payerId) return setStatus("Select payer");

  // read checked splitWithIds
  const splitWithIds = Array.from(splitWithBox.querySelectorAll("input[type=checkbox]"))
    .filter(cb => cb.checked)
    .map(cb => cb.getAttribute("data-split-id"));

  if (splitWithIds.length === 0) return setStatus("Select at least 1 person to split");

  const expense = {
    id: uid("e"),
    title,
    amount,
    payerId,
    splitWithIds,
    createdAt: Date.now(),
  };

  state.expenses.push(expense);
  saveState(state);

  expenseTitleInput.value = "";
  expenseAmountInput.value = "";
  payerSelect.value = "";

  setStatus("Added expense ✅");
  renderAll();
}

function removeExpense(expenseId) {
  state.expenses = state.expenses.filter(e => e.id !== expenseId);
  saveState(state);
  setStatus("Deleted expense");
  renderAll();
}

function seedSample() {
  const a = { id: uid("m"), name: "A" };
  const b = { id: uid("m"), name: "B" };
  const c = { id: uid("m"), name: "C" };

  state = {
    tripName: "Sample Trip",
    members: [a, b, c],
    expenses: [
      {
        id: uid("e"),
        title: "Dinner",
        amount: 300000,
        payerId: a.id,
        splitWithIds: [a.id, b.id, c.id],
        createdAt: Date.now(),
      },
      {
        id: uid("e"),
        title: "Taxi",
        amount: 120000,
        payerId: b.id,
        splitWithIds: [a.id, b.id, c.id],
        createdAt: Date.now(),
      },
    ],
  };

  saveState(state);
  setStatus("Loaded sample data");
  renderAll();
}

// ===== events =====
saveTripBtn.addEventListener("click", () => {
  state.tripName = (tripNameInput.value || "").trim() || "TripSplit Lite";
  saveState(state);
  setStatus("Trip saved");
  renderAll();
});

resetBtn.addEventListener("click", () => {
  resetState();
  state = defaultState();
  setStatus("Reset done");
  renderAll();
});

seedBtn.addEventListener("click", seedSample);
addMemberBtn.addEventListener("click", addMember);

memberNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addMember();
});

addExpenseBtn.addEventListener("click", addExpense);

// event delegation for remove buttons
membersList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove-member]");
  if (!btn) return;
  removeMember(btn.getAttribute("data-remove-member"));
});

expensesList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove-expense]");
  if (!btn) return;
  removeExpense(btn.getAttribute("data-remove-expense"));
});

// small helper to avoid injecting raw HTML
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// init
renderAll();
setStatus("Ready");
