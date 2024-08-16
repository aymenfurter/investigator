import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAudio, faComments, faSpinner, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import AudioUploader from './AudioUploader';
import Timeline from './Timeline';
import Transcription from './Transcription';
import GraphView from './GraphView';
import ChatSection from './ChatSection';

const CaseDetailContainer = styled.div`
  padding: 40px;
  background-color: #ffffff;
  border-radius: 15px;
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
    color: #0078d7;
  }
`;

const Description = styled.p`
  color: #666666;
  margin-bottom: 20px;
  line-height: 1.6;
  font-size: 16px;
  text-align: justify;
  transition: color 0.3s ease;
  &:hover {
    color: #333333;
  }
`;

const Tabs = styled.div`
  display: flex;
  margin-bottom: 20px;
  justify-content: space-around;
  align-items: center;
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
`;

const Tab = styled.button`
  background-color: ${props => props.active ? '#0078d7' : '#ffffff'};
  color: ${props => props.active ? '#ffffff' : '#0078d7'};
  border: 1px solid #0078d7;
  padding: 10px 30px;
  margin-right: 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  &:hover {
    background-color: #0078d7;
    color: #ffffff;
    transform: translateY(-2px);
    box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
  }
`;

const TabIcon = styled(FontAwesomeIcon)`
  margin-right: 8px;
  transition: color 0.3s ease;
`;

const LoadingSpinner = styled(FontAwesomeIcon)`
  font-size: 24px;
  color: #999999;
  animation: spin 1s linear infinite;
  margin: 20px auto;
  display: block;
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const StatusMessage = styled.div`
  background-color: #f0f8ff;
  color: #0078d7;
  padding: 10px;
  border-radius: 5px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SummaryContainer = styled.div`
  margin-top: 20px;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const SummaryTitle = styled.h3`
  color: #333333;
  margin-bottom: 10px;
`;

const SummaryText = styled.p`
  color: #666666;
  line-height: 1.6;
`;

const CaseDetail = () => {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [activeTab, setActiveTab] = useState('files');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [selectedAudioFile, setSelectedAudioFile] = useState(null);

  const fetchCaseDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/cases/${id}`);
      const data = response.data;
      // Remove duplicate files
      data.files = [...new Set(data.files)];
      setCaseData(data);
      setProcessingStatus(data.status || 'unknown');
      if (data.files && data.files.length > 0) {
        setSelectedAudioFile(data.files[0]);
      }
    } catch (error) {
      console.error('Error fetching case details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetails();
    const statusInterval = setInterval(async () => {
      try {
        const statusResponse = await axios.get(`/api/cases/${id}/status`);
        setProcessingStatus(statusResponse.data.status);
        if (statusResponse.data.status === 'completed' || statusResponse.data.status === 'error') {
          clearInterval(statusInterval);
          fetchCaseDetails();
        }
      } catch (error) {
        console.error('Error fetching status:', error);
      }
    }, 5000);
    return () => clearInterval(statusInterval);
  }, [id]);

  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
  };

  const handleAudioFileSelect = (file) => {
    setSelectedAudioFile(file);
    setCurrentTime(0);
  };

  const handleTimeClick = (time) => {
    setCurrentTime(time);
  };

  if (loading) {
    return (
      <CaseDetailContainer>
        <LoadingSpinner icon={faSpinner} />
      </CaseDetailContainer>
    );
  }

  if (!caseData) {
    return <CaseDetailContainer>Case not found</CaseDetailContainer>;
  }

  return (
    <CaseDetailContainer>
      <Title>{caseData.id}</Title>
      <Description>{caseData.description}</Description>
      
      {processingStatus && (
        <StatusMessage>
          Processing Status: {processingStatus}
          {processingStatus === 'processing' && <LoadingSpinner icon={faSpinner} />}
        </StatusMessage>
      )}
      
      <Tabs>
        <Tab active={activeTab === 'files'} onClick={() => setActiveTab('files')}>
          <TabIcon icon={faFileAudio} /> Files
        </Tab>
        <Tab active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')}>
          <TabIcon icon={faNetworkWired} /> Analysis
        </Tab>
        <Tab active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
          <TabIcon icon={faComments} /> Chat
        </Tab>
        <Tab class="disabled" active={activeTab === 'export'} onClick={() => setActiveTab('export')}>
          <TabIcon icon={faFileAudio} />
          Export (Coming)
        </Tab>
        <Tab class="disabled" active={activeTab === 'export'} onClick={() => setActiveTab('export')}>
          <TabIcon icon={faFileAudio} />
          Diarization (Coming)
        </Tab>
        <Tab class="disabled" active={activeTab === 'export'} onClick={() => setActiveTab('export')}>
          <TabIcon icon={faFileAudio} />
          Background Noise (Coming)
        </Tab>
      </Tabs>
      {activeTab === 'files' && (
        <>
          <AudioUploader caseId={id} onFileUploaded={fetchCaseDetails} />
          {caseData.files && caseData.files.length > 0 && processingStatus === 'completed' && (
            <>
              <Timeline 
                caseId={id} 
                audioFiles={caseData.files}
                selectedFile={selectedAudioFile}
                onFileSelect={handleAudioFileSelect}
                onTimeUpdate={handleTimeUpdate}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
              />
              {selectedAudioFile && caseData.summaries && caseData.summaries[selectedAudioFile] && (
                <SummaryContainer>
                  <SummaryTitle>Summary for {selectedAudioFile}</SummaryTitle>
                  <SummaryText>{caseData.summaries[selectedAudioFile]}</SummaryText>
                </SummaryContainer>
              )}
              {selectedAudioFile && caseData.full_transcripts && caseData.full_transcripts[selectedAudioFile] && (
                <Transcription 
                  transcript={caseData.full_transcripts[selectedAudioFile]} 
                  currentTime={currentTime}
                  onTimeClick={handleTimeClick}
                />
              )}
            </>
          )}
        </>
      )}
      {activeTab === 'analysis' && processingStatus === 'completed' && (
        <GraphView 
          graphData={caseData.graph} 
          onTimeClick={handleTimeClick}
        />
      )}
      {activeTab === 'chat' && processingStatus === 'completed' && (
        <ChatSection 
          caseId={id} 
          onCitationClick={handleTimeClick}
        />
      )}
    </CaseDetailContainer>
  );
};

export default CaseDetail;