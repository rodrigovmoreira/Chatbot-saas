import React, { useEffect, useState } from 'react';
import {
  Box,  Container,  Grid,  GridItem,  Card,  CardHeader,  CardBody,  Heading,  Text,  Button,  VStack,  HStack,
  Stat,  StatLabel,  StatNumber,  StatHelpText,  useToast,  Image,  Progress,  Badge,  Icon,  useColorModeValue,
  FormControl,  FormLabel,  Input,  Select,  Textarea,  Checkbox,  Modal,  ModalOverlay,  ModalContent,  ModalHeader,
  ModalFooter,  ModalBody,  ModalCloseButton,  useDisclosure,} from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon, DownloadIcon, AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { connectSocket, getSocket } from '../services/socket';
import { businessAPI } from '../services/api';

const Dashboard = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Estados para edição
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    businessName: '',
    businessType: '',
    welcomeMessage: ''
  });
  const [menuOptions, setMenuOptions] = useState([]);
  const [newMenuOption, setNewMenuOption] = useState({
    keyword: '',
    description: '',
    response: '',
    requiresHuman: false
  });

  // Carregar dados iniciais
  useEffect(() => {
    if (state.businessConfig) {
      setConfigForm({
        businessName: state.businessConfig.businessName || '',
        businessType: state.businessConfig.businessType || '',
        welcomeMessage: state.businessConfig.welcomeMessage || ''
      });
      setMenuOptions(state.businessConfig.menuOptions || []);
    }
  }, [state.businessConfig]);

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const socketInstance = connectSocket(token);

      socketInstance.on('qr', (qrImageUrl) => {
        console.log('QR Code recebido no frontend');
        dispatch({ type: 'SET_QR_CODE', payload: qrImageUrl });
        toast({
          title: 'QR Code Gerado!',
          description: 'Escaneie com seu WhatsApp',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      });

      socketInstance.on('status', (message) => {
        console.log('Status:', message);
        toast({
          title: 'Status WhatsApp',
          description: message,
          status: 'info',
          duration: 3000,
        });
      });

      socketInstance.on('whatsapp_ready', (isReady) => {
        console.log('WhatsApp ready:', isReady);
        dispatch({ 
          type: 'SET_WHATSAPP_STATUS', 
          payload: { 
            isConnected: isReady, 
            isAuthenticated: isReady,
            connectionTime: isReady ? new Date() : null
          } 
        });
        
        if (isReady) {
          dispatch({ type: 'SET_QR_CODE', payload: null });
          toast({
            title: 'WhatsApp Conectado!',
            description: 'Bot pronto para receber mensagens',
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
        }
      });

      return () => {
        socketInstance.disconnect();
      };
    }
  }, [dispatch, toast]);

  // Solicitar QR Code
  const requestQRCode = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('request_qr');
      toast({
        title: 'Solicitando QR Code...',
        status: 'info',
        duration: 2000,
      });
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await businessAPI.logout();
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  };

  // Salvar configurações do negócio
  const handleSaveConfig = async () => {
    try {
      const response = await businessAPI.updateConfig(configForm);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      setEditingConfig(false);
      toast({
        title: 'Configurações salvas!',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar configurações',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Adicionar opção de menu
  const handleAddMenuOption = () => {
    if (!newMenuOption.keyword || !newMenuOption.description || !newMenuOption.response) {
      toast({
        title: 'Preencha todos os campos',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    const updatedOptions = [...menuOptions, { ...newMenuOption }];
    setMenuOptions(updatedOptions);
    setNewMenuOption({
      keyword: '',
      description: '',
      response: '',
      requiresHuman: false
    });
    onClose();
    
    toast({
      title: 'Opção adicionada!',
      status: 'success',
      duration: 2000,
    });
  };

  // Remover opção de menu
  const handleRemoveMenuOption = (index) => {
    const updatedOptions = menuOptions.filter((_, i) => i !== index);
    setMenuOptions(updatedOptions);
    toast({
      title: 'Opção removida',
      status: 'info',
      duration: 2000,
    });
  };

  // Salvar menu completo
  const handleSaveMenu = async () => {
    try {
      const response = await businessAPI.updateConfig({
        ...state.businessConfig,
        menuOptions: menuOptions
      });
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      toast({
        title: 'Menu salvo com sucesso!',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar menu',
        status: 'error',
        duration: 3000,
      });
    }
  };

  if (!state.user) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minH="100vh">
        <Progress size="lg" isIndeterminate colorScheme="brand" w="300px" />
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50" p={4}>
      <Container maxW="1400px">
        {/* Header */}
        <Card bg={cardBg} mb={6} boxShadow="md">
          <CardBody>
            <HStack justify="space-between" align="center">
              <VStack align="start" spacing={1}>
                <Heading size="lg">
                  Dashboard - <Text as="span" color="brand.500">{state.businessConfig?.businessName || 'Meu Negócio'}</Text>
                </Heading>
                <Text color="gray.600">Olá, {state.user.name}!</Text>
              </VStack>
              <Button colorScheme="red" onClick={handleLogout}>
                Sair
              </Button>
            </HStack>
          </CardBody>
        </Card>

        {/* Main Grid */}
        <Grid
          templateColumns={{ base: '1fr', lg: '1fr 1fr' }}
          templateRows="auto auto auto"
          gap={6}
          mb={6}
        >
          {/* WhatsApp Status */}
          <GridItem colSpan={{ base: 1, lg: 1 }} rowSpan={1}>
            <Card bg={cardBg} height="100%" boxShadow="md">
              <CardHeader pb={0}>
                <Heading size="md">Status WhatsApp</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <HStack justify="space-between">
                    <Badge
                      colorScheme={state.whatsappStatus.isConnected ? 'green' : 'red'}
                      fontSize="md"
                      p={2}
                      borderRadius="md"
                    >
                      <HStack>
                        <Icon as={state.whatsappStatus.isConnected ? CheckCircleIcon : WarningIcon} />
                        <Text>
                          {state.whatsappStatus.isConnected ? 'Conectado' : 'Desconectado'}
                        </Text>
                      </HStack>
                    </Badge>
                    
                    {state.whatsappStatus.connectionTime && (
                      <Text fontSize="sm" color="gray.600">
                        Conectado em: {new Date(state.whatsappStatus.connectionTime).toLocaleString()}
                      </Text>
                    )}
                  </HStack>

                  {state.qrCode && (
                    <VStack spacing={3} p={4} border="2px dashed" borderColor="gray.200" borderRadius="lg">
                      <Heading size="sm">Conectar WhatsApp</Heading>
                      <Image 
                        src={state.qrCode} 
                        alt="QR Code para conectar WhatsApp"
                        maxW="200px"
                        borderRadius="md"
                        boxShadow="lg"
                      />
                      <Text fontSize="sm" textAlign="center" color="gray.600">
                        Escaneie este QR Code com seu WhatsApp
                      </Text>
                      <Button 
                        leftIcon={<DownloadIcon />} 
                        colorScheme="brand" 
                        size="sm"
                        onClick={() => window.open(state.qrCode, '_blank')}
                      >
                        Baixar QR Code
                      </Button>
                    </VStack>
                  )}

                  {state.whatsappStatus.isConnected && (
                    <VStack spacing={2} p={4} bg="green.50" borderRadius="lg" border="1px solid" borderColor="green.200">
                      <CheckCircleIcon boxSize={8} color="green.500" />
                      <Heading size="md" color="green.600">WhatsApp Conectado!</Heading>
                      <Text textAlign="center" color="green.700">
                        O bot está pronto para receber mensagens dos seus clientes
                      </Text>
                    </VStack>
                  )}

                  {!state.whatsappStatus.isConnected && (
                    <Button 
                      colorScheme="brand" 
                      onClick={requestQRCode}
                      leftIcon={<DownloadIcon />}
                    >
                      {state.qrCode ? 'Gerar Novo QR Code' : 'Conectar WhatsApp'}
                    </Button>
                  )}
                </VStack>
              </CardBody>
            </Card>
          </GridItem>

          {/* Business Config */}
          <GridItem colSpan={{ base: 1, lg: 1 }} rowSpan={1}>
            <Card bg={cardBg} height="100%" boxShadow="md">
              <CardHeader pb={0}>
                <Heading size="md">Configurações do Negócio</Heading>
              </CardHeader>
              <CardBody>
                {editingConfig ? (
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Nome do Negócio</FormLabel>
                      <Input 
                        value={configForm.businessName}
                        onChange={(e) => setConfigForm({...configForm, businessName: e.target.value})}
                        placeholder="Nome da sua empresa"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Segmento</FormLabel>
                      <Select 
                        value={configForm.businessType}
                        onChange={(e) => setConfigForm({...configForm, businessType: e.target.value})}
                      >
                        <option value="varejo">Varejo</option>
                        <option value="servicos">Serviços</option>
                        <option value="restaurante">Restaurante</option>
                        <option value="imoveis">Imóveis</option>
                        <option value="outros">Outros</option>
                      </Select>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Mensagem de Boas-Vindas</FormLabel>
                      <Textarea 
                        value={configForm.welcomeMessage}
                        onChange={(e) => setConfigForm({...configForm, welcomeMessage: e.target.value})}
                        placeholder="Digite a mensagem de boas-vindas para seus clientes..."
                        rows={3}
                      />
                    </FormControl>
                    
                    <HStack>
                      <Button colorScheme="brand" onClick={handleSaveConfig}>
                        Salvar
                      </Button>
                      <Button variant="outline" onClick={() => setEditingConfig(false)}>
                        Cancelar
                      </Button>
                    </HStack>
                  </VStack>
                ) : (
                  <VStack spacing={4} align="stretch">
                    <Box p={3} bg="blue.50" borderRadius="md">
                      <Text fontWeight="bold" color="blue.800">Nome do Negócio</Text>
                      <Text color="blue.600">{state.businessConfig?.businessName || 'Não configurado'}</Text>
                    </Box>
                    
                    <Box p={3} bg="purple.50" borderRadius="md">
                      <Text fontWeight="bold" color="purple.800">Segmento</Text>
                      <Text color="purple.600" textTransform="capitalize">
                        {state.businessConfig?.businessType || 'Não definido'}
                      </Text>
                    </Box>
                    
                    <Box p={3} bg="green.50" borderRadius="md">
                      <Text fontWeight="bold" color="green.800">Mensagem de Boas-Vindas</Text>
                      <Text color="green.600" fontStyle="italic">
                        "{state.businessConfig?.welcomeMessage || 'Não configurada'}"
                      </Text>
                    </Box>
                    
                    <Button 
                      colorScheme="brand" 
                      variant="outline" 
                      onClick={() => setEditingConfig(true)}
                      leftIcon={<EditIcon />}
                    >
                      Editar Configurações
                    </Button>
                  </VStack>
                )}
              </CardBody>
            </Card>
          </GridItem>

          {/* Menu de Atendimento */}
          <GridItem colSpan={{ base: 1, lg: 2 }} rowSpan={1}>
            <Card bg={cardBg} boxShadow="md">
              <CardHeader pb={0}>
                <Heading size="md">Menu de Atendimento</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Text color="gray.600">
                    Configure as opções de menu que seus clientes verão no WhatsApp
                  </Text>

                  {menuOptions.length === 0 ? (
                    <Box textAlign="center" py={8} color="gray.500">
                      <Text>Nenhuma opção de menu configurada</Text>
                      <Text fontSize="sm">Clique em "Adicionar Opção" para começar</Text>
                    </Box>
                  ) : (
                    <VStack spacing={3} align="stretch" maxH="400px" overflowY="auto">
                      {menuOptions.map((option, index) => (
                        <Card key={index} variant="outline" p={4}>
                          <HStack justify="space-between" align="start">
                            <VStack align="start" spacing={2} flex={1}>
                              <HStack>
                                <Badge colorScheme="brand">{option.keyword}</Badge>
                                {option.requiresHuman && (
                                  <Badge colorScheme="orange">Atendimento Humano</Badge>
                                )}
                              </HStack>
                              <Text fontWeight="medium">{option.description}</Text>
                              <Text fontSize="sm" color="gray.600">
                                {option.response}
                              </Text>
                            </VStack>
                            <Button
                              colorScheme="red"
                              size="sm"
                              onClick={() => handleRemoveMenuOption(index)}
                              leftIcon={<DeleteIcon />}
                            >
                              Remover
                            </Button>
                          </HStack>
                        </Card>
                      ))}
                    </VStack>
                  )}

                  <HStack>
                    <Button 
                      colorScheme="brand" 
                      onClick={onOpen}
                      leftIcon={<AddIcon />}
                    >
                      Adicionar Opção
                    </Button>
                    {menuOptions.length > 0 && (
                      <Button 
                        colorScheme="green" 
                        onClick={handleSaveMenu}
                      >
                        Salvar Menu
                      </Button>
                    )}
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {/* Statistics */}
        <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={6}>
          <Card bg={cardBg} boxShadow="md">
            <CardBody>
              <Stat>
                <StatLabel>Conversas Hoje</StatLabel>
                <StatNumber>0</StatNumber>
                <StatHelpText>↗︎ 0% desde ontem</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          
          <Card bg={cardBg} boxShadow="md">
            <CardBody>
              <Stat>
                <StatLabel>Clientes Atendidos</StatLabel>
                <StatNumber>0</StatNumber>
                <StatHelpText>Total de clientes</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          
          <Card bg={cardBg} boxShadow="md">
            <CardBody>
              <Stat>
                <StatLabel>Mensagens Hoje</StatLabel>
                <StatNumber>0</StatNumber>
                <StatHelpText>↘︎ 0% desde ontem</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          
          <Card bg={cardBg} boxShadow="md">
            <CardBody>
              <Stat>
                <StatLabel>Taxa de Resposta</StatLabel>
                <StatNumber>0%</StatNumber>
                <StatHelpText>Eficiência do bot</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </Grid>
      </Container>

      {/* Modal para adicionar opção de menu */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Adicionar Opção de Menu</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Palavra-chave</FormLabel>
                <Input 
                  value={newMenuOption.keyword}
                  onChange={(e) => setNewMenuOption({...newMenuOption, keyword: e.target.value})}
                  placeholder="Ex: produtos, horario, atendimento"
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Descrição</FormLabel>
                <Input 
                  value={newMenuOption.description}
                  onChange={(e) => setNewMenuOption({...newMenuOption, description: e.target.value})}
                  placeholder="Ex: Ver nossos produtos, Horário de funcionamento"
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Resposta</FormLabel>
                <Textarea 
                  value={newMenuOption.response}
                  onChange={(e) => setNewMenuOption({...newMenuOption, response: e.target.value})}
                  placeholder="Digite a resposta que o bot enviará quando esta opção for selecionada"
                  rows={4}
                />
              </FormControl>
              
              <FormControl>
                <Checkbox 
                  isChecked={newMenuOption.requiresHuman}
                  onChange={(e) => setNewMenuOption({...newMenuOption, requiresHuman: e.target.checked})}
                >
                  Encaminhar para atendente humano
                </Checkbox>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" mr={3} onClick={onClose}>
              Cancelar
            </Button>
            <Button colorScheme="brand" onClick={handleAddMenuOption}>
              Adicionar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Dashboard;