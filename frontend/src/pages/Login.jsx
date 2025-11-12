import React, { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  FormControl,
  FormLabel,
  Input,
  Button,
  Text,
  useToast,
  VStack,
  Heading,
  Card,
  CardBody,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { authAPI } from '../services/api';
import { useApp } from '../context/AppContext';

const Login = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { dispatch } = useApp();
  const toast = useToast();

  const handleAuthSuccess = (response) => {
    const { token, user } = response.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    dispatch({ type: 'SET_USER', payload: user });
    
    toast({
      title: 'Sucesso!',
      description: `Bem-vindo, ${user.name}!`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    
    window.location.href = '/dashboard';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.target);
    const data = {
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      const response = await authAPI.login(data);
      handleAuthSuccess(response);
    } catch (error) {
      setError(error.response?.data?.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      company: formData.get('company'),
      password: formData.get('password')
    };

    try {
      const response = await authAPI.register(data);
      handleAuthSuccess(response);
    } catch (error) {
      setError(error.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      minH="100vh"
      bgGradient="linear(135deg, #128C7E 0%, #25D366 100%)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      py={8}
    >
      <Container maxW="md">
        <Card borderRadius="xl" boxShadow="2xl">
          <CardBody p={8}>
            <VStack spacing={6}>
              <Heading 
                size="xl" 
                color="brand.600" 
                textAlign="center"
              >
                ChatBot Platform
              </Heading>

              {error && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              <Tabs 
                index={activeTab} 
                onChange={setActiveTab}
                variant="enclosed-colored"
                colorScheme="brand"
                width="100%"
              >
                <TabList>
                  <Tab flex={1} fontWeight="semibold">Login</Tab>
                  <Tab flex={1} fontWeight="semibold">Cadastro</Tab>
                </TabList>

                <TabPanels>
                  {/* Login Tab */}
                  <TabPanel px={0}>
                    <form onSubmit={handleLogin}>
                      <VStack spacing={4}>
                        <FormControl isRequired>
                          <FormLabel>Email</FormLabel>
                          <Input 
                            name="email"
                            type="email" 
                            placeholder="seu@email.com"
                            size="lg"
                          />
                        </FormControl>
                        
                        <FormControl isRequired>
                          <FormLabel>Senha</FormLabel>
                          <Input 
                            name="password"
                            type="password" 
                            placeholder="Sua senha"
                            size="lg"
                          />
                        </FormControl>
                        
                        <Button
                          type="submit"
                          colorScheme="brand"
                          size="lg"
                          width="100%"
                          isLoading={loading}
                          loadingText="Entrando..."
                        >
                          Entrar
                        </Button>
                      </VStack>
                    </form>
                  </TabPanel>

                  {/* Register Tab */}
                  <TabPanel px={0}>
                    <form onSubmit={handleRegister}>
                      <VStack spacing={4}>
                        <FormControl isRequired>
                          <FormLabel>Nome completo</FormLabel>
                          <Input 
                            name="name"
                            type="text" 
                            placeholder="Seu nome completo"
                            size="lg"
                          />
                        </FormControl>
                        
                        <FormControl isRequired>
                          <FormLabel>Email</FormLabel>
                          <Input 
                            name="email"
                            type="email" 
                            placeholder="seu@email.com"
                            size="lg"
                          />
                        </FormControl>
                        
                        <FormControl>
                          <FormLabel>Empresa</FormLabel>
                          <Input 
                            name="company"
                            type="text" 
                            placeholder="Nome da sua empresa"
                            size="lg"
                          />
                        </FormControl>
                        
                        <FormControl isRequired>
                          <FormLabel>Senha</FormLabel>
                          <Input 
                            name="password"
                            type="password" 
                            placeholder="Mínimo 6 caracteres"
                            size="lg"
                          />
                        </FormControl>
                        
                        <Button
                          type="submit"
                          colorScheme="brand"
                          size="lg"
                          width="100%"
                          isLoading={loading}
                          loadingText="Cadastrando..."
                        >
                          Criar Conta
                        </Button>
                      </VStack>
                    </form>
                  </TabPanel>
                </TabPanels>
              </Tabs>

              <Text fontSize="sm" color="gray.600" textAlign="center">
                Sistema de atendimento automatizado via WhatsApp
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </Container>
    </Box>
  );
};

export default Login;