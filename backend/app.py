#!/usr/bin/env python3
"""
Flask API for Romanian Elections 2025 Visualization
Serves attendance and results data
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import os
import json
from datetime import datetime
import logging
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

# Import the data update functions
from update_data import process_presence_data, generate_results_data, update_existing_data

app = Flask(__name__, static_folder='../frontend/build')
CORS(app)  # Enable CORS for all routes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Path to data directory
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')

# Route for serving React app
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route('/')
def index():
    return jsonify({
        "message": "Romanian Elections 2025 API",
        "endpoints": {
            "GET /attendance": "Get attendance data for all counties",
            "GET /attendance/<county>": "Get attendance data for a specific county",
            "GET /results": "Get election results for all counties",
            "GET /results/<county>": "Get election results for a specific county",
            "GET /demographic": "Get demographic breakdown of voters",
            "GET /clustering": "Get clustering of voting stations based on demographics",
            "GET /data/last_update": "Get last update timestamp of the data",
            "POST /trigger/update": "Trigger data update manually (admin only)"
        }
    })

@app.route('/attendance', methods=['GET'])
def get_attendance():
    try:
        # Check if attendance data file exists
        csv_path = os.path.join(DATA_DIR, 'attendance.csv')
        if not os.path.exists(csv_path):
            # If file doesn't exist, try to generate it from the presence file
            presence_file = os.path.join(DATA_DIR, 'presence_2024-12-02_07-00.csv')
            if os.path.exists(presence_file):
                process_presence_data(presence_file)
            else:
                return jsonify({"error": "Attendance data not available"}), 404
        
        # Read attendance data
        df = pd.read_csv(csv_path)
        
        # Convert NumPy types to native Python types for JSON serialization
        for col in df.select_dtypes(include=['int64', 'float64']).columns:
            if 'int' in str(df[col].dtype):
                df[col] = df[col].astype(int)
            elif 'float' in str(df[col].dtype):
                df[col] = df[col].astype(float)
        
        # Convert to dictionary for JSON response
        attendance_data = df.to_dict(orient='records')
        
        # Get last update timestamp
        if attendance_data and 'timestamp' in attendance_data[0]:
            last_update = attendance_data[0]['timestamp']
        else:
            last_update = "Unknown"
        
        return jsonify({
            "data": attendance_data,
            "last_update": last_update
        })
    except Exception as e:
        logger.error(f"Error in get_attendance: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/attendance/<county>', methods=['GET'])
def get_county_attendance(county):
    try:
        # Check if attendance data file exists
        csv_path = os.path.join(DATA_DIR, 'attendance.csv')
        if not os.path.exists(csv_path):
            return jsonify({"error": "Attendance data not available"}), 404
        
        # Read attendance data
        df = pd.read_csv(csv_path)
        
        # Find data for the requested county
        county_data = df[df['county'].str.lower() == county.lower()]
        
        if county_data.empty:
            return jsonify({"error": f"No data found for county: {county}"}), 404
        
        # Convert NumPy types to native Python types for JSON serialization
        for col in county_data.select_dtypes(include=['int64', 'float64']).columns:
            if 'int' in str(county_data[col].dtype):
                county_data[col] = county_data[col].astype(int)
            elif 'float' in str(county_data[col].dtype):
                county_data[col] = county_data[col].astype(float)
        
        # Convert to dictionary for JSON response
        county_data_dict = county_data.to_dict(orient='records')[0]
        
        return jsonify({
            "data": county_data_dict,
            "county": county,
            "last_update": county_data_dict.get('timestamp', "Unknown")
        })
    except Exception as e:
        logger.error(f"Error in get_county_attendance: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/results', methods=['GET'])
def get_results():
    try:
        # Check if results data file exists
        csv_path = os.path.join(DATA_DIR, 'results.csv')
        if not os.path.exists(csv_path):
            # If file doesn't exist, try to generate it
            generate_results_data()
            if not os.path.exists(csv_path):
                return jsonify({"error": "Results data not available"}), 404
        
        # Read results data
        df = pd.read_csv(csv_path)
        
        # Convert NumPy types to native Python types for JSON serialization
        for col in df.select_dtypes(include=['int64', 'float64']).columns:
            if 'int' in str(df[col].dtype):
                df[col] = df[col].astype(int)
            elif 'float' in str(df[col].dtype):
                df[col] = df[col].astype(float)
        
        # Convert to dictionary for JSON response
        results_data = df.to_dict(orient='records')
        
        # Get last update timestamp
        if results_data and 'timestamp' in results_data[0]:
            last_update = results_data[0]['timestamp']
        else:
            last_update = "Unknown"
        
        return jsonify({
            "data": results_data,
            "last_update": last_update
        })
    except Exception as e:
        logger.error(f"Error in get_results: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/results/<county>', methods=['GET'])
def get_county_results(county):
    try:
        # Check if results data file exists
        csv_path = os.path.join(DATA_DIR, 'results.csv')
        if not os.path.exists(csv_path):
            return jsonify({"error": "Results data not available"}), 404
        
        # Read results data
        df = pd.read_csv(csv_path)
        
        # Find data for the requested county
        county_data = df[df['county'].str.lower() == county.lower()]
        
        if county_data.empty:
            return jsonify({"error": f"No data found for county: {county}"}), 404
        
        # Convert to dictionary for JSON response
        county_data_dict = county_data.to_dict(orient='records')[0]
        
        return jsonify({
            "data": county_data_dict,
            "county": county,
            "last_update": county_data_dict.get('timestamp', "Unknown")
        })
    except Exception as e:
        logger.error(f"Error in get_county_results: {e}")
        return jsonify({"error": str(e)}), 500
    return jsonify(corr)

@app.route('/demographic', methods=['GET'])
def get_demographic():
    try:
        # Check if attendance data file exists
        csv_path = os.path.join(DATA_DIR, 'attendance.csv')
        if not os.path.exists(csv_path):
            return jsonify({"error": "Demographic data not available"}), 404
        
        # Read attendance data which includes demographic information
        df = pd.read_csv(csv_path)
        
        # Check if essential demographic columns exist
        basic_demographic_columns = ['male_voters', 'female_voters', 'age_18_24', 'age_25_34', 
                              'age_35_44', 'age_45_64', 'age_65_plus', 'urban_stations', 'rural_stations']
        
        if not all(col in df.columns for col in basic_demographic_columns):
            return jsonify({"error": "Basic demographic data columns missing in attendance data"}), 404
        
        # Calculate national totals and convert numpy types to native Python types
        national_totals = {
            'total_votes': int(df['votes_cast'].sum()),
            'male_voters': int(df['male_voters'].sum()),
            'female_voters': int(df['female_voters'].sum()),
            'age_18_24': int(df['age_18_24'].sum()),
            'age_25_34': int(df['age_25_34'].sum()),
            'age_35_44': int(df['age_35_44'].sum()),
            'age_45_64': int(df['age_45_64'].sum()),
            'age_65_plus': int(df['age_65_plus'].sum()),
            'urban_stations': int(df['urban_stations'].sum()),
            'rural_stations': int(df['rural_stations'].sum()),
        }
        
        # Define urban/rural columns we need
        urban_rural_columns = ['urban_votes', 'rural_votes',
                               'urban_male_voters', 'urban_female_voters',
                               'rural_male_voters', 'rural_female_voters',
                               'urban_age_18_24', 'urban_age_25_34', 'urban_age_35_44', 
                               'urban_age_45_64', 'urban_age_65_plus',
                               'rural_age_18_24', 'rural_age_25_34', 'rural_age_35_44', 
                               'rural_age_45_64', 'rural_age_65_plus']
        
        # Check if urban/rural data already exists in the CSV
        has_urban_rural_data = all(col in df.columns for col in urban_rural_columns)
        
        # If data doesn't exist, we'll estimate it based on station counts
        if not has_urban_rural_data:
            # Calculate estimated urban/rural votes based on station counts
            total_stations = df['urban_stations'] + df['rural_stations']
            df['urban_votes'] = (df['votes_cast'] * df['urban_stations'] / total_stations).round().fillna(0).astype(int)
            df['rural_votes'] = (df['votes_cast'] * df['rural_stations'] / total_stations).round().fillna(0).astype(int)
            
            # Calculate estimated urban/rural gender data
            df['urban_male_voters'] = (df['male_voters'] * df['urban_votes'] / df['votes_cast']).round().fillna(0).astype(int)
            df['urban_female_voters'] = (df['female_voters'] * df['urban_votes'] / df['votes_cast']).round().fillna(0).astype(int)
            df['rural_male_voters'] = (df['male_voters'] * df['rural_votes'] / df['votes_cast']).round().fillna(0).astype(int)
            df['rural_female_voters'] = (df['female_voters'] * df['rural_votes'] / df['votes_cast']).round().fillna(0).astype(int)
            
            # Calculate estimated urban/rural age data
            for age_group in ['age_18_24', 'age_25_34', 'age_35_44', 'age_45_64', 'age_65_plus']:
                df[f'urban_{age_group}'] = (df[age_group] * df['urban_votes'] / df['votes_cast']).round().fillna(0).astype(int)
                df[f'rural_{age_group}'] = (df[age_group] * df['rural_votes'] / df['votes_cast']).round().fillna(0).astype(int)
            
            # Now we have the urban/rural data available
            has_urban_rural_data = True
        
        # Calculate national totals
        urban_rural_totals = {col: int(df[col].sum()) for col in urban_rural_columns}
        national_totals.update(urban_rural_totals)
        
        # Calculate percentages
        total_votes = national_totals['total_votes']
        if total_votes > 0:
            # Basic demographic percentages
            national_totals['male_percentage'] = round(national_totals['male_voters'] / total_votes * 100, 1)
            national_totals['female_percentage'] = round(national_totals['female_voters'] / total_votes * 100, 1)
            national_totals['age_18_24_percentage'] = round(national_totals['age_18_24'] / total_votes * 100, 1)
            national_totals['age_25_34_percentage'] = round(national_totals['age_25_34'] / total_votes * 100, 1)
            national_totals['age_35_44_percentage'] = round(national_totals['age_35_44'] / total_votes * 100, 1)
            national_totals['age_45_64_percentage'] = round(national_totals['age_45_64'] / total_votes * 100, 1)
            national_totals['age_65_plus_percentage'] = round(national_totals['age_65_plus'] / total_votes * 100, 1)
            
            # Urban/rural percentages if available
            if has_urban_rural_data:
                # Overall urban/rural split
                national_totals['urban_percentage'] = round(national_totals['urban_votes'] / total_votes * 100, 1)
                national_totals['rural_percentage'] = round(national_totals['rural_votes'] / total_votes * 100, 1)
                
                # Gender percentages within urban
                if national_totals['urban_votes'] > 0:
                    national_totals['urban_male_percentage'] = round(national_totals['urban_male_voters'] / national_totals['urban_votes'] * 100, 1)
                    national_totals['urban_female_percentage'] = round(national_totals['urban_female_voters'] / national_totals['urban_votes'] * 100, 1)
                
                # Gender percentages within rural
                if national_totals['rural_votes'] > 0:
                    national_totals['rural_male_percentage'] = round(national_totals['rural_male_voters'] / national_totals['rural_votes'] * 100, 1)
                    national_totals['rural_female_percentage'] = round(national_totals['rural_female_voters'] / national_totals['rural_votes'] * 100, 1)
                
                # Age percentages within urban
                if national_totals['urban_votes'] > 0:
                    national_totals['urban_age_18_24_percentage'] = round(national_totals['urban_age_18_24'] / national_totals['urban_votes'] * 100, 1)
                    national_totals['urban_age_25_34_percentage'] = round(national_totals['urban_age_25_34'] / national_totals['urban_votes'] * 100, 1)
                    national_totals['urban_age_35_44_percentage'] = round(national_totals['urban_age_35_44'] / national_totals['urban_votes'] * 100, 1)
                    national_totals['urban_age_45_64_percentage'] = round(national_totals['urban_age_45_64'] / national_totals['urban_votes'] * 100, 1)
                    national_totals['urban_age_65_plus_percentage'] = round(national_totals['urban_age_65_plus'] / national_totals['urban_votes'] * 100, 1)
                
                # Age percentages within rural
                if national_totals['rural_votes'] > 0:
                    national_totals['rural_age_18_24_percentage'] = round(national_totals['rural_age_18_24'] / national_totals['rural_votes'] * 100, 1)
                    national_totals['rural_age_25_34_percentage'] = round(national_totals['rural_age_25_34'] / national_totals['rural_votes'] * 100, 1)
                    national_totals['rural_age_35_44_percentage'] = round(national_totals['rural_age_35_44'] / national_totals['rural_votes'] * 100, 1)
                    national_totals['rural_age_45_64_percentage'] = round(national_totals['rural_age_45_64'] / national_totals['rural_votes'] * 100, 1)
                    national_totals['rural_age_65_plus_percentage'] = round(national_totals['rural_age_65_plus'] / national_totals['rural_votes'] * 100, 1)
        
        # Get county level demographic data
        county_demographics = []
        for _, row in df.iterrows():
            county_votes = int(row['votes_cast'])
            county_data = {
                'county': row['county'],
                'total_votes': county_votes,
                'male_voters': int(row['male_voters']),
                'female_voters': int(row['female_voters']),
                'age_18_24': int(row['age_18_24']),
                'age_25_34': int(row['age_25_34']),
                'age_35_44': int(row['age_35_44']),
                'age_45_64': int(row['age_45_64']),
                'age_65_plus': int(row['age_65_plus']),
                'urban_stations': int(row['urban_stations']),
                'rural_stations': int(row['rural_stations'])
            }
            
            # Add county level urban/rural data
            if has_urban_rural_data:
                urban_rural_data = {col: int(row[col]) for col in urban_rural_columns}
                county_data.update(urban_rural_data)
            
            # Calculate percentages for this county
            if county_votes > 0:
                # Basic demographic percentages
                county_data['male_percentage'] = round(county_data['male_voters'] / county_votes * 100, 1)
                county_data['female_percentage'] = round(county_data['female_voters'] / county_votes * 100, 1)
                county_data['age_18_24_percentage'] = round(county_data['age_18_24'] / county_votes * 100, 1)
                county_data['age_25_34_percentage'] = round(county_data['age_25_34'] / county_votes * 100, 1)
                county_data['age_35_44_percentage'] = round(county_data['age_35_44'] / county_votes * 100, 1)
                county_data['age_45_64_percentage'] = round(county_data['age_45_64'] / county_votes * 100, 1)
                county_data['age_65_plus_percentage'] = round(county_data['age_65_plus'] / county_votes * 100, 1)
                
                # Urban/rural percentages if available
                if has_urban_rural_data:
                    # Overall urban/rural split for county
                    county_data['urban_percentage'] = round(county_data['urban_votes'] / county_votes * 100, 1)
                    county_data['rural_percentage'] = round(county_data['rural_votes'] / county_votes * 100, 1)
                    
                    # Gender percentages within urban
                    if county_data['urban_votes'] > 0:
                        county_data['urban_male_percentage'] = round(county_data['urban_male_voters'] / county_data['urban_votes'] * 100, 1)
                        county_data['urban_female_percentage'] = round(county_data['urban_female_voters'] / county_data['urban_votes'] * 100, 1)
                    
                    # Gender percentages within rural
                    if county_data['rural_votes'] > 0:
                        county_data['rural_male_percentage'] = round(county_data['rural_male_voters'] / county_data['rural_votes'] * 100, 1)
                        county_data['rural_female_percentage'] = round(county_data['rural_female_voters'] / county_data['rural_votes'] * 100, 1)
                    
                    # Age percentages within urban
                    if county_data['urban_votes'] > 0:
                        county_data['urban_age_18_24_percentage'] = round(county_data['urban_age_18_24'] / county_data['urban_votes'] * 100, 1)
                        county_data['urban_age_25_34_percentage'] = round(county_data['urban_age_25_34'] / county_data['urban_votes'] * 100, 1)
                        county_data['urban_age_35_44_percentage'] = round(county_data['urban_age_35_44'] / county_data['urban_votes'] * 100, 1)
                        county_data['urban_age_45_64_percentage'] = round(county_data['urban_age_45_64'] / county_data['urban_votes'] * 100, 1)
                        county_data['urban_age_65_plus_percentage'] = round(county_data['urban_age_65_plus'] / county_data['urban_votes'] * 100, 1)
                    
                    # Age percentages within rural
                    if county_data['rural_votes'] > 0:
                        county_data['rural_age_18_24_percentage'] = round(county_data['rural_age_18_24'] / county_data['rural_votes'] * 100, 1)
                        county_data['rural_age_25_34_percentage'] = round(county_data['rural_age_25_34'] / county_data['rural_votes'] * 100, 1)
                        county_data['rural_age_35_44_percentage'] = round(county_data['rural_age_35_44'] / county_data['rural_votes'] * 100, 1)
                        county_data['rural_age_45_64_percentage'] = round(county_data['rural_age_45_64'] / county_data['rural_votes'] * 100, 1)
                        county_data['rural_age_65_plus_percentage'] = round(county_data['rural_age_65_plus'] / county_data['rural_votes'] * 100, 1)
            
            county_demographics.append(county_data)
        
        # Get last update timestamp
        last_update = df['timestamp'].iloc[0] if not df.empty else "Unknown"
        
        return jsonify({
            "national": national_totals,
            "counties": county_demographics,
            "last_update": last_update,
            "has_urban_rural_data": has_urban_rural_data
        })
    except Exception as e:
        logger.error(f"Error in get_demographic: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/data/last_update', methods=['GET'])
def get_last_update():
    try:
        attendance_path = os.path.join(DATA_DIR, 'attendance.csv')
        results_path = os.path.join(DATA_DIR, 'results.csv')
        
        attendance_timestamp = "Not available"
        results_timestamp = "Not available"
        
        if os.path.exists(attendance_path):
            df = pd.read_csv(attendance_path)
            if not df.empty and 'timestamp' in df.columns:
                attendance_timestamp = df['timestamp'].iloc[0]
        
        if os.path.exists(results_path):
            df = pd.read_csv(results_path)
            if not df.empty and 'timestamp' in df.columns:
                results_timestamp = df['timestamp'].iloc[0]
        
        return jsonify({
            "attendance_last_update": attendance_timestamp,
            "results_last_update": results_timestamp
        })
    except Exception as e:
        logger.error(f"Error in get_last_update: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/trigger/update', methods=['POST'])
def trigger_update():
    try:
        # Simple API key check for security (should be improved in production)
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != os.environ.get('UPDATE_API_KEY', 'your-secure-api-key'):
            return jsonify({"error": "Unauthorized"}), 401
        
        # Check for request parameters
        data = request.get_json() or {}
        fresh = data.get('fresh', False)
        
        if fresh:
            # Look for the presence file
            presence_file = os.path.join(DATA_DIR, 'presence_2024-12-02_07-00.csv')
            if os.path.exists(presence_file):
                process_presence_data(presence_file)
            else:
                from update_data import generate_attendance_data
                generate_attendance_data()
            generate_results_data()
        else:
            update_existing_data()
        
        return jsonify({
            "message": "Data update triggered successfully",
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
    except Exception as e:
        logger.error(f"Error in trigger_update: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/original-presence', methods=['GET'])
def get_original_presence():
    """Return the original presence CSV file"""
    try:
        presence_file = os.path.join(DATA_DIR, 'presence_2024-12-02_07-00.csv')
        if not os.path.exists(presence_file):
            return jsonify({"error": "Original presence data not available"}), 404
        
        # Return the file as attachment
        return send_from_directory(DATA_DIR, 'presence_2024-12-02_07-00.csv', as_attachment=True)
    except Exception as e:
        logger.error(f"Error in get_original_presence: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/clustering', methods=['GET'])
def get_clustering():
    try:
        # Use presence_now.csv from the Cluster directory
        cluster_dir = os.path.join(DATA_DIR, 'Cluster')
        if not os.path.exists(cluster_dir):
            return jsonify({"error": "Cluster data directory not found"}), 404
        
        # Use specifically presence_now.csv file
        presence_file_path = os.path.join(cluster_dir, 'presence_now.csv')
        if not os.path.exists(presence_file_path):
            return jsonify({"error": "presence_now.csv file not found in Cluster directory"}), 404
        
        logger.info(f"Using presence file for clustering: {presence_file_path}")
        
        # Read presence data (with comment handling for any file header comments)
        df = pd.read_csv(presence_file_path, comment='//', engine='python')
        
        # Demographic columns to use for clustering
        demographic_columns = [
            'Barbati 18-24', 'Barbati 25-34', 'Barbati 35-44', 'Barbati 45-64', 'Barbati 65+',
            'Femei 18-24', 'Femei 25-34', 'Femei 35-44', 'Femei 45-64', 'Femei 65+'
        ]
        
        # Check if all demographic columns exist
        if not all(col in df.columns for col in demographic_columns):
            return jsonify({"error": "Required demographic columns missing in presence data"}), 400
        
        # Get desired clustering level from query parameters
        cluster_level = request.args.get('level', 'county').lower()
        n_clusters = int(request.args.get('n_clusters', 5))
        
        # Define unique identifiers based on cluster level
        if cluster_level == 'county':
            group_by_columns = ['Judet']
        elif cluster_level == 'town':
            group_by_columns = ['Judet', 'Localitate']
        elif cluster_level == 'polling':
            group_by_columns = ['Judet', 'Localitate', 'Nume sectie de votare']
        else:
            return jsonify({"error": f"Invalid clustering level: {cluster_level}. Must be one of: county, town, polling"}), 400
        
        # Group data by the specified level and aggregate demographics
        grouped_df = df.groupby(group_by_columns).agg({
            'Înscriși pe liste permanente': 'sum',
            'LP': 'sum',  # Votes cast
            **{col: 'sum' for col in demographic_columns}
        }).reset_index()
        
        # Filter out rows with zero votes to avoid division by zero
        grouped_df = grouped_df[grouped_df['LP'] > 0]
        
        # If we have too few rows for the requested number of clusters, reduce n_clusters
        if len(grouped_df) <= n_clusters:
            n_clusters = max(2, len(grouped_df) - 1)
            logger.warning(f"Too few data points for requested clusters. Reducing to {n_clusters} clusters.")
        
        # Calculate percentages instead of raw numbers for better clustering
        for col in demographic_columns:
            grouped_df[f'{col}_pct'] = (grouped_df[col] / grouped_df['LP'] * 100).clip(0, 100)
        
        # Prepare data for clustering
        features = [f'{col}_pct' for col in demographic_columns]
        
        # Check for NaN or infinite values and replace them
        X = grouped_df[features].replace([np.inf, -np.inf], np.nan).fillna(0).values
        
        # Safety check for extreme values
        X = np.clip(X, 0, 100)
        
        # Standardize the data
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Perform K-means clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        grouped_df['cluster'] = kmeans.fit_predict(X_scaled)
        
        # Calculate cluster centers
        cluster_centers = pd.DataFrame(
            scaler.inverse_transform(kmeans.cluster_centers_),
            columns=features
        )
        
        # Rename columns for clarity in response
        cluster_centers_dict = {}
        for i, row in cluster_centers.iterrows():
            cluster_centers_dict[i] = {
                'male_18_24_pct': float(row['Barbati 18-24_pct']),
                'male_25_34_pct': float(row['Barbati 25-34_pct']),
                'male_35_44_pct': float(row['Barbati 35-44_pct']),
                'male_45_64_pct': float(row['Barbati 45-64_pct']),
                'male_65_plus_pct': float(row['Barbati 65+_pct']),
                'female_18_24_pct': float(row['Femei 18-24_pct']),
                'female_25_34_pct': float(row['Femei 25-34_pct']),
                'female_35_44_pct': float(row['Femei 35-44_pct']),
                'female_45_64_pct': float(row['Femei 45-64_pct']),
                'female_65_plus_pct': float(row['Femei 65+_pct']),
            }
        
        # Perform PCA for 2D visualization
        pca = PCA(n_components=2)
        principal_components = pca.fit_transform(X_scaled)
        grouped_df['pca_x'] = principal_components[:, 0]
        grouped_df['pca_y'] = principal_components[:, 1]
        
        # Prepare response data
        result = {
            "cluster_level": cluster_level,
            "n_clusters": n_clusters,
            "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
            "cluster_centers": cluster_centers_dict,
            "clustered_data": []
        }
        
        # Add clustered data based on the level
        if cluster_level == 'county':
            for _, row in grouped_df.iterrows():
                result["clustered_data"].append({
                    "county": row['Judet'],
                    "total_registered": int(row['Înscriși pe liste permanente']),
                    "total_votes": int(row['LP']),
                    "cluster": int(row['cluster']),
                    "pca_x": float(row['pca_x']),
                    "pca_y": float(row['pca_y']),
                    "demographics": {
                        "male_18_24": int(row['Barbati 18-24']),
                        "male_25_34": int(row['Barbati 25-34']),
                        "male_35_44": int(row['Barbati 35-44']),
                        "male_45_64": int(row['Barbati 45-64']),
                        "male_65_plus": int(row['Barbati 65+']),
                        "female_18_24": int(row['Femei 18-24']),
                        "female_25_34": int(row['Femei 25-34']),
                        "female_35_44": int(row['Femei 35-44']),
                        "female_45_64": int(row['Femei 45-64']),
                        "female_65_plus": int(row['Femei 65+'])
                    },
                    "demographics_pct": {
                        "male_18_24": float(row['Barbati 18-24_pct']),
                        "male_25_34": float(row['Barbati 25-34_pct']),
                        "male_35_44": float(row['Barbati 35-44_pct']),
                        "male_45_64": float(row['Barbati 45-64_pct']),
                        "male_65_plus": float(row['Barbati 65+_pct']),
                        "female_18_24": float(row['Femei 18-24_pct']),
                        "female_25_34": float(row['Femei 25-34_pct']),
                        "female_35_44": float(row['Femei 35-44_pct']),
                        "female_45_64": float(row['Femei 45-64_pct']),
                        "female_65_plus": float(row['Femei 65+_pct'])
                    }
                })
        elif cluster_level == 'town':
            for _, row in grouped_df.iterrows():
                result["clustered_data"].append({
                    "county": row['Judet'],
                    "town": row['Localitate'],
                    "total_registered": int(row['Înscriși pe liste permanente']),
                    "total_votes": int(row['LP']),
                    "cluster": int(row['cluster']),
                    "pca_x": float(row['pca_x']),
                    "pca_y": float(row['pca_y']),
                    "demographics": {
                        "male_18_24": int(row['Barbati 18-24']),
                        "male_25_34": int(row['Barbati 25-34']),
                        "male_35_44": int(row['Barbati 35-44']),
                        "male_45_64": int(row['Barbati 45-64']),
                        "male_65_plus": int(row['Barbati 65+']),
                        "female_18_24": int(row['Femei 18-24']),
                        "female_25_34": int(row['Femei 25-34']),
                        "female_35_44": int(row['Femei 35-44']),
                        "female_45_64": int(row['Femei 45-64']),
                        "female_65_plus": int(row['Femei 65+'])
                    },
                    "demographics_pct": {
                        "male_18_24": float(row['Barbati 18-24_pct']),
                        "male_25_34": float(row['Barbati 25-34_pct']),
                        "male_35_44": float(row['Barbati 35-44_pct']),
                        "male_45_64": float(row['Barbati 45-64_pct']),
                        "male_65_plus": float(row['Barbati 65+_pct']),
                        "female_18_24": float(row['Femei 18-24_pct']),
                        "female_25_34": float(row['Femei 25-34_pct']),
                        "female_35_44": float(row['Femei 35-44_pct']),
                        "female_45_64": float(row['Femei 45-64_pct']),
                        "female_65_plus": float(row['Femei 65+_pct'])
                    }
                })
        else:  # polling level
            for _, row in grouped_df.iterrows():
                result["clustered_data"].append({
                    "county": row['Judet'],
                    "town": row['Localitate'],
                    "polling_station": row['Nume sectie de votare'],
                    "total_registered": int(row['Înscriși pe liste permanente']),
                    "total_votes": int(row['LP']),
                    "cluster": int(row['cluster']),
                    "pca_x": float(row['pca_x']),
                    "pca_y": float(row['pca_y']),
                    "demographics": {
                        "male_18_24": int(row['Barbati 18-24']),
                        "male_25_34": int(row['Barbati 25-34']),
                        "male_35_44": int(row['Barbati 35-44']),
                        "male_45_64": int(row['Barbati 45-64']),
                        "male_65_plus": int(row['Barbati 65+']),
                        "female_18_24": int(row['Femei 18-24']),
                        "female_25_34": int(row['Femei 25-34']),
                        "female_35_44": int(row['Femei 35-44']),
                        "female_45_64": int(row['Femei 45-64']),
                        "female_65_plus": int(row['Femei 65+'])
                    },
                    "demographics_pct": {
                        "male_18_24": float(row['Barbati 18-24_pct']),
                        "male_25_34": float(row['Barbati 25-34_pct']),
                        "male_35_44": float(row['Barbati 35-44_pct']),
                        "male_45_64": float(row['Barbati 45-64_pct']),
                        "male_65_plus": float(row['Barbati 65+_pct']),
                        "female_18_24": float(row['Femei 18-24_pct']),
                        "female_25_34": float(row['Femei 25-34_pct']),
                        "female_35_44": float(row['Femei 35-44_pct']),
                        "female_45_64": float(row['Femei 45-64_pct']),
                        "female_65_plus": float(row['Femei 65+_pct'])
                    }
                })
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error in get_clustering: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Ensure data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Check if we need to generate initial data
    attendance_path = os.path.join(DATA_DIR, 'attendance.csv')
    results_path = os.path.join(DATA_DIR, 'results.csv')
    
    if not os.path.exists(attendance_path) or not os.path.exists(results_path):
        logger.info("Initial data files not found. Attempting to generate data.")
        # Try to use the presence file if it exists
        presence_file = os.path.join(DATA_DIR, 'presence_2024-12-02_07-00.csv')
        if os.path.exists(presence_file):
            logger.info(f"Found presence file: {presence_file}. Processing...")
            process_presence_data(presence_file)
        else:
            logger.info("No presence file found. Generating random attendance data.")
            from update_data import generate_attendance_data
            generate_attendance_data()
        
        if not os.path.exists(results_path):
            logger.info("Generating random results data.")
            generate_results_data()
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)