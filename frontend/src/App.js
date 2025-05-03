import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
// Import Bubble alongside other chart types
import { Bar, Pie, Line, Scatter, Bubble } from 'react-chartjs-2'; 
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  // Import BubbleController instead of BubbleElement
  BubbleController 
} from 'chart.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Navbar, Nav, Alert, Button, Row, Col, Card, Form, Table } from 'react-bootstrap';
import './App.css';
import { getLocationIdentifier, calculateCosineSimilarity, findTopSimilarLocations } from './utils/similarity';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  // Register BubbleController instead of BubbleElement
  BubbleController 
);

function App() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [resultsData, setResultsData] = useState([]);
  const [demographicData, setDemographicData] = useState({
    national: {},
    counties: [],
    has_urban_rural_data: false
  });
  const [clusteringData, setClusteringData] = useState({
    cluster_level: 'county',
    n_clusters: 5,
    cluster_centers: {},
    clustered_data: []
  });
  const [clusterLevel, setClusterLevel] = useState('county');
  const [numClusters, setNumClusters] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('attendance');
  const [refreshing, setRefreshing] = useState(false);

  // State for filtering and sorting the clustered data table
  const [clusterTableFilter, setClusterTableFilter] = useState('');
  const [clusterTableSortConfig, setClusterTableSortConfig] = useState({ key: null, direction: 'ascending' });

  // State for similarity feature
  const [selectedLocationForSimilarity, setSelectedLocationForSimilarity] = useState('');
  const [similarLocations, setSimilarLocations] = useState([]);

  // Base URL for API
  const API_BASE_URL = 'http://localhost:5000';
  
  // Function to fetch data
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      // Fetch attendance data
      const attendanceResponse = await axios.get(`${API_BASE_URL}/attendance`);
      setAttendanceData(attendanceResponse.data.data || []);
      
      // Fetch results data
      const resultsResponse = await axios.get(`${API_BASE_URL}/results`);
      setResultsData(resultsResponse.data.data || []);
      
      // Fetch demographic data (includes urban/rural info)
      const demographicResponse = await axios.get(`${API_BASE_URL}/demographic`);
      setDemographicData(demographicResponse.data || {
        national: {},
        counties: [],
        has_urban_rural_data: false
      });
      
      // Fetch clustering data
      const clusteringResponse = await axios.get(`${API_BASE_URL}/clustering?level=${clusterLevel}&n_clusters=${numClusters}`);
      setClusteringData(clusteringResponse.data || {
        cluster_level: 'county',
        n_clusters: 5,
        cluster_centers: {},
        clustered_data: []
      });
      
      setRefreshing(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data. Please ensure the backend server is running.');
      setRefreshing(false);
    }
  }, [API_BASE_URL, clusterLevel, numClusters]);
  
  // Function to fetch just clustering data when level or number of clusters changes
  const fetchClusteringData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      // Fetch clustering data with current parameters
      const clusteringResponse = await axios.get(`${API_BASE_URL}/clustering?level=${clusterLevel}&n_clusters=${numClusters}`);
      setClusteringData(clusteringResponse.data || {
        cluster_level: 'county',
        n_clusters: 5,
        cluster_centers: {},
        clustered_data: []
      });
      
      setRefreshing(false);
    } catch (err) {
      console.error('Error fetching clustering data:', err);
      setError('Failed to fetch clustering data.');
      setRefreshing(false);
    }
  }, [API_BASE_URL, clusterLevel, numClusters]);
  
  // Effect when cluster level or number changes
  useEffect(() => {
    if (activeTab === 'clusters') {
      fetchClusteringData();
    }
  }, [clusterLevel, numClusters, activeTab, fetchClusteringData]);
  
  useEffect(() => {
    // Initial data loading
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchData]);
  
  // Update similarity list when selection or data changes
  useEffect(() => {
    const sims = findTopSimilarLocations(
      selectedLocationForSimilarity,
      clusteringData.clustered_data,
      clusterLevel
    );
    setSimilarLocations(sims);
  }, [
    selectedLocationForSimilarity,
    clusteringData.clustered_data,
    clusterLevel,
  ]);
  
  // Prepare unique locations for the similarity dropdown
  const uniqueLocationsForDropdown = useMemo(() => {
    const identifiers = new Set();
    clusteringData.clustered_data.forEach(item => {
      identifiers.add(getLocationIdentifier(item, clusterLevel));
    });
    return Array.from(identifiers).sort(); // Sort alphabetically
  }, [clusteringData.clustered_data, clusterLevel, getLocationIdentifier]);
  
  // Prepare attendance chart data
  const attendanceChartData = {
    labels: attendanceData.map(item => item.county),
    datasets: [
      {
        label: 'Attendance (%)',
        data: attendanceData.map(item => item.attendance_percentage),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };
  
  // Prepare results chart data
  const resultsChartData = {
    labels: resultsData.map(item => item.county),
    datasets: [
      {
        label: 'Candidate 1',
        data: resultsData.map(item => item.candidate_1),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
      {
        label: 'Candidate 2',
        data: resultsData.map(item => item.candidate_2),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        label: 'Candidate 3',
        data: resultsData.map(item => item.candidate_3),
        backgroundColor: 'rgba(255, 206, 86, 0.5)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1,
      },
      {
        label: 'Candidate 4',
        data: resultsData.map(item => item.candidate_4),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
      {
        label: 'Candidate 5',
        data: resultsData.map(item => item.candidate_5),
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };
  
  // Prepare overall results pie chart data
  const overallResultsData = {
    labels: ['Candidate 1', 'Candidate 2', 'Candidate 3', 'Candidate 4', 'Candidate 5'],
    datasets: [
      {
        data: resultsData.length > 0 
          ? [
              resultsData.reduce((sum, item) => sum + parseFloat(item.candidate_1), 0) / resultsData.length,
              resultsData.reduce((sum, item) => sum + parseFloat(item.candidate_2), 0) / resultsData.length,
              resultsData.reduce((sum, item) => sum + parseFloat(item.candidate_3), 0) / resultsData.length,
              resultsData.reduce((sum, item) => sum + parseFloat(item.candidate_4), 0) / resultsData.length,
              resultsData.reduce((sum, item) => sum + parseFloat(item.candidate_5), 0) / resultsData.length,
            ]
          : [],
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(153, 102, 255, 0.5)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Prepare demographic data for age groups
  const ageDemographicData = {
    labels: attendanceData.map(item => item.county),
    datasets: [
      {
        label: '18-24',
        data: attendanceData.map(item => item.age_18_24 || 0),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
      {
        label: '25-34',
        data: attendanceData.map(item => item.age_25_34 || 0),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        label: '35-44',
        data: attendanceData.map(item => item.age_35_44 || 0),
        backgroundColor: 'rgba(255, 206, 86, 0.5)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1,
      },
      {
        label: '45-64',
        data: attendanceData.map(item => item.age_45_64 || 0),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
      {
        label: '65+',
        data: attendanceData.map(item => item.age_65_plus || 0),
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Prepare gender distribution pie chart data
  const genderDistributionData = {
    labels: ['Male', 'Female'],
    datasets: [
      {
        data: [
          attendanceData.reduce((sum, item) => sum + (item.male_voters || 0), 0),
          attendanceData.reduce((sum, item) => sum + (item.female_voters || 0), 0),
        ],
        backgroundColor: [
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 99, 132, 0.5)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Prepare urban/rural distribution pie chart data
  const urbanRuralDistributionData = {
    labels: ['Urban', 'Rural'],
    datasets: [
      {
        data: [
          demographicData.national.urban_votes || 0,
          demographicData.national.rural_votes || 0,
        ],
        backgroundColor: [
          'rgba(75, 192, 192, 0.5)',
          'rgba(153, 102, 255, 0.5)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Prepare urban/rural gender distribution data
  const urbanRuralGenderData = {
    labels: ['Urban Male', 'Urban Female', 'Rural Male', 'Rural Female'],
    datasets: [
      {
        data: [
          demographicData.national.urban_male_voters || 0,
          demographicData.national.urban_female_voters || 0,
          demographicData.national.rural_male_voters || 0,
          demographicData.national.rural_female_voters || 0,
        ],
        backgroundColor: [
          'rgba(54, 162, 235, 0.5)', // Urban Male - blue
          'rgba(255, 99, 132, 0.5)', // Urban Female - pink
          'rgba(65, 105, 225, 0.5)', // Rural Male - darker blue
          'rgba(255, 20, 147, 0.5)', // Rural Female - darker pink
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(65, 105, 225, 1)',
          'rgba(255, 20, 147, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Prepare urban/rural age distribution data
  const urbanRuralAgeData = {
    labels: ['18-24', '25-34', '35-44', '45-64', '65+'],
    datasets: [
      {
        label: 'Urban',
        data: [
          demographicData.national.urban_age_18_24 || 0,
          demographicData.national.urban_age_25_34 || 0,
          demographicData.national.urban_age_35_44 || 0,
          demographicData.national.urban_age_45_64 || 0,
          demographicData.national.urban_age_65_plus || 0,
        ],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
      {
        label: 'Rural',
        data: [
          demographicData.national.rural_age_18_24 || 0,
          demographicData.national.rural_age_25_34 || 0,
          demographicData.national.rural_age_35_44 || 0,
          demographicData.national.rural_age_45_64 || 0,
          demographicData.national.rural_age_65_plus || 0,
        ],
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Prepare clusters for visualization
  const generateClusterColors = (numClusters) => {
    const colors = [
      'rgba(255, 99, 132, 0.7)',   // Red
      'rgba(54, 162, 235, 0.7)',   // Blue
      'rgba(255, 206, 86, 0.7)',   // Yellow
      'rgba(75, 192, 192, 0.7)',   // Green
      'rgba(153, 102, 255, 0.7)',  // Purple
      'rgba(255, 159, 64, 0.7)',   // Orange
      'rgba(199, 199, 199, 0.7)',  // Gray
      'rgba(83, 102, 255, 0.7)',   // Indigo
      'rgba(255, 99, 255, 0.7)',   // Pink
      'rgba(99, 255, 132, 0.7)',   // Light green
    ];
    
    // Generate more colors if needed
    if (numClusters > colors.length) {
      for (let i = colors.length; i < numClusters; i++) {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        colors.push(`rgba(${r}, ${g}, ${b}, 0.7)`);
      }
    }
    
    return colors.slice(0, numClusters);
  };

  // Generate colors for each cluster
  const clusterColors = generateClusterColors(clusteringData.n_clusters);
  
  // Prepare scatter plot data for clusters
  const clusterScatterData = {
    datasets: Array.from({ length: clusteringData.n_clusters }, (_, i) => {
      const pointsInCluster = clusteringData.clustered_data.filter(d => d.cluster === i);
      
      // Calculate min/max votes for scaling (optional, but good for normalization)
      const voteCounts = clusteringData.clustered_data.map(d => d.total_votes || 0);
      const minVotes = Math.min(...voteCounts);
      const maxVotes = Math.max(...voteCounts);

      // Scaling function for radius (adjust min/max radius as needed)
      const scaleRadius = (votes) => {
        const minRadius = 4; // Minimum point size
        const maxRadius = 25; // Maximum point size
        
        // Handle cases with no votes or invalid input
        if (!votes || votes <= 0) return minRadius;
        // Handle case where all vote counts are the same
        if (maxVotes === minVotes) return (minRadius + maxRadius) / 2; 

        // Use square root scaling for better visual differentiation of area
        const sqrtVotes = Math.sqrt(votes);
        const sqrtMin = Math.sqrt(Math.max(1, minVotes)); // Avoid sqrt(0)
        const sqrtMax = Math.sqrt(maxVotes);

        // Avoid division by zero if sqrtMin === sqrtMax after Math.max(1, minVotes)
        if (sqrtMax <= sqrtMin) return (minRadius + maxRadius) / 2;

        const scaled = minRadius + ((sqrtVotes - sqrtMin) / (sqrtMax - sqrtMin)) * (maxRadius - minRadius);
        
        // Clamp within bounds to ensure radius is within the defined min/max
        return Math.max(minRadius, Math.min(maxRadius, scaled)); 
      };

      return {
        label: `Cluster ${i + 1}`,
        // Map data points to { x, y, r } format
        data: pointsInCluster.map(d => ({ 
          x: d.pca_x, 
          y: d.pca_y, 
          r: scaleRadius(d.total_votes), // Calculate radius based on total_votes
          // Store original data for tooltips if needed
          location: clusterLevel === 'county' ? d.county : 
                    clusterLevel === 'town' ? `${d.county}, ${d.town}` : 
                    `${d.county}, ${d.town}, ${d.polling_station}`,
          votes: d.total_votes
        })),
        backgroundColor: clusterColors[i],
        // pointRadius: 8, // Remove fixed radius
        // pointHoverRadius: 12, // Remove fixed hover radius (or adjust dynamically)
      };
    })
  };
  
  // Filter and sort clustered data
  const filteredAndSortedClusteredData = useMemo(() => {
    let sortableItems = [...clusteringData.clustered_data];

    // Apply filtering
    if (clusterTableFilter) {
      const lowerCaseFilter = clusterTableFilter.toLowerCase();
      sortableItems = sortableItems.filter(item => {
        const countyMatch = item.county?.toLowerCase().includes(lowerCaseFilter);
        const townMatch = item.town?.toLowerCase().includes(lowerCaseFilter);
        const stationMatch = item.polling_station?.toLowerCase().includes(lowerCaseFilter);
        const clusterMatch = `cluster ${item.cluster + 1}`.includes(lowerCaseFilter);
        return countyMatch || townMatch || stationMatch || clusterMatch;
      });
    }

    // Apply sorting
    if (clusterTableSortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[clusterTableSortConfig.key];
        let bValue = b[clusterTableSortConfig.key];

        // Handle nested demographics_pct object
        if (clusterTableSortConfig.key.startsWith('demographics_pct.')) {
            const keys = clusterTableSortConfig.key.split('.');
            aValue = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : 0, a);
            bValue = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : 0, b);
        } else if (clusterTableSortConfig.key === 'cluster') {
            aValue = a.cluster;
            bValue = b.cluster;
        } else if (clusterTableSortConfig.key === 'total_votes') {
            aValue = a.total_votes;
            bValue = b.total_votes;
        } else if (clusterTableSortConfig.key === 'location') {
            // Combine location fields for sorting
            const getLocationString = (item) => {
                if (clusterLevel === 'polling') return `${item.county}-${item.town}-${item.polling_station}`;
                if (clusterLevel === 'town') return `${item.county}-${item.town}`;
                return item.county;
            };
            aValue = getLocationString(a);
            bValue = getLocationString(b);
        }


        // Basic comparison for numbers and strings
        if (aValue < bValue) {
          return clusterTableSortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return clusterTableSortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [clusteringData.clustered_data, clusterTableFilter, clusterTableSortConfig, clusterLevel]);

  // Function to request sorting
  const requestSort = (key) => {
    let direction = 'ascending';
    if (
      clusterTableSortConfig.key === key &&
      clusterTableSortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setClusterTableSortConfig({ key, direction });
  };

  // Helper function to get sort direction indicator
  const getSortDirectionIndicator = (key) => {
    if (clusterTableSortConfig.key !== key) {
      return null; // No indicator
    }
    return clusterTableSortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };


  // Chart options for scatter plot
  const scatterOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            const pointData = context.raw; // Access the raw data point {x, y, r, location, votes}
            if (!pointData) return `Cluster ${context.datasetIndex + 1}`;
            
            return `${pointData.location}: ${pointData.votes?.toLocaleString() || 'N/A'} votes (Cluster ${context.datasetIndex + 1})`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: true,
        },
        title: {
          display: true,
          text: 'PCA Dimension 1'
        }
      },
      y: {
        grid: {
          display: true,
        },
        title: {
          display: true,
          text: 'PCA Dimension 2'
        }
      }
    }
  };

  return (
    <div className="App">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="#home">Romanian Elections 2025</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link 
                href="#attendance" 
                active={activeTab === 'attendance'} 
                onClick={() => setActiveTab('attendance')}
              >
                Attendance
              </Nav.Link>
              <Nav.Link 
                href="#results" 
                active={activeTab === 'results'} 
                onClick={() => setActiveTab('results')}
              >
                Results
              </Nav.Link>
              <Nav.Link 
                href="#clusters" 
                active={activeTab === 'clusters'} 
                onClick={() => setActiveTab('clusters')}
              >
                Clusters
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      
      <Container className="mt-4">
        {error && <Alert variant="danger">{error}</Alert>}
        
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            {activeTab === 'attendance' ? (
              <h2>Voter Attendance</h2>
            ) : (
              <h2>Election Results</h2>
            )}
          </div>
          <Button 
            variant="primary" 
            onClick={fetchData} 
            disabled={refreshing}
            className="d-flex align-items-center"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
            {refreshing && (
              <span className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true"></span>
            )}
          </Button>
        </div>
        
        {loading ? (
          <div className="text-center my-5">
            <h3>Loading data...</h3>
          </div>
        ) : (
          <>
            {activeTab === 'attendance' && (
              <>
                <h2 className="mb-4">Voter Attendance</h2>
                <Row>
                  <Col md={8}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Attendance by County (%)</h4>
                        <Bar data={attendanceChartData} />
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={4}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Gender Distribution</h4>
                        <Pie data={genderDistributionData} />
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Voter Age Demographics</h4>
                        <Bar data={ageDemographicData} />
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Urban/Rural Distribution</h4>
                        <Pie data={urbanRuralDistributionData} />
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Urban/Rural Gender Distribution</h4>
                        <Pie data={urbanRuralGenderData} />
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Urban/Rural Age Distribution</h4>
                        <Bar data={urbanRuralAgeData} />
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12}>
                    <Card>
                      <Card.Body>
                        <h4>Attendance Details</h4>
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th>County</th>
                                <th>Total Voters</th>
                                <th>Votes Cast</th>
                                <th>Attendance (%)</th>
                                <th>Male/Female</th>
                                <th>Urban/Rural</th>
                                <th>Last Update</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendanceData.map((item, index) => (
                                <tr key={index}>
                                  <td>{item.county}</td>
                                  <td>{item.total_voters.toLocaleString()}</td>
                                  <td>{item.votes_cast.toLocaleString()}</td>
                                  <td>{item.attendance_percentage}%</td>
                                  <td>{item.male_voters?.toLocaleString() || 'N/A'} / {item.female_voters?.toLocaleString() || 'N/A'}</td>
                                  <td>{item.urban_stations} / {item.rural_stations}</td>
                                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </>
            )}
            
            {activeTab === 'results' && (
              <>
                <h2 className="mb-4">Election Results</h2>
                <Row>
                  <Col lg={8}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Results by County (%)</h4>
                        <Bar data={resultsChartData} />
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col lg={4}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Overall Results</h4>
                        <Pie data={overallResultsData} />
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12}>
                    <Card>
                      <Card.Body>
                        <h4>Detailed Results by County (%)</h4>
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th>County</th>
                                <th>Candidate 1</th>
                                <th>Candidate 2</th>
                                <th>Candidate 3</th>
                                <th>Candidate 4</th>
                                <th>Candidate 5</th>
                                <th>Last Update</th>
                              </tr>
                            </thead>
                            <tbody>
                              {resultsData.map((item, index) => (
                                <tr key={index}>
                                  <td>{item.county}</td>
                                  <td>{item.candidate_1}%</td>
                                  <td>{item.candidate_2}%</td>
                                  <td>{item.candidate_3}%</td>
                                  <td>{item.candidate_4}%</td>
                                  <td>{item.candidate_5}%</td>
                                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </>
            )}
            
            {activeTab === 'clusters' && (
              <>
                <h2 className="mb-4">Demographic Clusters</h2>
                <Row>
                  <Col md={12} className="mb-4">
                    <Card>
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h4>Clustering Parameters</h4>
                          <Button 
                            variant="primary" 
                            onClick={fetchClusteringData} 
                            disabled={refreshing}
                          >
                            Apply
                          </Button>
                        </div>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Clustering Level</Form.Label>
                              <Form.Select 
                                value={clusterLevel}
                                onChange={(e) => setClusterLevel(e.target.value)}
                              >
                                <option value="county">County</option>
                                <option value="town">Town</option>
                                <option value="polling">Polling Booth</option>
                              </Form.Select>
                              <Form.Text className="text-muted">
                                Choose the geographic level for clustering
                              </Form.Text>
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Number of Clusters</Form.Label>
                              <Form.Control
                                type="number"
                                min="2"
                                max="10"
                                value={numClusters}
                                onChange={(e) => setNumClusters(parseInt(e.target.value, 10))}
                              />
                              <Form.Text className="text-muted">
                                Choose between 2-10 clusters
                              </Form.Text>
                            </Form.Group>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Demographic Clusters - 2D Visualization</h4>
                        <div style={{ height: '500px' }}>
                          {/* Use Bubble chart instead of Scatter */}
                          <Bubble data={clusterScatterData} options={scatterOptions} /> 
                        </div>
                        <div className="text-center mt-3 text-muted">
                          <small>
                            * Points are projected to 2D using Principal Component Analysis (PCA). 
                            Explained variance: {clusteringData.explained_variance_ratio 
                              ? (clusteringData.explained_variance_ratio[0] * 100).toFixed(2) + '% / ' + 
                                (clusteringData.explained_variance_ratio[1] * 100).toFixed(2) + '%'
                              : 'N/A'}
                          </small>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  {/* New Similarity Finder Card */}
                  <Col md={12} className="mb-4">
                    <Card>
                      <Card.Body>
                        {/* Update title to remove PCA reference */}
                        <h4>Find Similar Locations (Based on Demographics)</h4>
                        <Form.Group className="mb-3">
                          <Form.Label>Select a Location:</Form.Label>
                          {/* Searchable input with suggestions */}
                          <Form.Control
                            type="text"
                            list="location-list"
                            value={selectedLocationForSimilarity}
                            onChange={(e) => setSelectedLocationForSimilarity(e.target.value)}
                            placeholder="Type to search locations..."
                          />
                          <datalist id="location-list">
                            {uniqueLocationsForDropdown.map(loc => (
                              <option key={loc} value={loc} />
                            ))}
                          </datalist>
                        </Form.Group>

                        {selectedLocationForSimilarity && similarLocations.length > 0 && (
                          <>
                            <h5>Top 5 Most Similar Locations to {selectedLocationForSimilarity}:</h5>
                            <Table striped bordered hover size="sm">
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Location</th>
                                  <th>Similarity Score</th>
                                  <th>Cluster</th>
                                  <th>Total Votes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {similarLocations.map((loc, index) => (
                                  <tr key={loc.identifier}>
                                    <td>{index + 1}</td>
                                    <td>{loc.identifier}</td>
                                    <td>{loc.similarity.toFixed(4)}</td>
                                    <td>{loc.cluster}</td>
                                    <td>{loc.votes?.toLocaleString() || 'N/A'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                            {/* Update the explanatory text */}
                            <small className="text-muted">Similarity based on cosine similarity of demographic percentages (age/gender groups).</small>
                          </>
                        )}
                        {selectedLocationForSimilarity && similarLocations.length === 0 && (
                          <p>Calculating similarities or no other locations found...</p>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4>Cluster Characteristics</h4>
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th>Cluster</th>
                                <th>Male 18-24</th>
                                <th>Male 25-34</th>
                                <th>Male 35-44</th>
                                <th>Male 45-64</th>
                                <th>Male 65+</th>
                                <th>Female 18-24</th>
                                <th>Female 25-34</th>
                                <th>Female 35-44</th>
                                <th>Female 45-64</th>
                                <th>Female 65+</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(clusteringData.cluster_centers || {}).map(([cluster, center]) => (
                                <tr key={cluster}>
                                  <td>Cluster {parseInt(cluster) + 1}</td>
                                  <td>{center.male_18_24_pct?.toFixed(2)}%</td>
                                  <td>{center.male_25_34_pct?.toFixed(2)}%</td>
                                  <td>{center.male_35_44_pct?.toFixed(2)}%</td>
                                  <td>{center.male_45_64_pct?.toFixed(2)}%</td>
                                  <td>{center.male_65_plus_pct?.toFixed(2)}%</td>
                                  <td>{center.female_18_24_pct?.toFixed(2)}%</td>
                                  <td>{center.female_25_34_pct?.toFixed(2)}%</td>
                                  <td>{center.female_35_44_pct?.toFixed(2)}%</td>
                                  <td>{center.female_45_64_pct?.toFixed(2)}%</td>
                                  <td>{center.female_65_plus_pct?.toFixed(2)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12}>
                    <Card>
                      <Card.Body>
                        <h4>Clustered Data</h4>
                        {/* Add Filter Input */}
                        <Form.Group className="mb-3">
                          <Form.Control
                            type="text"
                            placeholder="Filter by location or cluster..."
                            value={clusterTableFilter}
                            onChange={(e) => setClusterTableFilter(e.target.value)}
                          />
                        </Form.Group>
                        <div className="table-responsive">
                          <Table striped bordered hover size="sm"> {/* Use React Bootstrap Table */}
                            <thead>
                              <tr>
                                {/* Make headers clickable for sorting */}
                                {clusterLevel === 'county' && <th onClick={() => requestSort('location')}>County{getSortDirectionIndicator('location')}</th>}
                                {clusterLevel === 'town' && (
                                  <>
                                    <th onClick={() => requestSort('location')}>County / Town{getSortDirectionIndicator('location')}</th>
                                  </>
                                )}
                                {clusterLevel === 'polling' && (
                                  <>
                                    <th onClick={() => requestSort('location')}>County / Town / Station{getSortDirectionIndicator('location')}</th>
                                  </>
                                )}
                                <th onClick={() => requestSort('cluster')}>Cluster{getSortDirectionIndicator('cluster')}</th>
                                <th onClick={() => requestSort('total_votes')}>Total Votes{getSortDirectionIndicator('total_votes')}</th>
                                {/* Add sorting for demographic columns if needed */}
                                <th>Male %</th>
                                <th>Female %</th>
                                <th>18-24 %</th>
                                <th>25-34 %</th>
                                <th>35-44 %</th>
                                <th>45-64 %</th>
                                <th>65+ %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Use filteredAndSortedClusteredData */}
                              {filteredAndSortedClusteredData.map((item, index) => {
                                // Calculate totals
                                const maleTotal = (
                                  (item.demographics_pct?.male_18_24 || 0) +
                                  (item.demographics_pct?.male_25_34 || 0) +
                                  (item.demographics_pct?.male_35_44 || 0) +
                                  (item.demographics_pct?.male_45_64 || 0) +
                                  (item.demographics_pct?.male_65_plus || 0)
                                ).toFixed(2);

                                const femaleTotal = (
                                  (item.demographics_pct?.female_18_24 || 0) +
                                  (item.demographics_pct?.female_25_34 || 0) +
                                  (item.demographics_pct?.female_35_44 || 0) +
                                  (item.demographics_pct?.female_45_64 || 0) +
                                  (item.demographics_pct?.female_65_plus || 0)
                                ).toFixed(2);

                                const age18_24Total = (
                                  (item.demographics_pct?.male_18_24 || 0) +
                                  (item.demographics_pct?.female_18_24 || 0)
                                ).toFixed(2);

                                const age25_34Total = (
                                  (item.demographics_pct?.male_25_34 || 0) +
                                  (item.demographics_pct?.female_25_34 || 0)
                                ).toFixed(2);

                                const age35_44Total = (
                                  (item.demographics_pct?.male_35_44 || 0) +
                                  (item.demographics_pct?.female_35_44 || 0)
                                ).toFixed(2);

                                const age45_64Total = (
                                  (item.demographics_pct?.male_45_64 || 0) +
                                  (item.demographics_pct?.female_45_64 || 0)
                                ).toFixed(2);

                                const age65PlusTotal = (
                                  (item.demographics_pct?.male_65_plus || 0) +
                                  (item.demographics_pct?.female_65_plus || 0)
                                ).toFixed(2);

                                return (
                                  <tr key={index} style={{ backgroundColor: `${clusterColors[item.cluster]}40` }}>
                                    {clusterLevel === 'county' && <td>{item.county}</td>}
                                    {clusterLevel === 'town' && (
                                      <>
                                        <td>{item.county} / {item.town}</td>
                                      </>
                                    )}
                                    {clusterLevel === 'polling' && (
                                      <>
                                        <td>{item.county} / {item.town} / {item.polling_station}</td>
                                      </>
                                    )}
                                    <td>Cluster {item.cluster + 1}</td>
                                    <td>{item.total_votes?.toLocaleString() || 'N/A'}</td>
                                    <td>{maleTotal}%</td>
                                    <td>{femaleTotal}%</td>
                                    <td>{age18_24Total}%</td>
                                    <td>{age25_34Total}%</td>
                                    <td>{age35_44Total}%</td>
                                    <td>{age45_64Total}%</td>
                                    <td>{age65PlusTotal}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table> {/* Close React Bootstrap Table */}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </>
            )}
          </>
        )}
        
        <footer className="my-5 pt-4 text-muted text-center">
          <p>Romanian Elections 2025 - Last updated: {new Date().toLocaleString()}</p>
        </footer>
      </Container>
    </div>
  );
}

export default App;
