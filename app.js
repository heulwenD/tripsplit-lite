const STORAGE_KEY = "tripsplit_lite_state_v1";

// tạo id đơn giản
function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// object mặc định (đúng yêu cầu: tripName, members, expenses)
function defaultState() {
  return {
    tripName: "TripSplit Lite",
    members: [],
    expenses: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      tripName: parsed.tripName ?? "TripSplit Lite",
      members: Array.isArray(parsed.members) ? parsed.members : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
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

// ===== UI wiring =====
let state = loadState();

const tripNameInput = document.getElementById("tripNameInput");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const seedBtn = document.getElementById("seedBtn");
const statusText = document.getElementById("statusText");
const membersCount = document.getElementById("membersCount");
const expensesCount = document.getElementById("expensesCount");

function render() {
  tripNameInput.value = state.tripName || "";
  membersCount.textContent = String(state.members.length);
  expensesCount.textContent = String(state.expenses.length);
}

function setStatus(msg) {
  statusText.textContent = `Status: ${msg}`;
}

saveBtn.addEventListener("click", () => {
  state.tripName = (tripNameInput.value || "").trim() || "TripSplit Lite";
  saveState(state);
  setStatus("Saved ✅ (press F5)");
  render();
});

resetBtn.addEventListener("click", () => {
  resetState();
  state = defaultState();
  setStatus("Reset ✅");
  render();
});

seedBtn.addEventListener("click", () => {
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
  setStatus("Loaded sample data ✅");
  render();
});

// init
render();
setStatus("Loaded");
