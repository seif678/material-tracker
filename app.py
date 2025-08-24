from flask import Flask, render_template, request, jsonify, send_file, Response
from datetime import datetime
from io import StringIO
import csv

from config import Config
from models import db, ConsumptionRecord

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    with app.app_context():
        db.create_all()

    @app.route("/")
    def index():
        return render_template("index.html")

    # --- API Endpoints ---

    @app.get("/api/records")
    def api_records():
        # optional filters: date, line
        q = ConsumptionRecord.query
        date = request.args.get("date")
        line = request.args.get("line")
        if date:
            q = q.filter(ConsumptionRecord.date == date)
        if line:
            q = q.filter(ConsumptionRecord.line == line)
        records = q.order_by(ConsumptionRecord.timestamp.desc()).all()
        return jsonify([r.to_dict() for r in records])

    @app.post("/api/records")
    def api_add_record():
        data = request.get_json(silent=True) or request.form
        line = (data.get("productionLine") or data.get("line") or "").strip()
        shift_leader = (data.get("shiftLeader") or "").strip()
        rippon = int(data.get("ripponAmount") or data.get("rippon") or 0)
        labels = int(data.get("labelAmount") or data.get("labels") or 0)
        notes = data.get("notes", "")

        if not line or not shift_leader or rippon is None or labels is None:
            return jsonify({"error": "Missing required fields"}), 400

        now = datetime.utcnow()
        record = ConsumptionRecord(
            timestamp=now,
            date=now.strftime("%Y-%m-%d"),
            day=now.strftime("%A"),
            line=line,
            shift_leader=shift_leader,
            rippon=rippon,
            labels=labels,
            notes=notes
        )
        db.session.add(record)
        db.session.commit()
        return jsonify(record.to_dict()), 201

    @app.delete("/api/records/<int:record_id>")
    def api_delete_record(record_id):
        record = ConsumptionRecord.query.get_or_404(record_id)
        db.session.delete(record)
        db.session.commit()
        return jsonify({"success": True})

    @app.get("/api/stats")
    def api_stats():
        # Aggregate totals and structures for charts
        records = ConsumptionRecord.query.all()
        total_rippon = sum(r.rippon for r in records)
        total_labels = sum(r.labels for r in records)

        # daily grouped
        by_date = {}
        for r in records:
            by_date.setdefault(r.date, {"rippon": 0, "labels": 0})
            by_date[r.date]["rippon"] += r.rippon
            by_date[r.date]["labels"] += r.labels

        # line grouped
        lines = ["Line 1", "Line 2", "Line 3", "Line 4", "Line 6", "Line 7"]
        by_line = {ln: {"rippon": 0, "labels": 0} for ln in lines}
        for r in records:
            if r.line not in by_line:
                by_line[r.line] = {"rippon": 0, "labels": 0}
            by_line[r.line]["rippon"] += r.rippon
            by_line[r.line]["labels"] += r.labels

        rippon_capacity = Config.RIPPON_CAPACITY
        labels_capacity = Config.LABELS_CAPACITY
        rippon_remaining = max(0, rippon_capacity - total_rippon)
        labels_remaining = max(0, labels_capacity - total_labels)

        # Average per day for projection
        days = max(1, len(set(r.date for r in records)))
        avg_rippon = total_rippon / days if days else 0
        avg_labels = total_labels / days if days else 0

        return jsonify({
            "totals": {
                "rippon": total_rippon,
                "labels": total_labels,
                "recordsCount": len(records)
            },
            "byDate": by_date,
            "byLine": by_line,
            "inventory": {
                "ripponCapacity": rippon_capacity,
                "labelsCapacity": labels_capacity,
                "ripponRemaining": rippon_remaining,
                "labelsRemaining": labels_remaining
            },
            "averages": {
                "dailyRippon": avg_rippon,
                "dailyLabels": avg_labels
            }
        })

    @app.get("/export/csv")
    def export_csv():
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Day", "Production Line", "Rippon Used", "Labels Used", "Shift Leader", "Notes"])
        for r in ConsumptionRecord.query.order_by(ConsumptionRecord.timestamp.asc()).all():
            writer.writerow([r.date, r.day, r.line, r.rippon, r.labels, r.shift_leader, r.notes or ""])
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=material_consumption.csv"}
        )

    @app.get("/export/json")
    def export_json():
        payload = [r.to_dict() for r in ConsumptionRecord.query.order_by(ConsumptionRecord.timestamp.asc()).all()]
        return jsonify(payload)

    return app

app = create_app()
