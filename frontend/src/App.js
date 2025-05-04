import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Bar, Pie, Line, Scatter, Bubble, Doughnut } from 'react-chartjs-2'; 
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
  BubbleController 
} from 'chart.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Navbar, Nav, Alert, Button, Row, Col, Card, Form, Table, Badge } from 'react-bootstrap';
import { useDebounce } from './utils/hooks';
import { getLocationIdentifier, calculateCosineSimilarity, findTopSimilarLocations } from './utils/similarity';
import './App.css';

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
  BubbleController 
);

// Component for stats card with consistent styling
const StatsCard = ({ title, value, subtitle, icon, color }) => {
  return (
    <Card className="stats-card mb-4">
      <Card.Body className="d-flex flex-column align-items-center">
        <div className="icon" style={{ color: color || '#0d6efd' }}>
          {icon || '📊'}
        </div>
        <div className="value" style={{ color: color || '#0d6efd' }}>{value}</div>
        <div className="label">{title}</div>
        {subtitle && <div className="text-muted small mt-1">{subtitle}</div>}
      </Card.Body>
    </Card>
  );
};

// Dashboard header component
const DashboardHeader = ({ title, description, lastUpdated }) => {
  return (
    <div className="dashboard-header">
      <Row className="align-items-center">
        <Col>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </Col>
        {lastUpdated && (
          <Col xs="auto">
            <div className="last-updated">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </div>
          </Col>
        )}
      </Row>
    </div>
  );
};

// Chart container component for consistent chart displays
const ChartContainer = ({ title, chart, height = "350px" }) => {
  return (
    <Card className="mb-4">
      <Card.Body>
        <h4 className="mb-3">{title}</h4>
        <div style={{ height, position: 'relative' }}>
          {chart}
        </div>
      </Card.Body>
    </Card>
  );
};

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
  const [clusterTableFilter, setClusterTableFilter] = useState('');
  const [clusterTableSortConfig, setClusterTableSortConfig] = useState({ key: null, direction: 'ascending' });
  const [selectedLocationForSimilarity, setSelectedLocationForSimilarity] = useState('');
  const [ageGroupFilter, setAgeGroupFilter] = useState('all');
  const [topCountiesCount, setTopCountiesCount] = useState(10);
  const [useAgePercentages, setUseAgePercentages] = useState(true);

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
  
  // Debounced similarity input
  const debouncedSimilarity = useDebounce(selectedLocationForSimilarity, 300);
  // Compute similar locations memoized
  const similarLocations = useMemo(
    () => findTopSimilarLocations(
      debouncedSimilarity,
      clusteringData.clustered_data,
      clusterLevel
    ),
    [debouncedSimilarity, clusteringData.clustered_data, clusterLevel]
  );
  
  // Prepare unique locations for the similarity dropdown
  const uniqueLocationsForDropdown = useMemo(() => {
    const identifiers = new Set();
    clusteringData.clustered_data.forEach(item => {
      identifiers.add(getLocationIdentifier(item, clusterLevel));
    });
    return Array.from(identifiers).sort(); // Sort alphabetically
  }, [clusteringData.clustered_data, clusterLevel, getLocationIdentifier]);
  
  // Calculate summary statistics for dashboard cards
  const summaryStats = useMemo(() => {
    if (!attendanceData.length) return { totalVoters: 0, totalVotesCast: 0, avgAttendance: 0, counties: 0 };
    
    const totalVoters = attendanceData.reduce((sum, item) => sum + item.total_voters, 0);
    const totalVotesCast = attendanceData.reduce((sum, item) => sum + item.votes_cast, 0);
    const avgAttendance = (totalVotesCast / totalVoters * 100).toFixed(2);
    
    return {
      totalVoters: totalVoters.toLocaleString(),
      totalVotesCast: totalVotesCast.toLocaleString(),
      avgAttendance,
      counties: attendanceData.length
    };
  }, [attendanceData]);
  
  // Enhanced chart options with custom styling
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        cornerRadius: 6,
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        beginAtZero: true
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    }
  };
  
  // Prepare attendance chart data with improved styling
  const attendanceChartData = {
    labels: attendanceData.map(item => item.county),
    datasets: [
      {
        label: 'Attendance (%)',
        data: attendanceData.map(item => item.attendance_percentage),
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(54, 162, 235, 0.9)',
      },
    ],
  };
  
  // Enhanced results chart data with improved colors and styling
  const resultsChartData = {
    labels: resultsData.map(item => item.county),
    datasets: [
      {
        label: 'Candidate 1',
        data: resultsData.map(item => item.candidate_1),
        backgroundColor: 'rgba(255, 99, 132, 0.7)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Candidate 2',
        data: resultsData.map(item => item.candidate_2),
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Candidate 3',
        data: resultsData.map(item => item.candidate_3),
        backgroundColor: 'rgba(255, 206, 86, 0.7)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Candidate 4',
        data: resultsData.map(item => item.candidate_4),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Candidate 5',
        data: resultsData.map(item => item.candidate_5),
        backgroundColor: 'rgba(153, 102, 255, 0.7)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };
  
  // Overall results using doughnut chart for better visualization
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
          'rgba(255, 99, 132, 0.85)',
          'rgba(54, 162, 235, 0.85)',
          'rgba(255, 206, 86, 0.85)',
          'rgba(75, 192, 192, 0.85)',
          'rgba(153, 102, 255, 0.85)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
        ],
        borderWidth: 2,
        hoverOffset: 12
      },
    ],
  };
  
  // Prepare national age distribution pie chart
  const nationalAgeDemographicData = {
    labels: ['18-24', '25-34', '35-44', '45-64', '65+'],
    datasets: [
      {
        data: [
          demographicData.national.age_18_24 || 0,
          demographicData.national.age_25_34 || 0,
          demographicData.national.age_35_44 || 0,
          demographicData.national.age_45_64 || 0,
          demographicData.national.age_65_plus || 0,
        ],
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)',
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
  
  // Prepare filtered and sorted county age data for bar chart
  const getTopCountiesByAgeGroup = (ageGroup, topN = 10, usePercentages = false) => {
    // Calculate the values for sorting (either raw numbers or percentages)
    const countiesWithValues = attendanceData.map(item => {
      let value = 0;
      if (ageGroup === 'all') {
        value = item.votes_cast || 0;
      } else if (ageGroup === '18-24') {
        value = item.age_18_24 || 0;
        if (usePercentages && item.votes_cast > 0) {
          value = (value / item.votes_cast) * 100;
        }
      } else if (ageGroup === '25-34') {
        value = item.age_25_34 || 0;
        if (usePercentages && item.votes_cast > 0) {
          value = (value / item.votes_cast) * 100;
        }
      } else if (ageGroup === '35-44') {
        value = item.age_35_44 || 0;
        if (usePercentages && item.votes_cast > 0) {
          value = (value / item.votes_cast) * 100;
        }
      } else if (ageGroup === '45-64') {
        value = item.age_45_64 || 0;
        if (usePercentages && item.votes_cast > 0) {
          value = (value / item.votes_cast) * 100;
        }
      } else if (ageGroup === '65+') {
        value = item.age_65_plus || 0;
        if (usePercentages && item.votes_cast > 0) {
          value = (value / item.votes_cast) * 100;
        }
      }
      
      return {
        county: item.county,
        value,
        item, // Keep the full item for accessing other properties
      };
    });
    
    // Sort by the calculated value and take top N
    return countiesWithValues
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
  };
  
  // Get top counties based on current filters
  const topCountiesByAge = useMemo(() => 
    getTopCountiesByAgeGroup(ageGroupFilter, topCountiesCount, useAgePercentages),
    [ageGroupFilter, topCountiesCount, useAgePercentages, attendanceData]
  );
  
  // Prepare demographic data for age groups
  const ageDemographicData = {
    labels: topCountiesByAge.map(item => item.county),
    datasets: [
      {
        label: '18-24',
        data: topCountiesByAge.map(item => {
          const value = item.item.age_18_24 || 0;
          return useAgePercentages ? ((value / item.item.votes_cast) * 100).toFixed(1) : value;
        }),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
      {
        label: '25-34',
        data: topCountiesByAge.map(item => {
          const value = item.item.age_25_34 || 0;
          return useAgePercentages ? ((value / item.item.votes_cast) * 100).toFixed(1) : value;
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        label: '35-44',
        data: topCountiesByAge.map(item => {
          const value = item.item.age_35_44 || 0;
          return useAgePercentages ? ((value / item.item.votes_cast) * 100).toFixed(1) : value;
        }),
        backgroundColor: 'rgba(255, 206, 86, 0.5)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1,
      },
      {
        label: '45-64',
        data: topCountiesByAge.map(item => {
          const value = item.item.age_45_64 || 0;
          return useAgePercentages ? ((value / item.item.votes_cast) * 100).toFixed(1) : value;
        }),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
      {
        label: '65+',
        data: topCountiesByAge.map(item => {
          const value = item.item.age_65_plus || 0;
          return useAgePercentages ? ((value / item.item.votes_cast) * 100).toFixed(1) : value;
        }),
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
          demographicData.national.rural_votes || 0,  // Swapped: rural data should be urban
          demographicData.national.urban_votes || 0,  // Swapped: urban data should be rural
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
          demographicData.national.rural_male_voters || 0,   // Swapped: rural male should be urban male
          demographicData.national.rural_female_voters || 0, // Swapped: rural female should be urban female
          demographicData.national.urban_male_voters || 0,   // Swapped: urban male should be rural male
          demographicData.national.urban_female_voters || 0, // Swapped: urban female should be rural female
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
          demographicData.national.rural_age_18_24 || 0,   // Swapped: rural should be urban
          demographicData.national.rural_age_25_34 || 0,   // Swapped: rural should be urban
          demographicData.national.rural_age_35_44 || 0,   // Swapped: rural should be urban
          demographicData.national.rural_age_45_64 || 0,   // Swapped: rural should be urban
          demographicData.national.rural_age_65_plus || 0, // Swapped: rural should be urban
        ],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
      {
        label: 'Rural',
        data: [
          demographicData.national.urban_age_18_24 || 0,   // Swapped: urban should be rural
          demographicData.national.urban_age_25_34 || 0,   // Swapped: urban should be rural
          demographicData.national.urban_age_35_44 || 0,   // Swapped: urban should be rural
          demographicData.national.urban_age_45_64 || 0,   // Swapped: urban should be rural
          demographicData.national.urban_age_65_plus || 0, // Swapped: urban should be rural
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
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand href="#home">
            <span role="img" aria-label="Romania flag" className="me-2">🇷🇴</span> 
            Romanian Elections 2025
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
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
            <Button 
              variant="outline-light" 
              size="sm"
              className="ms-3 d-flex align-items-center"
              onClick={fetchData} 
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Refreshing...
                </>
              ) : (
                <>
                  <span className="me-2">↻</span> Refresh Data
                </>
              )}
            </Button>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      
      <Container>
        {error && (
          <Alert variant="danger" className="mb-4">
            <Alert.Heading>Error</Alert.Heading>
            <p>{error}</p>
          </Alert>
        )}
        
        {loading ? (
          <div className="text-center my-5 py-5">
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <h3>Loading election data...</h3>
            <p className="text-muted">Please wait while we fetch the latest information</p>
          </div>
        ) : (
          <>
            {activeTab === 'attendance' && (
              <>
                <DashboardHeader 
                  title="Voter Attendance Dashboard" 
                  description="Comprehensive overview of voter turnout and demographics across Romania"
                  lastUpdated={attendanceData[0]?.timestamp}
                />
                
                {/* Summary statistics cards */}
                <Row className="mb-4">
                  <Col md={3}>
                    <StatsCard 
                      title="Total Eligible Voters" 
                      value={summaryStats.totalVoters}
                      icon="🧑‍⚖️"
                      color="#0d6efd"
                    />
                  </Col>
                  <Col md={3}>
                    <StatsCard 
                      title="Total Votes Cast" 
                      value={summaryStats.totalVotesCast}
                      icon="✓"
                      color="#198754"
                    />
                  </Col>
                  <Col md={3}>
                    <StatsCard 
                      title="Average Attendance" 
                      value={`${summaryStats.avgAttendance}%`}
                      icon="📊"
                      color="#fd7e14"
                    />
                  </Col>
                  <Col md={3}>
                    <StatsCard 
                      title="Counties Reporting" 
                      value={summaryStats.counties}
                      subtitle="All counties reporting"
                      icon="🏛️"
                      color="#6f42c1"
                    />
                  </Col>
                </Row>
                
                <Row>
                  <Col lg={8}>
                    <ChartContainer 
                      title="Attendance by County (%)" 
                      chart={<Bar data={attendanceChartData} options={chartOptions} />}
                      height="400px"
                    />
                  </Col>
                  
                  <Col lg={4}>
                    <ChartContainer 
                      title="Gender Distribution" 
                      chart={
                        <Doughnut 
                          data={genderDistributionData} 
                          options={{
                            ...chartOptions,
                            cutout: '60%',
                            plugins: {
                              ...chartOptions.plugins,
                              tooltip: {
                                ...chartOptions.plugins.tooltip,
                                callbacks: {
                                  label: function(context) {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
                                  }
                                }
                              }
                            }
                          }}
                        />
                      }
                    />
                  </Col>
                  
                  <Col md={12}>
                    <Card className="mb-4">
                      <Card.Body>
                        <h4 className="mb-3">Voter Age Demographics</h4>
                        <Row>
                          <Col md={4}>
                            <h5 className="text-center mb-3">National Age Distribution</h5>
                            <div style={{ height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <Pie 
                                data={nationalAgeDemographicData} 
                                options={{
                                  ...chartOptions,
                                  plugins: {
                                    ...chartOptions.plugins,
                                    tooltip: {
                                      ...chartOptions.plugins.tooltip,
                                      callbacks: {
                                        label: function(context) {
                                          const value = context.raw;
                                          const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                          const percentage = ((value / total) * 100).toFixed(1);
                                          return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
                                        }
                                      }
                                    }
                                  }
                                }}
                              />
                            </div>
                          </Col>
                          
                          <Col md={8}>
                            <div className="filter-controls mb-3">
                              <Row className="align-items-center">
                                <Col md={3}>
                                  <Form.Group>
                                    <Form.Label>Filter by age:</Form.Label>
                                    <Form.Select 
                                      value={ageGroupFilter}
                                      onChange={(e) => setAgeGroupFilter(e.target.value)}
                                      className="form-select-sm"
                                    >
                                      <option value="all">All age groups</option>
                                      <option value="18-24">18-24 years</option>
                                      <option value="25-34">25-34 years</option>
                                      <option value="35-44">35-44 years</option>
                                      <option value="45-64">45-64 years</option>
                                      <option value="65+">65+ years</option>
                                    </Form.Select>
                                  </Form.Group>
                                </Col>
                                <Col md={3}>
                                  <Form.Group>
                                    <Form.Label>Counties to show:</Form.Label>
                                    <Form.Select 
                                      value={topCountiesCount}
                                      onChange={(e) => setTopCountiesCount(parseInt(e.target.value))}
                                      className="form-select-sm"
                                    >
                                      <option value="5">Top 5</option>
                                      <option value="10">Top 10</option>
                                      <option value="15">Top 15</option>
                                      <option value="20">Top 20</option>
                                    </Form.Select>
                                  </Form.Group>
                                </Col>
                                <Col md={3}>
                                  <Form.Group>
                                    <Form.Check 
                                      type="switch"
                                      id="use-percentages-switch"
                                      label="Show percentages"
                                      checked={useAgePercentages}
                                      onChange={(e) => setUseAgePercentages(e.target.checked)}
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={3}>
                                  <Badge bg="light" text="dark" className="p-2">
                                    {ageGroupFilter === 'all' 
                                      ? 'Showing counties with highest total votes' 
                                      : `Counties with highest ${ageGroupFilter} ${useAgePercentages ? 'percentage' : 'turnout'}`}
                                  </Badge>
                                </Col>
                              </Row>
                            </div>
                            <div style={{ height: '300px' }}>
                              <Bar 
                                data={ageDemographicData} 
                                options={{
                                  ...chartOptions,
                                  plugins: {
                                    ...chartOptions.plugins,
                                    tooltip: {
                                      ...chartOptions.plugins.tooltip,
                                      callbacks: {
                                        label: function(context) {
                                          const value = context.raw;
                                          return useAgePercentages
                                            ? `${context.dataset.label}: ${value}%`
                                            : `${context.dataset.label}: ${Number(value).toLocaleString()}`;
                                        }
                                      }
                                    }
                                  },
                                  scales: {
                                    ...chartOptions.scales,
                                    y: {
                                      ...chartOptions.scales.y,
                                      title: {
                                        display: true,
                                        text: useAgePercentages ? 'Percentage (%)' : 'Number of Voters'
                                      }
                                    }
                                  }
                                }}
                              />
                            </div>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12} className="mb-4">
                    <Card className="insight-card">
                      <Card.Body>
                        <h4 className="mb-3">
                          <i className="fa fa-lightbulb-o me-2" aria-hidden="true"></i>
                          Urban/Rural Voter Insights
                        </h4>
                        <Row>
                          <Col md={8}>
                            <p>The urban and rural voter distributions reveal important demographic patterns across Romania. Understanding these patterns helps analyze voting behaviors and predict future electoral trends.</p>
                            <ul className="insights-list">
                              <li>
                                <strong>Distribution split:</strong> {' '}
                                {demographicData.national.rural_votes && demographicData.national.urban_votes ? (
                                  <>
                                    Urban areas account for {((demographicData.national.rural_votes / (demographicData.national.rural_votes + demographicData.national.urban_votes)) * 100).toFixed(1)}% of total voters.
                                  </>
                                ) : 'Data not available'}
                              </li>
                              <li>
                                <strong>Gender differences:</strong> {' '}
                                {demographicData.national.rural_male_voters && demographicData.national.rural_female_voters ? (
                                  <>
                                    Urban areas show a {demographicData.national.rural_male_voters > demographicData.national.rural_female_voters ? 'male' : 'female'} majority at {((Math.max(demographicData.national.rural_male_voters, demographicData.national.rural_female_voters) / (demographicData.national.rural_male_voters + demographicData.national.rural_female_voters)) * 100).toFixed(1)}%.
                                  </>
                                ) : 'Gender data not available'}
                              </li>
                              <li>
                                <strong>Age demographics:</strong> {' '}
                                {demographicData.national.rural_age_18_24 ? (
                                  <>
                                    Urban areas have a {
                                      demographicData.national.rural_age_18_24 > demographicData.national.urban_age_18_24 ? 'higher' : 'lower'
                                    } percentage of young voters (18-24) compared to rural areas.
                                  </>
                                ) : 'Age data not available'}
                              </li>
                            </ul>
                          </Col>
                          <Col md={4}>
                            <div className="stats-highlight">
                              <div className="stat-item">
                                <div className="stat-label">Urban Stations</div>
                                <div className="stat-value">{demographicData.national.urban_stations?.toLocaleString() || 'N/A'}</div>
                              </div>
                              <div className="stat-item">
                                <div className="stat-label">Rural Stations</div>
                                <div className="stat-value">{demographicData.national.rural_stations?.toLocaleString() || 'N/A'}</div>
                              </div>
                              <div className="stat-item">
                                <div className="stat-label">Urban/Rural Ratio</div>
                                <div className="stat-value">
                                  {demographicData.national.urban_stations && demographicData.national.rural_stations ? 
                                    (demographicData.national.urban_stations / demographicData.national.rural_stations).toFixed(2) : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={6}>
                    <ChartContainer 
                      title="Urban/Rural Distribution" 
                      chart={
                        <Doughnut 
                          data={urbanRuralDistributionData}
                          options={{
                            ...chartOptions,
                            cutout: '60%',
                            plugins: {
                              ...chartOptions.plugins,
                              tooltip: {
                                ...chartOptions.plugins.tooltip,
                                callbacks: {
                                  label: function(context) {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
                                  }
                                }
                              }
                            }
                          }}
                        />
                      }
                    />
                    <div className="text-center text-muted small mt-2 mb-4">
                      <em>Distribution of voters in urban vs rural areas across Romania</em>
                    </div>
                  </Col>
                  
                  <Col md={6}>
                    <ChartContainer 
                      title="Urban/Rural Gender Distribution" 
                      chart={
                        <Pie 
                          data={urbanRuralGenderData} 
                          options={{
                            ...chartOptions,
                            plugins: {
                              ...chartOptions.plugins,
                              tooltip: {
                                ...chartOptions.plugins.tooltip,
                                callbacks: {
                                  label: function(context) {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
                                  }
                                }
                              }
                            }
                          }}
                        />
                      }
                    />
                    <div className="text-center text-muted small mt-2 mb-4">
                      <em>Comparison of gender distribution between urban and rural areas</em>
                    </div>
                  </Col>
                  
                  <Col md={12}>
                    <ChartContainer 
                      title="Urban/Rural Age Distribution" 
                      chart={
                        <Bar 
                          data={urbanRuralAgeData} 
                          options={{
                            ...chartOptions,
                            plugins: {
                              ...chartOptions.plugins,
                              tooltip: {
                                ...chartOptions.plugins.tooltip,
                                callbacks: {
                                  label: function(context) {
                                    const value = context.raw;
                                    const datasetLabel = context.dataset.label;
                                    return `${datasetLabel}: ${value.toLocaleString()} voters`;
                                  },
                                  afterLabel: function(context) {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${percentage}% of all ${context.dataset.label.toLowerCase()} voters`;
                                  }
                                }
                              }
                            },
                            scales: {
                              ...chartOptions.scales,
                              y: {
                                ...chartOptions.scales.y,
                                title: {
                                  display: true,
                                  text: 'Number of voters'
                                }
                              }
                            }
                          }}
                        />
                      }
                      height="400px"
                    />
                    <div className="text-center text-muted small mt-2 mb-4">
                      <em>Comparing age demographics between urban and rural populations</em>
                    </div>
                  </Col>
                  
                  <Col md={12}>
                    <Card>
                      <Card.Body>
                        <h4 className="mb-3">Attendance Details</h4>
                        <div className="mb-3">
                          <Form.Control
                            type="text"
                            placeholder="Filter by county..."
                            onChange={(e) => setClusterTableFilter(e.target.value)}
                            value={clusterTableFilter}
                            className="w-25"
                          />
                        </div>
                        <div className="table-responsive">
                          <table className="table table-striped data-table">
                            <thead>
                              <tr>
                                <th onClick={() => requestSort('county')}>
                                  County {getSortDirectionIndicator('county')}
                                </th>
                                <th onClick={() => requestSort('total_voters')}>
                                  Total Voters {getSortDirectionIndicator('total_voters')}
                                </th>
                                <th onClick={() => requestSort('votes_cast')}>
                                  Votes Cast {getSortDirectionIndicator('votes_cast')}
                                </th>
                                <th onClick={() => requestSort('attendance_percentage')}>
                                  Attendance (%) {getSortDirectionIndicator('attendance_percentage')}
                                </th>
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
                                  <td>
                                    <div className="d-flex align-items-center">
                                      <div className="progress flex-grow-1 me-2" style={{ height: '8px' }}>
                                        <div 
                                          className="progress-bar" 
                                          role="progressbar" 
                                          style={{ width: `${item.attendance_percentage}%` }}
                                          aria-valuenow={item.attendance_percentage} 
                                          aria-valuemin="0" 
                                          aria-valuemax="100"
                                        ></div>
                                      </div>
                                      <span>{item.attendance_percentage}%</span>
                                    </div>
                                  </td>
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
                <DashboardHeader 
                  title="Election Results Dashboard" 
                  description="Real-time results and candidate performance analysis"
                  lastUpdated={resultsData[0]?.timestamp}
                />
                
                <Row className="mb-4">
                  {overallResultsData.labels.map((label, index) => (
                    <Col key={index} md={12/5}>
                      <StatsCard 
                        title={label} 
                        value={`${overallResultsData.datasets[0].data[index].toFixed(1)}%`}
                        color={overallResultsData.datasets[0].backgroundColor[index].replace('0.85', '1')}
                      />
                    </Col>
                  ))}
                </Row>
                
                <Row>
                  <Col lg={8}>
                    <ChartContainer 
                      title="Candidate Performance by County" 
                      chart={<Bar data={resultsChartData} options={chartOptions} />}
                      height="400px"
                    />
                  </Col>
                  
                  <Col lg={4}>
                    <ChartContainer 
                      title="Overall Results Distribution" 
                      chart={
                        <Doughnut 
                          data={overallResultsData} 
                          options={{
                            ...chartOptions,
                            cutout: '65%',
                            plugins: {
                              ...chartOptions.plugins,
                              tooltip: {
                                ...chartOptions.plugins.tooltip,
                                callbacks: {
                                  label: function(context) {
                                    return `${context.label}: ${context.raw.toFixed(1)}%`;
                                  }
                                }
                              }
                            }
                          }}
                        />
                      }
                    />
                  </Col>
                  
                  {/* Add more visualization components for results tab */}
                  
                  <Col md={12}>
                    <Card>
                      <Card.Body>
                        <h4 className="mb-3">Detailed Results by County</h4>
                        <div className="table-responsive">
                          <table className="table table-striped data-table">
                            <thead>
                              <tr>
                                <th>County</th>
                                <th>Candidate 1 (%)</th>
                                <th>Candidate 2 (%)</th>
                                <th>Candidate 3 (%)</th>
                                <th>Candidate 4 (%)</th>
                                <th>Candidate 5 (%)</th>
                                <th>Votes Cast</th>
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
                                  <td>{item.votes_cast.toLocaleString()}</td>
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
                <DashboardHeader 
                  title="Voter Clusters Analysis" 
                  description="Cluster analysis of voting patterns across different regions"
                />
                
                <Row className="mb-4">
                  <Col md={12}>
                    <Card className="filter-controls">
                      <Card.Body>
                        <Row className="align-items-center">
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label>Clustering Level:</Form.Label>
                              <Form.Select 
                                value={clusterLevel}
                                onChange={(e) => setClusterLevel(e.target.value)}
                              >
                                <option value="county">County Level</option>
                                <option value="town">Town Level</option>
                                <option value="polling">Polling Station Level</option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label>Number of Clusters:</Form.Label>
                              <Form.Select 
                                value={numClusters}
                                onChange={(e) => setNumClusters(parseInt(e.target.value))}
                              >
                                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                  <option key={n} value={n}>{n} clusters</option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Button 
                              variant="primary" 
                              onClick={fetchClusteringData} 
                              disabled={refreshing}
                              className="mt-4 w-100"
                            >
                              {refreshing ? 'Updating...' : 'Update Clusters'}
                              {refreshing && (
                                <span className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true"></span>
                              )}
                            </Button>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={12}>
                    <ChartContainer 
                      title="Voter Clusters Visualization" 
                      chart={<Bubble data={clusterScatterData} options={scatterOptions} />}
                      height="500px"
                    />
                  </Col>
                  
                  <Col md={12} className="mt-4">
                    <Card>
                      <Card.Body>
                        <h4 className="mb-3">Find Similar Voting Patterns</h4>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Select location:</Form.Label>
                              <Form.Select
                                value={selectedLocationForSimilarity}
                                onChange={(e) => setSelectedLocationForSimilarity(e.target.value)}
                              >
                                <option value="">-- Select a location --</option>
                                {uniqueLocationsForDropdown.map((location, idx) => (
                                  <option key={idx} value={location}>{location}</option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            {selectedLocationForSimilarity && (
                              <div className="mt-4">
                                <h5>Most similar to {selectedLocationForSimilarity}:</h5>
                                <ul className="list-group">
                                  {similarLocations.map((location, idx) => (
                                    <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                                      {location.name}
                                      <Badge bg="primary" pill>
                                        {(location.similarity * 100).toFixed(2)}% similar
                                      </Badge>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col md={12} className="mt-4">
                    <Card>
                      <Card.Body>
                        <h4 className="mb-3">Cluster Data</h4>
                        <div className="mb-3">
                          <Form.Control
                            type="text"
                            placeholder="Filter data..."
                            onChange={(e) => setClusterTableFilter(e.target.value)}
                            value={clusterTableFilter}
                            className="w-25"
                          />
                        </div>
                        
                        <div className="table-responsive">
                          <table className="table table-striped data-table">
                            <thead>
                              <tr>
                                <th onClick={() => requestSort('location')}>
                                  Location {getSortDirectionIndicator('location')}
                                </th>
                                <th onClick={() => requestSort('cluster')}>
                                  Cluster {getSortDirectionIndicator('cluster')}
                                </th>
                                <th onClick={() => requestSort('total_votes')}>
                                  Total Votes {getSortDirectionIndicator('total_votes')}
                                </th>
                                <th>Demographics</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAndSortedClusteredData.map((item, index) => {
                                const location = clusterLevel === 'county' ? item.county : 
                                                clusterLevel === 'town' ? `${item.county}, ${item.town}` : 
                                                `${item.county}, ${item.town}, ${item.polling_station}`;
                                return (
                                  <tr key={index}>
                                    <td>{location}</td>
                                    <td>
                                      <span 
                                        className="badge" 
                                        style={{ 
                                          backgroundColor: clusterColors[item.cluster],
                                          color: 'white',
                                          padding: '6px 12px'
                                        }}
                                      >
                                        Cluster {item.cluster + 1}
                                      </span>
                                    </td>
                                    <td>{item.total_votes?.toLocaleString() || 'N/A'}</td>
                                    <td>
                                      {item.demographics_pct && (
                                        <div className="d-flex flex-wrap gap-2">
                                          {item.demographics_pct.age_18_24 && (
                                            <Badge bg="light" text="dark">18-24: {item.demographics_pct.age_18_24}%</Badge>
                                          )}
                                          {item.demographics_pct.age_25_34 && (
                                            <Badge bg="light" text="dark">25-34: {item.demographics_pct.age_25_34}%</Badge>
                                          )}
                                          {item.demographics_pct.age_35_44 && (
                                            <Badge bg="light" text="dark">35-44: {item.demographics_pct.age_35_44}%</Badge>
                                          )}
                                          {item.demographics_pct.age_45_64 && (
                                            <Badge bg="light" text="dark">45-64: {item.demographics_pct.age_45_64}%</Badge>
                                          )}
                                          {item.demographics_pct.age_65_plus && (
                                            <Badge bg="light" text="dark">65+: {item.demographics_pct.age_65_plus}%</Badge>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </>
            )}
          </>
        )}
      </Container>
      
      <footer className="mt-auto py-4 bg-light">
        <Container className="text-center">
          <p className="text-muted mb-0">
            Romanian Elections 2025 Dashboard | Last data refresh: {new Date().toLocaleString()}
          </p>
        </Container>
      </footer>
    </div>
  );
}

export default App;
