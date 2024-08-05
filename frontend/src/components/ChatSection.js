import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 500px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  background-color: #ffffff;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }
`;

const MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #f8f8f8;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: #cccccc #f8f8f8;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f8f8f8;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #cccccc;
    border-radius: 4px;
  }
`;

const Message = styled.div`
  margin-bottom: 15px;
  padding: 12px;
  border-radius: 10px;
  max-width: 70%;
  align-self: flex-start;
  background-color: #f0f0f0;
  color: #333333;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  position: relative;
  transition: background-color 0.3s ease, transform 0.3s ease;
  
  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: -10px;
    width: 10px;
    height: 10px;
    background-color: inherit;
    border-radius: 50%;
    box-shadow: 0 0 0 2px #ffffff;
  }

  &.user {
    align-self: flex-end;
    background-color: #0078d7;
    color: #ffffff;

    &:hover {
      background-color: #005a9e;
    }

    &:after {
      left: auto;
      right: -10px;
    }
  }
`;

const InputContainer = styled.div`
  display: flex;
  padding: 15px;
  background-color: #ffffff;
  border-top: 1px solid #e0e0e0;
`;

const Input = styled.input`
  flex: 1;
  padding: 10px 15px;
  border: 1px solid #cccccc;
  border-radius: 20px;
  font-size: 16px;
  background-color: #fafafa;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;

  &:focus {
    border-color: #0078d7;
    box-shadow: 0 0 5px rgba(0, 120, 215, 0.5);
    background-color: #ffffff;
  }
`;

const SendButton = styled.button`
  background-color: #0078d7;
  color: #ffffff;
  border: none;
  border-radius: 50%;
  width: 45px;
  height: 45px;
  margin-left: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.3s ease;

  &:hover {
    background-color: #005a9e;
    transform: scale(1.1);
  }

  &:active {
    background-color: #004a87;
    transform: scale(0.95);
  }
`;

const CitationList = styled.div`
  margin-top: 10px;
`;

const CitationButton = styled.button`
  background-color: #0078d7;
  color: white;
  border: none;
  padding: 5px 10px;
  margin: 2px;
  border-radius: 3px;
  cursor: pointer;
  &:hover {
    background-color: #005a9e;
  }
`;

const ChatSection = ({ caseId, onCitationClick }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messageListRef = useRef(null);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === '') return;

    const newMessage = { role: 'user', content: input };
    setMessages([...messages, newMessage]);
    setInput('');

    try {
      const response = await axios.post(`/api/cases/${caseId}/chat`, {
        messages: [...messages, newMessage],
      });
      
      if (response.data && response.data.choices && response.data.choices[0].message) {
        const assistantMessage = response.data.choices[0].message;
        setMessages(prevMessages => [
          ...prevMessages,
          {
            role: 'assistant',
            content: assistantMessage.content,
            citations: assistantMessage.context?.citations || []
          }
        ]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prevMessages => [
        ...prevMessages,
        { role: 'assistant', content: "Sorry, there was an error processing your request." }
      ]);
    }
  };

  const formatCitation = (url) => {
    const match = url.match(/\/([^\/]+)__min(\d+)_(\d+)\.txt$/);
    if (match) {
      const [_, filename, minutes, seconds] = match;
      return `${filename} - ${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }
    return url;
  };

  return (
    <ChatContainer>
      <MessageList ref={messageListRef}>
        {messages.map((message, index) => (
          <Message key={index} className={message.role === 'user' ? 'user' : ''}>
            {message.content}
            {message.citations && message.citations.length > 0 && (
              <CitationList>
                {message.citations.map((citation, citationIndex) => (
                  <CitationButton
                    key={citationIndex}
                    onClick={() => onCitationClick(citation.url)}
                  >
                    {formatCitation(citation.url)}
                  </CitationButton>
                ))}
              </CitationList>
            )}
          </Message>
        ))}
      </MessageList>
      <InputContainer>
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your message..."
        />
        <SendButton onClick={handleSendMessage}>
          <FontAwesomeIcon icon={faPaperPlane} />
        </SendButton>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatSection;