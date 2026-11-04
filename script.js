// ========================================
// MY MONEY TRACKER - COMPLETE SCRIPT
// Backend + MySQL + Monthly Overview
// Expense Breakdown + Budget + Notifications
// ========================================

"use strict";

const API_BASE = "/api";
const BUDGET_STORAGE_KEY = "myMoneyTrackerMonthlyBudget";

function getSavedMonthlyBudget() {
    try {
        const value = Number(localStorage.getItem(BUDGET_STORAGE_KEY));
        return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
        return 0;
    }
}

let MONTHLY_BUDGET = getSavedMonthlyBudget();
let transactions = [];
let isLoading = false;

const $ = (selector) => document.querySelector(selector);

// Dashboard elements
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

// Forms
const incomeForm = $("#income-form");
const expenseForm = $("#expense-form");

const incomeDateInput = $("#income-date");
const incomeAmountInput = $("#income-amount");
const incomeNoteInput = $("#income-note");

const expenseDateInput = $("#expense-date");
const expenseAmountInput = $("#expense-amount");
const expenseCategoryInput = $("#expense-category");
const expenseNoteInput = $("#expense-note");

// Actual containers in your index.html
const monthlyOverviewContainer = $("#monthly-overview-data");
const expenseBreakdownContainer = $("#expense-breakdown-data");

const previousMonthPendingContainer =
    $("#previous-month-pending-data");

const previousMonthLabel =
    $("#previous-month-label");

// ========================================
// DATE AND CURRENCY HELPERS
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
// API HELPERS
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
            result.details ||
            result.error ||
            result.message ||
            `Request failed (${response.status})`
        );
    }

    return result;
}

function normalizeTransaction(item) {
    return {
        id: Number(item.id),
        type: item.type,
        amount: Number(item.amount),
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

async function loadTransactions(showMessage = false) {
    try {
        isLoading = true;

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

// ========================================
// MONTHLY BUDGET - DATABASE
// ========================================

async function loadMonthlyBudget() {
    const result = await apiRequest("/budget");
    const amount = Number(result.monthly_budget);

    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Invalid budget returned from database.");
    }

    MONTHLY_BUDGET = amount;

    try {
        localStorage.setItem(
            BUDGET_STORAGE_KEY,
            String(amount)
        );
    } catch (error) {
        console.warn("Budget cache unavailable:", error);
    }

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

    try {
        localStorage.setItem(
            BUDGET_STORAGE_KEY,
            String(MONTHLY_BUDGET)
        );
    } catch (error) {
        console.warn("Budget cache unavailable:", error);
    }

    updateDashboard();

    return MONTHLY_BUDGET;
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================

let toastContainer;

function createToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) {
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
    closeButton.setAttribute(
        "aria-label",
        "Close notification"
    );

    toast.append(icon, content, closeButton);

    const progress = document.createElement("div");
    progress.className = "toast-progress";
    progress.setAttribute("aria-hidden", "true");

    toast.appendChild(progress);
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
// CUSTOM CONFIRMATION DIALOG
// ========================================

function showChoiceDialog({
    title = "Are you sure?",
    message = "Please choose an option.",
    icon = "bi-question-circle-fill",
    buttons = []
}) {
    return new Promise((resolve) => {
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

            document.removeEventListener(
                "keydown",
                handleKeydown
            );

            overlay.remove();
            resolve(value);
        }

        function handleKeydown(event) {
            if (event.key === "Escape") {
                closeDialog(null);
            }
        }

        buttons.forEach((config) => {
            const button = document.createElement("button");

            button.type = "button";

            button.className =
                `neon-modal-btn ${config.className || "neon-btn-secondary"
                }`;

            button.textContent = config.label;

            button.addEventListener("click", () => {
                closeDialog(config.value);
            });

            actions.appendChild(button);
        });

        overlay.addEventListener("click", (event) => {
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
    }).then((value) => value === true);
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
// TRANSACTION CALCULATIONS
// ========================================

function getMonthlyTransactions() {
    const month = getCurrentMonth();

    return transactions.filter(
        (item) => item.date.startsWith(month)
    );
}

function getReceivedIncome(list) {
    return list
        .filter((item) =>
            item.type === "income" &&
            item.status === "received"
        )
        .reduce((sum, item) => sum + item.amount, 0);
}

function getPendingIncome(list) {
    return list
        .filter((item) =>
            item.type === "income" &&
            item.status === "pending"
        )
        .reduce((sum, item) => sum + item.amount, 0);
}

function getExpenses(list) {
    return list
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);
}

// ========================================
// MONTHLY OVERVIEW
// Uses #monthly-overview-data from your HTML
// ========================================

function updateMonthlyOverview() {
    const container = monthlyOverviewContainer;

    if (!container) return;

    const month = getCurrentMonth();

    const list = transactions.filter(
        (item) => item.date.startsWith(month)
    );

    const income = getReceivedIncome(list);

    const pendingItems = list.filter(
        (item) =>
            item.type === "income" &&
            item.status === "pending"
    );

    const pendingTotal = getPendingIncome(list);
    const expenses = getExpenses(list);
    const balance = income - expenses;

    container.replaceChildren();

    // Summary cards
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
            label: "Available Balance",
            value: formatCurrency(balance),
            className: "overview-balance"
        }
    ];

    metrics.forEach((metric) => {
        const card = document.createElement("div");
        card.className = `overview-metric ${metric.className}`;

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

    // Pending salary dates
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
            .forEach((item) => {
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
// MONTHLY EXPENSE BREAKDOWN
// Uses #expense-breakdown-data from your HTML
// Groups expenses by category.
// ========================================

function updateExpenseBreakdown() {
    const container = expenseBreakdownContainer;

    if (!container) {
        console.error(
            "Expense Breakdown container #expense-breakdown-data not found."
        );
        return;
    }

    const month = getCurrentMonth();

    const expenses = transactions.filter(
        (item) =>
            item.type === "expense" &&
            typeof item.date === "string" &&
            item.date.startsWith(month)
    );

    // Group expenses by category
    const categoryTotals = new Map();

    expenses.forEach((item) => {
        const category = item.category || "Other";
        const amount = Number(item.amount) || 0;

        categoryTotals.set(
            category,
            (categoryTotals.get(category) || 0) + amount
        );
    });

    const categories = [...categoryTotals.entries()]
        .sort((a, b) => b[1] - a[1]);

    const total = expenses.reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0
    );

    container.replaceChildren();

    // Total monthly expenses
    const totalRow = document.createElement("div");
    totalRow.className = "expense-breakdown-total";

    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Total This Month";

    const totalAmount = document.createElement("strong");
    totalAmount.textContent = formatCurrency(total);

    totalRow.append(totalLabel, totalAmount);
    container.appendChild(totalRow);

    // Empty state
    if (categories.length === 0) {
        const empty = document.createElement("p");

        empty.className = "analytics-empty";
        empty.textContent =
            "No expenses recorded this month yet.";

        container.appendChild(empty);

        return;
    }

    // Category-wise expenses
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

        // Percentage bar
        const track = document.createElement("div");
        track.className = "expense-category-track";
        track.setAttribute("aria-hidden", "true");

        const bar = document.createElement("div");
        bar.className = "expense-category-bar";

        const percentage = total > 0
            ? (amount / total) * 100
            : 0;

        bar.style.width = `${percentage}%`;

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

    // Previous month name
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

    // Income + Pending + Previous Month ONLY
    const pendingItems = transactions
        .filter((item) =>
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

    // Total pending salary card
    const totalCard = document.createElement("div");
    totalCard.className = "previous-pending-total";

    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Total Pending Salary";

    const totalAmount = document.createElement("strong");
    totalAmount.textContent = formatCurrency(totalPending);

    totalCard.append(totalLabel, totalAmount);
    container.appendChild(totalCard);

    // Empty message
    if (pendingItems.length === 0) {

        const empty = document.createElement("p");

        empty.className = "analytics-empty";
        empty.textContent =
            `No pending salary for ${monthName}.`;

        container.appendChild(empty);

        return;
    }

    // Pending salary list
    const list = document.createElement("div");
    list.className = "previous-pending-list";

    pendingItems.forEach((item) => {

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
// RENDER RECENT TRANSACTIONS
// ========================================

function renderTransactions() {
    if (!transactionListElement) return;

    transactionListElement.replaceChildren();

    const list = getMonthlyTransactions()
        .slice()
        .sort((a, b) => b.id - a.id);

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

    list.forEach((item) => {
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

            if (received) {
                button.title = "Income already received";
            } else {
                button.addEventListener("click", () => {
                    markIncomeReceived(item.id);
                });
            }

            statusCell.appendChild(button);

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
    const balance = income - expenses;

    if (totalIncomeElement) {
        totalIncomeElement.textContent = formatCurrency(income);
    }

    if (totalExpensesElement) {
        totalExpensesElement.textContent = formatCurrency(expenses);
    }

    if (availableBalanceElement) {
        availableBalanceElement.textContent = formatCurrency(balance);

        availableBalanceElement.style.color =
            balance < 0 ? "var(--red)" : "var(--primary)";
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

    const todayList = transactions.filter(
        (item) => item.date === today
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

    // Update dashboard sections
    updateMonthlySections();

    // Update previous month pending salary
    updatePreviousMonthPendingSalary();
}

// ========================================
// ADD INCOME
// ========================================

if (incomeForm) {
    incomeForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const date = incomeDateInput.value;
        const amount = Number(incomeAmountInput.value);
        const note = incomeNoteInput.value.trim();

        if (
            !date ||
            !Number.isFinite(amount) ||
            amount <= 0
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
    expenseForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const date = expenseDateInput.value;
        const amount = Number(expenseAmountInput.value);
        const category = expenseCategoryInput.value;
        const note = expenseNoteInput.value.trim();

        if (
            !date ||
            !Number.isFinite(amount) ||
            amount <= 0
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

            // Dashboard reload also updates Expense Breakdown.
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
        (transaction) => transaction.id === id
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
// DEFAULT DATES
// ========================================

function setDefaultDates() {
    if (incomeDateInput && !incomeDateInput.value) {
        incomeDateInput.value = getTodayDate();
    }

    if (expenseDateInput && !expenseDateInput.value) {
        expenseDateInput.value = getTodayDate();
    }

    if (incomeDateInput) {
        incomeDateInput.max = getTodayDate();
    }

    if (expenseDateInput) {
        expenseDateInput.max = getTodayDate();
    }
}

// ========================================
// NAVIGATION
// ========================================

function setupNavigation() {
    const links = document.querySelectorAll(
        ".sidebar .nav-link[href^='#']"
    );

    links.forEach((link) => {
        link.addEventListener("click", () => {
            links.forEach((item) =>
                item.classList.remove("active")
            );

            link.classList.add("active");
        });
    });

    document.querySelectorAll(
        ".action-button[href^='#']"
    ).forEach((link) => {
        link.addEventListener("click", (event) => {
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

const budgetButton = $(".action-budget");

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
    closeButton.setAttribute(
        "aria-label",
        "Close budget popup"
    );

    const icon = document.createElement("div");
    icon.className = "budget-modal-icon";
    icon.innerHTML =
        '<i class="bi bi-calendar-check-fill"></i>';

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
    label.htmlFor = "budget-amount-input";
    label.textContent = "New budget amount";

    const wrapper = document.createElement("div");
    wrapper.className = "budget-input-wrapper";

    const symbol = document.createElement("span");
    symbol.className = "budget-currency-symbol";
    symbol.textContent = "₹";

    const input = document.createElement("input");
    input.className = "budget-input";
    input.id = "budget-amount-input";
    input.type = "number";
    input.min = "0.01";
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
    errorElement.setAttribute("role", "alert");
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
        if (event.key === "Escape") {
            closeModal();
        }
    }

    closeButton.addEventListener("click", closeModal);
    cancel.addEventListener("click", closeModal);

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const raw = input.value.trim();
        const amount = Number(raw);

        if (
            raw === "" ||
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
            console.error(
                "Saving monthly budget failed:",
                error
            );

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
    budgetButton.addEventListener("click", (event) => {
        event.preventDefault();
        openBudgetModal();
    });
}

// ========================================
// AI BUTTON
// ========================================

const aiChatButton = $(".ai-chat-button");

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

    // Show initial empty state immediately.
    updateMonthlySections();

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

    await loadTransactions();

    console.log("My Money Tracker initialized.");
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );
} else {
    initializeApp();
}
