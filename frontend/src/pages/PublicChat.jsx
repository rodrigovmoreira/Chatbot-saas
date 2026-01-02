import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  IconButton,
  Container,
  Spinner,
  Flex,
  Heading,
  useToast,
  Avatar,
  useColorModeValue,
} from '@chakra-ui/react';
import { FaPaperPlane } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Create a standalone axios instance to avoid auth interceptors
const publicApi = axios.create({
  // FIX: Override broken env var 'http://localhotst:3000' if detected, or just use hardcoded backend port for this file
  baseURL: (process.env.REACT_APP_API_URL && !process.env.REACT_APP_API_URL.includes('localhotst'))
    ? process.env.REACT_APP_API_URL
    : 'http://localhost:3001',
});

const PublicChat = () => {
  const { businessId } = useParams();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('Chat');
  const [sessionId, setSessionId] = useState('');
  const messagesEndRef = useRef(null);
  const toast = useToast();

  const bg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('teal.600', 'teal.500');
  const userBubbleBg = useColorModeValue('teal.500', 'teal.600');
  const botBubbleBg = useColorModeValue('white', 'gray.700');
  const userTextColor = 'white';
  const botTextColor = useColorModeValue('gray.800', 'white');

  // 1. Session & Config Init
  useEffect(() => {
    // Session ID Logic
    let storedSession = localStorage.getItem('calango_session_id');
    if (!storedSession) {
      storedSession = uuidv4();
      localStorage.setItem('calango_session_id', storedSession);
    }
    setSessionId(storedSession);

    // Fetch Business Config
    const fetchConfig = async () => {
      try {
        const res = await publicApi.get(`/api/chat/config/${businessId}`);
        if (res.data && res.data.businessName) {
          setBusinessName(res.data.businessName);
        }
      } catch (error) {
        console.error('Error fetching business config:', error);
        toast({
          title: 'Erro ao carregar chat.',
          description: 'Não foi possível conectar ao negócio.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };

    if (businessId) {
      fetchConfig();
    }
  }, [businessId, toast]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMsg = inputValue.trim();
    setInputValue(''); // Clear input immediately

    // Optimistic UI: Add user message
    const newMessage = { sender: 'user', text: userMsg };
    setMessages((prev) => [...prev, newMessage]);

    setLoading(true);

    try {
      const payload = {
        businessId,
        sessionId,
        message: userMsg,
      };

      const res = await publicApi.post('/api/chat/send', payload);

      if (res.data && res.data.response) {
        setMessages((prev) => [
          ...prev,
          { sender: 'bot', text: res.data.response },
        ]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar mensagem.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <Flex direction="column" h="100vh" bg={bg}>
      {/* Header */}
      <Box bg={headerBg} p={4} shadow="md">
        <Container maxW="container.md">
          <HStack spacing={3}>
            <Avatar size="sm" name={businessName} bg="teal.800" color="white" />
            <Heading size="md" color="white">
              {businessName}
            </Heading>
          </HStack>
        </Container>
      </Box>

      {/* Chat Area */}
      <Box flex={1} overflowY="auto" p={4}>
        <Container maxW="container.md">
          <VStack spacing={4} align="stretch">
            {messages.map((msg, index) => (
              <Flex
                key={index}
                justify={msg.sender === 'user' ? 'flex-end' : 'flex-start'}
              >
                <Box
                  maxW="80%"
                  bg={msg.sender === 'user' ? userBubbleBg : botBubbleBg}
                  color={msg.sender === 'user' ? userTextColor : botTextColor}
                  p={3}
                  borderRadius="lg"
                  borderTopRightRadius={msg.sender === 'user' ? '0' : 'lg'}
                  borderTopLeftRadius={msg.sender === 'bot' ? '0' : 'lg'}
                  shadow="sm"
                >
                  <Text whiteSpace="pre-wrap">{msg.text}</Text>
                </Box>
              </Flex>
            ))}
            {loading && (
              <Flex justify="flex-start">
                <Box
                  bg={botBubbleBg}
                  p={3}
                  borderRadius="lg"
                  borderTopLeftRadius="0"
                  shadow="sm"
                >
                  <HStack spacing={1}>
                    <Spinner size="xs" color="gray.500" />
                    <Text fontSize="sm" color="gray.500">
                      Digitando...
                    </Text>
                  </HStack>
                </Box>
              </Flex>
            )}
            <div ref={messagesEndRef} />
          </VStack>
        </Container>
      </Box>

      {/* Input Area */}
      <Box bg={useColorModeValue('white', 'gray.800')} p={3} borderTopWidth={1}>
        <Container maxW="container.md">
          <HStack spacing={2}>
            <Input
              placeholder="Digite sua mensagem..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              bg={useColorModeValue('gray.100', 'gray.700')}
              border="none"
              _focus={{ ring: 2, ringColor: 'teal.500' }}
            />
            <IconButton
              icon={<FaPaperPlane />}
              colorScheme="teal"
              aria-label="Send message"
              onClick={handleSendMessage}
              isDisabled={!inputValue.trim() || loading}
            />
          </HStack>
        </Container>
      </Box>
    </Flex>
  );
};

export default PublicChat;
