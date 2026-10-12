# ==========================================
# GuardianMap - Train Safety ML Model
# ==========================================

from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

from app.services.training_data import generate_training_data
from app.services.ml_dataset import get_feature_names


MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"
MODEL_DIR.mkdir(exist_ok=True)

MODEL_PATH = MODEL_DIR / "guardian_safety_model.joblib"


def train_model():

    print()
    print("==========================================")
    print("GuardianMap Safety ML Training")
    print("==========================================")

    # --------------------------------------
    # 1. Generate training data
    # --------------------------------------

    X, y = generate_training_data(1000)

    print(f"Training samples: {len(X)}")
    print(f"Features: {len(X[0])}")

    # --------------------------------------
    # 2. Split training/testing data
    # --------------------------------------

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y
    )

    print(f"Training set: {len(X_train)}")
    print(f"Testing set: {len(X_test)}")

    # --------------------------------------
    # 3. Create Random Forest model
    # --------------------------------------

    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=8,
        random_state=42,
        class_weight="balanced"
    )

    # --------------------------------------
    # 4. Train
    # --------------------------------------

    print()
    print("Training Random Forest...")

    model.fit(X_train, y_train)

    # --------------------------------------
    # 5. Test model
    # --------------------------------------

    predictions = model.predict(X_test)

    accuracy = accuracy_score(
        y_test,
        predictions
    )

    print()
    print("Model accuracy:")
    print(f"{accuracy * 100:.2f}%")

    print()
    print("Classification report:")
    print(
        classification_report(
            y_test,
            predictions,
            target_names=[
                "Low",
                "Moderate",
                "High"
            ]
        )
    )

    # --------------------------------------
    # 6. Feature importance
    # --------------------------------------

    print("Feature importance:")

    feature_names = get_feature_names()

    importance = model.feature_importances_

    for name, value in sorted(
        zip(feature_names, importance),
        key=lambda x: x[1],
        reverse=True
    ):
        print(
            f"{name}: {value:.4f}"
        )

    # --------------------------------------
    # 7. Save trained model
    # --------------------------------------

    joblib.dump(
        {
            "model": model,
            "feature_names": feature_names
        },
        MODEL_PATH
    )

    print()
    print("==========================================")
    print("Model training successful.")
    print(f"Saved to: {MODEL_PATH}")
    print("==========================================")


if __name__ == "__main__":
    train_model()