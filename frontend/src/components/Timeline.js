import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

const TimelineContainer = styled.div`
  margin-top: 30px;
  padding: 20px;
  background-color: #f7f7f7;
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
`;

const AudioPlayerContainer = styled.div`
  background-color: #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 25px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.05);
`;

const PlayButton = styled.button`
  background-color: #0078d7;
  color: #ffffff;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.3s ease;
  &:hover {
    background-color: #005a9e;
  }
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 12px;
  background-color: #cccccc;
  border-radius: 6px;
  margin-top: 15px;
  cursor: pointer;
  position: relative;
`;

const Progress = styled.div`
  width: ${props => props.percent}%;
  height: 100%;
  background-color: #0078d7;
  border-radius: 6px;
  transition: width 0.1s linear;
`;

const CurrentTime = styled.div`
  font-size: 14px;
  color: #333;
  margin-top: 10px;
  text-align: center;
`;

const FileSelector = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
`;

const FileButton = styled.button`
  background-color: ${props => props.active ? '#0078d7' : '#ffffff'};
  color: ${props => props.active ? '#ffffff' : '#0078d7'};
  border: 1px solid #0078d7;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
  &:hover {
    background-color: #0078d7;
    color: #ffffff;
  }
`;


const Timeline = ({ caseId, audioFiles, selectedFile, onFileSelect, onTimeUpdate, currentTime, setCurrentTime }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(new Audio());

  useEffect(() => {
    const audio = audioRef.current;
    audio.src = `/api/cases/${caseId}/audio/${selectedFile}`;

    const handleTimeUpdate = () => onTimeUpdate(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [caseId, selectedFile, onTimeUpdate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (isFinite(currentTime) && !isNaN(currentTime)) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * audio.duration;
    if (isFinite(newTime) && !isNaN(newTime)) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleFileSelect = (file) => {
    onFileSelect(file);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const formatTime = (timeInSeconds) => {
    if (!isFinite(timeInSeconds) || isNaN(timeInSeconds)) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <TimelineContainer>
      <AudioPlayerContainer>
        <PlayButton onClick={handlePlayPause} disabled={!selectedFile}>
          <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
        </PlayButton>
        <ProgressBar onClick={handleSeek}>
          <Progress percent={(currentTime / duration) * 100 || 0} />
        </ProgressBar>
        <CurrentTime>{formatTime(currentTime)} / {formatTime(duration)}</CurrentTime>
      </AudioPlayerContainer>
      <FileSelector>
        {audioFiles.map((file, index) => (
          <FileButton 
            key={index} 
            onClick={() => handleFileSelect(file)}
            active={file === selectedFile}
          >
            {file}
          </FileButton>
        ))}
      </FileSelector>
    </TimelineContainer>
  );
};

export default Timeline;