from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import json
import re
import joblib
import pandas as pd
import numpy as np

# ============================================================
# 1. APPLICATION CONFIGURATION
# ============================================================

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
MODELS_DIR = PROJECT_DIR / "models"
AIRPORT_CONFIG_PATH = BASE_DIR / "airport_routes.json"

MODEL_PATHS = {
    "preprocessor": MODELS_DIR / "preprocessor.pkl",
    "logistic": MODELS_DIR / "logistic_regression.pkl",
    "decision_tree": MODELS_DIR / "decision_tree.pkl",
    "linear": MODELS_DIR / "linear_regression.pkl",
    "feature_config": MODELS_DIR / "feature_config.pkl",
}

DEFAULT_FEATURES = [
    "Airline",
    "Origin",
    "Dest",
    "CRSElapsedTime",
    "Month",
    "DayOfWeek",
    "Operating_Airline",
    "DepTimeBlk",
    "ArrTimeBlk",
    "DepartureHour",
    "DepartureMinute",
    "ArrivalHour",
]

# ============================================================
# 2. LOAD TRAINED MODELS
# ============================================================

preprocessor = None
logistic_model = None
decision_tree_model = None
linear_model = None
feature_config = {}
MODELS_LOADED = False

try:
    preprocessor = joblib.load(MODEL_PATHS["preprocessor"])
    logistic_model = joblib.load(MODEL_PATHS["logistic"])
    decision_tree_model = joblib.load(MODEL_PATHS["decision_tree"])
    linear_model = joblib.load(MODEL_PATHS["linear"])

    if MODEL_PATHS["feature_config"].exists():
        feature_config = joblib.load(MODEL_PATHS["feature_config"])

    MODELS_LOADED = True
    print("FlightIQ ML models loaded successfully.")

except Exception as exc:
    print(f"Could not load FlightIQ models: {exc}")

# ============================================================
# 3. LOAD AIRPORTS AND SUPPORTED ROUTES
# ============================================================

AIRPORTS = []
AIRPORTS_BY_CODE = {}
ROUTES = {}
SCOPE = {}
AIRPORT_CONFIG_LOADED = False

try:
    if AIRPORT_CONFIG_PATH.exists():
        with open(AIRPORT_CONFIG_PATH, "r", encoding="utf-8") as file:
            airport_config = json.load(file)

        AIRPORTS = airport_config.get("airports", [])
        ROUTES = airport_config.get("routes", {})
        SCOPE = airport_config.get("scope", {})

        AIRPORTS_BY_CODE = {
            str(airport["code"]).upper(): airport
            for airport in AIRPORTS
            if airport.get("code")
        }

        ROUTES = {
            str(origin).upper(): [
                str(destination).upper()
                for destination in destinations
            ]
            for origin, destinations in ROUTES.items()
        }

        AIRPORT_CONFIG_LOADED = True

        print(
            f"Loaded {len(AIRPORTS)} airport records "
            "and the supported route network."
        )
    else:
        print("Airport configuration not found: backend/airport_routes.json")

except Exception as exc:
    print(f"Could not load airport configuration: {exc}")

# ============================================================
# 4. AIRPORT TIME ZONES
# ============================================================

# Known U.S. airport time zones. The airport configuration's
# explicit IANA timezone, when present, takes precedence.

AIRPORT_TIMEZONE_OVERRIDES = {
    "ATL": "America/New_York",
    "BOS": "America/New_York",
    "BWI": "America/New_York",
    "CLT": "America/New_York",
    "DCA": "America/New_York",
    "DTW": "America/Detroit",
    "EWR": "America/New_York",
    "FLL": "America/New_York",
    "IAD": "America/New_York",
    "JFK": "America/New_York",
    "LGA": "America/New_York",
    "MCO": "America/New_York",
    "MIA": "America/New_York",
    "PHL": "America/New_York",
    "RDU": "America/New_York",
    "TPA": "America/New_York",

    "ORD": "America/Chicago",
    "MDW": "America/Chicago",
    "DFW": "America/Chicago",
    "DAL": "America/Chicago",
    "IAH": "America/Chicago",
    "HOU": "America/Chicago",
    "MSP": "America/Chicago",
    "MCI": "America/Chicago",
    "MSY": "America/Chicago",
    "BNA": "America/Chicago",
    "STL": "America/Chicago",
    "AUS": "America/Chicago",
    "SAT": "America/Chicago",
    "MEM": "America/Chicago",

    "DEN": "America/Denver",
    "SLC": "America/Denver",
    "ABQ": "America/Denver",
    "BOI": "America/Boise",
    "PHX": "America/Phoenix",

    "LAS": "America/Los_Angeles",
    "LAX": "America/Los_Angeles",
    "SAN": "America/Los_Angeles",
    "SFO": "America/Los_Angeles",
    "SJC": "America/Los_Angeles",
    "OAK": "America/Los_Angeles",
    "PDX": "America/Los_Angeles",
    "SEA": "America/Los_Angeles",
    "SMF": "America/Los_Angeles",

    "ANC": "America/Anchorage",
    "FAI": "America/Anchorage",

    "HNL": "Pacific/Honolulu",
    "OGG": "Pacific/Honolulu",
    "LIH": "Pacific/Honolulu",
    "KOA": "Pacific/Honolulu",
}

STATE_TIMEZONES = {
    "CT": "America/New_York",
    "DE": "America/New_York",
    "GA": "America/New_York",
    "MA": "America/New_York",
    "MD": "America/New_York",
    "ME": "America/New_York",
    "NH": "America/New_York",
    "NJ": "America/New_York",
    "NY": "America/New_York",
    "NC": "America/New_York",
    "OH": "America/New_York",
    "PA": "America/New_York",
    "RI": "America/New_York",
    "SC": "America/New_York",
    "VA": "America/New_York",
    "VT": "America/New_York",
    "WV": "America/New_York",
    "DC": "America/New_York",

    "AL": "America/Chicago",
    "AR": "America/Chicago",
    "IA": "America/Chicago",
    "IL": "America/Chicago",
    "LA": "America/Chicago",
    "MN": "America/Chicago",
    "MO": "America/Chicago",
    "MS": "America/Chicago",
    "OK": "America/Chicago",
    "WI": "America/Chicago",

    "CO": "America/Denver",
    "MT": "America/Denver",
    "NM": "America/Denver",
    "UT": "America/Denver",
    "WY": "America/Denver",

    "CA": "America/Los_Angeles",
    "WA": "America/Los_Angeles",
    "OR": "America/Los_Angeles",

    "AK": "America/Anchorage",
    "HI": "Pacific/Honolulu",
    "AZ": "America/Phoenix",
}


def get_airport_timezone(airport_code):
    """Resolve an airport's timezone when it is known."""

    code = str(airport_code).strip().upper()
    airport = AIRPORTS_BY_CODE.get(code, {})

    # Prefer explicit timezone information in airport_routes.json.
    for key in (
        "timezone",
        "time_zone",
        "timezone_name",
        "tz",
        "tz_name",
        "timeZone",
        "iana_timezone",
    ):
        value = airport.get(key)

        if isinstance(value, str) and value.strip():
            try:
                return ZoneInfo(value.strip())
            except (ZoneInfoNotFoundError, ValueError):
                pass

    zone_name = AIRPORT_TIMEZONE_OVERRIDES.get(code)

    # If no airport-code mapping exists, try its state abbreviation.
    if not zone_name:
        for key in ("state_code", "state", "region", "location", "city"):
            value = airport.get(key)

            if not isinstance(value, str):
                continue

            value = value.strip().upper()

            if value in STATE_TIMEZONES:
                zone_name = STATE_TIMEZONES[value]
                break

            match = re.search(r",\s*([A-Z]{2})\s*$", value)

            if match and match.group(1) in STATE_TIMEZONES:
                zone_name = STATE_TIMEZONES[match.group(1)]
                break

    if not zone_name:
        return None

    try:
        return ZoneInfo(zone_name)
    except (ZoneInfoNotFoundError, ValueError):
        app.logger.warning(
            "Timezone unavailable for airport %s. "
            "Install the tzdata package if needed.",
            code,
        )
        return None

# ============================================================
# 5. HELPER FUNCTIONS
# ============================================================


def convert_time_to_hour_minute(value):
    """Convert HHMM, such as 930, into (9, 30)."""

    try:
        time_value = int(value)
    except (TypeError, ValueError):
        raise ValueError("Flight times must be supplied in HHMM format.")

    hour = time_value // 100
    minute = time_value % 100

    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(
            f"Invalid flight time: {value}. Use HHMM format."
        )

    return hour, minute


def time_to_block(hour):
    """Match the dataset's scheduled time-block format."""

    start = hour * 100
    end = start + 59
    return f"{start:04d}-{end:04d}"


def validate_scheduled_duration(
    flight_date,
    origin,
    destination,
    departure_time,
    arrival_time,
    entered_duration_minutes,
):
    """
    Validate duration by converting airport-local scheduled times
    to UTC. If arrival is earlier than departure in UTC, treat it
    as an arrival on the following day.

    Returns the calculated duration when both time zones are known.
    Returns None when a timezone cannot be resolved.
    """

    origin_tz = get_airport_timezone(origin)
    destination_tz = get_airport_timezone(destination)

    # Do not guess timezone offsets for unknown airports.
    if origin_tz is None or destination_tz is None:
        app.logger.warning(
            "Skipping duration consistency check for %s -> %s "
            "because an airport timezone is unknown.",
            origin,
            destination,
        )
        return None

    departure_hour, departure_minute = convert_time_to_hour_minute(
        departure_time
    )
    arrival_hour, arrival_minute = convert_time_to_hour_minute(
        arrival_time
    )

    # Use the departure's calendar date for both airport-local times.
    departure_local = datetime.combine(
        flight_date.date(),
        time(departure_hour, departure_minute),
        tzinfo=origin_tz,
    )

    arrival_local = datetime.combine(
        flight_date.date(),
        time(arrival_hour, arrival_minute),
        tzinfo=destination_tz,
    )

    departure_utc = departure_local.astimezone(timezone.utc)
    arrival_utc = arrival_local.astimezone(timezone.utc)

    # An arrival at or before departure UTC is assumed to be next day.
    if arrival_utc <= departure_utc:
        arrival_local += timedelta(days=1)
        arrival_utc = arrival_local.astimezone(timezone.utc)

    calculated_minutes = (
        arrival_utc - departure_utc
    ).total_seconds() / 60.0

    # Allow 45 minutes of tolerance for rounded or approximate schedules.
    tolerance_minutes = 45

    if abs(float(entered_duration_minutes) - calculated_minutes) > tolerance_minutes:
        hours = int(calculated_minutes // 60)
        minutes = int(round(calculated_minutes % 60))

        raise ValueError(
            f"Entered duration ({entered_duration_minutes:g} minutes) "
            f"does not match the schedule for {origin} -> {destination}. "
            f"After converting the airports' local times, the schedule "
            f"implies about {calculated_minutes:.0f} minutes "
            f"({hours} h {minutes:02d} min). Please check the flight "
            f"date, times, and airline-published duration."
        )

    return calculated_minutes


def get_expected_features():
    """Return the exact input columns expected by the preprocessor."""

    if preprocessor is not None and hasattr(
        preprocessor, "feature_names_in_"
    ):
        return list(preprocessor.feature_names_in_)

    configured = feature_config.get("features")

    if configured:
        return list(configured)

    return DEFAULT_FEATURES.copy()


def build_input_dataframe(data):
    """Build model inputs using pre-departure information only."""

    try:
        flight_date = pd.to_datetime(
            data.get("FlightDate"),
            errors="raise",
        )
    except (TypeError, ValueError):
        raise ValueError(
            "FlightDate must be a valid date, such as 2026-10-11."
        )

    if pd.isna(flight_date):
        raise ValueError("A valid FlightDate is required.")

    origin = str(data.get("Origin", "")).strip().upper()
    destination = str(data.get("Dest", "")).strip().upper()
    airline = str(data.get("Airline", "")).strip()
    operating_airline = str(
        data.get("Operating_Airline", "")
    ).strip().upper()

    if not origin or not destination:
        raise ValueError("Both Origin and Dest are required.")

    if origin == destination:
        raise ValueError(
            "Origin and destination must be different airports."
        )

    if not airline or not operating_airline:
        raise ValueError(
            "Airline and Operating_Airline are required."
        )

    try:
        departure_time = int(data["CRSDepTime"])
        arrival_time = int(data["CRSArrTime"])
        elapsed_time = float(data["CRSElapsedTime"])
    except (KeyError, TypeError, ValueError):
        raise ValueError(
            "Provide CRSDepTime, CRSArrTime, and "
            "CRSElapsedTime as valid numeric values."
        )

    if not np.isfinite(elapsed_time) or elapsed_time <= 0:
        raise ValueError(
            "CRSElapsedTime must be a positive number of minutes."
        )

    departure_hour, departure_minute = (
        convert_time_to_hour_minute(departure_time)
    )

    arrival_hour, _ = convert_time_to_hour_minute(arrival_time)

    # Validate the duration using airport-local timezones.
    validate_scheduled_duration(
        flight_date=flight_date,
        origin=origin,
        destination=destination,
        departure_time=departure_time,
        arrival_time=arrival_time,
        entered_duration_minutes=elapsed_time,
    )

    # Dataset convention: Monday = 1 through Sunday = 7.
    day_of_week = flight_date.dayofweek + 1

    row = {
        "Airline": airline,
        "Origin": origin,
        "Dest": destination,
        "CRSElapsedTime": elapsed_time,
        "Month": flight_date.month,
        "DayOfWeek": day_of_week,
        "Operating_Airline": operating_airline,
        "DepTimeBlk": time_to_block(departure_hour),
        "ArrTimeBlk": time_to_block(arrival_hour),
        "DepartureHour": departure_hour,
        "DepartureMinute": departure_minute,
        "ArrivalHour": arrival_hour,
    }

    expected_features = get_expected_features()

    # Preserve the feature order used during training.
    model_row = {
        feature: row.get(feature, np.nan)
        for feature in expected_features
    }

    model_input = pd.DataFrame([model_row])

    # Safely fill unexpected missing fields.
    for column in model_input.columns:
        if model_input[column].isna().any():
            if pd.api.types.is_numeric_dtype(model_input[column]):
                model_input[column] = model_input[column].fillna(0)
            else:
                model_input[column] = model_input[column].fillna("")

    display_input = {
        "FlightDate": flight_date.strftime("%Y-%m-%d"),
        "Airline": airline,
        "Operating_Airline": operating_airline,
        "Marketing_Airline_Network": data.get(
            "Marketing_Airline_Network",
            operating_airline,
        ),
        "Origin": origin,
        "Dest": destination,
        "CRSDepTime": departure_time,
        "CRSArrTime": arrival_time,
        "CRSElapsedTime": elapsed_time,
        "Month": flight_date.month,
        "DayofMonth": flight_date.day,
        "DayOfWeek": day_of_week,
        "DepartureHour": departure_hour,
        "DepartureMinute": departure_minute,
        "ArrivalHour": arrival_hour,
    }

    return model_input, display_input


def positive_class_probability(model, transformed_input):
    """Return the probability for the delayed-flight class, label 1."""

    if not hasattr(model, "predict_proba"):
        raise RuntimeError(
            "The classification model does not support predict_proba."
        )

    probabilities = model.predict_proba(transformed_input)[0]
    classes = list(model.classes_)

    if 1 not in classes:
        return 0.0

    return float(probabilities[classes.index(1)])

# ============================================================
# 6. HOME ENDPOINT
# ============================================================


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "project": "FlightIQ",
        "description": (
            "Intelligent Flight Delay & Operational "
            "Risk Prediction System"
        ),
        "status": "Backend is running",
        "models_loaded": MODELS_LOADED,
        "airport_config_loaded": AIRPORT_CONFIG_LOADED,
    })

# ============================================================
# 7. HEALTH CHECK
# ============================================================


@app.route("/api/health", methods=["GET"])
def health():
    if not MODELS_LOADED:
        return jsonify({
            "status": "error",
            "message": "One or more ML models could not be loaded.",
        }), 500

    return jsonify({
        "status": "healthy",
        "message": "FlightIQ backend and models are ready.",
        "airport_config_loaded": AIRPORT_CONFIG_LOADED,
    })

# ============================================================
# 8. AIRPORT LIST ENDPOINT
# ============================================================


@app.route("/api/airports", methods=["GET"])
def get_airports():
    if not AIRPORT_CONFIG_LOADED:
        return jsonify({
            "success": False,
            "message": (
                "Airport data is unavailable. "
                "Create backend/airport_routes.json."
            ),
        }), 500

    return jsonify({
        "success": True,
        "airports": AIRPORTS,
        "count": len(AIRPORTS),
        "scope": SCOPE,
    })

# ============================================================
# 9. DESTINATION OPTIONS FOR AN ORIGIN
# ============================================================


@app.route("/api/routes/<origin>", methods=["GET"])
def get_routes(origin):
    origin = origin.strip().upper()

    if not AIRPORT_CONFIG_LOADED:
        return jsonify({
            "success": False,
            "message": "Airport route data is unavailable.",
        }), 500

    if origin not in AIRPORTS_BY_CODE:
        return jsonify({
            "success": False,
            "message": f"Unsupported origin airport: {origin}.",
        }), 404

    destinations = ROUTES.get(origin, [])

    return jsonify({
        "success": True,
        "origin": origin,
        "destinations": destinations,
        "count": len(destinations),
    })

# ============================================================
# 10. FLIGHT DELAY PREDICTION
# ============================================================


@app.route("/api/predict", methods=["POST"])
def predict():
    if not MODELS_LOADED:
        return jsonify({
            "success": False,
            "message": "ML models are not loaded.",
        }), 500

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Please send a valid JSON request body.",
        }), 400

    required_fields = [
        "FlightDate",
        "Airline",
        "Operating_Airline",
        "Origin",
        "Dest",
        "CRSDepTime",
        "CRSArrTime",
        "CRSElapsedTime",
    ]

    missing_fields = [
        field for field in required_fields
        if field not in data or data[field] in (None, "")
    ]

    if missing_fields:
        return jsonify({
            "success": False,
            "message": "Some required fields are missing.",
            "missing_fields": missing_fields,
        }), 400

    origin = str(data["Origin"]).strip().upper()
    destination = str(data["Dest"]).strip().upper()

    # Backend validation applies even if the frontend dropdown filters routes.
    if origin == destination:
        return jsonify({
            "success": False,
            "message": "Origin and destination must be different airports.",
        }), 400

    # Restrict predictions to airports and routes in the configured dataset.
    if AIRPORT_CONFIG_LOADED:
        if origin not in AIRPORTS_BY_CODE:
            return jsonify({
                "success": False,
                "message": (
                    f"Origin airport '{origin}' is not "
                    "supported by the current dataset."
                ),
            }), 400

        if destination not in AIRPORTS_BY_CODE:
            return jsonify({
                "success": False,
                "message": (
                    f"Destination airport '{destination}' is not "
                    "supported by the current dataset."
                ),
            }), 400

        if destination not in ROUTES.get(origin, []):
            return jsonify({
                "success": False,
                "message": (
                    f"The route {origin} -> {destination} is not "
                    "represented in the current training dataset."
                ),
            }), 400

    try:
        model_input, display_input = build_input_dataframe(data)

        transformed_input = preprocessor.transform(model_input)

        # Logistic Regression classification.
        logistic_probability = positive_class_probability(
            logistic_model,
            transformed_input,
        )

        logistic_prediction = int(
            logistic_model.predict(transformed_input)[0]
        )

        # Decision Tree classification.
        tree_probability = positive_class_probability(
            decision_tree_model,
            transformed_input,
        )

        tree_prediction = int(
            decision_tree_model.predict(transformed_input)[0]
        )

        # Linear Regression estimates delay duration.
        predicted_delay = float(
            linear_model.predict(transformed_input)[0]
        )

        if not np.isfinite(predicted_delay):
            raise RuntimeError(
                "Linear Regression returned an invalid prediction."
            )

        # Delay duration cannot be negative in the user interface.
        predicted_delay = max(0.0, predicted_delay)

        # Combined probability is the mean of the two classifiers.
        combined_probability = (
            logistic_probability + tree_probability
        ) / 2.0

        # These thresholds are project-defined, not airline standards.
        if combined_probability >= 0.70:
            risk_level = "High"
        elif combined_probability >= 0.40:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        return jsonify({
            "success": True,
            "input": display_input,
            "prediction": {
                "delay_probability": round(
                    combined_probability * 100, 2
                ),
                "expected_delay_minutes": round(
                    predicted_delay, 2
                ),
                "risk_level": risk_level,
                "logistic_regression": {
                    "delay_probability": round(
                        logistic_probability * 100, 2
                    ),
                    "prediction": logistic_prediction,
                },
                "decision_tree": {
                    "delay_probability": round(
                        tree_probability * 100, 2
                    ),
                    "prediction": tree_prediction,
                },
            },
        })

    except (ValueError, TypeError, KeyError) as exc:
        return jsonify({
            "success": False,
            "message": str(exc),
        }), 400

    except Exception as exc:
        app.logger.exception("FlightIQ prediction failed.")

        return jsonify({
            "success": False,
            "message": "Prediction failed.",
            "error": str(exc),
        }), 500

# ============================================================
# 11. START THE SERVER
# ============================================================

if __name__ == "__main__":
    print("=" * 55)
    print("FlightIQ Backend")
    print("=" * 55)
    print(f"ML models loaded: {MODELS_LOADED}")
    print(f"Airport configuration loaded: {AIRPORT_CONFIG_LOADED}")

    if AIRPORT_CONFIG_LOADED:
        print(f"Supported airports: {len(AIRPORTS)}")
        print(f"Origin airports with routes: {len(ROUTES)}")

    print("=" * 55)

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
    )