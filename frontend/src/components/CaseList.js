import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faSpinner, faPlus } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';


const CaseListContainer = styled.div`
  padding: 40px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    box-shadow: 0 12px 20px rgba(0, 0, 0, 0.15);
  }
`;

const Title = styled.h2`
  color: #333333;
  margin-bottom: 20px;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: capitalize;
  transition: color 0.3s ease;

  &:hover {
    color: #0078D7;
  }
`;

const CaseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 30px;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 10px;
  transition: background-color 0.3s ease;
`;

const CaseCard = styled(Link)`
  background-color: #ffffff;
  border-radius: 10px;
  padding: 20px;
  text-decoration: none;
  color: #333333;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(0,120,215,0.2) 100%);
    transition: opacity 0.3s ease;
    opacity: 0;
  }

  &:hover:before {
    opacity: 1;
  }
`;

const CaseIcon = styled(FontAwesomeIcon)`
  font-size: 28px;
  color: #0078D7;
  margin-bottom: 15px;
  transition: color 0.3s ease;

  &:hover {
    color: #005A9E;
  }
`;

const CaseName = styled.h3`
  margin: 0 0 10px 0;
  font-size: 20px;
  font-weight: 500;
  color: #333333;
  transition: color 0.3s ease;

  &:hover {
    color: #0078D7;
  }
`;

const CaseDescription = styled.p`
  margin: 0;
  font-size: 16px;
  color: #666666;
  line-height: 1.5;
  transition: color 0.3s ease;

  &:hover {
    color: #333333;
  }
`;

const LoadingSpinner = styled(FontAwesomeIcon)`
  font-size: 24px;
  color: #999999;
  animation: spin 1s linear infinite;
  display: block;
  margin: 20px auto;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const NewCaseForm = styled.form`
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 20px;
  background-color: #f7f7f7;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
`;

const Input = styled.input`
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #cccccc;
  font-size: 15px;
  background-color: #ffffff;
  transition: border-color 0.3s ease, background-color 0.3s ease;

  &:focus {
    border-color: #0078D7;
    background-color: #f0f8ff;
  }
`;

const TextArea = styled.textarea`
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #cccccc;
  font-size: 15px;
  resize: vertical;
  min-height: 100px;
  background-color: #ffffff;
  transition: border-color 0.3s ease, background-color 0.3s ease;

  &:focus {
    border-color: #0078D7;
    background-color: #f0f8ff;
  }
`;

const Button = styled.button`
  padding: 12px 18px;
  border-radius: 6px;
  background-color: #0078D7;
  color: #ffffff;
  font-size: 15px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.3s ease;
  border: none;
  font-weight: 500;

  &:hover {
    background-color: #005A9E;
    transform: translateY(-2px);
  }

  &:active {
    background-color: #004A87;
  }
`;

const CaseList = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  // New state for the form inputs
  const [newCaseName, setNewCaseName] = useState('');
  const [newCaseDescription, setNewCaseDescription] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await axios.get('/api/cases');
        setCases(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching cases:', error);
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  const handleCreateCase = async (event) => {
    event.preventDefault();
    setError(null); // Clear previous errors

    if (!newCaseName || !newCaseDescription) {
      setError('Both name and description are required.');
      return;
    }

    try {
      const response = await axios.post('/api/cases', {
        id: newCaseName,
        description: newCaseDescription,
      });

      setCases([...cases, response.data]);
      setNewCaseName('');
      setNewCaseDescription('');
    } catch (error) {
      console.error('Error creating case:', error);
      setError('Failed to create case. Please try again.');
    }
  };

  if (loading) {
    return (
      <CaseListContainer>
        <LoadingSpinner icon={faSpinner} />
      </CaseListContainer>
    );
  }

  return (
    <CaseListContainer>
      <Title>Cases</Title>

      {/* New Case Form */}
      <NewCaseForm onSubmit={handleCreateCase}>
        <Input
          type="text"
          placeholder="Case Name"
          value={newCaseName}
          onChange={(e) => setNewCaseName(e.target.value)}
        />
        <TextArea
          placeholder="Case Description"
          value={newCaseDescription}
          onChange={(e) => setNewCaseDescription(e.target.value)}
        />
        <Button type="submit">
          <FontAwesomeIcon icon={faPlus} /> Create Case
        </Button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </NewCaseForm>

      {/* Case List */}
      <CaseGrid>
        {cases.map((case_) => (
          <CaseCard key={case_.id} to={`/cases/${case_.id}`}>
            <CaseIcon icon={faFolder} />
            <CaseName>{case_.name}</CaseName>
            <CaseDescription>{case_.description}</CaseDescription>
          </CaseCard>
        ))}
      </CaseGrid>
    </CaseListContainer>
  );
};

export default CaseList;
