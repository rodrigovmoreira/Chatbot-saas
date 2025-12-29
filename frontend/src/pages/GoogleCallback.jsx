import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Box, Spinner, Text, VStack } from '@chakra-ui/react';

const GoogleCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { dispatch } = useApp();

  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));

        // Save to localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Update Context
        dispatch({ type: 'SET_USER', payload: user });

        // Redirect to dashboard
        navigate('/dashboard');
      } catch (error) {
        console.error("Error parsing user data:", error);
        navigate('/login');
      }
    } else {
      console.error("Missing token or user data");
      navigate('/login');
    }
  }, [searchParams, navigate, dispatch]);

  return (
    <Box
      height="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.50"
    >
      <VStack spacing={4}>
        <Spinner size="xl" color="brand.500" thickness="4px" />
        <Text fontSize="lg" color="gray.600">Autenticando com Google...</Text>
      </VStack>
    </Box>
  );
};

export default GoogleCallback;
