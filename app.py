from flask import Flask, jsonify, request, send_from_directory
import mysql.connector
import os
import logging
import calendar

from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path


# ========================================
# APP CONFIGURATION
# ========================================

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__, static_folder=None)
app.config["JSON_SORT_KEYS"] = False

logging.basicConfig(level=logging.INFO)


# ========================================
# MYSQL CONFIGURATION
# ========================================

DB_HOST = "localhost" 
DB_PORT = 3306 
DB_USER = "root" 
DB_PASSWORD = "MANOJARUNA@2005" 
DB_NAME = "money_tracker"

# ========================================
# MYSQL CONNECTION
# ========================================

def get_db_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        connection_timeout=10
    )


def close_db(connection=None, cursor=None):

    if cursor is not None:
        cursor.close()

    if connection is not None and connection.is_connected():
        connection.close()


def db_error(operation, error):

    app.logger.exception("%s failed", operation)

    return jsonify({
        "error": "Database operation failed",
        "details": str(error)
    }), 500


# ========================================
# AUTOMATIC END OF THE MONTH
# ========================================

def ensure_month_end_records(connection):

    cursor = connection.cursor()

    try:

        today = date.today()

        current_month_start = today.replace(day=1)

        # Find all completed months
        cursor.execute("""
            SELECT DISTINCT
                YEAR(transaction_date),
                MONTH(transaction_date)
            FROM transactions
            WHERE type IN ('income', 'expense')
              AND transaction_date < %s
            ORDER BY
                YEAR(transaction_date),
                MONTH(transaction_date)
        """, (current_month_start,))

        completed_months = cursor.fetchall()

        for year, month in completed_months:

            # Calculate last date of the month
            last_day = calendar.monthrange(year, month)[1]

            month_end_date = date(year, month, last_day)

            month_key = f"{year}-{month:02d}"

            # Insert only once for each month
            cursor.execute("""
                INSERT IGNORE INTO transactions (
                    type,
                    amount,
                    category,
                    note,
                    transaction_date,
                    status,
                    month_end_month
                )
                VALUES (
                    'month_end',
                    0.00,
                    NULL,
                    'END OF THE MONTH',
                    %s,
                    'received',
                    %s
                )
            """, (
                month_end_date,
                month_key
            ))

        connection.commit()

        app.logger.info("Month-end records checked successfully")

    except Exception:

        connection.rollback()
        raise

    finally:

        cursor.close()


# ========================================
# FRONTEND
# ========================================

@app.route("/")
def home():

    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def frontend_files(filename):

    allowed = {
        ".html", ".css", ".js", ".png", ".jpg",
        ".jpeg", ".webp", ".svg", ".ico",
        ".woff", ".woff2", ".ttf"
    }

    requested = Path(filename)

    if (
        requested.suffix.lower() not in allowed
        or ".." in requested.parts
    ):

        return jsonify({
            "error": "File not found"
        }), 404

    file_path = (BASE_DIR / requested).resolve()

    if not file_path.is_relative_to(BASE_DIR):

        return jsonify({
            "error": "File not found"
        }), 404

    if not file_path.is_file():

        return jsonify({
            "error": "File not found"
        }), 404

    return send_from_directory(BASE_DIR, filename)


# ========================================
# HEALTH CHECK
# ========================================

@app.route("/api/health", methods=["GET"])
def health():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute("SELECT DATABASE()")

        database_name = cursor.fetchone()[0]

        return jsonify({
            "message": "My Money Tracker API is running",
            "database": "connected",
            "database_name": database_name
        }), 200

    except Exception as error:

        app.logger.exception("Health check failed")

        return jsonify({
            "message": "Backend is running",
            "database": "disconnected",
            "details": str(error)
        }), 503

    finally:

        close_db(connection, cursor)


# ========================================
# TRANSACTIONS - GET ALL
# ========================================

@app.route("/api/transactions", methods=["GET"])
def get_transactions():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()

        # Automatically close completed months
        ensure_month_end_records(connection)

        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                id,
                type,
                amount,
                category,
                note,
                transaction_date,
                status,
                created_at
            FROM transactions

            ORDER BY
                transaction_date DESC,
                (type = 'month_end') ASC,
                id DESC
        """)

        rows = cursor.fetchall()

        for item in rows:

            if item["amount"] is not None:
                item["amount"] = float(item["amount"])

            if item["transaction_date"] is not None:

                item["date"] = item.pop(
                    "transaction_date"
                ).isoformat()

            else:

                item["date"] = None
                item.pop("transaction_date", None)

            if item.get("created_at") is not None:

                item["created_at"] = (
                    item["created_at"].isoformat()
                )

        return jsonify(rows), 200

    except Exception as error:

        return db_error("Fetching transactions", error)

    finally:

        close_db(connection, cursor)


# ========================================
# TRANSACTIONS - ADD INCOME / EXPENSE
# ========================================

@app.route("/api/transactions", methods=["POST"])
def add_transaction():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({
            "error": "A valid JSON object is required"
        }), 400

    transaction_type = data.get("type")

    amount_value = data.get("amount")

    transaction_date = data.get(
        "transaction_date",
        data.get("date")
    )

    category = data.get("category")

    note = data.get("note")

    status = data.get("status", "received")

    if transaction_type not in ("income", "expense"):

        return jsonify({
            "error": "Type must be income or expense"
        }), 400

    try:

        if isinstance(amount_value, bool) or amount_value is None:
            raise InvalidOperation

        amount = Decimal(str(amount_value))

        if (
            not amount.is_finite()
            or amount <= 0
            or amount >= Decimal("100000000")
        ):
            raise InvalidOperation

        amount = amount.quantize(Decimal("0.01"))

    except (InvalidOperation, ValueError, TypeError):

        return jsonify({
            "error": "Invalid amount"
        }), 400

    try:

        if not isinstance(transaction_date, str):
            raise ValueError

        parsed_date = date.fromisoformat(transaction_date)

        if parsed_date.isoformat() != transaction_date:
            raise ValueError

        if parsed_date > date.today():

            return jsonify({
                "error": "Future dates are not allowed"
            }), 400

    except (ValueError, TypeError):

        return jsonify({
            "error": "Date must be YYYY-MM-DD"
        }), 400

    if category is not None:

        if not isinstance(category, str) or len(category) > 100:

            return jsonify({
                "error": "Invalid category"
            }), 400

        category = category.strip() or None

    if note is not None:

        if not isinstance(note, str) or len(note) > 255:

            return jsonify({
                "error": "Invalid note"
            }), 400

        note = note.strip() or None

    if transaction_type == "income":

        if status not in ("received", "pending"):

            return jsonify({
                "error": "Income status must be received or pending"
            }), 400

        category = category or "Salary"

    else:

        status = "received"

        category = category or "Other"

    connection = None
    cursor = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO transactions (
                type,
                amount,
                category,
                note,
                transaction_date,
                status
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            transaction_type,
            amount,
            category,
            note,
            parsed_date,
            status
        ))

        connection.commit()

        new_id = cursor.lastrowid

        return jsonify({

            "message": "Transaction saved successfully",

            "id": new_id,

            "type": transaction_type,

            "amount": float(amount),

            "category": category,

            "note": note,

            "date": parsed_date.isoformat(),

            "status": status

        }), 201

    except Exception as error:

        if connection is not None and connection.is_connected():
            connection.rollback()

        return db_error("Saving transaction", error)

    finally:

        close_db(connection, cursor)


# ========================================
# MARK PENDING INCOME AS RECEIVED
# ========================================

@app.route(
    "/api/transactions/<int:transaction_id>/receive",
    methods=["PATCH"]
)
def mark_income_received(transaction_id):

    connection = None
    cursor = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute("""
            UPDATE transactions

            SET status = 'received'

            WHERE id = %s
              AND type = 'income'
              AND status = 'pending'
        """, (transaction_id,))

        if cursor.rowcount == 0:

            connection.rollback()

            return jsonify({
                "error": "Pending income not found"
            }), 404

        connection.commit()

        return jsonify({

            "message": "Income marked as received",

            "id": transaction_id,

            "status": "received"

        }), 200

    except Exception as error:

        if connection is not None and connection.is_connected():
            connection.rollback()

        return db_error("Updating income", error)

    finally:

        close_db(connection, cursor)


# ========================================
# MONTHLY BUDGET - GET
# ========================================


@app.route("/api/budget", methods=["GET"])
def get_budget():

    connection = None
    cursor = None

    try:
        today = date.today()

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT monthly_budget
            FROM monthly_budgets
            WHERE budget_year = %s
            AND budget_month = %s
        """, (today.year, today.month))

        row = cursor.fetchone()

        budget = float(row["monthly_budget"]) if row else 0.0

        return jsonify({
            "monthly_budget": budget,
            "year": today.year,
            "month": today.month
        }), 200

    except Exception as error:
        return db_error("Loading monthly budget", error)

    finally:
        close_db(connection, cursor)


# ========================================
# MONTHLY BUDGET - SAVE / UPDATE
# ========================================


@app.route("/api/budget", methods=["PUT"])
def save_budget():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    try:
        raw_budget = data.get("monthly_budget")

        if isinstance(raw_budget, bool) or raw_budget is None:
            raise InvalidOperation

        budget = Decimal(str(raw_budget))

        if (
            not budget.is_finite()
            or budget <= 0
            or budget >= Decimal("10000000000")
        ):
            raise InvalidOperation

        budget = budget.quantize(Decimal("0.01"))

    except (InvalidOperation, ValueError, TypeError):
        return jsonify({"error": "Invalid budget amount"}), 400

    connection = None
    cursor = None

    try:
        today = date.today()

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO monthly_budgets
            (budget_year, budget_month, monthly_budget)
            VALUES (%s, %s, %s)

            ON DUPLICATE KEY UPDATE
            monthly_budget = VALUES(monthly_budget)
        """, (today.year, today.month, budget))

        connection.commit()

        return jsonify({
            "message": "Monthly budget saved successfully",
            "monthly_budget": float(budget),
            "year": today.year,
            "month": today.month
        }), 200

    except Exception as error:
        if connection is not None and connection.is_connected():
            connection.rollback()

        return db_error("Saving monthly budget", error)

    finally:
        close_db(connection, cursor)



# ========================================
# LEAVE MANAGEMENT - SAVE
# ========================================

@app.route("/api/leaves", methods=["POST"])
def add_leave():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON"}), 400

    leave_date = data.get("leave_date")
    leave_type = data.get("leave_type")
    leave_reason = data.get("leave_reason")

    if not leave_date or not leave_type:
        return jsonify({
            "error": "Date and leave type are required"
        }), 400

    try:
        parsed_date = date.fromisoformat(leave_date)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid leave date"}), 400

    if leave_type not in (
        "Personal", "Sick", "Festival", "Emergency", "Other"
    ):
        return jsonify({"error": "Invalid leave type"}), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO leave_management
            (leave_date, leave_type, leave_reason)
            VALUES (%s, %s, %s)
        """, (parsed_date, leave_type, leave_reason))

        connection.commit()

        return jsonify({
            "message": "Leave saved successfully",
            "id": cursor.lastrowid
        }), 201

    except Exception as error:
        if connection and connection.is_connected():
            connection.rollback()

        return db_error("Saving leave", error)

    finally:
        close_db(connection, cursor)

# ========================================
# START SERVER
# ========================================

if __name__ == "__main__":

    app.run(
        debug=True
    )
