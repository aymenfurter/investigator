import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

const TranscriptionContainer = styled.div`
  margin-top: 20px;
  padding: 20px;
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  overflow-y: auto;
`;

const TranscriptText = styled.p`
  color: ${props => props.active ? '#0078d7' : '#333333'};
  font-weight: ${props => props.active ? 'bold' : 'normal'};
  transition: all 0.3s ease;
  margin-bottom: 10px;
  padding: 5px;
  border-radius: 5px;
  background-color: ${props => props.active ? '#f0f8ff' : 'transparent'};
  cursor: pointer;
  &:hover {
    background-color: #f0f8ff;
  }
`;

const Transcription = ({ transcript, currentTime, onTimeClick }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (transcript) {
      const lines = transcript.split('\n');
      const newActiveIndex = lines.findIndex((line, index) => {
        const nextLine = lines[index + 1];
        const currentTimecode = parseTimecode(line);
        const nextTimecode = nextLine ? parseTimecode(nextLine) : Infinity;
        return currentTime >= currentTimecode && currentTime < nextTimecode;
      });
      if (newActiveIndex !== -1 && newActiveIndex !== activeIndex) {
        setActiveIndex(newActiveIndex);
        if (transcriptRef.current) {
          const activeElement = transcriptRef.current.children[newActiveIndex];
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentTime, transcript, activeIndex]);

  const parseTimecode = (line) => {
    const match = line.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (match) {
      const [, hours, minutes, seconds, milliseconds] = match;
      return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
    }
    return 0;
  };

  const handleLineClick = (line) => {
    const timecode = parseTimecode(line);
    onTimeClick(timecode);
  };

  if (!transcript || transcript.length === 0) {
    return <TranscriptionContainer>No transcript available</TranscriptionContainer>;
  }

  const lines = transcript.split('\n');

  return (
    <TranscriptionContainer ref={transcriptRef}>
      
      {lines.map((line, index) => (
        <TranscriptText 
          key={index} 
          active={index === activeIndex}
          onClick={() => handleLineClick(line)}
        >
          {line}
        </TranscriptText>
      ))}
    </TranscriptionContainer>
  );
};

export default Transcription;