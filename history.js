
const API_BASE = "/api";

const monthInput = document.getElementById("history-month");
const viewButton = document.getElementById("view-history");
const tableBody = document.getElementById("history-table-body");

let allTransactions = [];
let monthlyBudget = 0;

const $ = (id) => document.getElementById(id);

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return "—";

    const [year, month, day] = String(value).slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
}

function showMessage(message) {
    $("history-message").textContent = message;
}

async function loadHistoryData() {
    try {
        showMessage("Loading your financial records...");

        const [transactionResponse, budgetResponse] = await Promise.all([
            fetch(`${API_BASE}/transactions`),
            fetch(`${API_BASE}/budget`)
        ]);

        if (!transactionResponse.ok) {
            throw new Error("Could not load transactions.");
        }

        if (!budgetResponse.ok) {
            throw new Error("Could not load monthly budget.");
        }

        const transactionData = await transactionResponse.json();
        const budgetData = await budgetResponse.json();

        if (!Array.isArray(transactionData)) {
            throw new Error("Invalid transaction data.");
        }

        allTransactions = transactionData.map(item => ({
            ...item,
            amount: Number(item.amount),
            date: String(item.date || item.transaction_date || "").slice(0, 10)
        }));

        monthlyBudget = Number(budgetData.monthly_budget) || 0;

        renderHistory();

    } catch (error) {
        console.error("History loading error:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-row">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
        showMessage(error.message);
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function renderHistory() {
    const selectedMonth = monthInput.value;

    if (!selectedMonth) {
        showMessage("Please select a month.");
        return;
    }

    const monthTransactions = allTransactions.filter(item =>
        item.date.startsWith(selectedMonth)
    );

    let totalIncome = 0;
    let totalExpense = 0;

    // Combine income and expense by date.
    const dailyRecords = new Map();

    monthTransactions.forEach(item => {
        if (!item.date || !Number.isFinite(item.amount)) return;

        if (!dailyRecords.has(item.date)) {
            dailyRecords.set(item.date, {
                date: item.date,
                income: 0,
                expense: 0
            });
        }

        const record = dailyRecords.get(item.date);

        if (item.type === "income") {
            record.income += item.amount;
            totalIncome += item.amount;
        } else if (item.type === "expense") {
            record.expense += item.amount;
            totalExpense += item.amount;
        }
    });

    const records = [...dailyRecords.values()]
        .sort((a, b) => a.date.localeCompare(b.date));

    const balance = totalIncome - totalExpense;
    const budgetUsed = monthlyBudget > 0
        ? (totalExpense / monthlyBudget) * 100
        : 0;

    $("history-income").textContent = formatCurrency(totalIncome);
    $("history-expense").textContent = formatCurrency(totalExpense);
    $("history-budget").textContent = formatCurrency(monthlyBudget);
    $("history-balance").textContent = formatCurrency(balance);

    $("history-balance").style.color =
        balance < 0 ? "#ff7188" : "#55c3ff";

    $("history-budget-bar").style.width =
        `${Math.min(budgetUsed, 100)}%`;

    $("history-budget-status").textContent =
        monthlyBudget > 0
            ? `${budgetUsed.toFixed(1)}% Used`
            : "No budget set";

    $("selected-month-label").textContent =
        new Intl.DateTimeFormat("en-IN", {
            month: "long",
            year: "numeric"
        }).format(new Date(`${selectedMonth}-01T00:00:00`));

    $("table-total-income").textContent = formatCurrency(totalIncome);
    $("table-total-expense").textContent = formatCurrency(totalExpense);

    tableBody.replaceChildren();

    if (records.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.className = "empty-row";
        cell.textContent = "No transactions found for this month.";

        row.appendChild(cell);
        tableBody.appendChild(row);
    } else {
        records.forEach((record, index) => {
            const row = document.createElement("tr");

            const values = [
                index + 1,
                formatDate(record.date),
                record.income > 0 ? formatCurrency(record.income) : "—",
                record.expense > 0 ? formatCurrency(record.expense) : "—"
            ];

            values.forEach((value, cellIndex) => {
                const cell = document.createElement("td");
                cell.textContent = value;

                if (cellIndex === 2) {
                    cell.classList.add("income-cell");
                }

                if (cellIndex === 3) {
                    cell.classList.add("expense-cell");
                }

                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });
    }

    showMessage("");
}

function getCurrentMonth() {
    const today = new Date();

    return `${today.getFullYear()}-${String(
        today.getMonth() + 1
    ).padStart(2, "0")}`;
}

monthInput.value = getCurrentMonth();

viewButton.addEventListener("click", renderHistory);

monthInput.addEventListener("change", renderHistory);

$("print-report").addEventListener("click", () => {
    window.print();
});

$("download-pdf").addEventListener("click", () => {
    window.print();
});

loadHistoryData();
