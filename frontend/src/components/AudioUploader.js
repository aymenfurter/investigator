import React, { useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';

const UploaderContainer = styled.div`
  margin-bottom: 20px;
  background-color: #ffffff;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
  &:hover {
    background-color: #f8f8f8;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }
`;

const DropZone = styled.div`
  border: 2px dashed #e0e0e0;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #fafafa;
  position: relative;
  overflow: hidden;
  &:hover {
    border-color: #0078d7;
    background-color: #f0f8ff;
  }
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 0;
    background-color: #33c3f0;
    transition: height 0.3s ease;
    z-index: 0;
    opacity: 0.05;
  }
  &:hover:before {
    height: 100%;
  }
`;

const UploadIcon = styled(FontAwesomeIcon)`
  font-size: 28px;
  color: #0078d7;
  margin-bottom: 10px;
  transition: color 0.3s ease;
  &:hover {
    color: #005a9e;
  }
`;

const UploadText = styled.p`
  margin: 0;
  color: #666666;
  transition: color 0.3s ease;
  &:hover {
    color: #333333;
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 12px;
  background-color: #e0e0e0;
  border-radius: 6px;
  margin-top: 12px;
  overflow: hidden;
  transition: background-color 0.3s ease, height 0.3s ease;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
  &:hover {
    background-color: #cccccc;
    height: 14px;
  }
`;

const Progress = styled.div`
  width: ${props => props.percent}%;
  height: 100%;
  background-color: #0078d7;
  transition: width 0.3s ease;
  box-shadow: inset 0 -1px 1px rgba(0, 0, 0, 0.2);
  &:hover {
    background-color: #005a9e;
  }
`;

const ErrorMessage = styled.div`
  color: #d32f2f;
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AudioUploader = ({ caseId, onFileUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'audio/mpeg') {
      setUploading(true);
      setProgress(0);
      setError('');
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await axios.post(`/api/cases/${caseId}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        });
        if (response.status === 202) {
          onFileUploaded();
        } else {
          throw new Error('Unexpected response from server');
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        setError('Error uploading file. Please try again.');
      } finally {
        setUploading(false);
      }
    } else {
      setError('Please select an MP3 file');
    }
  };

  return (
    <UploaderContainer>
      <DropZone onClick={() => document.getElementById('fileInput').click()}>
        {uploading ? (
          <UploadIcon icon={faSpinner} spin />
        ) : (
          <UploadIcon icon={faUpload} />
        )}
        <UploadText>{uploading ? 'Uploading...' : 'Click or drag MP3 file here to upload'}</UploadText>
        <HiddenInput
          id="fileInput"
          type="file"
          accept=".mp3,audio/mpeg"
          onChange={handleFileSelect}
        />
      </DropZone>
      {uploading && (
        <ProgressBar>
          <Progress percent={progress} />
        </ProgressBar>
      )}
      {error && (
        <ErrorMessage>
          <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '5px' }} />
          {error}
        </ErrorMessage>
      )}
    </UploaderContainer>
  );
};

export default AudioUploader;