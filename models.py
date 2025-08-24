from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class ConsumptionRecord(db.Model):
    __tablename__ = "consumption_records"
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True, nullable=False)
    date = db.Column(db.String(10), index=True, nullable=False)  # YYYY-MM-DD
    day = db.Column(db.String(20), nullable=False)
    line = db.Column(db.String(50), index=True, nullable=False)
    shift_leader = db.Column(db.String(100), nullable=False)
    rippon = db.Column(db.Integer, nullable=False)
    labels = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M"),
            "date": self.date,
            "day": self.day,
            "line": self.line,
            "shiftLeader": self.shift_leader,
            "rippon": self.rippon,
            "labels": self.labels,
            "notes": self.notes or ""
        }
