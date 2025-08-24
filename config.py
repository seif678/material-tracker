import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///tracker.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Inventory starting capacities (change as needed)
    RIPPON_CAPACITY = int(os.environ.get("RIPPON_CAPACITY", 50))
    LABELS_CAPACITY = int(os.environ.get("LABELS_CAPACITY", 30))
