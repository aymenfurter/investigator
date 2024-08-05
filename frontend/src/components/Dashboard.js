import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const DashboardContainer = styled.div`
  padding: 30px;
  background-color: #fafafa;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease, background-color 0.3s ease;
`;

const Stat = styled.div`
  background-color: #ffffff;
  border-radius: 8px;
  padding: 25px;
  margin-bottom: 25px;
  font-size: 20px;
  font-weight: 500;
  color: #333333;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 10px rgba(0, 0, 0, 0.1);
  }

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(0,120,215,0.15) 100%);
    transition: height 0.3s ease;
    z-index: 0;
  }

  & > * {
    position: relative;
    z-index: 1;
  }
`;
const Dashboard = () => {
  const [stats, setStats] = useState({ total_cases: 0, total_minutes_ingested: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get('/api/dashboard');
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <DashboardContainer>
      <h1>Dashboard</h1>
      <Stat>Total Cases: {stats.total_cases}</Stat>
      <Stat>Total Minutes Ingested: {stats.total_minutes_ingested}</Stat>
    </DashboardContainer>
  );
};

export default Dashboard;