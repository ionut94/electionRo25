# Romanian Elections 2025 Visualization

This web application visualizes the election results for the Romanian Elections taking place in 2025. It features a React frontend for data visualization and a Flask backend that processes and serves the election data. The application provides interactive dashboards with enhanced visualizations for election attendance, demographic analysis, and result tracking.

## Project Structure

```
electionRo25/
├── backend/                # Flask backend
│   ├── app.py              # Main Flask application
│   ├── update_data.py      # Data processing utilities
│   ├── requirements.txt    # Python dependencies
│   ├── run.sh              # Script to start the backend
│   └── data/               # Data directory for CSV files
│       ├── attendance.csv  # Voter attendance data
│       ├── results.csv     # Election results data
│       └── Cluster/        # Raw election data for clustering
└── frontend/               # React frontend
    ├── public/             # Static files
    └── src/                # React source code
        ├── App.js          # Main React component 
        ├── App.css         # Main stylesheet
        └── utils/          # Utility functions
            ├── hooks.js    # Custom React hooks
            └── similarity.js # Data similarity calculations
```

## Features

- Real-time visualization of election attendance data with automatic updates
- Comprehensive demographic breakdowns (age groups, gender, urban/rural)
- Interactive charts displaying election results by county
- Advanced data visualizations with custom color schemes and responsive layouts
- Detailed tabular data with sorting and filtering capabilities
- Data clustering analysis for identifying voting patterns
- Demographic insights cards with key statistics highlights
- Manual data refresh with a dedicated refresh button
- Auto-refreshing data (every 5 minutes)
- Responsive design that works on desktop, tablet, and mobile devices
- Modern UI with reusable components:
  - Dashboard headers with timestamps
  - Statistics cards with visual indicators
  - Chart containers with consistent styling
  - Progress bars for percentage visualization
  - Enhanced tooltips for detailed data exploration

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

The application processes and visualizes data from the following files:

1. **attendance.csv** - Contains voter attendance statistics with the following columns:
   - county: Name of the county
   - total_voters: Total number of eligible voters
   - votes_cast: Number of votes cast
   - attendance_percentage: Percentage of eligible voters who voted
   - male_voters: Number of male voters
   - female_voters: Number of female voters
   - urban_stations: Number of urban polling stations
   - rural_stations: Number of rural polling stations
   - urban_votes: Number of votes from urban areas
   - rural_votes: Number of votes from rural areas
   - urban_male_voters: Number of male voters from urban areas
   - urban_female_voters: Number of female voters from urban areas
   - rural_male_voters: Number of male voters from rural areas
   - rural_female_voters: Number of female voters from rural areas
   - age_18_24, age_25_34, age_35_44, age_45_64, age_65_plus: Number of voters by age group
   - urban_age_* and rural_age_*: Age group breakdowns by urban/rural areas
   - timestamp: Date and time of the data point

2. **results.csv** - Contains election results with the following columns:
   - county: Name of the county
   - candidate_1 through candidate_5: Percentage of votes for each candidate
   - timestamp: Date and time of the data point

3. **Raw presence data** - The backend can process detailed polling station data from CSV files with information about each voting station, including demographic breakdowns by age and gender.

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

3. **/demographic** - Returns demographic breakdown data:
   ```json
   {
     "national": {national demographic totals and percentages},
     "counties": [county-level demographic data],
     "last_update": "timestamp of last update",
     "has_urban_rural_data": true/false
   }
   ```

4. **/clustering** - Returns clustering data based on demographic patterns:
   ```json
   {
     "cluster_level": "county|town|polling",
     "n_clusters": number of clusters,
     "cluster_centers": {cluster centers data},
     "clustered_data": [array of data points with cluster assignments]
   }
   ```

5. **/data/last_update** - Returns the timestamp of the last data update

6. **/trigger/update** - Endpoint to manually trigger data processing (POST)

## Updating Data

To update the election data, you can:

1. **Replace CSV Files**: Modify or replace the CSV files in the `backend/data` directory. The application will automatically detect and display the updated information on the next refresh.

2. **Use API Endpoint**: Send a POST request to the `/trigger/update` endpoint to trigger the data processing pipeline, which will automatically update all visualizations.

3. **Run Update Script**: Execute the data processing utilities directly:
   ```
   cd backend
   python update_data.py
   ```

## Urban/Rural Data Visualization

The application provides detailed urban/rural voter analysis through:

- Urban/Rural Distribution Chart - Shows the split of voters between urban and rural areas
- Urban/Rural Gender Distribution - Displays gender breakdown in both urban and rural settings
- Urban/Rural Age Distribution - Shows age group comparison between urban and rural voters
- Urban/Rural Insights Card - Provides key metrics and observations about urban/rural voting patterns

## Deployment

For production deployment, we recommend using Docker containers:

```
# Build the frontend
cd frontend
npm run build

# Create a single container with both front and backend
docker build -t election-ro25-app .
docker run -p 80:80 election-ro25-app
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.