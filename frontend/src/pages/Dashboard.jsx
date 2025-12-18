import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box, Container, Grid, GridItem, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack,
  useToast, Badge, Icon, useColorModeValue, FormControl, FormLabel, Input, Textarea, Checkbox,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, Alert, AlertIcon, Spinner, Select, Tabs, TabList, TabPanels, Tab, TabPanel
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningTwoIcon, AddIcon, EditIcon, DeleteIcon, StarIcon } from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { businessAPI } from '../services/api';

const Dashboard = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');

  // Modais de Edição
  const { isOpen, onOpen, onClose } = useDisclosure(); // Modal Menu
  const { isOpen: isProductModalOpen, onOpen: onProductModalOpen, onClose: onProductModalClose } = useDisclosure({
    onClose: () => setEditingProductIndex(null)
  }); // Modal Produto

  // Estados de Interface
  const [editingHours, setEditingHours] = useState(false);

  // Estados de Presets (Inteligência)
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  // Formulário de Configurações Gerais
  const [configForm, setConfigForm] = useState({
    businessName: '',
    operatingHours: { opening: '09:00', closing: '18:00' },
    awayMessage: ''
  });

  // Listas de Dados
  const [menuOptions, setMenuOptions] = useState([]);
  const [products, setProducts] = useState([]);

  // Estados Temporários (Novos Itens)
  const [newMenuOption, setNewMenuOption] = useState({ keyword: '', description: '', response: '', requiresHuman: false });
  const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '' });
  const [editingProductIndex, setEditingProductIndex] = useState(null);

  // 1. Carregar Dados do Contexto Global
  useEffect(() => {
    if (state.businessConfig) {
      setConfigForm({
        businessName: state.businessConfig.businessName || '',
        operatingHours: state.businessConfig.operatingHours || { opening: '09:00', closing: '18:00' },
        awayMessage: state.businessConfig.awayMessage || ''
      });
      setMenuOptions(state.businessConfig.menuOptions || []);
      setProducts(state.businessConfig.products || []);
    }
  }, [state.businessConfig]);

  // 2. Carregar Lista de Nichos (Presets) do Backend
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        console.log("🔍 Buscando presets na API..."); // Log 1
        const res = await businessAPI.getPresets();
        console.log("📦 Presets recebidos:", res.data); // Log 2
        setPresets(res.data);
      } catch (error) {
        console.error("❌ Erro ao buscar presets:", error); // Log erro
      }
    };
    fetchPresets();
  }, []);

  // --- Ações de Conexão (WhatsApp) ---

  const handleStartWhatsApp = async () => {
    try {
      toast({ title: 'Iniciando servidor...', status: 'info', duration: 2000 });
      await businessAPI.startWhatsApp();
      // O socket cuidará de atualizar o status para "Iniciando..." -> "QR Code"
    } catch (error) {
      toast({ title: 'Erro ao iniciar', description: error.message, status: 'error' });
    }
  };

  const handleLogoutWhatsApp = async () => {
    if (!window.confirm("Tem certeza? O bot vai parar de responder.")) return;
    try {
      await businessAPI.logoutWhatsApp();
      toast({ title: 'Desconectado', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao desconectar', status: 'error' });
    }
  };

  const handleLogoutSystem = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  // --- Ações de Configuração ---

  const handleSaveConfig = async () => {
    try {
      const payload = { ...state.businessConfig, ...configForm };
      const response = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      setEditingHours(false);
      toast({ title: 'Configurações salvas!', status: 'success', duration: 3000 });
    } catch (error) {
      toast({ title: 'Erro ao salvar', status: 'error' });
    }
  };

  const handleApplyPreset = async () => {
    if (!selectedPreset) return;

    if (!window.confirm("ATENÇÃO: Isso mudará a personalidade, os prompts e o fluxo de mensagens do seu robô. Deseja continuar?")) {
      return;
    }

    try {
      const response = await businessAPI.applyPreset(selectedPreset);
      // Atualiza o contexto global com a nova config que veio do backend
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data.config });

      toast({
        title: 'Nova Personalidade Ativa!',
        description: 'Seu robô foi reconfigurado com sucesso.',
        status: 'success',
        duration: 5000,
        isClosable: true
      });
    } catch (error) {
      toast({ title: 'Erro ao aplicar modelo', description: error.message, status: 'error' });
    }
  };

  const handleSaveMenu = async () => {
    try {
      const payload = { ...state.businessConfig, menuOptions };
      const res = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: res.data });
      toast({ title: 'Menu salvo!', status: 'success' });
    } catch (e) { toast({ title: 'Erro ao salvar menu', status: 'error' }); }
  };

  const handleSaveProducts = async () => {
    try {
      const payload = { ...state.businessConfig, products };
      const res = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: res.data });
      toast({ title: 'Catálogo salvo!', status: 'success' });
    } catch (e) { toast({ title: 'Erro ao salvar produtos', status: 'error' }); }
  };

  // --- CRUD Auxiliares (Frontend) ---
  const handleAddMenuOption = () => {
    setMenuOptions([...menuOptions, newMenuOption]);
    setNewMenuOption({ keyword: '', description: '', response: '', requiresHuman: false });
    onClose();
  };
  const handleRemoveMenuOption = (idx) => setMenuOptions(menuOptions.filter((_, i) => i !== idx));

  const handleAddProduct = () => {
    if (editingProductIndex !== null) {
      const u = [...products]; u[editingProductIndex] = newProduct; setProducts(u); setEditingProductIndex(null);
    } else {
      setProducts([...products, newProduct]);
    }
    setNewProduct({ name: '', price: '', description: '' });
    onProductModalClose();
  };
  const handleRemoveProduct = (idx) => setProducts(products.filter((_, i) => i !== idx));


  return (
    <Box minH="100vh" bg="gray.50" p={4}>
      <Container maxW="1200px">

        {/* Header */}
        <HStack justify="space-between" mb={6} bg="white" p={4} borderRadius="lg" boxShadow="sm">
          <VStack align="start" spacing={0}>
            <Heading size="lg" color="brand.600">Painel de Controle</Heading>
            <Text color="gray.500" fontSize="sm">
              Gerenciando: <b>{configForm.businessName || 'Minha Empresa'}</b>
            </Text>
          </VStack>
          <Button colorScheme="red" variant="ghost" size="sm" onClick={handleLogoutSystem}>Sair do Sistema</Button>
        </HStack>

        <Tabs variant="soft-rounded" colorScheme="brand" isLazy>
          <TabList mb={4} bg="white" p={2} borderRadius="lg" boxShadow="sm" overflowX="auto">
            <Tab fontWeight="bold" _selected={{ color: 'white', bg: 'brand.500' }}>🤖 Conexão & Geral</Tab>
            <Tab fontWeight="bold" _selected={{ color: 'white', bg: 'brand.500' }}>🧠 Inteligência & Nicho</Tab>
            <Tab fontWeight="bold" _selected={{ color: 'white', bg: 'brand.500' }}>💬 Respostas Rápidas</Tab>
            <Tab fontWeight="bold" _selected={{ color: 'white', bg: 'brand.500' }}>📦 Catálogo</Tab>
          </TabList>

          <TabPanels>

            {/* ABA 1: VISÃO GERAL (STATUS + HORÁRIOS) */}
            <TabPanel px={0}>
              <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>

                {/* Card WhatsApp (Lógica Multi-tenant) */}
                <GridItem>
                  <Card bg={cardBg} h="100%" boxShadow="md" borderTop="4px solid" borderColor={state.whatsappStatus.isConnected ? "green.400" : "red.400"}>
                    <CardHeader><Heading size="md">Status do WhatsApp</Heading></CardHeader>
                    <CardBody display="flex" flexDirection="column" alignItems="center" justifyContent="center">

                      {state.whatsappStatus.isConnected ? (
                        // ESTADO: CONECTADO
                        <VStack spacing={4}>
                          <Icon as={CheckCircleIcon} color="green.500" boxSize={16} />
                          <Box textAlign="center">
                            <Text fontWeight="bold" fontSize="lg" color="green.600">Sistema Online</Text>
                            <Text fontSize="sm" color="gray.500">O robô está respondendo seus clientes.</Text>
                          </Box>
                          <Button colorScheme="red" variant="outline" onClick={handleLogoutWhatsApp}>
                            Desconectar Sessão
                          </Button>
                        </VStack>
                      ) : (
                        // ESTADO: DESCONECTADO OU INICIANDO
                        <VStack spacing={4} w="100%">
                          {state.whatsappStatus.qrCode ? (
                            // EXIBE QR CODE
                            <Box p={3} border="2px dashed" borderColor="brand.200" borderRadius="md">
                              <QRCodeSVG value={state.whatsappStatus.qrCode} size={180} />
                            </Box>
                          ) : state.whatsappStatus.mode === 'Iniciando...' ? (
                            // EXIBE SPINNER
                            <VStack py={6}>
                              <Spinner size="xl" color="brand.500" thickness="4px" />
                              <Text color="gray.500" fontWeight="bold">Iniciando motor...</Text>
                            </VStack>
                          ) : (
                            // EXIBE BOTÃO DE CONECTAR
                            <VStack py={4}>
                              <Icon as={WarningTwoIcon} color="orange.400" boxSize={12} />
                              <Text fontWeight="bold" color="gray.600">Sessão Desligada</Text>
                              <Text fontSize="sm" color="gray.400" textAlign="center" mb={2}>
                                Clique abaixo para ligar seu robô e gerar o QR Code.
                              </Text>
                              <Button size="lg" colorScheme="green" onClick={handleStartWhatsApp} width="full">
                                Ligar Robô
                              </Button>
                            </VStack>
                          )}

                          <Badge colorScheme={state.whatsappStatus.qrCode ? "blue" : "gray"}>
                            Status: {state.whatsappStatus.mode}
                          </Badge>
                        </VStack>
                      )}
                    </CardBody>
                  </Card>
                </GridItem>

                {/* Card Configurações Básicas */}
                <GridItem>
                  <Card bg={cardBg} h="100%" boxShadow="md">
                    <CardHeader>
                      <HStack justify="space-between">
                        <Heading size="md">Dados da Empresa</Heading>
                        <Button size="xs" onClick={() => setEditingHours(!editingHours)} leftIcon={<EditIcon />}>
                          {editingHours ? 'Cancelar' : 'Editar'}
                        </Button>
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={4} align="stretch">
                        <FormControl>
                          <FormLabel fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">Nome Fantasia</FormLabel>
                          <Input isDisabled={!editingHours} value={configForm.businessName} onChange={e => setConfigForm({ ...configForm, businessName: e.target.value })} />
                        </FormControl>

                        <HStack>
                          <FormControl>
                            <FormLabel fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">Abertura</FormLabel>
                            <Input type="time" isDisabled={!editingHours} value={configForm.operatingHours.opening} onChange={e => setConfigForm({ ...configForm, operatingHours: { ...configForm.operatingHours, opening: e.target.value } })} />
                          </FormControl>
                          <FormControl>
                            <FormLabel fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">Fechamento</FormLabel>
                            <Input type="time" isDisabled={!editingHours} value={configForm.operatingHours.closing} onChange={e => setConfigForm({ ...configForm, operatingHours: { ...configForm.operatingHours, closing: e.target.value } })} />
                          </FormControl>
                        </HStack>

                        <FormControl>
                          <FormLabel fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">Mensagem de Ausência</FormLabel>
                          <Textarea
                            isDisabled={!editingHours}
                            value={configForm.awayMessage}
                            onChange={e => setConfigForm({ ...configForm, awayMessage: e.target.value })}
                            placeholder="Ex: Estamos fechados. Atendemos das 09h às 18h."
                            rows={3}
                          />
                        </FormControl>

                        {editingHours && (
                          <Button colorScheme="brand" onClick={handleSaveConfig} width="full">
                            Salvar Alterações
                          </Button>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                </GridItem>
              </Grid>
            </TabPanel>

            {/* ABA 2: INTELIGÊNCIA (PRESETS) */}
            <TabPanel px={0}>
              <Grid templateColumns={{ base: '1fr', lg: '1fr 2fr' }} gap={6}>

                {/* Coluna Esquerda: Seletor */}
                <GridItem>
                  <Card bg="white" boxShadow="md" borderLeft="4px solid" borderColor="blue.500">
                    <CardHeader><Heading size="md">Identidade do Robô</Heading></CardHeader>
                    <CardBody>
                      <Text fontSize="sm" color="gray.600" mb={4}>
                        Escolha um modelo pronto para configurar instantaneamente a personalidade, visão computacional e regras de negócio do seu bot.
                      </Text>

                      <FormControl mb={4}>
                        <FormLabel>Ramo de Atuação</FormLabel>
                        <Select
                          placeholder="Selecione o nicho..."
                          size="lg"
                          bg="gray.50"
                          onChange={(e) => setSelectedPreset(e.target.value)}
                          value={selectedPreset}
                        >
                          {presets.map(p => (
                            <option key={p.key} value={p.key}>{p.icon} {p.name}</option>
                          ))}
                        </Select>
                      </FormControl>

                      <Button
                        colorScheme="blue"
                        width="full"
                        onClick={handleApplyPreset}
                        isDisabled={!selectedPreset}
                        leftIcon={<StarIcon />}
                      >
                        Aplicar Personalidade
                      </Button>
                    </CardBody>
                  </Card>
                </GridItem>

                {/* Coluna Direita: Visualização do Cérebro */}
                <GridItem>
                  <Card bg="gray.50" boxShadow="sm">
                    <CardHeader pb={0}><Heading size="sm" color="gray.600">Prompts Ativos (Cérebro da IA)</Heading></CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={4}>
                        <Box>
                          <Text fontSize="xs" fontWeight="bold" mb={1}>SYSTEM PROMPT (CHAT)</Text>
                          <Textarea
                            value={state.businessConfig?.prompts?.chatSystem || "..."}
                            isReadOnly
                            bg="white"
                            fontSize="xs"
                            fontFamily="monospace"
                            h="120px"
                          />
                        </Box>
                        <Box>
                          <Text fontSize="xs" fontWeight="bold" mb={1}>VISION PROMPT (IMAGEM)</Text>
                          <Textarea
                            value={state.businessConfig?.prompts?.visionSystem || "..."}
                            isReadOnly
                            bg="white"
                            fontSize="xs"
                            fontFamily="monospace"
                            h="80px"
                          />
                        </Box>
                        <Alert status="info" fontSize="xs" py={2}>
                          <AlertIcon boxSize={3} />
                          Esses textos são gerados automaticamente pelo Modelo escolhido.
                        </Alert>
                      </VStack>
                    </CardBody>
                  </Card>
                </GridItem>
              </Grid>
            </TabPanel>

            {/* ABA 3: RESPOSTAS RÁPIDAS (MENU) */}
            <TabPanel px={0}>
              <Card bg="white" boxShadow="md">
                <CardHeader>
                  <HStack justify="space-between">
                    <Box>
                      <Heading size="md">Menu de Respostas</Heading>
                      <Text fontSize="sm" color="gray.500">Palavras-chave que o bot responde instantaneamente.</Text>
                    </Box>
                    <Button leftIcon={<AddIcon />} colorScheme="green" onClick={onOpen}>Nova Regra</Button>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={4}>
                    {menuOptions.map((opt, idx) => (
                      <Card key={idx} variant="outline" borderColor="gray.200">
                        <CardBody p={3}>
                          <HStack justify="space-between" mb={2}>
                            <Badge colorScheme="purple" px={2} py={1} borderRadius="md">{opt.keyword}</Badge>
                            <Icon as={DeleteIcon} color="red.300" cursor="pointer" onClick={() => handleRemoveMenuOption(idx)} />
                          </HStack>
                          <Text fontSize="xs" color="gray.600" noOfLines={3}>{opt.response}</Text>
                          {opt.requiresHuman && <Badge mt={2} colorScheme="orange" fontSize="0.6em">Encaminha p/ Humano</Badge>}
                        </CardBody>
                      </Card>
                    ))}
                  </Grid>
                  {menuOptions.length === 0 && <Text color="gray.400" textAlign="center" py={8}>Nenhuma regra cadastrada.</Text>}

                  {menuOptions.length > 0 && (
                    <Box mt={6} pt={4} borderTop="1px solid #eee" textAlign="right">
                      <Button colorScheme="brand" onClick={handleSaveMenu}>Salvar Alterações do Menu</Button>
                    </Box>
                  )}
                </CardBody>
              </Card>
            </TabPanel>

            {/* ABA 4: CATÁLOGO */}
            <TabPanel px={0}>
              <Card bg="white" boxShadow="md">
                <CardHeader>
                  <HStack justify="space-between">
                    <Box>
                      <Heading size="md">Produtos & Serviços</Heading>
                      <Text fontSize="sm" color="gray.500">A IA usa essa lista para consultar preços.</Text>
                    </Box>
                    <Button leftIcon={<AddIcon />} variant="outline" colorScheme="blue" onClick={() => { setEditingProductIndex(null); setNewProduct({ name: '', price: '', description: '' }); onProductModalOpen(); }}>
                      Novo Item
                    </Button>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    {products.map((prod, idx) => (
                      <HStack key={idx} p={4} borderWidth="1px" borderRadius="md" justify="space-between" bg="gray.50" _hover={{ bg: 'white', borderColor: 'blue.200' }}>
                        <VStack align="start" spacing={1}>
                          <HStack>
                            <Text fontWeight="bold">{prod.name}</Text>
                            <Badge colorScheme="green" fontSize="md">R$ {prod.price}</Badge>
                          </HStack>
                          <Text fontSize="sm" color="gray.600">{prod.description}</Text>
                        </VStack>
                        <HStack>
                          <Button size="sm" variant="ghost" onClick={() => { setNewProduct(prod); setEditingProductIndex(idx); onProductModalOpen(); }}><EditIcon /></Button>
                          <Button size="sm" colorScheme="red" variant="ghost" onClick={() => handleRemoveProduct(idx)}><DeleteIcon /></Button>
                        </HStack>
                      </HStack>
                    ))}
                    {products.length === 0 && <Text color="gray.400" textAlign="center" py={8}>Catálogo vazio.</Text>}
                  </VStack>

                  {products.length > 0 && (
                    <Box mt={6} pt={4} borderTop="1px solid #eee" textAlign="right">
                      <Button colorScheme="brand" onClick={handleSaveProducts}>Salvar Catálogo</Button>
                    </Box>
                  )}
                </CardBody>
              </Card>
            </TabPanel>

          </TabPanels>
        </Tabs>
      </Container>

      {/* --- MODAIS DE CADASTRO --- */}

      {/* Modal Menu */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Adicionar Resposta Rápida</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Palavra-Chave</FormLabel>
                <Input placeholder="Ex: pix, endereco, horario" value={newMenuOption.keyword} onChange={e => setNewMenuOption({ ...newMenuOption, keyword: e.target.value })} />
                <Text fontSize="xs" color="gray.500">Quando o cliente digitar isso, o bot responde na hora.</Text>
              </FormControl>
              <FormControl>
                <FormLabel>Descrição (Interna)</FormLabel>
                <Input placeholder="Ex: Enviar chave pix" value={newMenuOption.description} onChange={e => setNewMenuOption({ ...newMenuOption, description: e.target.value })} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Resposta do Robô</FormLabel>
                <Textarea placeholder="Digite a resposta completa aqui..." rows={4} value={newMenuOption.response} onChange={e => setNewMenuOption({ ...newMenuOption, response: e.target.value })} />
              </FormControl>
              <Checkbox colorScheme="orange" isChecked={newMenuOption.requiresHuman} onChange={e => setNewMenuOption({ ...newMenuOption, requiresHuman: e.target.checked })}>
                Marcar atendimento como "Humano Necessário"
              </Checkbox>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
            <Button colorScheme="brand" onClick={handleAddMenuOption}>Adicionar Regra</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Produto */}
      <Modal isOpen={isProductModalOpen} onClose={onProductModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingProductIndex !== null ? 'Editar' : 'Novo'} Item do Catálogo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Nome do Produto/Serviço</FormLabel>
                <Input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Preço (R$)</FormLabel>
                <Input type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Detalhes (para a IA ler)</FormLabel>
                <Textarea placeholder="Ingredientes, tamanho, duração..." value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onProductModalClose}>Cancelar</Button>
            <Button colorScheme="blue" onClick={handleAddProduct}>Salvar Item</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Dashboard;