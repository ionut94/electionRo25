# Romanian Elections 2025 Visualization

This web application visualizes the election results for the Romanian Elections taking place in 2025. It features a React frontend for data visualization and a Flask backend that processes and serves the election data.

## Project Structure

```
electionRo25/
├── backend/                    # Flask backend
│   ├── app.py                  # Main Flask application
│   ├── requirements.txt        # Python dependencies
│   ├── run.sh                  # Script to start the backend
│   ├── update_data.py          # Data processing and update functionality
│   ├── force_download.py       # Specialized script for downloading from live source
│   ├── fetch_live_data_improved.sh  # Shell script for automated data updates
│   ├── setup_cron_job.sh       # Script to setup automated updates
│   └── data/                   # Data directory for CSV files
│       ├── attendance.csv      # Voter attendance data
│       ├── results.csv         # Election results data
│       └── presence_now.csv    # Latest downloaded raw data
└── frontend/                   # React frontend
    ├── public/                 # Static files
    └── src/                    # React source code
```

## Features

- Real-time visualization of election attendance data
- Demographic breakdowns (age groups, gender, urban/rural)
- Interactive charts displaying election results by county
- Detailed tabular data for both attendance and results
- Manual data refresh with a dedicated refresh button
- Auto-refreshing data (every 5 minutes)
- Live data updates from the official election source with multiple fallback methods
- Urban/Rural distribution estimation when data is missing
- Robust handling of anti-bot protection on the official data source
- Automated scheduled updates via cron job
- Responsive design works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- Python 3.8 or later
- pip (Python package manager)

### Running the Backend

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Run the start script (this will create a virtual environment, install dependencies, and start the server):
   ```
   ./run.sh
   ```

   The Flask server will start at http://localhost:5000

### Running the Frontend

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies (if not already done):
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

   The React application will be available at http://localhost:3000

## Data Files

The application expects two main data files in the `backend/data` directory:

1. **attendance.csv** - Contains voter attendance statistics with the following columns:
   - county: Name of the county
   - total_voters: Total number of eligible voters
   - votes_cast: Number of votes cast
   - attendance_percentage: Percentage of eligible voters who voted
   - male_voters: Number of male voters
   - female_voters: Number of female voters
   - urban_stations: Number of urban polling stations
   - rural_stations: Number of rural polling stations
   - age_18_24: Number of voters aged 18-24
   - age_25_34: Number of voters aged 25-34
   - age_35_44: Number of voters aged 35-44
   - age_45_64: Number of voters aged 45-64
   - age_65_plus: Number of voters aged 65 and older
   - timestamp: Date and time of the data point

2. **results.csv** - Contains election results with the following columns:
   - county: Name of the county
   - candidate_1 through candidate_5: Percentage of votes for each candidate
   - timestamp: Date and time of the data point

## API Endpoints

The backend server provides the following API endpoints:

1. **/attendance** - Returns voter attendance data in the format:
   ```json
   {
     "data": [array of attendance records],
     "last_update": "timestamp of last update"
   }
   ```

2. **/results** - Returns election results data in the format:
   ```json
   {
     "data": [array of results records],
     "last_update": "timestamp of last update"
   }
   ```

## Updating Data

The application offers multiple methods for updating election data:

1. **Manual Data Refresh**: Click the "Refresh Data" button in the UI to load the latest data from the backend.

2. **Auto-Refresh**: The application automatically refreshes data every 5 minutes while running.

3. **Live Data Source Updates**: 
   - Click the "Update from Live Source" button in the UI to download and process the latest data directly from the official source.
   - Use the command line tool to download and update data:
     ```
     cd backend
     ./fetch_live_data.sh
     ```
   - For continuous updates, specify an interval (in seconds):
     ```
     ./fetch_live_data.sh --interval 3600  # Update every hour
     ```
   - API Key Configuration:
     - The backend requires an API key for the update endpoint
     - Set the key in the frontend `.env` file:
       ```
       REACT_APP_UPDATE_API_KEY=your-secure-api-key
       ```
     - Or set an environment variable on the server:
       ```
       export UPDATE_API_KEY=your-secure-api-key
       ```
     - The default key is 'your-secure-api-key' if not specified

4. **Automated Scheduled Updates**:
   - Set up a cron job to automatically update data at regular intervals:
     ```
     cd backend
     ./setup_cron_job.sh
     ```
   - This will create a cron job to update data hourly. You can modify the script to change the frequency.

5. **Manual File Update**: Simply replace or modify the CSV files in the `backend/data` directory. The application will detect and display the updated information on the next refresh.

## Live Data Source

The application can download data from the official election source:
```
https://prezenta.roaep.ro/prezidentiale04052025//data/csv/simpv/presence_now.csv
```

This data is processed and converted to the format expected by the application.

## License

This project is licensed under the MIT License.