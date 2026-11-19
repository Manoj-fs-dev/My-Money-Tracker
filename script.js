
"use strict";

// ========================================
// MY MONEY TRACKER
// COMPLETE UPDATED SCRIPT.JS
// Flask + MySQL Backend
// ========================================

const API_BASE = "/api";

// ========================================
// GLOBAL VARIABLES
// ========================================

let MONTHLY_BUDGET = 0;
let transactions = [];
let bankTransfers = [];
let isLoading = false;

// ========================================
// DOM SELECTOR
// ========================================

const $ = selector => document.querySelector(selector);

// Dashboard
const totalIncomeElement = $("#total-income");
const totalExpensesElement = $("#total-expenses");
const availableBalanceElement = $("#available-balance");
const monthlyLimitElement = $("#monthly-limit");
const budgetProgressBar = $("#budget-progress-bar");
const budgetStatusElement = $("#budget-status");
const transactionListElement = $("#transaction-list");

const todayIncomeElement = $("#today-income");
const todayExpensesElement = $("#today-expenses");
const currentDateElement = $("#current-date");

const monthlyOverviewContainer = $("#monthly-overview-data");
const expenseBreakdownContainer = $("#expense-breakdown-data");
const previousMonthPendingContainer =
    $("#previous-month-pending-data");
const previousMonthLabel = $("#previous-month-label");

// Bank transfer
const bankTransferForm = $("#bank-transfer-form");
const bankTransferAmountInput = $("#bank-transfer-amount");
const bankTransferDateInput = $("#bank-transfer-date");
const bankTransferNoteInput = $("#bank-transfer-note");
const bankTransferHistory = $("#bank-transfer-history");
const bankTransferredElement = $("#bank-transferred-amount");

// Income
const incomeForm = $("#income-form");
const incomeDateInput = $("#income-date");
const incomeAmountInput = $("#income-amount");
const incomeNoteInput = $("#income-note");

// Expense
const expenseForm = $("#expense-form");
const expenseDateInput = $("#expense-date");
const expenseAmountInput = $("#expense-amount");
const expenseCategoryInput = $("#expense-category");
const expenseNoteInput = $("#expense-note");

// Leave
const leaveForm = $("#leave-form");

// Budget
const budgetButton = $(".action-budget");

// AI
const aiChatButton = $(".ai-chat-button");

// ========================================
// DATE HELPERS
// ========================================

function getTodayDate() {
    const today = new Date();

    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");
}

function getCurrentMonth() {
    return getTodayDate().slice(0, 7);
}

function getPreviousMonth() {
    const today = new Date();

    const previous = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
    );

    return [
        previous.getFullYear(),
        String(previous.getMonth() + 1).padStart(2, "0")
    ].join("-");
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
}

function formatDate(value) {
    if (!value) return "—";

    const parts = String(value).slice(0, 10).split("-");

    if (parts.length !== 3) return value;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ========================================
// API REQUEST
// ========================================

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.error ||
            result.message ||
            `Request failed (${response.status})`
        );
    }

    return result;
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================

let toastContainer = null;

function createToastContainer() {
    if (
        toastContainer &&
        document.body.contains(toastContainer)
    ) {
        return toastContainer;
    }

    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container-custom";
    toastContainer.setAttribute("aria-live", "polite");

    document.body.appendChild(toastContainer);

    return toastContainer;
}

function showToast(message, type = "success", title = "") {
    const container = createToastContainer();

    const settings = {
        success: ["bi-check-circle-fill", title || "Success!"],
        error: ["bi-x-circle-fill", title || "Something went wrong"],
        warning: ["bi-exclamation-triangle-fill", title || "Attention!"],
        info: ["bi-info-circle-fill", title || "Information"]
    };

    const config = settings[type] || settings.info;

    const toast = document.createElement("div");
    toast.className = `custom-toast ${type}`;

    toast.setAttribute(
        "role",
        type === "error" ? "alert" : "status"
    );

    const icon = document.createElement("div");
    icon.className = "toast-icon";

    const iconElement = document.createElement("i");
    iconElement.className = `bi ${config[0]}`;

    icon.appendChild(iconElement);

    const content = document.createElement("div");
    content.className = "toast-message";

    const heading = document.createElement("strong");
    heading.textContent = config[1];

    const description = document.createElement("p");
    description.textContent = message;

    content.append(heading, description);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "toast-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close notification");

    const progress = document.createElement("div");
    progress.className = "toast-progress";

    toast.append(icon, content, closeButton, progress);
    container.appendChild(toast);

    let removed = false;

    function removeToast() {
        if (removed) return;

        removed = true;
        toast.classList.add("toast-leaving");

        setTimeout(() => toast.remove(), 260);
    }

    const timeoutId = setTimeout(removeToast, 4000);

    closeButton.addEventListener("click", () => {
        clearTimeout(timeoutId);
        removeToast();
    });
}

// ========================================
// CONFIRMATION DIALOG
// ========================================

function showChoiceDialog({
    title = "Are you sure?",
    message = "Please choose an option.",
    icon = "bi-question-circle-fill",
    buttons = []
}) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "neon-modal-overlay";

        const modal = document.createElement("section");
        modal.className = "neon-modal";

        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");

        const iconElement = document.createElement("div");
        iconElement.className = "neon-modal-icon";

        const iconTag = document.createElement("i");
        iconTag.className = `bi ${icon}`;

        iconElement.appendChild(iconTag);

        const heading = document.createElement("h3");
        heading.textContent = title;

        const description = document.createElement("p");
        description.textContent = message;

        const actions = document.createElement("div");
        actions.className = "neon-modal-actions";

        let finished = false;

        function closeDialog(value) {
            if (finished) return;

            finished = true;

            document.removeEventListener("keydown", handleKeydown);

            overlay.remove();

            resolve(value);
        }

        function handleKeydown(event) {
            if (event.key === "Escape") {
                closeDialog(null);
            }
        }

        buttons.forEach(config => {
            const button = document.createElement("button");

            button.type = "button";

            button.className =
                `neon-modal-btn ${config.className || "neon-btn-secondary"}`;

            button.textContent = config.label;

            button.addEventListener("click", () => {
                closeDialog(config.value);
            });

            actions.appendChild(button);
        });

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                closeDialog(null);
            }
        });

        modal.append(
            iconElement,
            heading,
            description,
            actions
        );

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.addEventListener("keydown", handleKeydown);

        actions.querySelector("button")?.focus();
    });
}

function showConfirmDialog(
    message,
    title = "Confirm Action"
) {
    return showChoiceDialog({
        title,
        message,
        icon: "bi-shield-check",
        buttons: [
            {
                label: "Cancel",
                value: false,
                className: "neon-btn-secondary"
            },
            {
                label: "Yes, Confirm",
                value: true,
                className: "neon-btn-primary"
            }
        ]
    }).then(value => value === true);
}

function showIncomeStatusDialog(amount) {
    return showChoiceDialog({
        title: "Salary Received?",
        message:
            `${formatCurrency(amount)}\n\n` +
            "Has this money already reached your bank account or hands?",
        icon: "bi-cash-stack",
        buttons: [
            {
                label: "Cancel",
                value: null,
                className: "neon-btn-secondary"
            },
            {
                label: "Still Pending",
                value: "pending",
                className: "neon-btn-warning"
            },
            {
                label: "✓ Received",
                value: "received",
                className: "neon-btn-success"
            }
        ]
    });
}

// ========================================
// NORMALIZE TRANSACTIONS
// ========================================

function normalizeTransaction(item) {
    return {
        id: Number(item.id),
        type: item.type,
        amount: Number(item.amount) || 0,
        category: item.category || (
            item.type === "income" ? "Salary" : "Other"
        ),
        note: item.note || "",
        date: String(
            item.date || item.transaction_date || ""
        ).slice(0, 10),
        status: item.status || "received",
        created_at: item.created_at || null
    };
}

// ========================================
// LOAD TRANSACTIONS
// ========================================

async function loadTransactions(showMessage = false) {
    try {
        isLoading = true;

        renderTransactions();

        const result = await apiRequest("/transactions");

        if (!Array.isArray(result)) {
            throw new Error("Invalid transactions response.");
        }

        transactions = result.map(normalizeTransaction);

        updateDashboard();

        if (showMessage) {
            showToast(
                "Transactions loaded from MySQL.",
                "success",
                "Data Loaded!"
            );
        }

        return true;

    } catch (error) {
        console.error("Loading transactions failed:", error);

        showToast(
            `Could not load transactions: ${error.message}`,
            "error",
            "Backend Error"
        );

        return false;

    } finally {
        isLoading = false;
        renderTransactions();
    }
}

async function createTransaction(transaction) {
    return apiRequest("/transactions", {
        method: "POST",
        body: JSON.stringify({
            type: transaction.type,
            amount: transaction.amount,
            category: transaction.category,
            note: transaction.note,
            transaction_date: transaction.date,
            status: transaction.status
        })
    });
}

async function receiveTransaction(id) {
    return apiRequest(`/transactions/${id}/receive`, {
        method: "PATCH"
    });
}

async function updateIncomeTransaction(id, transaction) {
    return apiRequest(`/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify({
            amount: transaction.amount,
            category: transaction.category,
            note: transaction.note,
            date: transaction.date,
            status: transaction.status
        })
    });
}

// ========================================
// MONTHLY BUDGET
// ========================================

async function loadMonthlyBudget() {
    const result = await apiRequest("/budget");

    const amount = Number(result.monthly_budget);

    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Invalid budget returned from database.");
    }

    MONTHLY_BUDGET = amount;

    updateDashboard();
}

async function saveMonthlyBudget(amount) {
    const result = await apiRequest("/budget", {
        method: "PUT",
        body: JSON.stringify({
            monthly_budget: amount
        })
    });

    MONTHLY_BUDGET = Number(result.monthly_budget);

    updateDashboard();

    return MONTHLY_BUDGET;
}

// ========================================
// BANK TRANSFER API
// Flask endpoint:
// GET  /api/bank-transfers
// POST /api/bank-transfers
// ========================================

function normalizeBankTransfer(item) {
    return {
        id: Number(item.id),
        amount: Number(item.amount) || 0,
        date: String(item.transfer_date || "").slice(0, 10),
        bank_name: item.bank_name || "",
        note: item.note || "",
        created_at: item.created_at || null
    };
}

async function loadBankTransfers(showMessage = false) {
    try {
        const result = await apiRequest("/bank-transfers");

        if (!Array.isArray(result.transfers)) {
            throw new Error("Invalid bank transfer response.");
        }

        bankTransfers = result.transfers.map(normalizeBankTransfer);

        updateDashboard();

        if (showMessage) {
            showToast(
                "Bank transfer history loaded.",
                "success"
            );
        }

        return true;

    } catch (error) {
        console.error("Bank transfer loading failed:", error);

        showToast(
            `Could not load bank transfers: ${error.message}`,
            "error",
            "Bank Transfer Error"
        );

        return false;
    }
}

async function createBankTransfer(transfer) {
    return apiRequest("/bank-transfers", {
        method: "POST",
        body: JSON.stringify({
            amount: transfer.amount,
            transfer_date: transfer.date,
            bank_name: transfer.bank_name,
            note: transfer.note
        })
    });
}

// ========================================
// MONTHLY CALCULATIONS
// ========================================

function getMonthlyTransactions() {
    const month = getCurrentMonth();

    return transactions.filter(item =>
        item.date.startsWith(month)
    );
}

function getReceivedIncome(list) {
    return list
        .filter(item =>
            item.type === "income" &&
            item.status === "received"
        )
        .reduce((sum, item) => sum + item.amount, 0);
}

function getPendingIncome(list) {
    return list
        .filter(item =>
            item.type === "income" &&
            item.status === "pending"
        )
        .reduce((sum, item) => sum + item.amount, 0);
}

function getExpenses(list) {
    return list
        .filter(item => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);
}

function getMonthlyBankTransfers() {
    const month = getCurrentMonth();

    return bankTransfers.filter(item =>
        item.date.startsWith(month)
    );
}

function getTotalBankTransferred() {
    return getMonthlyBankTransfers().reduce(
        (sum, item) => sum + item.amount,
        0
    );
}

function getTotalBalanceBeforeTransfer() {
    const list = getMonthlyTransactions();

    return getReceivedIncome(list) - getExpenses(list);
}

function getAvailableBalance() {
    return (
        getTotalBalanceBeforeTransfer() -
        getTotalBankTransferred()
    );
}

// ========================================
// BANK TRANSFER HISTORY
// ========================================

function renderBankTransferHistory() {
    if (!bankTransferHistory) return;

    bankTransferHistory.replaceChildren();

    const list = getMonthlyBankTransfers()
        .slice()
        .sort((a, b) =>
            b.date.localeCompare(a.date) || b.id - a.id
        );

    if (list.length === 0) {
        const empty = document.createElement("p");

        empty.className = "analytics-empty";
        empty.textContent =
            "No bank transfers recorded this month.";

        bankTransferHistory.appendChild(empty);
        return;
    }

    list.forEach(item => {
        const row = document.createElement("div");
        row.className = "bank-transfer-history-row";

        const details = document.createElement("div");
        details.className = "bank-transfer-details";

        const title = document.createElement("strong");
        title.textContent = item.bank_name || "Bank Transfer";

        const date = document.createElement("span");
        date.textContent = formatDate(item.date);

        const note = document.createElement("small");
        note.textContent = item.note || "Money transferred";

        details.append(title, date, note);

        const right = document.createElement("div");
        right.className = "bank-transfer-right";

        const amount = document.createElement("strong");
        amount.textContent = formatCurrency(item.amount);
        amount.style.color = "var(--green)";

        const label = document.createElement("small");
        label.textContent = "Transferred";

        right.append(amount, label);

        row.append(details, right);

        bankTransferHistory.appendChild(row);
    });
}


// ========================================
// ADD BANK TRANSFER
// ========================================


if (bankTransferForm) {
    bankTransferForm.addEventListener("submit", async event => {
        event.preventDefault();

        const amount = Number(bankTransferAmountInput?.value);
        const date = bankTransferDateInput?.value;
        const bankName = $("#bank-name")?.value.trim() || "";
        const note = bankTransferNoteInput?.value.trim() || "";

        if (!Number.isFinite(amount) || amount <= 0 || amount >= 100000000) {
            showToast("Enter a valid transfer amount.", "error");
            return;
        }

        if (!date || date > getTodayDate()) {
            showToast("Enter a valid transfer date.", "error");
            return;
        }

        if (date.slice(0, 7) !== getCurrentMonth()) {
            showToast("Please select a date in the current month.", "warning");
            return;
        }

        if (amount > getAvailableBalance()) {
            showToast(
                `Insufficient balance. Available: ${formatCurrency(getAvailableBalance())}`,
                "error",
                "Insufficient Balance"
            );
            return;
        }

        const submitButton =
            bankTransferForm.querySelector('[type="submit"]');

        if (submitButton) submitButton.disabled = true;

        try {
            // Save transfer
            await createBankTransfer({
                amount,
                date,
                bank_name: bankName,
                note
            });

            // Show success immediately after successful save
            showToast(
                `Your ${formatCurrency(amount)} has been transferred to your bank account.`,
                "success",
                "Bank Transfer Successful!"
            );

            bankTransferForm.reset();

            if (bankTransferDateInput) {
                bankTransferDateInput.value = getTodayDate();
            }

            // Reload history separately
            await loadBankTransfers();

        } catch (error) {
            console.error("Bank transfer failed:", error);

            showToast(
                error.message,
                "error",
                "Transfer Failed"
            );

        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}
// ========================================
// MONTHLY OVERVIEW
// ========================================

function updateMonthlyOverview() {
    const container = monthlyOverviewContainer;

    if (!container) return;

    const list = getMonthlyTransactions();

    const income = getReceivedIncome(list);
    const pendingTotal = getPendingIncome(list);
    const expenses = getExpenses(list);
    const bankTransferred = getTotalBankTransferred();

    const balance = income - expenses - bankTransferred;

    const pendingItems = list.filter(item =>
        item.type === "income" &&
        item.status === "pending"
    );

    container.replaceChildren();

    const summary = document.createElement("div");
    summary.className = "monthly-overview-summary";

    const metrics = [
        {
            label: "Income Received",
            value: formatCurrency(income),
            className: "overview-income"
        },
        {
            label: "Monthly Expenses",
            value: formatCurrency(expenses),
            className: "overview-expense"
        },
        {
            label: "Pending Salary",
            value: formatCurrency(pendingTotal),
            className: "overview-pending"
        },
        {
            label: "Bank Transferred",
            value: formatCurrency(bankTransferred),
            className: "overview-pending"
        },
        {
            label: "Available Balance",
            value: formatCurrency(balance),
            className: "overview-balance"
        }
    ];

    metrics.forEach(metric => {
        const card = document.createElement("div");
        card.className =
            `overview-metric ${metric.className}`;

        const label = document.createElement("span");
        label.className = "overview-metric-label";
        label.textContent = metric.label;

        const value = document.createElement("strong");
        value.className = "overview-metric-value";
        value.textContent = metric.value;

        card.append(label, value);
        summary.appendChild(card);
    });

    container.appendChild(summary);

    const pendingSection = document.createElement("div");
    pendingSection.className = "pending-salary-section";

    const heading = document.createElement("h4");
    heading.className = "analytics-subheading";
    heading.textContent = "Pending Salary Dates";

    pendingSection.appendChild(heading);

    if (pendingItems.length === 0) {
        const empty = document.createElement("p");

        empty.className = "analytics-empty";
        empty.textContent = "No pending salary for this month.";

        pendingSection.appendChild(empty);

    } else {
        pendingItems
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .forEach(item => {
                const row = document.createElement("div");
                row.className = "pending-salary-row";

                const details = document.createElement("div");
                details.className = "pending-salary-details";

                const title = document.createElement("strong");
                title.textContent = item.note || "Daily Salary";

                const date = document.createElement("span");
                date.textContent =
                    `Work date: ${formatDate(item.date)}`;

                details.append(title, date);

                const amount = document.createElement("strong");
                amount.className = "pending-salary-amount";
                amount.textContent = formatCurrency(item.amount);

                row.append(details, amount);

                pendingSection.appendChild(row);
            });
    }

    container.appendChild(pendingSection);
}

// ========================================
// EXPENSE BREAKDOWN
// ========================================

function updateExpenseBreakdown() {
    const container = expenseBreakdownContainer;

    if (!container) return;

    const month = getCurrentMonth();

    const expenses = transactions.filter(item =>
        item.type === "expense" &&
        item.date.startsWith(month)
    );

    const categoryTotals = new Map();

    expenses.forEach(item => {
        const category = item.category || "Other";

        categoryTotals.set(
            category,
            (categoryTotals.get(category) || 0) + item.amount
        );
    });

    const categories = [...categoryTotals.entries()]
        .sort((a, b) => b[1] - a[1]);

    const total = getExpenses(expenses);

    container.replaceChildren();

    const totalRow = document.createElement("div");
    totalRow.className = "expense-breakdown-total";

    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Total This Month";

    const totalAmount = document.createElement("strong");
    totalAmount.textContent = formatCurrency(total);

    totalRow.append(totalLabel, totalAmount);

    container.appendChild(totalRow);

    if (categories.length === 0) {
        const empty = document.createElement("p");

        empty.className = "analytics-empty";
        empty.textContent =
            "No expenses recorded this month yet.";

        container.appendChild(empty);
        return;
    }

    categories.forEach(([category, amount]) => {
        const row = document.createElement("div");
        row.className = "expense-category-row";

        const top = document.createElement("div");
        top.className = "expense-category-top";

        const name = document.createElement("span");
        name.className = "expense-category-name";
        name.textContent = category;

        const value = document.createElement("strong");
        value.className = "expense-category-amount";
        value.textContent = formatCurrency(amount);

        top.append(name, value);

        const track = document.createElement("div");
        track.className = "expense-category-track";

        const bar = document.createElement("div");
        bar.className = "expense-category-bar";

        bar.style.width =
            `${total > 0 ? (amount / total) * 100 : 0}%`;

        track.appendChild(bar);

        row.append(top, track);

        container.appendChild(row);
    });
}

function updateMonthlySections() {
    updateMonthlyOverview();
    updateExpenseBreakdown();
}

// ========================================
// PREVIOUS MONTH PENDING SALARY
// ========================================

function updatePreviousMonthPendingSalary() {
    const container = previousMonthPendingContainer;

    if (!container) return;

    const previousMonth = getPreviousMonth();

    const monthDate = new Date(
        `${previousMonth}-01T00:00:00`
    );

    const monthName = new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric"
    }).format(monthDate);

    if (previousMonthLabel) {
        previousMonthLabel.textContent = monthName;
    }

    const pendingItems = transactions
        .filter(item =>
            item.type === "income" &&
            item.status === "pending" &&
            item.date.startsWith(previousMonth)
        )
        .sort((a, b) => a.date.localeCompare(b.date));

    const totalPending = pendingItems.reduce(
        (sum, item) => sum + item.amount,
        0
    );

    container.replaceChildren();

    const totalCard = document.createElement("div");
    totalCard.className = "previous-pending-total";

    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Total Pending Salary";

    const totalAmount = document.createElement("strong");
    totalAmount.textContent = formatCurrency(totalPending);

    totalCard.append(totalLabel, totalAmount);

    container.appendChild(totalCard);

    if (pendingItems.length === 0) {
        const empty = document.createElement("p");

        empty.className = "analytics-empty";
        empty.textContent =
            `No pending salary for ${monthName}.`;

        container.appendChild(empty);
        return;
    }

    const list = document.createElement("div");
    list.className = "previous-pending-list";

    pendingItems.forEach(item => {
        const row = document.createElement("div");
        row.className = "previous-pending-row";

        const details = document.createElement("div");
        details.className = "previous-pending-details";

        const title = document.createElement("strong");
        title.textContent = item.note || "Daily Salary";

        const date = document.createElement("span");
        date.textContent = formatDate(item.date);

        details.append(title, date);

        const right = document.createElement("div");
        right.className = "previous-pending-right";

        const amount = document.createElement("strong");
        amount.className = "previous-pending-amount";
        amount.textContent = formatCurrency(item.amount);

        const button = document.createElement("button");

        button.type = "button";
        button.className =
            "neon-modal-btn neon-btn-success previous-received-btn";

        button.textContent = "✓ Received";

        button.addEventListener("click", () => {
            markIncomeReceived(item.id);
        });

        right.append(amount, button);
        row.append(details, right);

        list.appendChild(row);
    });

    container.appendChild(list);
}

// ========================================
// RENDER TRANSACTIONS
// ========================================

function renderTransactions() {
    if (!transactionListElement) return;

    transactionListElement.replaceChildren();

    const list = getMonthlyTransactions()
        .slice()
        .sort((a, b) =>
            b.date.localeCompare(a.date) || b.id - a.id
        );

    if (list.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.className = "empty-message";

        cell.textContent = isLoading
            ? "Loading transactions..."
            : "No transactions yet. Add your first income or expense!";

        row.appendChild(cell);
        transactionListElement.appendChild(row);

        return;
    }

    list.forEach(item => {
        const row = document.createElement("tr");

        const isIncome = item.type === "income";

        const dateCell = document.createElement("td");
        dateCell.textContent = formatDate(item.date);

        const typeCell = document.createElement("td");

        typeCell.textContent = isIncome ? "Income" : "Expense";

        typeCell.style.color = isIncome
            ? "var(--green)"
            : "var(--red)";

        const categoryCell = document.createElement("td");

        categoryCell.textContent = isIncome
            ? (item.note || "Daily Income")
            : (item.category || "Other");

        categoryCell.title = item.note || "";

        const amountCell = document.createElement("td");

        amountCell.textContent =
            `${isIncome ? "+" : "-"}${formatCurrency(item.amount)}`;

        amountCell.style.color = isIncome
            ? "var(--green)"
            : "var(--red)";

        const statusCell = document.createElement("td");

        if (isIncome) {
            const received = item.status === "received";

            const actions = document.createElement("div");

            actions.style.cssText =
                "display:flex;align-items:center;gap:7px;flex-wrap:wrap;";

            const button = document.createElement("button");

            button.type = "button";

            button.className = received
                ? "neon-modal-btn neon-btn-success"
                : "neon-modal-btn neon-btn-warning";

            button.style.cssText =
                "min-height:32px;padding:7px 10px;white-space:nowrap;";

            button.textContent = received
                ? "✓ Received"
                : "☐ Mark Received";

            button.disabled = received;

            if (!received) {
                button.addEventListener("click", () => {
                    markIncomeReceived(item.id);
                });
            }

            const editButton = document.createElement("button");

            editButton.type = "button";
            editButton.className = "neon-modal-btn";
            editButton.textContent = "✏ Edit";

            editButton.style.cssText =
                "min-height:32px;padding:7px 10px;white-space:nowrap;background:rgba(59,130,246,.14);color:#60a5fa;border:1px solid rgba(96,165,250,.35);";

            editButton.addEventListener("click", () => {
                openEditIncomeModal(item);
            });

            actions.append(button, editButton);
            statusCell.appendChild(actions);

        } else {
            const badge = document.createElement("span");

            badge.className =
                "badge rounded-pill text-bg-secondary";

            badge.textContent = "Spent";

            statusCell.appendChild(badge);
        }

        row.append(
            dateCell,
            typeCell,
            categoryCell,
            amountCell,
            statusCell
        );

        transactionListElement.appendChild(row);
    });
}

// ========================================
// UPDATE DASHBOARD
// ========================================

function updateDashboard() {
    const list = getMonthlyTransactions();

    const income = getReceivedIncome(list);
    const expenses = getExpenses(list);

    const bankTransferred = getTotalBankTransferred();

    const totalBalance = income - expenses;

    const balance = totalBalance - bankTransferred;

    if (totalIncomeElement) {
        totalIncomeElement.textContent = formatCurrency(income);
    }

    if (totalExpensesElement) {
        totalExpensesElement.textContent = formatCurrency(expenses);
    }

    if (availableBalanceElement) {
        availableBalanceElement.textContent =
            formatCurrency(balance);

        availableBalanceElement.style.color =
            balance < 0 ? "var(--red)" : "var(--primary)";
    }

    if (bankTransferredElement) {
        bankTransferredElement.textContent =
            formatCurrency(bankTransferred);
    }

    const totalBalanceElement =
        $("#total-balance-before-transfer");

    if (totalBalanceElement) {
        totalBalanceElement.textContent =
            formatCurrency(totalBalance);
    }

    if (monthlyLimitElement) {
        monthlyLimitElement.textContent =
            formatCurrency(MONTHLY_BUDGET);
    }

    const percentage = MONTHLY_BUDGET > 0
        ? Math.min((expenses / MONTHLY_BUDGET) * 100, 100)
        : 0;

    if (budgetProgressBar) {
        budgetProgressBar.style.width = `${percentage}%`;

        budgetProgressBar.setAttribute(
            "aria-valuenow",
            String(Math.round(percentage))
        );

        budgetProgressBar.style.background =
            expenses > MONTHLY_BUDGET
                ? "linear-gradient(90deg, #ff6685, #ff354f)"
                : "linear-gradient(90deg, #ffb454, #21d4a4)";
    }

    if (budgetStatusElement) {
        if (expenses > MONTHLY_BUDGET) {
            budgetStatusElement.textContent =
                `Over budget by ${formatCurrency(
                    expenses - MONTHLY_BUDGET
                )}`;

            budgetStatusElement.style.color = "var(--red)";

        } else {
            budgetStatusElement.textContent =
                `${formatCurrency(
                    MONTHLY_BUDGET - expenses
                )} budget remaining`;

            budgetStatusElement.style.color = "var(--green)";
        }
    }

    const today = getTodayDate();

    const todayList = transactions.filter(item =>
        item.date === today
    );

    if (todayIncomeElement) {
        todayIncomeElement.textContent =
            formatCurrency(getReceivedIncome(todayList));
    }

    if (todayExpensesElement) {
        todayExpensesElement.textContent =
            formatCurrency(getExpenses(todayList));
    }

    if (currentDateElement) {
        currentDateElement.textContent =
            new Intl.DateTimeFormat("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }).format(new Date());
    }

    renderTransactions();
    updateMonthlySections();
    updatePreviousMonthPendingSalary();
    renderBankTransferHistory();
}

// ========================================
// ADD INCOME
// ========================================

if (incomeForm) {
    incomeForm.addEventListener("submit", async event => {
        event.preventDefault();

        const date = incomeDateInput?.value;
        const amount = Number(incomeAmountInput?.value);
        const note = incomeNoteInput?.value.trim() || "";

        if (
            !date ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount >= 100000000
        ) {
            showToast(
                "Enter a valid income date and amount.",
                "error"
            );
            return;
        }

        if (date > getTodayDate()) {
            showToast(
                "Future dates are not allowed.",
                "error"
            );

            incomeDateInput.focus();
            return;
        }

        const status = await showIncomeStatusDialog(amount);

        if (!status) return;

        const submitButton =
            incomeForm.querySelector('[type="submit"]');

        if (submitButton) submitButton.disabled = true;

        try {
            await createTransaction({
                type: "income",
                date,
                amount,
                note: note || "Daily Income",
                category: "Salary",
                status
            });

            const loaded = await loadTransactions();

            if (!loaded) {
                throw new Error(
                    "Saved, but transactions could not be reloaded."
                );
            }

            incomeForm.reset();
            setDefaultDates();

            showToast(
                `${formatCurrency(amount)} income saved to database.`,
                "success",
                "Income Saved!"
            );

        } catch (error) {
            console.error("Saving income failed:", error);

            showToast(
                `Income operation failed: ${error.message}`,
                "error",
                "Database Error"
            );

        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

// ========================================
// ADD EXPENSE
// ========================================

if (expenseForm) {
    expenseForm.addEventListener("submit", async event => {
        event.preventDefault();

        const date = expenseDateInput?.value;
        const amount = Number(expenseAmountInput?.value);
        const category = expenseCategoryInput?.value;
        const note = expenseNoteInput?.value.trim() || "";

        if (
            !date ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount >= 100000000
        ) {
            showToast(
                "Enter a valid expense date and amount.",
                "error"
            );
            return;
        }

        if (date > getTodayDate()) {
            showToast(
                "Future dates are not allowed.",
                "error"
            );

            expenseDateInput.focus();
            return;
        }

        if (!category) {
            showToast(
                "Select an expense category.",
                "warning"
            );

            expenseCategoryInput.focus();
            return;
        }

        const submitButton =
            expenseForm.querySelector('[type="submit"]');

        if (submitButton) submitButton.disabled = true;

        try {
            await createTransaction({
                type: "expense",
                date,
                amount,
                category,
                note: note || category,
                status: "received"
            });

            const loaded = await loadTransactions();

            if (!loaded) {
                throw new Error(
                    "Saved, but transactions could not be reloaded."
                );
            }

            expenseForm.reset();
            setDefaultDates();

            showToast(
                `${formatCurrency(amount)} expense saved to database.`,
                "success",
                "Expense Added!"
            );

            if (
                getExpenses(getMonthlyTransactions()) >
                MONTHLY_BUDGET
            ) {
                showToast(
                    "You have crossed your monthly spending limit.",
                    "warning",
                    "Budget Exceeded"
                );
            }

        } catch (error) {
            console.error("Saving expense failed:", error);

            showToast(
                `Expense operation failed: ${error.message}`,
                "error",
                "Database Error"
            );

        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

// ========================================
// MARK INCOME AS RECEIVED
// ========================================

async function markIncomeReceived(id) {
    const item = transactions.find(
        transaction => transaction.id === id
    );

    if (!item || item.type !== "income") return;

    if (item.status === "received") {
        showToast(
            "This income is already received.",
            "info"
        );
        return;
    }

    const confirmed = await showConfirmDialog(
        `Confirm that ${formatCurrency(item.amount)} has been received?`,
        "Mark Income as Received"
    );

    if (!confirmed) return;

    try {
        await receiveTransaction(id);

        const loaded = await loadTransactions();

        if (!loaded) {
            throw new Error(
                "Updated, but transactions could not be reloaded."
            );
        }

        showToast(
            `${formatCurrency(item.amount)} marked as received.`,
            "success",
            "Income Updated!"
        );

    } catch (error) {
        console.error("Updating income failed:", error);

        showToast(
            `Could not update income: ${error.message}`,
            "error",
            "Database Error"
        );
    }
}

// ========================================
// EDIT INCOME
// ========================================

function openEditIncomeModal(item) {
    if (!item || item.type !== "income") return;

    if ($(".edit-income-overlay")) return;

    const overlay = document.createElement("div");

    overlay.className =
        "budget-modal-overlay edit-income-overlay";

    const modal = document.createElement("section");

    modal.className = "budget-modal";

    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const closeButton = document.createElement("button");

    closeButton.type = "button";
    closeButton.className = "budget-modal-close";
    closeButton.textContent = "×";

    const heading = document.createElement("h2");
    heading.textContent = "Edit Income";

    const description = document.createElement("p");

    description.className = "budget-modal-description";

    description.textContent =
        "Update the details of this income transaction.";

    const form = document.createElement("form");

    function addField(labelText, type, value) {
        const wrapper = document.createElement("div");

        wrapper.style.marginBottom = "14px";

        const label = document.createElement("label");

        label.className = "budget-input-label";
        label.textContent = labelText;

        const input = document.createElement("input");

        input.className = "budget-input";
        input.type = type;
        input.value = value == null ? "" : String(value);
        input.required = true;
        input.style.width = "100%";
        input.style.boxSizing = "border-box";

        if (type === "number") {
            input.min = "0.01";
            input.max = "99999999.99";
            input.step = "0.01";
        }

        if (type === "date") {
            input.max = getTodayDate();
        }

        wrapper.append(label, input);
        form.appendChild(wrapper);

        return input;
    }

    const dateInput = addField(
        "Income Date",
        "date",
        item.date
    );

    const amountInput = addField(
        "Amount (₹)",
        "number",
        item.amount
    );

    const categoryInput = addField(
        "Category",
        "text",
        item.category || "Salary"
    );

    categoryInput.maxLength = 100;

    const noteInput = addField(
        "Note / Description",
        "text",
        item.note || ""
    );

    noteInput.maxLength = 255;

    const statusLabel = document.createElement("label");

    statusLabel.className = "budget-input-label";
    statusLabel.textContent = "Payment Status";

    const statusInput = document.createElement("select");

    statusInput.className = "budget-input";
    statusInput.style.width = "100%";

    [
        { value: "received", label: "✓ Received" },
        { value: "pending", label: "Pending" }
    ].forEach(entry => {
        const option = document.createElement("option");

        option.value = entry.value;
        option.textContent = entry.label;

        statusInput.appendChild(option);
    });

    statusInput.value = item.status;

    form.append(statusLabel, statusInput);

    const errorElement = document.createElement("p");

    errorElement.className = "budget-modal-error";
    errorElement.hidden = true;

    const actions = document.createElement("div");

    actions.className = "budget-modal-actions";

    const cancelButton = document.createElement("button");

    cancelButton.type = "button";
    cancelButton.className =
        "budget-modal-btn budget-cancel-btn";
    cancelButton.textContent = "Cancel";

    const saveButton = document.createElement("button");

    saveButton.type = "submit";
    saveButton.className =
        "budget-modal-btn budget-save-btn";
    saveButton.textContent = "Save Changes";

    actions.append(cancelButton, saveButton);

    form.append(errorElement, actions);

    modal.append(
        closeButton,
        heading,
        description,
        form
    );

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function closeModal() {
        document.removeEventListener("keydown", handleKeydown);
        overlay.remove();
    }

    function handleKeydown(event) {
        if (event.key === "Escape") {
            closeModal();
        }
    }

    closeButton.addEventListener("click", closeModal);
    cancelButton.addEventListener("click", closeModal);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeModal();
    });

    document.addEventListener("keydown", handleKeydown);

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const date = dateInput.value;
        const amount = Number(amountInput.value);
        const category = categoryInput.value.trim();
        const note = noteInput.value.trim();
        const status = statusInput.value;

        if (!date || date > getTodayDate()) {
            errorElement.textContent = "Choose a valid date.";
            errorElement.hidden = false;
            return;
        }

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount >= 100000000
        ) {
            errorElement.textContent = "Enter a valid amount.";
            errorElement.hidden = false;
            return;
        }

        if (!category) {
            errorElement.textContent = "Enter a category.";
            errorElement.hidden = false;
            return;
        }

        saveButton.disabled = true;
        cancelButton.disabled = true;

        try {
            await updateIncomeTransaction(item.id, {
                date,
                amount,
                category,
                note,
                status
            });

            const loaded = await loadTransactions();

            if (!loaded) {
                throw new Error(
                    "Could not refresh dashboard."
                );
            }

            closeModal();

            showToast(
                "Income updated successfully!",
                "success",
                "Income Updated!"
            );

        } catch (error) {
            errorElement.textContent = error.message;
            errorElement.hidden = false;

        } finally {
            saveButton.disabled = false;
            cancelButton.disabled = false;
        }
    });

    dateInput.focus();
}

// ========================================
// LEAVE MANAGEMENT
// ========================================

if (leaveForm) {
    leaveForm.addEventListener("submit", async event => {
        event.preventDefault();

        const leaveData = {
            leave_date: $("#leave-date")?.value,
            leave_type: $("#leave-type")?.value,
            leave_reason:
                $("#leave-reason")?.value.trim() || ""
        };

        if (
            !leaveData.leave_date ||
            !leaveData.leave_type
        ) {
            showToast(
                "Leave date and leave type are required.",
                "error"
            );
            return;
        }

        const submitButton =
            leaveForm.querySelector('[type="submit"]');

        if (submitButton) submitButton.disabled = true;

        try {
            await apiRequest("/leaves", {
                method: "POST",
                body: JSON.stringify(leaveData)
            });

            leaveForm.reset();

            showToast(
                "Leave saved successfully!",
                "success",
                "Leave Saved!"
            );

        } catch (error) {
            console.error("Leave saving failed:", error);

            showToast(error.message, "error");

        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

// ========================================
// DEFAULT DATES
// ========================================

function setDefaultDates() {
    const today = getTodayDate();

    if (incomeDateInput && !incomeDateInput.value) {
        incomeDateInput.value = today;
    }

    if (expenseDateInput && !expenseDateInput.value) {
        expenseDateInput.value = today;
    }

    if (
        bankTransferDateInput &&
        !bankTransferDateInput.value
    ) {
        bankTransferDateInput.value = today;
    }

    if (incomeDateInput) {
        incomeDateInput.max = today;
    }

    if (expenseDateInput) {
        expenseDateInput.max = today;
    }

    if (bankTransferDateInput) {
        bankTransferDateInput.max = today;
    }

    const leaveDateInput = $("#leave-date");

    if (leaveDateInput) {
        leaveDateInput.max = today;
    }
}

// ========================================
// NAVIGATION
// ========================================

function setupNavigation() {
    const links = document.querySelectorAll(
        ".sidebar .nav-link[href^='#']"
    );

    links.forEach(link => {
        link.addEventListener("click", () => {
            links.forEach(item =>
                item.classList.remove("active")
            );

            link.classList.add("active");
        });
    });

    document.querySelectorAll(
        ".action-button[href^='#']"
    ).forEach(link => {
        link.addEventListener("click", event => {
            const target = document.querySelector(
                link.getAttribute("href")
            );

            if (target) {
                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
    });
}

// ========================================
// MONTHLY BUDGET MODAL
// ========================================

function openBudgetModal() {
    if ($(".budget-modal-overlay")) return;

    const overlay = document.createElement("div");

    overlay.className = "budget-modal-overlay";

    const modal = document.createElement("section");

    modal.className = "budget-modal";

    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const closeButton = document.createElement("button");

    closeButton.type = "button";
    closeButton.className = "budget-modal-close";
    closeButton.textContent = "×";

    const icon = document.createElement("div");

    icon.className = "budget-modal-icon";

    const iconTag = document.createElement("i");

    iconTag.className = "bi bi-calendar-check-fill";

    icon.appendChild(iconTag);

    const heading = document.createElement("h2");

    heading.textContent = "Set Monthly Budget";

    const description = document.createElement("p");

    description.className = "budget-modal-description";

    description.textContent =
        "Set a spending limit and keep your finances on track.";

    const currentCard = document.createElement("div");

    currentCard.className = "budget-current-card";

    const currentLabel = document.createElement("span");

    currentLabel.className = "budget-current-label";
    currentLabel.textContent = "Current monthly budget";

    const currentValue = document.createElement("span");

    currentValue.className = "budget-current-value";
    currentValue.textContent = formatCurrency(MONTHLY_BUDGET);

    currentCard.append(currentLabel, currentValue);

    const form = document.createElement("form");

    const label = document.createElement("label");

    label.className = "budget-input-label";
    label.textContent = "New budget amount";

    const wrapper = document.createElement("div");

    wrapper.className = "budget-input-wrapper";

    const symbol = document.createElement("span");

    symbol.className = "budget-currency-symbol";
    symbol.textContent = "₹";

    const input = document.createElement("input");

    input.className = "budget-input";
    input.type = "number";
    input.min = "0.01";
    input.max = "99999999.99";
    input.step = "0.01";
    input.required = true;
    input.value = MONTHLY_BUDGET || "";

    wrapper.append(symbol, input);

    const hint = document.createElement("p");

    hint.className = "budget-input-hint";

    hint.textContent =
        "Enter your maximum monthly spending limit.";

    const errorElement = document.createElement("p");

    errorElement.className = "budget-modal-error";
    errorElement.hidden = true;

    const actions = document.createElement("div");

    actions.className = "budget-modal-actions";

    const cancel = document.createElement("button");

    cancel.type = "button";
    cancel.className = "budget-modal-btn budget-cancel-btn";
    cancel.textContent = "Cancel";

    const save = document.createElement("button");

    save.type = "submit";
    save.className = "budget-modal-btn budget-save-btn";
    save.textContent = "Save Budget";

    actions.append(cancel, save);

    form.append(
        label,
        wrapper,
        hint,
        errorElement,
        actions
    );

    modal.append(
        closeButton,
        icon,
        heading,
        description,
        currentCard,
        form
    );

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function closeModal() {
        document.removeEventListener("keydown", onKeydown);
        overlay.remove();

        budgetButton?.focus({ preventScroll: true });
    }

    function onKeydown(event) {
        if (event.key === "Escape") closeModal();
    }

    closeButton.addEventListener("click", closeModal);
    cancel.addEventListener("click", closeModal);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeModal();
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const raw = input.value.trim();
        const amount = Number(raw);

        if (
            !raw ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount >= 100000000
        ) {
            errorElement.textContent =
                "Enter a valid budget greater than ₹0.";

            errorElement.hidden = false;

            input.focus();
            return;
        }

        save.disabled = true;
        save.textContent = "Saving...";

        try {
            await saveMonthlyBudget(amount);

            closeModal();

            showToast(
                `${formatCurrency(MONTHLY_BUDGET)} is your new monthly budget.`,
                "success",
                "Budget Saved!"
            );

        } catch (error) {
            errorElement.textContent =
                `Budget was not saved: ${error.message}`;

            errorElement.hidden = false;

        } finally {
            save.disabled = false;
            save.textContent = "Save Budget";
        }
    });

    document.addEventListener("keydown", onKeydown);

    input.focus();
}

if (budgetButton) {
    budgetButton.addEventListener("click", event => {
        event.preventDefault();
        openBudgetModal();
    });
}

// ========================================
// AI BUTTON
// ========================================

if (aiChatButton) {
    aiChatButton.addEventListener("click", () => {
        showToast(
            "AI Money Assistant will be connected in a future update.",
            "info"
        );
    });
}

// ========================================
// INITIALIZE APPLICATION
// ========================================

async function initializeApp() {
    setDefaultDates();

    setupNavigation();

    updateDashboard();

    // Load monthly budget
    try {
        await loadMonthlyBudget();

    } catch (error) {
        console.error("Loading budget failed:", error);

        showToast(
            `Could not load database budget: ${error.message}`,
            "error",
            "Database Error"
        );
    }

    // Load transactions
    await loadTransactions();

    // Load bank transfers
    await loadBankTransfers();

    console.log("My Money Tracker initialized.");
}

// ========================================
// DOM READY
// ========================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeApp,
        { once: true }
    );
} else {
    initializeApp();
}






// TEST TOAST POPUP
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        showToast(
            "Toast notification working!",
            "success",
            "Test Successful!"
        );
    }, 1000);
});
