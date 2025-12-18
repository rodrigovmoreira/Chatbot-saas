import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box, Container, Grid, GridItem, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack,
  useToast, Badge, Icon, useColorModeValue, FormControl, FormLabel, Input, Textarea, Checkbox,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, Alert, AlertIcon, Spinner, Select, Tabs, TabList, TabPanels, Tab, TabPanel, Divider
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningTwoIcon, AddIcon, EditIcon, DeleteIcon, StarIcon, TimeIcon } from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { businessAPI } from '../services/api';

const Dashboard = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  
  // === ESTADOS DE CONTROLE DE MODAIS ===
  const { isOpen, onOpen, onClose } = useDisclosure(); // Modal Menu
  const { isOpen: isProductModalOpen, onOpen: onProductModalOpen, onClose: onProductModalClose } = useDisclosure(); // Modal Produto
  const { isOpen: isFollowUpModalOpen, onOpen: onFollowUpOpen, onClose: onFollowUpClose } = useDisclosure(); // Modal Follow-up (NOVO)

  // === ESTADOS DE DADOS ===
  const [editingHours, setEditingHours] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  // Formulário Configs Gerais
  const [configForm, setConfigForm] = useState({
    businessName: '',
    operatingHours: { opening: '09:00', closing: '18:00' },
    awayMessage: ''
  });

  // Listas de Dados
  const [menuOptions, setMenuOptions] = useState([]);
  const [products, setProducts] = useState([]);
  const [followUpSteps, setFollowUpSteps] = useState([]); // <--- NOVO: Lista de Passos do Funil

  // --- ESTADOS DE EDIÇÃO (INPUTS CONTROLADOS) ---
  
  // 1. Prompts (Agora Editáveis)
  const [activePrompts, setActivePrompts] = useState({
    chatSystem: '',
    visionSystem: ''
  });

  // 2. Menu (Respostas Rápidas)
  const [newMenuOption, setNewMenuOption] = useState({ keyword: '', description: '', response: '', requiresHuman: false, useAI: false });
  const [editingMenuIndex, setEditingMenuIndex] = useState(null);

  // 3. Produtos
  const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '' });
  const [editingProductIndex, setEditingProductIndex] = useState(null);

  // 4. Follow-up (NOVO)
  const [newFollowUp, setNewFollowUp] = useState({ delayMinutes: 60, message: '' });
  const [editingFollowUpIndex, setEditingFollowUpIndex] = useState(null);

  // =========================================================
  // 🔄 CARREGAMENTO INICIAL
  // =========================================================
  
  // 1. Sincroniza Estado Local com Contexto Global
  useEffect(() => {
    if (state.businessConfig) {
      // Config Gerais
      setConfigForm({
        businessName: state.businessConfig.businessName || '',
        operatingHours: state.businessConfig.operatingHours || { opening: '09:00', closing: '18:00' },
        awayMessage: state.businessConfig.awayMessage || ''
      });
      // Listas
      setMenuOptions(state.businessConfig.menuOptions || []);
      setProducts(state.businessConfig.products || []);
      setFollowUpSteps(state.businessConfig.followUpSteps || []); // Carrega funil
      
      // Prompts (Se existirem)
      if (state.businessConfig.prompts) {
        setActivePrompts({
          chatSystem: state.businessConfig.prompts.chatSystem || '',
          visionSystem: state.businessConfig.prompts.visionSystem || ''
        });
      }
    }
  }, [state.businessConfig]);

  // 2. Busca Presets (Nichos)
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const res = await businessAPI.getPresets();
        setPresets(res.data);
      } catch (error) {
        console.error("Erro presets:", error);
      }
    };
    fetchPresets();
  }, []);

  // =========================================================
  // 🔌 AÇÕES DE CONEXÃO (WHATSAPP)
  // =========================================================
  const handleStartWhatsApp = async () => {
    try {
      toast({ title: 'Iniciando servidor...', status: 'info', duration: 2000 });
      await businessAPI.startWhatsApp();
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

  // =========================================================
  // 💾 AÇÕES DE SALVAMENTO (API)
  // =========================================================

  // Salva Configs Gerais (Nome, Horário)
  const handleSaveConfig = async () => {
    try {
      const payload = { ...state.businessConfig, ...configForm };
      const response = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      setEditingHours(false);
      toast({ title: 'Configurações salvas!', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao salvar', status: 'error' });
    }
  };

  // Aplica Preset (Nicho)
  const handleApplyPreset = async () => {
    if (!selectedPreset) return;
    if (!window.confirm("ATENÇÃO: Isso substituirá seus PROMPTS e seu FUNIL DE VENDAS pelo modelo padrão. Continuar?")) return;

    try {
      const response = await businessAPI.applyPreset(selectedPreset);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data.config });
      
      // Atualiza visualmente os inputs de prompt e funil imediatamente
      setActivePrompts({
        chatSystem: response.data.config.prompts.chatSystem,
        visionSystem: response.data.config.prompts.visionSystem
      });
      setFollowUpSteps(response.data.config.followUpSteps || []);

      toast({ title: 'Personalidade aplicada!', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao aplicar modelo', status: 'error' });
    }
  };

  // Salva Prompts (Edição Manual)
  const handleSavePrompts = async () => {
    try {
      const payload = { 
        ...state.businessConfig, 
        prompts: activePrompts // Manda o que está no input
      };
      const response = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      toast({ title: 'Cérebro da IA atualizado!', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao salvar prompts', status: 'error' });
    }
  };

  // Salva Menu
  const handleSaveMenu = async () => {
    try {
      const payload = { ...state.businessConfig, menuOptions };
      const res = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: res.data });
      toast({ title: 'Menu salvo!', status: 'success' });
    } catch (e) { toast({ title: 'Erro ao salvar menu', status: 'error' }); }
  };

  // Salva Produtos
  const handleSaveProducts = async () => {
    try {
      const payload = { ...state.businessConfig, products };
      const res = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: res.data });
      toast({ title: 'Catálogo salvo!', status: 'success' });
    } catch (e) { toast({ title: 'Erro ao salvar produtos', status: 'error' }); }
  };

  // Salva Follow-ups (Funil) - NOVO
  const handleSaveFollowUps = async () => {
    try {
      // Garante que os stages estão numerados corretamente (1, 2, 3...)
      const orderedSteps = followUpSteps.map((step, index) => ({
        ...step,
        stage: index + 1
      }));
      
      const payload = { ...state.businessConfig, followUpSteps: orderedSteps };
      const res = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: res.data });
      setFollowUpSteps(orderedSteps); // Atualiza local com a ordem certa
      toast({ title: 'Funil de Vendas salvo!', status: 'success' });
    } catch (e) { toast({ title: 'Erro ao salvar funil', status: 'error' }); }
  };

  // =========================================================
  // ✏️ HANDLERS DE EDIÇÃO LOCAL (CRUDs)
  // =========================================================

  // --- MENU ---
  const handleEditMenuOption = (idx) => {
    setEditingMenuIndex(idx);
    setNewMenuOption(menuOptions[idx]);
    onOpen();
  };
  const handleSaveMenuOption = () => {
    if (!newMenuOption.keyword || !newMenuOption.response) {
      toast({ title: 'Preencha os campos obrigatórios', status: 'warning' });
      return;
    }
    const updated = [...menuOptions];
    if (editingMenuIndex !== null) updated[editingMenuIndex] = newMenuOption;
    else updated.push(newMenuOption);
    
    setMenuOptions(updated);
    setEditingMenuIndex(null);
    setNewMenuOption({ keyword: '', description: '', response: '', requiresHuman: false, useAI: false });
    onClose();
  };
  const handleRemoveMenuOption = (idx) => setMenuOptions(menuOptions.filter((_, i) => i !== idx));

  // --- PRODUTOS ---
  const handleAddProduct = () => {
    const updated = [...products];
    if (editingProductIndex !== null) updated[editingProductIndex] = newProduct;
    else updated.push(newProduct);

    setProducts(updated);
    setNewProduct({ name: '', price: '', description: '' });
    setEditingProductIndex(null);
    onProductModalClose();
  };
  const handleRemoveProduct = (idx) => setProducts(products.filter((_, i) => i !== idx));

  // --- FOLLOW-UPS (NOVO) ---
  const handleEditFollowUp = (idx) => {
    setEditingFollowUpIndex(idx);
    setNewFollowUp(followUpSteps[idx]);
    onFollowUpOpen();
  };
  const handleSaveFollowUpStep = () => {
    if (!newFollowUp.message || !newFollowUp.delayMinutes) {
      toast({ title: 'Preencha tempo e mensagem', status: 'warning' });
      return;
    }
    const updated = [...followUpSteps];
    if (editingFollowUpIndex !== null) updated[editingFollowUpIndex] = newFollowUp;
    else updated.push(newFollowUp); // Adiciona no final

    setFollowUpSteps(updated);
    setEditingFollowUpIndex(null);
    setNewFollowUp({ delayMinutes: 60, message: '' });
    onFollowUpClose();
  };
  const handleRemoveFollowUp = (idx) => setFollowUpSteps(followUpSteps.filter((_, i) => i !== idx));


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
            <Tab fontWeight="bold">🤖 Conexão & Geral</Tab>
            <Tab fontWeight="bold">🧠 Inteligência & Nicho</Tab>
            <Tab fontWeight="bold">💬 Respostas Rápidas</Tab>
            <Tab fontWeight="bold">📦 Catálogo</Tab>
          </TabList>

          <TabPanels>

            {/* ABA 1: VISÃO GERAL */}
            <TabPanel px={0}>
              <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
                {/* Card WhatsApp */}
                <GridItem>
                  <Card bg={cardBg} h="100%" boxShadow="md" borderTop="4px solid" borderColor={state.whatsappStatus.isConnected ? "green.400" : "red.400"}>
                    <CardHeader><Heading size="md">Status do WhatsApp</Heading></CardHeader>
                    <CardBody display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                      {state.whatsappStatus.isConnected ? (
                        <VStack spacing={4}>
                          <Icon as={CheckCircleIcon} color="green.500" boxSize={16} />
                          <Box textAlign="center">
                            <Text fontWeight="bold" fontSize="lg" color="green.600">Sistema Online</Text>
                            <Text fontSize="sm" color="gray.500">O robô está respondendo seus clientes.</Text>
                          </Box>
                          <Button colorScheme="red" variant="outline" onClick={handleLogoutWhatsApp}>Desconectar Sessão</Button>
                        </VStack>
                      ) : (
                        <VStack spacing={4} w="100%">
                          {state.whatsappStatus.qrCode ? (
                            <Box p={3} border="2px dashed" borderColor="brand.200" borderRadius="md"><QRCodeSVG value={state.whatsappStatus.qrCode} size={180} /></Box>
                          ) : state.whatsappStatus.mode === 'Iniciando...' ? (
                            <VStack py={6}><Spinner size="xl" color="brand.500" thickness="4px" /><Text color="gray.500">Iniciando motor...</Text></VStack>
                          ) : (
                            <VStack py={4}>
                              <Icon as={WarningTwoIcon} color="orange.400" boxSize={12} />
                              <Text fontWeight="bold" color="gray.600">Sessão Desligada</Text>
                              <Button size="lg" colorScheme="green" onClick={handleStartWhatsApp} width="full">Ligar Robô</Button>
                            </VStack>
                          )}
                        </VStack>
                      )}
                    </CardBody>
                  </Card>
                </GridItem>
                {/* Card Configs */}
                <GridItem>
                  <Card bg={cardBg} h="100%" boxShadow="md">
                    <CardHeader>
                      <HStack justify="space-between"><Heading size="md">Dados da Empresa</Heading><Button size="xs" onClick={() => setEditingHours(!editingHours)} leftIcon={<EditIcon />}>{editingHours ? 'Cancelar' : 'Editar'}</Button></HStack>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={4} align="stretch">
                        <FormControl>
                          <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">NOME FANTASIA</FormLabel>
                          <Input isDisabled={!editingHours} value={configForm.businessName} onChange={e => setConfigForm({ ...configForm, businessName: e.target.value })} />
                        </FormControl>
                        <HStack>
                          <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">ABERTURA</FormLabel><Input type="time" isDisabled={!editingHours} value={configForm.operatingHours.opening} onChange={e => setConfigForm({ ...configForm, operatingHours: { ...configForm.operatingHours, opening: e.target.value } })} /></FormControl>
                          <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">FECHAMENTO</FormLabel><Input type="time" isDisabled={!editingHours} value={configForm.operatingHours.closing} onChange={e => setConfigForm({ ...configForm, operatingHours: { ...configForm.operatingHours, closing: e.target.value } })} /></FormControl>
                        </HStack>
                        <FormControl>
                          <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">MENSAGEM DE AUSÊNCIA</FormLabel>
                          <Textarea isDisabled={!editingHours} value={configForm.awayMessage} onChange={e => setConfigForm({ ...configForm, awayMessage: e.target.value })} rows={3} />
                        </FormControl>
                        {editingHours && <Button colorScheme="brand" onClick={handleSaveConfig} width="full">Salvar Alterações</Button>}
                      </VStack>
                    </CardBody>
                  </Card>
                </GridItem>
              </Grid>
            </TabPanel>

            {/* ABA 2: INTELIGÊNCIA & NICHO (ATUALIZADA) */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                
                {/* 1. SELEÇÃO DE NICHO */}
                <Card bg="white" boxShadow="md" borderLeft="4px solid" borderColor="blue.500">
                  <CardBody>
                    <Grid templateColumns={{ base: '1fr', md: '2fr 1fr' }} gap={4} alignItems="center">
                      <Box>
                        <Heading size="sm" mb={1}>Modelo de Negócio (Preset)</Heading>
                        <Text fontSize="sm" color="gray.600">Escolha um nicho para carregar Prompts e Funil de Vendas pré-configurados.</Text>
                      </Box>
                      <HStack>
                        <Select placeholder="Selecione..." bg="gray.50" onChange={(e) => setSelectedPreset(e.target.value)} value={selectedPreset}>
                          {presets.map(p => (<option key={p.key} value={p.key}>{p.icon} {p.name}</option>))}
                        </Select>
                        <Button colorScheme="blue" onClick={handleApplyPreset} isDisabled={!selectedPreset} leftIcon={<StarIcon />}>Aplicar</Button>
                      </HStack>
                    </Grid>
                  </CardBody>
                </Card>

                <Divider />

                {/* 2. CÉREBRO DA IA (EDITÁVEL) */}
                <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
                  <Card bg="white" boxShadow="sm">
                    <CardHeader pb={0}><Heading size="sm">🧠 Personalidade do Chat (System)</Heading></CardHeader>
                    <CardBody>
                      <Textarea 
                        value={activePrompts.chatSystem}
                        onChange={(e) => setActivePrompts({...activePrompts, chatSystem: e.target.value})}
                        placeholder="Ex: Você é um assistente..."
                        rows={10} bg="gray.50" fontSize="sm"
                      />
                    </CardBody>
                  </Card>
                  <Card bg="white" boxShadow="sm">
                    <CardHeader pb={0}><Heading size="sm">👁️ Visão Computacional (Vision)</Heading></CardHeader>
                    <CardBody>
                      <Textarea 
                        value={activePrompts.visionSystem}
                        onChange={(e) => setActivePrompts({...activePrompts, visionSystem: e.target.value})}
                        placeholder="Ex: Descreva a imagem focando em..."
                        rows={10} bg="gray.50" fontSize="sm"
                      />
                    </CardBody>
                  </Card>
                </Grid>
                <Button colorScheme="green" size="lg" onClick={handleSavePrompts}>Salvar Alterações nos Prompts</Button>

                <Divider />

                {/* 3. FUNIL DE VENDAS (FOLLOW-UP) - NOVO! */}
                <Box>
                  <HStack justify="space-between" mb={4}>
                    <Box>
                      <Heading size="md">Funil de Vendas (Follow-up)</Heading>
                      <Text fontSize="sm" color="gray.500">Mensagens automáticas para recuperar clientes que pararam de responder.</Text>
                    </Box>
                    <Button leftIcon={<AddIcon />} colorScheme="purple" onClick={() => { setEditingFollowUpIndex(null); setNewFollowUp({delayMinutes: 60, message: ''}); onFollowUpOpen(); }}>
                      Novo Passo
                    </Button>
                  </HStack>

                  <VStack spacing={4} align="stretch">
                    {followUpSteps.map((step, idx) => (
                      <Card key={idx} variant="outline" borderColor="purple.200" bg="purple.50">
                        <CardBody>
                          <HStack justify="space-between" align="start">
                            <HStack align="start" spacing={4}>
                              <VStack 
                                bg="purple.500" color="white" borderRadius="full" boxSize="40px" 
                                justify="center" align="center" fontWeight="bold" flexShrink={0}
                              >
                                <Text>{idx + 1}</Text>
                              </VStack>
                              <Box>
                                <HStack mb={1}>
                                  <Icon as={TimeIcon} color="gray.500" />
                                  <Text fontWeight="bold" fontSize="sm">
                                    Após {step.delayMinutes >= 60 ? `${(step.delayMinutes / 60).toFixed(1)} horas` : `${step.delayMinutes} minutos`} de silêncio
                                  </Text>
                                </HStack>
                                <Text fontSize="md" color="gray.800">"{step.message}"</Text>
                              </Box>
                            </HStack>
                            <HStack>
                              <Button size="sm" variant="ghost" colorScheme="blue" onClick={() => handleEditFollowUp(idx)}><EditIcon /></Button>
                              <Button size="sm" variant="ghost" colorScheme="red" onClick={() => handleRemoveFollowUp(idx)}><DeleteIcon /></Button>
                            </HStack>
                          </HStack>
                        </CardBody>
                      </Card>
                    ))}
                    {followUpSteps.length === 0 && (
                      <Alert status="warning" borderRadius="md"><AlertIcon />Seu funil está vazio. O bot não cobrará clientes inativos.</Alert>
                    )}
                  </VStack>
                  
                  {followUpSteps.length > 0 && (
                    <Box mt={4} textAlign="right">
                      <Button colorScheme="purple" variant="outline" onClick={handleSaveFollowUps}>Salvar Funil de Vendas</Button>
                    </Box>
                  )}
                </Box>

              </VStack>
            </TabPanel>

            {/* ABA 3: RESPOSTAS RÁPIDAS */}
            <TabPanel px={0}>
              <Card bg="white" boxShadow="md">
                <CardHeader>
                  <HStack justify="space-between">
                    <Box><Heading size="md">Menu de Respostas</Heading><Text fontSize="sm" color="gray.500">Palavras-chave que o bot responde instantaneamente.</Text></Box>
                    <Button leftIcon={<AddIcon />} colorScheme="green" onClick={() => { setEditingMenuIndex(null); setNewMenuOption({ keyword: '', description: '', response: '', requiresHuman: false, useAI: false }); onOpen(); }}>Nova Regra</Button>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={4}>
                    {menuOptions.map((opt, idx) => (
                      <Card key={idx} variant="outline" size="sm">
                        <CardBody p={3}>
                          <HStack justify="space-between" mb={2}>
                            <Badge colorScheme="purple">{idx + 1}. {opt.keyword.split(',')[0]}</Badge>
                            <HStack spacing={1}>
                              <Icon as={EditIcon} color="blue.400" cursor="pointer" onClick={() => handleEditMenuOption(idx)} boxSize={4} />
                              <Icon as={DeleteIcon} color="red.300" cursor="pointer" onClick={() => handleRemoveMenuOption(idx)} boxSize={4} />
                            </HStack>
                          </HStack>
                          <Text fontWeight="bold" fontSize="xs" mb={1}>{opt.description}</Text>
                          <Text fontSize="xs" color="gray.500" noOfLines={2}>{opt.response}</Text>
                          <HStack mt={2}>
                            {opt.requiresHuman && <Badge colorScheme="orange" fontSize="0.6em">Humano</Badge>}
                            {opt.useAI && <Badge colorScheme="teal" fontSize="0.6em">IA Ativa</Badge>}
                          </HStack>
                        </CardBody>
                      </Card>
                    ))}
                  </Grid>
                  {menuOptions.length > 0 && <Box mt={6} pt={4} textAlign="right"><Button colorScheme="brand" onClick={handleSaveMenu}>Salvar Alterações do Menu</Button></Box>}
                </CardBody>
              </Card>
            </TabPanel>

            {/* ABA 4: CATÁLOGO */}
            <TabPanel px={0}>
              <Card bg="white" boxShadow="md">
                <CardHeader>
                  <HStack justify="space-between">
                    <Box><Heading size="md">Produtos & Serviços</Heading><Text fontSize="sm" color="gray.500">Para a IA consultar preços.</Text></Box>
                    <Button leftIcon={<AddIcon />} variant="outline" colorScheme="blue" onClick={() => { setEditingProductIndex(null); setNewProduct({ name: '', price: '', description: '' }); onProductModalOpen(); }}>Novo Item</Button>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    {products.map((prod, idx) => (
                      <HStack key={idx} p={4} borderWidth="1px" borderRadius="md" justify="space-between" bg="gray.50">
                        <VStack align="start" spacing={1}>
                          <HStack><Text fontWeight="bold">{prod.name}</Text><Badge colorScheme="green">R$ {prod.price}</Badge></HStack>
                          <Text fontSize="sm" color="gray.600">{prod.description}</Text>
                        </VStack>
                        <HStack>
                          <Button size="sm" variant="ghost" onClick={() => { setNewProduct(prod); setEditingProductIndex(idx); onProductModalOpen(); }}><EditIcon /></Button>
                          <Button size="sm" colorScheme="red" variant="ghost" onClick={() => handleRemoveProduct(idx)}><DeleteIcon /></Button>
                        </HStack>
                      </HStack>
                    ))}
                  </VStack>
                  {products.length > 0 && <Box mt={6} pt={4} textAlign="right"><Button colorScheme="brand" onClick={handleSaveProducts}>Salvar Catálogo</Button></Box>}
                </CardBody>
              </Card>
            </TabPanel>

          </TabPanels>
        </Tabs>
      </Container>

      {/* --- MODAIS --- */}

      {/* Modal Menu */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingMenuIndex !== null ? 'Editar Regra' : 'Nova Regra'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl><FormLabel fontSize="sm" fontWeight="bold">Descrição Interna</FormLabel><Input placeholder="Ex: Chave Pix" value={newMenuOption.description} onChange={e => setNewMenuOption({ ...newMenuOption, description: e.target.value })} /></FormControl>
              <FormControl isRequired><FormLabel fontSize="sm" fontWeight="bold">Palavras-Chave (separadas por vírgula)</FormLabel><Textarea placeholder="pix, pagamento, conta" value={newMenuOption.keyword} onChange={e => setNewMenuOption({ ...newMenuOption, keyword: e.target.value })} rows={2} /></FormControl>
              <FormControl isRequired><FormLabel fontSize="sm" fontWeight="bold">Resposta Oficial</FormLabel><Textarea placeholder="Chave: 123..." value={newMenuOption.response} onChange={e => setNewMenuOption({ ...newMenuOption, response: e.target.value })} rows={4} /></FormControl>
              <Box w="100%" bg="gray.50" p={3} borderRadius="md" border="1px dashed" borderColor="gray.200">
                <Text fontSize="xs" fontWeight="bold" mb={2}>COMPORTAMENTO</Text>
                <VStack align="start">
                  <Checkbox colorScheme="teal" isChecked={newMenuOption.useAI} onChange={e => setNewMenuOption({ ...newMenuOption, useAI: e.target.checked })}>Usar IA para humanizar ✨</Checkbox>
                  <Checkbox colorScheme="orange" isChecked={newMenuOption.requiresHuman} onChange={e => setNewMenuOption({ ...newMenuOption, requiresHuman: e.target.checked })}>Pausar Bot (Chamar Humano) 🛑</Checkbox>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button><Button colorScheme="brand" onClick={handleSaveMenuOption}>{editingMenuIndex !== null ? 'Salvar' : 'Adicionar'}</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Follow-up (NOVO) */}
      <Modal isOpen={isFollowUpModalOpen} onClose={onFollowUpClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingFollowUpIndex !== null ? 'Editar Passo do Funil' : 'Novo Passo do Funil'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Tempo de Espera (em Minutos)</FormLabel>
                <HStack>
                  <Input type="number" value={newFollowUp.delayMinutes} onChange={e => setNewFollowUp({...newFollowUp, delayMinutes: parseInt(e.target.value)})} />
                  <Text fontSize="sm" color="gray.500">minutos</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400">Ex: 60 = 1 hora; 1440 = 24 horas.</Text>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Mensagem de Cobrança</FormLabel>
                <Textarea placeholder="Ex: E aí, ainda tem interesse?" value={newFollowUp.message} onChange={e => setNewFollowUp({...newFollowUp, message: e.target.value})} rows={4} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onFollowUpClose}>Cancelar</Button>
            <Button colorScheme="purple" onClick={handleSaveFollowUpStep}>Salvar Passo</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Produto */}
      <Modal isOpen={isProductModalOpen} onClose={onProductModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingProductIndex !== null ? 'Editar' : 'Novo'} Produto</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired><FormLabel>Nome</FormLabel><Input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} /></FormControl>
              <FormControl isRequired><FormLabel>Preço</FormLabel><Input type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} /></FormControl>
              <FormControl><FormLabel>Detalhes</FormLabel><Textarea value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} /></FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={onProductModalClose}>Cancelar</Button><Button colorScheme="blue" onClick={handleAddProduct}>Salvar</Button></ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default Dashboard;