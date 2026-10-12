# ==========================================
# GuardianMap - Build ML Dataset
# ==========================================

from datetime import datetime

from app.core.database import SessionLocal
from app.models.models import SafetyReport

from app.services.ml_dataset import create_training_row


def build_dataset():

    db = SessionLocal()

    try:

        reports = (
            db.query(SafetyReport)
            .filter(SafetyReport.status == "active")
            .all()
        )

        print()
        print("==========================================")
        print("GuardianMap ML Dataset")
        print("==========================================")
        print(f"Active safety reports found: {len(reports)}")
        print()

        if not reports:
            print("No safety reports available.")
            print("Create a few safety reports first.")
            return

        dataset = []

        for report in reports:

            severity = int(
                getattr(report, "severity", 3) or 3
            )

            verified = int(
                bool(
                    getattr(
                        report,
                        "verified",
                        False
                    )
                )
            )

            row = create_training_row(
                distance_km=0.0,
                report_count=1,
                verified_reports=verified,
                average_severity=severity,
                nearest_report_distance_km=0.0,
                average_report_distance_km=0.0,
                safe_place_count=0,
                current_hour=datetime.now().hour
            )

            row["report_latitude"] = float(
                report.latitude
            )

            row["report_longitude"] = float(
                report.longitude
            )

            row["category"] = (
                getattr(
                    report,
                    "category",
                    "unknown"
                )
            )

            dataset.append(row)

        print("Dataset rows created:", len(dataset))
        print()

        for index, row in enumerate(dataset, start=1):

            print(f"Row {index}:")
            print(row)
            print()

    finally:

        db.close()


if __name__ == "__main__":
    build_dataset()