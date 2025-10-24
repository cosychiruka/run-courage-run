import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaRobot, FaMicrophone, FaPaperPlane } from 'react-icons/fa';
import { GiCow } from 'react-icons/gi';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import ErrorBoundary from './ErrorBoundary';
import './Trenchbot.css';

const Trenchbot = () => {
  const [messages, setMessages] = useState([
    { text: "Hi there! I'm Courage, your Web3 lending assistant. How can I help you today?", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const { address } = useAppKitAccount() || {};
  const { network } = useAppKitNetwork() || {};

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load voices when they become available
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        // This forces the browser to load voices
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };

      window.speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Handle speech recognition
  const handleListen = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Your browser does not support speech recognition.');
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleSendMessage(transcript);
      setIsListening(false);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
      setIsListening(false);
    } else {
      handleListen();
    }
  }, [isListening, handleListen]);

  // Text-to-speech function
  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Text-to-speech not supported in this browser');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Try to find a pleasant voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = [
      'Google US English',
      'Samantha',
      'Alex',
      'Microsoft David - English (United States)',
      'Microsoft Zira - English (United States)'
    ];

    const selectedVoice = voices.find(voice =>
      preferredVoices.some(name => voice.name.includes(name))
    );

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Configure speech parameters
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;

    // Add error handling
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
    };

    // Speak the text
    window.speechSynthesis.speak(utterance);
  }, []);

  // Handle sending a message
  const handleSendMessage = useCallback(async (voiceInput) => {
    const message = voiceInput || input;
    if (!message.trim()) return;

    // Add user message to chat
    setMessages(prev => [...prev, { text: message, sender: 'user' }]);
    if (!voiceInput) setInput('');

    try {
      // Generate bot response
      const response = await generateBotResponse(
        message,
        address,
        network || 'solana'
      );

      // Add bot response to chat
      setMessages(prev => [...prev, { text: response, sender: 'bot' }]);

      // Speak the response if voice output is enabled
      speak(response);
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage = "Yikes! Something went wrong. Please try again later.";
      setMessages(prev => [...prev, { text: errorMessage, sender: 'bot' }]);
      speak(errorMessage);
    }
  }, [input, address, network, speak]);

  // Handle key press for sending message
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Generate a response based on user input
  const generateBotResponse = async (userInput, userAddress, currentNetwork) => {
    // This is a simplified version - in a real app, you would call your AI service here
    const input = userInput.toLowerCase();

    // Check for common questions
    if (input.includes('hello') || input.includes('hi') || input.includes('hey')) {
      return "G-g-greetings! I'm Courage, your Web3 lending assistant. What can I help you with today?";
    }
    
    if (input.includes('loan') || input.includes('borrow') || input.includes('lend')) {
      return "I can help you with lending on Solana! The current APY is around 3-5%. Would you like to see available lending pools?";
    }
    
    if (input.includes('wallet') && userAddress) {
      const shortAddress = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
      return `I see you're connected with wallet ${shortAddress} on ${currentNetwork?.name || 'Solana'} network.`;
    } else if (input.includes('wallet')) {
      return "I don't see a connected wallet. Please connect your wallet to use this feature!";
    }
    
    if (input.includes('solana') || input.includes('sol') || input.includes('phantom')) {
      return "Solana is the only fully supported network right now. Other networks like Ethereum and Base are coming soon!";
    }
    
    if (input.includes('network') || input.includes('networks')) {
      return "Currently, we only support Solana. Ethereum and Base networks are coming soon in future updates!";
    }
    
    if (input.includes('thank')) {
      return "You're welcome! Remember, if you need anything, just ask. I'm here to help! *whimpers excitedly*";
    }
    
    if (input.includes('help') || input.includes('support')) {
      return `I can help you with:
      - Checking loan rates on Solana
      - Explaining how to use the app
      - Connecting your wallet
      - Answering questions about Web3 lending
      
What would you like to know?`;
    }
    
    // Default response
    return "I'm still learning about that topic. Could you rephrase your question or ask me something else about Web3 lending on Solana?";
  };

  return (
    <ErrorBoundary fallbackText="AI chat couldn't load. Please refresh the page.">
    <div className="trenchbot-container">
      <div className="trenchbot-header">
        <GiCow className="courage-icon" />
        <h3>Courage AI Trenchbot</h3>
      </div>
      
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.sender}`}>
            {message.sender === 'bot' ? (
              <FaRobot className="message-icon" />
            ) : (
              <div className="user-avatar">You</div>
            )}
            <div className="message-content">{message.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything about Web3 lending..."
          disabled={isListening}
          aria-label="Type your message"
          aria-busy={isListening}
        />
        <div className="button-group">
          <button
            className={`mic-button ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={isListening ? 'Stop listening' : 'Voice input'}
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          >
            {isListening ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            )}
          </button>
          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!input.trim()}
            title="Send message"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
};

export default Trenchbot;
