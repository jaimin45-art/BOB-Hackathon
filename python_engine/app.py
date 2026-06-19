#!/usr/bin/env python3
import os
import math
from flask import Flask, request, jsonify

try:
    import numpy as np
    from sklearn.ensemble import IsolationForest
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

app = Flask(__name__)

# Baseline behavioral features: [CPM, Flight Time (ms), Scroll Speed (px/s)]
baseline_data = [
    [240.0, 120.0, 420.0],
    [235.0, 118.0, 410.0],
    [250.0, 125.0, 440.0],
    [242.0, 122.0, 425.0],
    [238.0, 119.0, 415.0],
    [245.0, 121.0, 430.0],
    [247.0, 123.0, 435.0],
    [239.0, 117.0, 412.0],
    [241.0, 120.0, 422.0],
    [246.0, 124.0, 428.0]
]

if HAS_SKLEARN:
    print("Training IsolationForest model on normal behavior baseline...")
    clf = IsolationForest(contamination=0.05, random_state=42)
    clf.fit(np.array(baseline_data))
else:
    print("Scikit-learn not available. Initializing Z-Score fallback calculator...")
    means = [sum(x[i] for x in baseline_data) / len(baseline_data) for i in range(3)]
    stds = []
    for i in range(3):
        variance = sum((x[i] - means[i]) ** 2 for x in baseline_data) / len(baseline_data)
        stds.append(math.sqrt(variance) if variance > 0 else 1.0)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "engine": "scikit-learn IsolationForest" if HAS_SKLEARN else "pure-python-zscore-fallback"
    })

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data or 'features' not in data:
            return jsonify({"error": "Missing 'features' array in request body"}), 400
        
        features = data['features']
        if len(features) != 3:
            return jsonify({"error": "Features array must contain exactly 3 floats: [cpm, flight_time, scroll_speed]"}), 400
            
        # Convert items to float
        features = [float(x) for x in features]
        
        if HAS_SKLEARN:
            # Predict anomaly score
            raw_score = clf.decision_function(np.array([features]))[0]
            # Map score (-0.5 to 0.5 typical range) to 0.0 - 1.0 anomaly probability
            anomaly_score = 1.0 - (1.0 / (1.0 + math.exp(-raw_score * 8.0)))
        else:
            # Z-score fallback calculation
            z_scores = [abs(features[i] - means[i]) / stds[i] for i in range(3)]
            avg_z = sum(z_scores) / len(z_scores)
            anomaly_score = 1.0 - math.exp(-avg_z / 1.5)
            
        return jsonify({
            "anomaly_score": round(anomaly_score, 4),
            "features_evaluated": features
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting Python Risk Scoring microservice on port {port}...")
    app.run(host='0.0.0.0', port=port)
