#!/usr/bin/env python3
"""
Update script for Romanian Elections 2025 Visualization

This script processes detailed election presence data and updates results data.
It can read the detailed presence CSV format and extract relevant information
for the election dashboard.
"""

import os
import pandas as pd
import numpy as np
import random
import shutil
import argparse
import time
from datetime import datetime

# Path to data directory
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Counties in Romania (Canonical Full Names)
COUNTIES = [
    "Alba", "Arad", "Arges", "Bacau", "Bihor", "Bistrita-Nasaud", "Botosani",
    "Brasov", "Braila", "Buzau", "Caras-Severin", "Calarasi", "Cluj", "Constanta",
    "Covasna", "Dambovita", "Dolj", "Galati", "Giurgiu", "Gorj", "Harghita",
    "Hunedoara", "Ialomita", "Iasi", "Ilfov", "Maramures", "Mehedinti", "Mures",
    "Neamt", "Olt", "Prahova", "Satu Mare", "Salaj", "Sibiu", "Suceava", "Teleorman",
    "Timis", "Tulcea", "Vaslui", "Valcea", "Vrancea", "Bucharest"
]

# Create a mapping for potential variations/abbreviations to full names
# Convert keys to uppercase for case-insensitive matching
COUNTY_NAME_MAP = {name.upper(): name for name in COUNTIES}
# Add common variations if needed (ensure keys are uppercase)
COUNTY_NAME_MAP["BUCURESTI"] = "Bucharest"
COUNTY_NAME_MAP["CARAS SEVERIN"] = "Caras-Severin"
COUNTY_NAME_MAP["BISTRITA NASAUD"] = "Bistrita-Nasaud"
COUNTY_NAME_MAP["SATU-MARE"] = "Satu Mare"
# Add more mappings based on expected variations in your source 'Judet' column

def get_full_county_name(name):
    """Maps a potentially abbreviated/varied county name to its full name."""
    if pd.isna(name):
        return "Unknown" # Handle missing names
    # Convert to string, uppercase, strip whitespace, and lookup
    return COUNTY_NAME_MAP.get(str(name).upper().strip(), str(name).strip()) # Return cleaned original if no map found

def process_presence_data(source_file=None):
    """Process detailed presence data, mapping 'Judet' to full county names using correct headers."""
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    default_source = os.path.join(DATA_DIR, 'presence_now.csv')
    source_file = source_file or default_source

    if not os.path.exists(source_file):
        print(f"Source file {source_file} not found. Generating random data instead.")
        return generate_attendance_data()

    try:
        print(f"Attempting to read CSV: {source_file}")
        df = pd.read_csv(source_file)
        print(f"Successfully read CSV. Columns found: {list(df.columns)}")

        # --- Define Expected Column Names based on presence_2024-11-25_07-00.csv ---
        judet_col = 'Judet'
        total_voters_col = 'Înscriși pe liste permanente' # Corrected
        votes_cast_col = 'LT' # Corrected (Total Votanti)

        # Columns for calculating total male/female voters
        male_age_cols_src = ["Barbati 18-24", "Barbati 25-34", "Barbati 35-44", "Barbati 45-64", "Barbati 65+"]
        female_age_cols_src = ["Femei 18-24", "Femei 25-34", "Femei 35-44", "Femei 45-64", "Femei 65+"]

        # Columns for calculating age group totals (output keys match frontend expectations)
        age_group_cols_src = {
            'age_18_24': ["Barbati 18-24", "Femei 18-24"],
            'age_25_34': ["Barbati 25-34", "Femei 25-34"],
            'age_35_44': ["Barbati 35-44", "Femei 35-44"],
            'age_45_64': ["Barbati 45-64", "Femei 45-64"],
            'age_65_plus': ["Barbati 65+", "Femei 65+"]
        }

        station_type_col = 'Mediu' # Corrected (U/R)
        station_id_col = 'Nr sectie de votare' # Corrected
        # --- End Define Expected Column Names ---

        # --- Start Column Validation ---
        # Check for essential columns needed for basic aggregation
        required_cols_for_processing = [judet_col, total_voters_col, votes_cast_col]
        # Also check if at least the age group columns exist for detailed stats
        all_age_gender_cols = male_age_cols_src + female_age_cols_src
        required_cols_for_processing.extend(all_age_gender_cols) # Add age/gender cols to validation

        missing_cols = [col for col in required_cols_for_processing if col not in df.columns]

        if missing_cols:
             # More specific error message
             print(f"Error: Source CSV file '{source_file}' is missing essential columns for processing.")
             print(f"  Essential columns expected: {judet_col}, {total_voters_col}, {votes_cast_col}")
             print(f"  Also expected age/gender columns like: {all_age_gender_cols[:3]}... etc.")
             print(f"  Missing columns found: {missing_cols}")
             print(f"  Columns found in file: {list(df.columns)}")
             print("Cannot process this file. Falling back to generating random data.")
             return generate_attendance_data() # Fallback

        # Apply mapping to create a new column with full names
        df['Judet_Full'] = df[judet_col].apply(get_full_county_name)
        # --- End Column Validation and County Name Mapping ---

        county_data = []
        grouped = df.groupby('Judet_Full')

        print(f"Processing data grouped by full county names...")
        for county_full_name, county_df in grouped:
            if not county_full_name or county_full_name == "Unknown":
                original_name = county_df[judet_col].iloc[0] if not county_df.empty else 'N/A'
                print(f"Skipping group with invalid/unknown county name derived from source: {original_name}")
                continue

            # Aggregate essential data
            total_voters = county_df[total_voters_col].sum()
            votes_cast = county_df[votes_cast_col].sum()
            attendance_percentage = (votes_cast / total_voters * 100) if total_voters > 0 else 0

            # Helper to safely sum multiple columns
            def safe_sum_multiple(cols_to_sum):
                total = 0
                for col in cols_to_sum:
                    if col in county_df.columns:
                        # Sum only numeric, non-NA values for the column
                        total += pd.to_numeric(county_df[col], errors='coerce').dropna().sum()
                return int(total) if pd.notna(total) else None

            # Calculate total male and female voters by summing age groups
            male_voters = safe_sum_multiple(male_age_cols_src)
            female_voters = safe_sum_multiple(female_age_cols_src)

            county_entry = {
                'county': county_full_name,
                'total_voters': int(total_voters),
                'votes_cast': int(votes_cast),
                'attendance_percentage': round(attendance_percentage, 2),
                'male_voters': male_voters,
                'female_voters': female_voters,
                'timestamp': current_time
            }

            # Calculate and add age group totals
            for output_key, source_cols in age_group_cols_src.items():
                county_entry[output_key] = safe_sum_multiple(source_cols)

            # Calculate urban/rural stations
            urban_stations = None
            rural_stations = None
            if station_type_col in county_df.columns and station_id_col in county_df.columns:
                 try:
                     station_types = county_df[station_type_col].astype(str).str.upper().fillna('UNKNOWN')
                     # Use .loc to avoid SettingWithCopyWarning if county_df is a slice
                     urban_stations = county_df.loc[station_types == 'U', station_id_col].nunique() # Changed to 'U'
                     rural_stations = county_df.loc[station_types == 'R', station_id_col].nunique() # Changed to 'R'
                 except Exception as station_err:
                     print(f"Warning: Could not calculate urban/rural stations for {county_full_name}: {station_err}")

            county_entry['urban_stations'] = int(urban_stations) if pd.notna(urban_stations) else None
            county_entry['rural_stations'] = int(rural_stations) if pd.notna(rural_stations) else None

            county_data.append(county_entry)

        if not county_data:
             print("Warning: No valid county data could be processed from the source file after grouping.")
             return pd.DataFrame()

        # Create DataFrame and save to CSV
        result_df = pd.DataFrame(county_data)
        # Reorder columns to ensure 'county' is first, followed by others
        cols_order = ['county', 'total_voters', 'votes_cast', 'attendance_percentage',
                      'male_voters', 'female_voters', 'age_18_24', 'age_25_34', 'age_35_44',
                      'age_45_64', 'age_65_plus', 'urban_stations', 'rural_stations', 'timestamp']
        # Filter out any columns that might not exist if aggregation failed partially
        final_cols = [col for col in cols_order if col in result_df.columns]
        result_df = result_df[final_cols]

        csv_path = os.path.join(DATA_DIR, 'attendance.csv')
        result_df.to_csv(csv_path, index=False)
        print(f"Processed presence data using correct headers and saved attendance data to {csv_path} at {current_time}")

        # Save a timestamped copy of the original file
        try:
            source_filename = os.path.basename(source_file)
            safe_source_filename = "".join(c if c.isalnum() else "_" for c in source_filename)
            timestamped_source_path = os.path.join(DATA_DIR, f"processed_{safe_source_filename}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
            if not source_filename.startswith('processed_'):
                 shutil.copy2(source_file, timestamped_source_path)
                 print(f"Copied source file to {timestamped_source_path}")
        except Exception as copy_err:
            print(f"Could not copy source file: {copy_err}")

        return result_df

    except KeyError as e:
        print(f"Error processing presence data: Problem accessing column - {e}. This might indicate an unexpected CSV structure or incorrect column name definition in the script.")
        print("Falling back to generating random data.")
        return generate_attendance_data()
    except pd.errors.EmptyDataError:
        print(f"Error processing presence data: Source file {source_file} is empty.")
        print("Falling back to generating random data.")
        return generate_attendance_data()
    except Exception as e:
        print(f"An unexpected error occurred during presence data processing: {e}")
        import traceback
        traceback.print_exc()
        print("Falling back to generating random data.")
        return generate_attendance_data()


def generate_attendance_data():
    """Generate random attendance data for counties using full names"""
    data = []
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    for county in COUNTIES: # Uses the full names list
        total_voters = random.randint(300000, 2000000)
        attendance_pct = random.uniform(25.0, 60.0)
        votes_cast = int(total_voters * (attendance_pct / 100))

        male_ratio = random.uniform(0.45, 0.55)
        male_voters = int(votes_cast * male_ratio)
        female_voters = votes_cast - male_voters

        age_18_24 = int(votes_cast * random.uniform(0.05, 0.15))
        age_25_34 = int(votes_cast * random.uniform(0.15, 0.25))
        age_35_44 = int(votes_cast * random.uniform(0.15, 0.25))
        age_45_64 = int(votes_cast * random.uniform(0.25, 0.35))
        age_65_plus = max(0, votes_cast - age_18_24 - age_25_34 - age_35_44 - age_45_64)

        urban_stations = random.randint(20, 100)
        rural_stations = random.randint(10, 50)

        data.append({
            'county': county, # Full name used here
            'total_voters': total_voters,
            'votes_cast': votes_cast,
            'attendance_percentage': round(attendance_pct, 2),
            'male_voters': male_voters,
            'female_voters': female_voters,
            'age_18_24': age_18_24,
            'age_25_34': age_25_34,
            'age_35_44': age_35_44,
            'age_45_64': age_45_64,
            'age_65_plus': age_65_plus,
            'urban_stations': urban_stations,
            'rural_stations': rural_stations,
            'timestamp': current_time
        })

    df = pd.DataFrame(data)
    csv_path = os.path.join(DATA_DIR, 'attendance.csv')
    df.to_csv(csv_path, index=False)
    print(f"Generated random attendance data using full county names at {current_time}")
    return df

def generate_results_data():
    """Generate random election results data for counties using full names"""
    data = []
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    for county in COUNTIES: # Uses the full names list
        results = [random.uniform(5, 35) for _ in range(5)]
        total = sum(results)
        results_pct = [(r / total * 100) if total > 0 else 20.0 for r in results] # Handle zero total

        data.append({
            'county': county, # Full name used here
            'candidate_1': round(results_pct[0], 2),
            'candidate_2': round(results_pct[1], 2),
            'candidate_3': round(results_pct[2], 2),
            'candidate_4': round(results_pct[3], 2),
            'candidate_5': round(results_pct[4], 2),
            'timestamp': current_time
        })

    df = pd.DataFrame(data)
    csv_path = os.path.join(DATA_DIR, 'results.csv')
    df.to_csv(csv_path, index=False)
    print(f"Generated random results data using full county names at {current_time}")
    return df

def update_existing_data():
    """Update existing CSV files with new simulated data, preserving full county names"""
    attendance_path = os.path.join(DATA_DIR, 'attendance.csv')
    results_path = os.path.join(DATA_DIR, 'results.csv')
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    updated_any = False

    # Update attendance data
    if os.path.exists(attendance_path):
        try:
            df_attendance = pd.read_csv(attendance_path)
            if 'county' not in df_attendance.columns or 'total_voters' not in df_attendance.columns or 'votes_cast' not in df_attendance.columns:
                 raise ValueError("Attendance CSV missing required columns.")

            for index, row in df_attendance.iterrows():
                change_factor = random.uniform(0.005, 0.02)
                # Ensure new_votes doesn't exceed total_voters and handle potential NaN
                total_voters = row['total_voters'] if pd.notna(row['total_voters']) else 0
                votes_cast = row['votes_cast'] if pd.notna(row['votes_cast']) else 0
                new_votes = min(total_voters, votes_cast + int(total_voters * change_factor))

                df_attendance.loc[index, 'votes_cast'] = new_votes
                df_attendance.loc[index, 'attendance_percentage'] = round((new_votes / total_voters * 100) if total_voters > 0 else 0, 2)
                df_attendance.loc[index, 'timestamp'] = current_time

            df_attendance.to_csv(attendance_path, index=False)
            print(f"Updated existing attendance data at {current_time}")
            updated_any = True
        except Exception as e:
            print(f"Error updating attendance data: {e}. Generating fresh data instead.")
            generate_attendance_data()
            updated_any = True
    else:
        print("Attendance data file not found. Generating fresh data.")
        generate_attendance_data()
        updated_any = True

    # Update results data
    if os.path.exists(results_path):
        try:
            df_results = pd.read_csv(results_path)
            c_cols = [f'candidate_{i}' for i in range(1, 6)]
            if 'county' not in df_results.columns or not all(col in df_results.columns for col in c_cols):
                 raise ValueError("Results CSV missing required columns.")

            for index, row in df_results.iterrows():
                 adjustments = [random.uniform(-0.5, 0.5) for _ in c_cols]
                 # Handle potential NaN in percentages before adjustment
                 current_pcts = [row[col] if pd.notna(row[col]) else 0 for col in c_cols]
                 new_pcts = np.array(current_pcts) + np.array(adjustments)
                 new_pcts = np.maximum(0, new_pcts) # Ensure non-negative
                 total_pct = sum(new_pcts)
                 if total_pct > 0:
                     new_pcts = (new_pcts / total_pct) * 100
                 else:
                     new_pcts = [20.0] * 5 # Fallback if sum is zero

                 for i, col in enumerate(c_cols):
                     df_results.loc[index, col] = round(new_pcts[i], 2)
                 df_results.loc[index, 'timestamp'] = current_time

            df_results.to_csv(results_path, index=False)
            print(f"Updated existing results data at {current_time}")
            updated_any = True
        except Exception as e:
            print(f"Error updating results data: {e}. Generating fresh data instead.")
            generate_results_data()
            updated_any = True
    else:
        print("Results data file not found. Generating fresh data.")
        generate_results_data()
        updated_any = True

    return updated_any


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Update or generate election data files using full county names.')
    parser.add_argument('--fresh', action='store_true', help='Force generation of fresh data, overwriting existing files.')
    parser.add_argument('--interval', type=int, default=0, help='Run updates every X seconds (0 = run once and exit).')
    parser.add_argument('--presence', type=str, help='Path to a specific presence CSV file to process instead of the default or updating.')
    args = parser.parse_args()

    run_mode = "single run"
    if args.interval > 0:
        run_mode = f"interval ({args.interval}s)"
    print(f"--- Starting election data update ({run_mode}) at {datetime.now()} ---")

    try:
        if args.interval > 0:
            print(f"Update loop started. Press Ctrl+C to stop.")
            while True:
                print(f"\n--- Running update cycle at {datetime.now()} ---") # Corrected string termination
                processed_or_generated = False
                if args.presence:
                    print(f"Processing specified presence file: {args.presence}")
                    process_presence_data(args.presence)
                    # Decide if results should also be generated/updated when processing presence
                    # generate_results_data() # Option 1: Always generate fresh results
                    update_existing_data() # Option 2: Update existing results (or generate if missing)
                    processed_or_generated = True
                elif args.fresh:
                    print("Forcing fresh data generation...")
                    generate_attendance_data()
                    generate_results_data()
                    processed_or_generated = True
                else:
                    print("Updating existing data (or generating if missing)...")
                    processed_or_generated = update_existing_data()

                status = "updated/generated" if processed_or_generated else "no changes needed"
                print(f"--- Update cycle finished ({status}). Waiting {args.interval} seconds... ---")
                time.sleep(args.interval)
        else:
            # Run once logic
            if args.presence:
                 print(f"Processing specified presence file: {args.presence}")
                 process_presence_data(args.presence)
                 # Decide on results handling for single run with presence file
                 # generate_results_data()
                 update_existing_data()
            elif args.fresh:
                print("Forcing fresh data generation...")
                generate_attendance_data()
                generate_results_data()
            else:
                print("Updating existing data (or generating if missing)...")
                update_existing_data()
            print(f"--- Election data update finished at {datetime.now()} ---")

    except KeyboardInterrupt:
        print("\n--- Update process stopped by user. ---")
    except Exception as e:
        print(f"\n--- An error occurred during the update process: {e} ---")
        import traceback
        traceback.print_exc() # Print detailed traceback for debugging