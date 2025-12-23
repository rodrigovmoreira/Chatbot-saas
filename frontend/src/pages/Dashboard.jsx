import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box, Container, Grid, GridItem, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack, Stack,
  useToast, Badge, Icon, useColorModeValue, FormControl, FormLabel, Input, Textarea, Checkbox,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, Alert, AlertIcon, Spinner, Select, Tabs, TabList, TabPanels, Tab, TabPanel, Divider, IconButton
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningTwoIcon, AddIcon, EditIcon, DeleteIcon, StarIcon, TimeIcon, DownloadIcon, ChatIcon } from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { businessAPI } from '../services/api';
import { authAPI } from '../services/api';
import ScheduleTab from '../components/ScheduleTab';

const Dashboard = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');

  // === ESTADOS DE CONTROLE DE MODAIS ===
  const { isOpen, onOpen, onClose } = useDisclosure(); // Modal Menu
  const { isOpen: isProductModalOpen, onOpen: onProductModalOpen, onClose: onProductModalClose } = useDisclosure(); // Modal Produto
  const { isOpen: isFollowUpModalOpen, onOpen: onFollowUpOpen, onClose: onFollowUpClose } = useDisclosure(); // Modal Follow-up
  const { isOpen: isSavePromptOpen, onOpen: onSavePromptOpen, onClose: onSavePromptClose } = useDisclosure(); // Modal Salvar Prompt

  // === ESTADOS DE DADOS ===
  const [editingHours, setEditingHours] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  // === ESTADOS PARA CUSTOM PROMPTS (MEUS MODELOS) ===
  const [customPrompts, setCustomPrompts] = useState([]);
  const [selectedCustomPrompt, setSelectedCustomPrompt] = useState('');
  const [newPromptName, setNewPromptName] = useState('');

  // Formulário Configs Gerais
  const [configForm, setConfigForm] = useState({
    businessName: '',
    operatingHours: { opening: '09:00', closing: '18:00' },
    awayMessage: ''
  });

  // Listas de Dados
  const [menuOptions, setMenuOptions] = useState([]);
  const [products, setProducts] = useState([]);
  const [followUpSteps, setFollowUpSteps] = useState([]); //Lista de Passos do Funil

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

  // 1. Adicione a busca inicial (pode colocar junto com o useEffect dos Presets ou separado)
  useEffect(() => {
    fetchCustomPrompts();
  }, []);

  const fetchCustomPrompts = async () => {
    try { const res = await businessAPI.getCustomPrompts(); setCustomPrompts(res.data); } catch (e) { }
  };

  // 2. Função para Carregar SEU Modelo (Preenche os inputs sem apagar)
  const handleLoadCustomPrompt = (promptId) => {
    const selected = customPrompts.find(p => p._id === promptId);
    if (selected) {
      setActivePrompts({
        chatSystem: selected.prompts.chatSystem,
        visionSystem: selected.prompts.visionSystem
      });
      setSelectedCustomPrompt(promptId);
      setSelectedPreset(''); // Limpa o seletor de Preset do sistema para não confundir
      toast({ title: 'Modelo carregado! Clique em "Salvar Alterações" para ativar.', status: 'info' });
    }
  };

  // 3. Funções para Criar e Deletar Modelos
  const handleOpenSavePromptModal = () => {
    setNewPromptName('');
    onSavePromptOpen();
  };

  const handleCreateCustomPrompt = async () => {
    if (!newPromptName) return;
    try {
      await businessAPI.saveCustomPrompt({
        name: newPromptName,
        prompts: activePrompts // Salva o que está escrito nos TextAreas agora
      });
      toast({ title: 'Modelo salvo na sua biblioteca!', status: 'success' });
      fetchCustomPrompts();
      onSavePromptClose();
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.response?.data?.message, status: 'error' });
    }
  };

  const handleDeleteCustomPrompt = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Apagar este modelo salvo?")) return;
    try {
      await businessAPI.deleteCustomPrompt(id);
      fetchCustomPrompts();
      if (selectedCustomPrompt === id) setSelectedCustomPrompt('');
      toast({ title: 'Modelo removido', status: 'success' });
    } catch (e) { }
  };

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

  const handleLogoutSystem = async () => {
    const confirm = window.confirm("Ao sair, o Robô do WhatsApp será desligado para economizar recursos. Deseja continuar?");

    if (confirm) {
      try {
        // 1. Avisa o backend para matar o processo do Chrome
        await authAPI.logout(); // Você precisará garantir que essa função existe no api.js (veja abaixo)

        toast({ title: 'Sessão encerrada', status: 'info' });
      } catch (error) {
        console.error("Erro ao notificar logout:", error);
        // Mesmo se der erro na API, forçamos o logout local
      } finally {
        // 2. Limpeza Local
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
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

  // --- FOLLOW-UPS ---
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

        {/* Header Responsivo */}
        <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'start', md: 'center' }} mb={6} bg="white" p={4} borderRadius="lg" boxShadow="sm" spacing={4} >
          <VStack align="start" spacing={0}>
            <Heading size="lg" color="brand.600">Painel de Controle</Heading>
            <Text color="gray.500" fontSize="sm">
              Gerenciando: <b>{configForm.businessName || 'Minha Empresa'}</b>
            </Text>
          </VStack>
          <Button colorScheme="red" variant="ghost" size="sm" onClick={handleLogoutSystem} width={{ base: '100%', md: 'auto' }} >Sair do Sistema </Button>
        </Stack>

        <Tabs variant="soft-rounded" colorScheme="brand" isLazy>
          <TabList mb={4} bg="white" p={2} borderRadius="lg" boxShadow="sm" overflowX="auto"
            css={{
              '&::-webkit-scrollbar': { height: '4px' },
              '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '24px' },
            }}
            whiteSpace="nowrap"
          >
            <Tab fontWeight="bold">🤖 Conexão & Geral</Tab>
            <Tab fontWeight="bold">🧠 Inteligência & Nicho</Tab>
            <Tab fontWeight="bold">💬 Respostas Rápidas</Tab>
            <Tab fontWeight="bold">📦 Catálogo</Tab>
            <Tab fontWeight="bold" color="purple.600">
              <Icon as={ChatIcon} mr={2} /> Live Chat
            </Tab>
            <Tab fontWeight="bold" color="blue.600">
              <Icon as={TimeIcon} mr={2} /> Agendamentos
            </Tab>
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

            {/* ABA 2: INTELIGÊNCIA & NICHO */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">

                {/* 1. SELEÇÃO DE PRESET DO SISTEMA */}
                <Card bg="white" boxShadow="sm" borderLeft="4px solid" borderColor="blue.500">
                  <CardBody>
                    <Grid templateColumns={{ base: '1fr', md: '2fr 1fr' }} gap={4} alignItems="center">
                      <Box>
                        <Heading size="sm" mb={1}>Modelos Padrão (Sistema)</Heading>
                        <Text fontSize="sm" color="gray.600">Use um modelo pronto da plataforma.</Text>
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

                {/* 2. MEUS MODELOS SALVOS (O Retângulo Laranja) */}
                <Card bg="orange.50" boxShadow="sm" borderLeft="4px solid" borderColor="orange.400">
                  <CardBody>
                    <Grid templateColumns={{ base: '1fr', md: '2fr 1fr' }} gap={4} alignItems="center">
                      <Box>
                        <Heading size="sm" mb={1} color="orange.800">Meus Modelos Pessoais</Heading>
                        <Text fontSize="sm" color="orange.700">Carregue suas edições salvas anteriormente.</Text>
                      </Box>
                      <HStack>
                        <Select
                          placeholder="Carregar meus prompts..."
                          bg="white"
                          onChange={(e) => handleLoadCustomPrompt(e.target.value)}
                          value={selectedCustomPrompt}
                        >
                          {customPrompts.map(p => (
                            <option key={p._id} value={p._id}>📄 {p.name}</option>
                          ))}
                        </Select>
                        {selectedCustomPrompt && (
                          <IconButton
                            icon={<DeleteIcon />}
                            colorScheme="red"
                            variant="ghost"
                            onClick={(e) => handleDeleteCustomPrompt(selectedCustomPrompt, e)}
                            aria-label="Deletar"
                          />
                        )}
                      </HStack>
                    </Grid>
                  </CardBody>
                </Card>

                <Divider />

                {/* 3. EDITORES DE TEXTO (CHAT E VISÃO) */}
                <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
                  <Card bg="white" boxShadow="sm">
                    <CardHeader pb={0}><Heading size="sm">🧠 Personalidade (Chat)</Heading></CardHeader>
                    <CardBody>
                      <Textarea
                        value={activePrompts.chatSystem}
                        onChange={(e) => setActivePrompts({ ...activePrompts, chatSystem: e.target.value })}
                        rows={10}
                        bg="gray.50"
                        fontSize="sm"
                        placeholder="Instruções para o chat..."
                      />
                    </CardBody>
                  </Card>
                  <Card bg="white" boxShadow="sm">
                    <CardHeader pb={0}><Heading size="sm">👁️ Visão (Imagem)</Heading></CardHeader>
                    <CardBody>
                      <Textarea
                        value={activePrompts.visionSystem}
                        onChange={(e) => setActivePrompts({ ...activePrompts, visionSystem: e.target.value })}
                        rows={10}
                        bg="gray.50"
                        fontSize="sm"
                        placeholder="Instruções para análise de imagem..."
                      />
                    </CardBody>
                  </Card>
                </Grid>

                {/* BOTÕES DE AÇÃO DOS PROMPTS - CORRIGIDO PARA MOBILE */}
                <Stack direction={{ base: 'column', md: 'row' }} spacing={4} width="100%">
                  <Button
                    colorScheme="green"
                    size="lg"
                    onClick={handleSavePrompts}
                    flex="2"
                    boxShadow="md"
                    width="100%"
                    whiteSpace="normal"
                    height="auto"
                    py={4}
                  >
                    Salvar Alterações nos Prompts (Ativar)
                  </Button>

                  <Button
                    colorScheme="orange"
                    variant="outline"
                    size="lg"
                    onClick={handleOpenSavePromptModal}
                    flex="1"
                    leftIcon={<DownloadIcon />}
                    width="100%"
                    whiteSpace="normal"
                    height="auto"
                    py={4}
                  >
                    Salvar como Meu Modelo
                  </Button>
                </Stack>

                <Divider />

                {/* 4. FUNIL DE VENDAS (A PARTE QUE TINHA SUMIDO!) */}
                <Box>
                  <HStack justify="space-between" mb={4}>
                    <Box>
                      <Heading size="md">Funil de Vendas (Follow-up)</Heading>
                      <Text fontSize="sm" color="gray.500">Mensagens automáticas para recuperar clientes que pararam de responder.</Text>
                    </Box>
                    <Button leftIcon={<AddIcon />} colorScheme="purple" onClick={() => { setEditingFollowUpIndex(null); setNewFollowUp({ delayMinutes: 60, message: '' }); onFollowUpOpen(); }}>
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

            {/* ABA 5: LIVE CHAT (PLACEHOLDER) */}
            <TabPanel px={0}>
              <Card h="75vh" overflow="hidden" border="1px solid" borderColor="gray.200">
                <HStack h="100%" spacing={0} align="stretch">

                  {/* LADO ESQUERDO: LISTA DE CONTATOS (MOCKUP) */}
                  <Box w={{ base: "80px", md: "300px" }} borderRight="1px solid" borderColor="gray.200" bg="gray.50">
                    <Box p={4} borderBottom="1px solid" borderColor="gray.200" bg="white">
                      <Heading size="sm" color="gray.600">Conversas</Heading>
                    </Box>
                    <VStack spacing={0} align="stretch" overflowY="auto">
                      {/* Item Fake 1 */}
                      <Box p={4} bg="white" borderBottom="1px solid" borderColor="gray.100" cursor="pointer" borderLeft="4px solid" borderLeftColor="green.400">
                        <Text fontWeight="bold" fontSize="sm" noOfLines={1}>João Silva</Text>
                        <Text fontSize="xs" color="gray.500" noOfLines={1}>Olá, qual o preço do corte?</Text>
                        <Badge colorScheme="green" fontSize="0.6em" mt={1}>Online</Badge>
                      </Box>
                      {/* Item Fake 2 */}
                      <Box p={4} _hover={{ bg: "gray.100" }} cursor="pointer" borderBottom="1px solid" borderColor="gray.100">
                        <Text fontWeight="bold" fontSize="sm" noOfLines={1}>Maria Souza</Text>
                        <Text fontSize="xs" color="gray.500" noOfLines={1}>Obrigado pelo atendimento!</Text>
                      </Box>
                      {/* Item Fake 3 */}
                      <Box p={4} _hover={{ bg: "gray.100" }} cursor="pointer" borderBottom="1px solid" borderColor="gray.100">
                        <Text fontWeight="bold" fontSize="sm" noOfLines={1}>Pedro Henrique</Text>
                        <Text fontSize="xs" color="gray.500" noOfLines={1}>Agendado para amanhã?</Text>
                      </Box>
                    </VStack>
                  </Box>

                  {/* LADO DIREITO: CHAT (MOCKUP) */}
                  <Box flex="1" bg="gray.100" position="relative" display="flex" flexDirection="column">

                    {/* Header do Chat */}
                    <HStack p={4} bg="white" borderBottom="1px solid" borderColor="gray.200" justify="space-between">
                      <HStack>
                        <Box bg="gray.300" borderRadius="full" w="40px" h="40px" />
                        <Box>
                          <Text fontWeight="bold">João Silva</Text>
                          <Text fontSize="xs" color="green.500">● Respondendo agora</Text>
                        </Box>
                      </HStack>
                      <Button size="sm" colorScheme="orange" variant="outline">Pausar Robô</Button>
                    </HStack>

                    {/* Área de Mensagens (Vazia/Ilustrativa) */}
                    <Box flex="1" p={6} overflowY="auto">
                      <VStack spacing={4}>
                        <Alert status="info" borderRadius="md">
                          <Icon as={WarningTwoIcon} mr={2} />
                          Módulo de Chat ao Vivo em desenvolvimento.
                        </Alert>
                        <Text color="gray.400" fontSize="sm" mt={10}>
                          Selecione uma conversa para visualizar o histórico aqui.
                        </Text>
                      </VStack>
                    </Box>

                    {/* Input de Envio */}
                    <Box p={4} bg="white" borderTop="1px solid" borderColor="gray.200">
                      <HStack>
                        <Input placeholder="Digite sua mensagem..." isDisabled />
                        <IconButton aria-label="Enviar" icon={<ChatIcon />} colorScheme="blue" isDisabled />
                      </HStack>
                    </Box>
                  </Box>

                </HStack>
              </Card>
            </TabPanel>

            {/* ABA DE AGENDAMENTOS */}
            <TabPanel px={0}>
              <ScheduleTab />
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
                  <Input type="number" value={newFollowUp.delayMinutes} onChange={e => setNewFollowUp({ ...newFollowUp, delayMinutes: parseInt(e.target.value) })} />
                  <Text fontSize="sm" color="gray.500">minutos</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400">Ex: 60 = 1 hora; 1440 = 24 horas.</Text>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Mensagem de Cobrança</FormLabel>
                <Textarea placeholder="Ex: E aí, ainda tem interesse?" value={newFollowUp.message} onChange={e => setNewFollowUp({ ...newFollowUp, message: e.target.value })} rows={4} />
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

      {/* Modal Salvar Custom Prompt (NOVO) */}
      <Modal isOpen={isSavePromptOpen} onClose={onSavePromptClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Salvar como Meu Modelo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text fontSize="sm" color="gray.600">Dê um nome para salvar a configuração atual de prompts na sua biblioteca pessoal.</Text>
              <FormControl isRequired>
                <FormLabel>Nome do Modelo</FormLabel>
                <Input placeholder="Ex: Tatuador Agressivo v2" value={newPromptName} onChange={e => setNewPromptName(e.target.value)} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onSavePromptClose}>Cancelar</Button>
            <Button colorScheme="orange" onClick={handleCreateCustomPrompt}>Salvar na Biblioteca</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default Dashboard;