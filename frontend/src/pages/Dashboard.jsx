import React, { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box, Grid, GridItem, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack, Stack,
  useToast, Badge, Icon, useColorModeValue, FormControl, FormLabel, Input, Textarea, Checkbox,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, Alert, AlertIcon, Spinner, Select, Divider, IconButton, Tooltip,
  Flex, Drawer, DrawerOverlay, DrawerContent,
  Menu, MenuButton, MenuList, MenuItem, Avatar
} from '@chakra-ui/react';
import {
  CheckCircleIcon, WarningTwoIcon, AddIcon, EditIcon, DeleteIcon, StarIcon, TimeIcon,
  DownloadIcon, ChatIcon, HamburgerIcon, SettingsIcon, AttachmentIcon,
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon
} from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { businessAPI } from '../services/api';
import { authAPI } from '../services/api';
import ScheduleTab from '../components/ScheduleTab';
import ColorModeToggle from '../components/ColorModeToggle';

// --- COMPONENTES DE NAVEGAÇÃO ---

const LinkItems = [
  { name: 'Conexão & Geral', icon: SettingsIcon, index: 0 },
  { name: 'Inteligência & Nicho', icon: StarIcon, index: 1 },
  { name: 'Respostas Rápidas', icon: EditIcon, index: 2 },
  { name: 'Catálogo', icon: AttachmentIcon, index: 3 },
  { name: 'Live Chat', icon: ChatIcon, index: 4, color: 'purple.500' },
  { name: 'Agendamentos', icon: TimeIcon, index: 5, color: 'blue.500' },
];

const SidebarContent = ({ onClose, activeTab, setActiveTab, isCollapsed = false, toggleCollapse, ...rest }) => {
  const bg = useColorModeValue('white', 'gray.900');
  const borderRightColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Flex
      direction="column"
      transition="width 0.2s"
      bg={bg}
      borderRight="1px"
      borderRightColor={borderRightColor}
      w={{ base: 'full', lg: isCollapsed ? 20 : 60 }}
      pos="fixed"
      h="full"
      {...rest}
    >
      <Flex h="20" alignItems="center" mx={isCollapsed ? 0 : 8} justifyContent={isCollapsed ? 'center' : 'space-between'}>
        {!isCollapsed && (
          <Text fontSize="2xl" fontFamily="monospace" fontWeight="bold">
            Painel
          </Text>
        )}
        <Box display={{ base: 'flex', lg: 'none' }} onClick={onClose}>
          <Icon as={ChevronLeftIcon} />
        </Box>
      </Flex>
      <Box flex="1" overflowY="auto">
        {LinkItems.map((link) => (
          <NavItem
            key={link.name}
            icon={link.icon}
            isActive={activeTab === link.index}
            isCollapsed={isCollapsed}
            onClick={() => {
              setActiveTab(link.index);
              if (onClose) onClose();
            }}
            color={link.color}
          >
            {link.name}
          </NavItem>
        ))}
      </Box>

      {/* Sidebar Footer */}
      <Flex
        p="4"
        mt="auto"
        borderTopWidth="1px"
        borderColor={useColorModeValue('gray.200', 'gray.700')}
        justifyContent={isCollapsed ? 'center' : 'space-between'}
        alignItems="center"
        direction={isCollapsed ? 'column' : 'row'}
        gap={isCollapsed ? 2 : 0}
      >
        <ColorModeToggle />
        <IconButton
          display={{ base: 'none', lg: 'flex' }}
          icon={isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          onClick={toggleCollapse}
          variant="ghost"
          aria-label={isCollapsed ? "Expandir" : "Recolher"}
          size="sm"
        />
      </Flex>
    </Flex>
  );
};

const NavItem = ({ icon, children, isActive, color, isCollapsed, ...rest }) => {
  const hoverBg = useColorModeValue('brand.500', 'brand.200');
  const activeBg = useColorModeValue('brand.100', 'gray.700');
  const activeColor = useColorModeValue('brand.600', 'brand.200');

  return (
    <Flex
      align="center"
      p="4"
      mx={isCollapsed ? 2 : 4}
      borderRadius="lg"
      role="group"
      cursor="pointer"
      bg={isActive ? activeBg : 'transparent'}
      color={isActive ? activeColor : 'inherit'}
      justifyContent={isCollapsed ? 'center' : 'flex-start'}
      _hover={{
        bg: hoverBg,
        color: 'white',
      }}
      mb={2}
      {...rest}
    >
      {icon && (
        <Icon
          mr={isCollapsed ? 0 : 4}
          fontSize="16"
          _groupHover={{
            color: 'white',
          }}
          as={icon}
          color={isActive ? activeColor : (color || 'inherit')}
        />
      )}
      {!isCollapsed && children}
    </Flex>
  );
};

const MobileNav = ({ onOpen, title, ...rest }) => {
  const bg = useColorModeValue('white', 'gray.900');
  const borderBottomColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Flex
      display={{ base: 'flex', lg: 'none' }}
      ml={{ base: 0, lg: 60 }}
      px={{ base: 4, md: 4 }}
      height="20"
      alignItems="center"
      bg={bg}
      borderBottomWidth="1px"
      borderBottomColor={borderBottomColor}
      justifyContent={{ base: 'space-between', md: 'flex-end' }}
      {...rest}
    >
      <IconButton
        display={{ base: 'flex', lg: 'none' }}
        onClick={onOpen}
        variant="outline"
        aria-label="open menu"
        icon={<HamburgerIcon />}
      />

      <Text
        display={{ base: 'flex', lg: 'none' }}
        fontSize="xl"
        fontFamily="monospace"
        fontWeight="bold"
        ml={4}
      >
        {title}
      </Text>

      <HStack spacing={{ base: '0', md: '6' }}>
        {/* ColorModeToggle moved to Sidebar */}
      </HStack>
    </Flex>
  );
};


// --- COMPONENTE PRINCIPAL ---

const Dashboard = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();

  // Call hooks at the top level
  const cardBg = useColorModeValue('white', 'gray.800');
  const mainBg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const orangeBg = useColorModeValue('orange.50', 'orange.900');
  const orange800 = useColorModeValue("orange.800", "orange.200");
  const orange700 = useColorModeValue("orange.700", "orange.300");
  const purpleBg = useColorModeValue('purple.50', 'purple.900');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');
  const gray200 = useColorModeValue('gray.200', 'gray.600');
  const gray800 = useColorModeValue('gray.800', 'gray.200');
  const gray100 = useColorModeValue("gray.100", "gray.900");

  // === ESTADOS DE CONTROLE DE MODAIS ===
  const { isOpen, onOpen, onClose } = useDisclosure(); // Modal Menu
  const { isOpen: isProductModalOpen, onOpen: onProductModalOpen, onClose: onProductModalClose } = useDisclosure(); // Modal Produto
  const { isOpen: isFollowUpModalOpen, onOpen: onFollowUpOpen, onClose: onFollowUpClose } = useDisclosure(); // Modal Follow-up
  const { isOpen: isSavePromptOpen, onOpen: onSavePromptOpen, onClose: onSavePromptClose } = useDisclosure(); // Modal Salvar Prompt
  const { isOpen: isProfileOpen, onOpen: onProfileOpen, onClose: onProfileClose } = useDisclosure(); // Modal Perfil

  // === ESTADO DE NAVEGAÇÃO SIDEBAR ===
  const { isOpen: isSidebarOpen, onOpen: onSidebarOpen, onClose: onSidebarClose } = useDisclosure();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // === ESTADOS DE DADOS ===
  const [editingHours, setEditingHours] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  // === ESTADOS PARA CUSTOM PROMPTS (MEUS MODELOS) ===
  const [customPrompts, setCustomPrompts] = useState([]);
  const [selectedCustomPrompt, setSelectedCustomPrompt] = useState('');
  const [newPromptName, setNewPromptName] = useState('');

  // Estado do Perfil
  const [profileData, setProfileData] = useState({ name: '', email: '', company: '', avatarUrl: '' });

  // Formulário Configs Gerais
  const [configForm, setConfigForm] = useState({
    businessName: '',
    operatingHours: { opening: '09:00', closing: '18:00' },
    awayMessage: '',
    socialMedia: { instagram: '', website: '', portfolio: '' }
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
  const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '', imageUrls: [], tags: [] });
  const [editingProductIndex, setEditingProductIndex] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // 4. Follow-up (NOVO)
  const [newFollowUp, setNewFollowUp] = useState({ delayMinutes: 60, message: '' });
  const [editingFollowUpIndex, setEditingFollowUpIndex] = useState(null);

  // =========================================================
  // 🔄 CARREGAMENTO INICIAL
  // =========================================================

  const dataLoadedRef = useRef(false);

  // 1. Sincroniza Estado Local com Contexto Global (Apenas UMA vez para evitar sobrescrita)
  useEffect(() => {
    if (state.businessConfig && !dataLoadedRef.current) {
      // Config Gerais
      setConfigForm({
        businessName: state.businessConfig.businessName || '',
        operatingHours: state.businessConfig.operatingHours || { opening: '09:00', closing: '18:00' },
        awayMessage: state.businessConfig.awayMessage || '',
        socialMedia: state.businessConfig.socialMedia || { instagram: '', website: '', portfolio: '' }
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

      dataLoadedRef.current = true;
    }
  }, [state.businessConfig]);

  // Sincroniza dados do Perfil
  useEffect(() => {
    if (state.user) {
      setProfileData({
        name: state.user.name || '',
        email: state.user.email || '',
        company: state.businessConfig?.businessName || state.user.company || 'Minha Empresa',
        avatarUrl: state.user.avatarUrl || '' // Se houver
      });
    }
  }, [state.user, state.businessConfig]);

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
      setFollowUpSteps(selected.followUpSteps || []);
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
        prompts: activePrompts, // Salva o que está escrito nos TextAreas agora
        followUpSteps: followUpSteps // Salva também o funil atual
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
    // Normaliza tags de string para array se necessário
    let finalTags = newProduct.tags;
    if (typeof finalTags === 'string') {
      finalTags = finalTags.split(',').map(t => t.trim()).filter(t => t);
    }

    const productToSave = { ...newProduct, tags: finalTags };

    const updated = [...products];
    if (editingProductIndex !== null) updated[editingProductIndex] = productToSave;
    else updated.push(productToSave);

    setProducts(updated);
    setNewProduct({ name: '', price: '', description: '', imageUrls: [], tags: [] });
    setEditingProductIndex(null);
    onProductModalClose();
  };
  const handleRemoveProduct = (idx) => setProducts(products.filter((_, i) => i !== idx));

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsUploading(true);

    try {
      // Upload de múltiplas imagens em paralelo
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append('image', file);
        return businessAPI.uploadImage(formData);
      });

      const responses = await Promise.all(uploadPromises);
      const newUrls = responses.map(res => res.data.imageUrl);

      setNewProduct(prev => ({
        ...prev,
        imageUrls: [...(prev.imageUrls || []), ...newUrls]
      }));
      toast({ title: `${newUrls.length} imagens enviadas!`, status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao enviar imagem', description: error.message, status: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (indexToRemove) => {
    const urlToRemove = newProduct.imageUrls[indexToRemove];

    // Se for URL salva (tem http), deletamos do backend
    if (urlToRemove && urlToRemove.startsWith('http')) {
      try {
        await businessAPI.deleteImage(urlToRemove);
        toast({ title: 'Imagem removida!', status: 'success' });
      } catch (error) {
        console.error("Erro ao deletar imagem:", error);
        toast({ title: 'Erro ao remover arquivo', status: 'error' });
        return; // Não remove do estado se falhar no backend (opcional)
      }
    }

    setNewProduct(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== indexToRemove)
    }));
  };

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
    <Box minH="100vh" bg={mainBg}>
      {/* SIDEBAR PARA DESKTOP */}
      <SidebarContent
        display={{ base: 'none', lg: 'flex' }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        toggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* DRAWER PARA MOBILE */}
      <Drawer
        autoFocus={false}
        isOpen={isSidebarOpen}
        placement="left"
        onClose={onSidebarClose}
        returnFocusOnClose={false}
        onOverlayClick={onSidebarClose}
        size="full"
      >
        <DrawerOverlay />
        <DrawerContent>
          <SidebarContent onClose={onSidebarClose} activeTab={activeTab} setActiveTab={setActiveTab} />
        </DrawerContent>
      </Drawer>

      {/* CONTEÚDO PRINCIPAL (Área à direita) */}
      <Box ml={{ base: 0, lg: isCollapsed ? 20 : 60 }} p={{ base: 4, md: 6 }} transition="margin-left 0.2s">

        {/* Navbar Mobile (Hamburger) e Desktop Header Actions */}
        <MobileNav onOpen={onSidebarOpen} title={LinkItems[activeTab]?.name || 'Painel'} mb={4} />

        {/* HEADER DESKTOP (TopBar) */}
        <Flex
          display={{ base: 'none', lg: 'flex' }}
          justify="space-between"
          align="center"
          mb={6}
          bg={headerBg}
          p={4}
          borderRadius="lg"
          boxShadow="sm"
        >
          {/* Lado Esquerdo: Nome da Empresa */}
          <Heading size="md" color={useColorModeValue("gray.700", "white")}>
            {profileData.company}
          </Heading>

          {/* Lado Direito: Menu do Usuário */}
          <Menu>
            <MenuButton as={Button} rightIcon={<ChevronDownIcon />} variant="ghost" p={2}>
              <HStack>
                <Avatar size="sm" name={profileData.name} src={profileData.avatarUrl} />
                <Text fontWeight="normal">{profileData.name}</Text>
              </HStack>
            </MenuButton>
            <MenuList>
              <MenuItem icon={<EditIcon />} onClick={onProfileOpen}>Meu Perfil</MenuItem>
              <MenuItem icon={<WarningTwoIcon />} onClick={handleLogoutSystem}>Sair</MenuItem>
            </MenuList>
          </Menu>
        </Flex>

        {/* --- CONTEÚDO DAS ABAS (Render Condicional) --- */}

        {/* ABA 0: CONEXÃO & GERAL */}
        {activeTab === 0 && (
          <Box>
            <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
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
                          <Box bg="white" p={4} borderRadius="lg"><QRCodeSVG value={state.whatsappStatus.qrCode} size={180} /></Box>
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

                      <Divider />

                      <Heading size="sm" pt={2} color="gray.600">Links & Redes Sociais</Heading>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">INSTAGRAM</FormLabel>
                        <Input isDisabled={!editingHours} placeholder="@seu_negocio" value={configForm.socialMedia.instagram} onChange={e => setConfigForm({ ...configForm, socialMedia: { ...configForm.socialMedia, instagram: e.target.value } })} />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">WEBSITE</FormLabel>
                        <Input isDisabled={!editingHours} placeholder="https://..." value={configForm.socialMedia.website} onChange={e => setConfigForm({ ...configForm, socialMedia: { ...configForm.socialMedia, website: e.target.value } })} />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">PORTFOLIO</FormLabel>
                        <Input isDisabled={!editingHours} placeholder="Link externo (Drive, Behance...)" value={configForm.socialMedia.portfolio} onChange={e => setConfigForm({ ...configForm, socialMedia: { ...configForm.socialMedia, portfolio: e.target.value } })} />
                      </FormControl>

                      {editingHours && <Button colorScheme="brand" onClick={handleSaveConfig} width="full">Salvar Alterações</Button>}
                    </VStack>
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>
          </Box>
        )}

        {/* ABA 1: INTELIGÊNCIA & NICHO */}
        {activeTab === 1 && (
          <Box>
            <VStack spacing={6} align="stretch">

              {/* 1. SELEÇÃO DE PRESET DO SISTEMA */}
              <Card bg={cardBg} boxShadow="sm" borderLeft="4px solid" borderColor="blue.500">
                <CardBody>
                  <Grid templateColumns={{ base: '1fr', md: '2fr 1fr' }} gap={4} alignItems="center">
                    <Box>
                      <Heading size="sm" mb={1}>Modelos Padrão (Sistema)</Heading>
                      <Text fontSize="sm" color="gray.600">Use um modelo pronto da plataforma.</Text>
                    </Box>
                    <HStack direction={{ base: 'column', md: 'row' }} spacing={4}>
                      <Select placeholder="Selecione..." bg={gray50Bg} onChange={(e) => setSelectedPreset(e.target.value)} value={selectedPreset}>
                        {presets.map(p => (<option key={p.key} value={p.key}>{p.icon} {p.name}</option>))}
                      </Select>
                      <Button colorScheme="blue" onClick={handleApplyPreset} isDisabled={!selectedPreset} leftIcon={<StarIcon />} width={{ base: 'full', md: 'auto' }}>Aplicar</Button>
                    </HStack>
                  </Grid>
                </CardBody>
              </Card>

              {/* 2. MEUS MODELOS SALVOS (O Retângulo Laranja) */}
              <Card bg={orangeBg} boxShadow="sm" borderLeft="4px solid" borderColor="orange.400">
                <CardBody>
                  <Grid templateColumns={{ base: '1fr', md: '2fr 1fr' }} gap={4} alignItems="center">
                    <Box>
                      <Heading size="sm" mb={1} color={orange800}>Meus Modelos Pessoais</Heading>
                      <Text fontSize="sm" color={orange700}>Carregue suas edições salvas anteriormente.</Text>
                    </Box>
                    <HStack direction={{ base: 'column', md: 'row' }} spacing={4}>
                      <Select
                        placeholder="Carregar meus prompts..."
                        bg={cardBg}
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
                <Card bg={cardBg} boxShadow="sm">
                  <CardHeader pb={0}><Heading size="sm">🧠 Personalidade (Chat)</Heading></CardHeader>
                  <CardBody>
                    <Textarea
                      value={activePrompts.chatSystem}
                      onChange={(e) => setActivePrompts({ ...activePrompts, chatSystem: e.target.value })}
                      rows={10}
                      bg={gray50Bg}
                      fontSize="sm"
                      placeholder="Instruções para o chat..."
                    />
                  </CardBody>
                </Card>
                <Card bg={cardBg} boxShadow="sm">
                  <CardHeader pb={0}><Heading size="sm">👁️ Visão (Imagem)</Heading></CardHeader>
                  <CardBody>
                    <Textarea
                      value={activePrompts.visionSystem}
                      onChange={(e) => setActivePrompts({ ...activePrompts, visionSystem: e.target.value })}
                      rows={10}
                      bg={gray50Bg}
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
                <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" mb={4}>
                  <Box>
                    <Heading size="md">Funil de Vendas (Follow-up)</Heading>
                    <Text fontSize="sm" color="gray.500">Mensagens automáticas para recuperar clientes que pararam de responder.</Text>
                  </Box>
                  <Button leftIcon={<AddIcon />} colorScheme="purple" onClick={() => { setEditingFollowUpIndex(null); setNewFollowUp({ delayMinutes: 60, message: '' }); onFollowUpOpen(); }}>
                    Novo Passo
                  </Button>
                </Stack>

                <VStack spacing={4} align="stretch">
                  {followUpSteps.map((step, idx) => (
                    <Card key={idx} variant="outline" borderColor="purple.200" bg={purpleBg}>
                      <CardBody>
                        <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align="start">
                          <Stack direction={{ base: 'column', md: 'row' }} align="start" spacing={4}>
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
                              <Text fontSize="md" color={gray800}>"{step.message}"</Text>
                            </Box>
                          </Stack>
                          <HStack>
                            <Tooltip label="Editar passo">
                              <IconButton icon={<EditIcon />} aria-label="Editar passo" size="sm" variant="ghost" colorScheme="blue" onClick={() => handleEditFollowUp(idx)} />
                            </Tooltip>
                            <Tooltip label="Excluir passo">
                              <IconButton icon={<DeleteIcon />} aria-label="Excluir passo" size="sm" variant="ghost" colorScheme="red" onClick={() => handleRemoveFollowUp(idx)} />
                            </Tooltip>
                          </HStack>
                        </Stack>
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
          </Box>
        )}

        {/* ABA 2: RESPOSTAS RÁPIDAS */}
        {activeTab === 2 && (
          <Box>
            <Card bg={cardBg} boxShadow="md">
              <CardHeader>
                <Stack direction={{ base: 'column', md: 'row' }} justify="space-between">
                  <Box><Heading size="md">Menu de Respostas</Heading><Text fontSize="sm" color="gray.500">Palavras-chave que o bot responde instantaneamente.</Text></Box>
                  <Button leftIcon={<AddIcon />} colorScheme="green" onClick={() => { setEditingMenuIndex(null); setNewMenuOption({ keyword: '', description: '', response: '', requiresHuman: false, useAI: false }); onOpen(); }}>Nova Regra</Button>
                </Stack>
              </CardHeader>
              <CardBody>
                <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={4}>
                  {menuOptions.map((opt, idx) => (
                    <Card key={idx} variant="outline" size="sm">
                      <CardBody p={3}>
                        <HStack justify="space-between" mb={2}>
                          <Badge colorScheme="purple">{idx + 1}. {opt.keyword.split(',')[0]}</Badge>
                          <HStack spacing={1}>
                            <Tooltip label="Editar regra">
                              <IconButton icon={<EditIcon />} aria-label="Editar regra" size="xs" colorScheme="blue" variant="ghost" onClick={() => handleEditMenuOption(idx)} />
                            </Tooltip>
                            <Tooltip label="Excluir regra">
                              <IconButton icon={<DeleteIcon />} aria-label="Excluir regra" size="xs" colorScheme="red" variant="ghost" onClick={() => handleRemoveMenuOption(idx)} />
                            </Tooltip>
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
          </Box>
        )}

        {/* ABA 3: CATÁLOGO */}
        {activeTab === 3 && (
          <Box>
            <Card bg={cardBg} boxShadow="md">
              <CardHeader>
                <Stack direction={{ base: 'column', md: 'row' }} justify="space-between">
                  <Box><Heading size="md">Produtos & Serviços</Heading><Text fontSize="sm" color="gray.500">Para a IA consultar preços e enviar fotos.</Text></Box>
                  <Button leftIcon={<AddIcon />} variant="outline" colorScheme="blue" onClick={() => { setEditingProductIndex(null); setNewProduct({ name: '', price: '', description: '', imageUrls: [], tags: [] }); onProductModalOpen(); }}>Novo Item</Button>
                </Stack>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={3}>
                  {products.map((prod, idx) => (
                    <Stack direction={{ base: 'column', md: 'row' }} key={idx} p={4} borderWidth="1px" borderRadius="md" justify="space-between" bg={gray50Bg} align="start">
                      {prod.imageUrls && prod.imageUrls.length > 0 && (
                        <Box w="60px" h="60px" borderRadius="md" overflow="hidden" flexShrink={0}>
                          <img src={prod.imageUrls[0]} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </Box>
                      )}
                      <VStack align="start" spacing={1} flex={1}>
                        <HStack><Text fontWeight="bold">{prod.name}</Text><Badge colorScheme="green">R$ {prod.price}</Badge></HStack>
                        <Text fontSize="sm" color="gray.600">{prod.description}</Text>
                        {prod.tags && prod.tags.length > 0 && (
                          <HStack flexWrap="wrap" spacing={1}>
                            {prod.tags.map((t, i) => <Badge key={i} colorScheme="purple" variant="subtle" fontSize="0.6em">{t}</Badge>)}
                          </HStack>
                        )}
                      </VStack>
                      <HStack>
                        <Tooltip label="Editar produto">
                          <IconButton icon={<EditIcon />} aria-label="Editar produto" size="sm" variant="ghost" onClick={() => { setNewProduct(prod); setEditingProductIndex(idx); onProductModalOpen(); }} />
                        </Tooltip>
                        <Tooltip label="Excluir produto">
                          <IconButton icon={<DeleteIcon />} aria-label="Excluir produto" size="sm" colorScheme="red" variant="ghost" onClick={() => handleRemoveProduct(idx)} />
                        </Tooltip>
                      </HStack>
                    </Stack>
                  ))}
                </VStack>
                {products.length > 0 && <Box mt={6} pt={4} textAlign="right"><Button colorScheme="brand" onClick={handleSaveProducts}>Salvar Catálogo</Button></Box>}
              </CardBody>
            </Card>
          </Box>
        )}

        {/* ABA 4: LIVE CHAT (PLACEHOLDER) */}
        {activeTab === 4 && (
          <Box>
            <Card h="75vh" overflow="hidden" border="1px solid" borderColor="gray.200">
              <Stack direction={{ base: 'column', md: 'row' }} h="100%" spacing={0} align="stretch">

                {/* LADO ESQUERDO: LISTA DE CONTATOS (MOCKUP) */}
                <Box w={{ base: "100%", md: "300px" }} h={{ base: "40%", md: "100%" }} borderRight="1px solid" borderColor={gray50Bg} bg={gray50Bg} overflowY="auto">
                  <Box p={4} borderBottom="1px solid" borderColor={gray50Bg} bg={cardBg}>
                    <Heading size="sm" color="gray.600">Conversas</Heading>
                  </Box>
                  <VStack spacing={0} align="stretch" overflowY="auto">
                    {/* Item Fake 1 */}
                    <Box p={4} bg={cardBg} borderBottom="1px solid" borderColor={gray50Bg} cursor="pointer" borderLeft="4px solid" borderLeftColor="green.400">
                      <Text fontWeight="bold" fontSize="sm" noOfLines={1}>João Silva</Text>
                      <Text fontSize="xs" color="gray.500" noOfLines={1}>Olá, qual o preço do corte?</Text>
                      <Badge colorScheme="green" fontSize="0.6em" mt={1}>Online</Badge>
                    </Box>
                    {/* Item Fake 2 */}
                    <Box p={4} _hover={{ bg: gray50Bg }} cursor="pointer" borderBottom="1px solid" borderColor={gray50Bg}>
                      <Text fontWeight="bold" fontSize="sm" noOfLines={1}>Maria Souza</Text>
                      <Text fontSize="xs" color="gray.500" noOfLines={1}>Obrigado pelo atendimento!</Text>
                    </Box>
                    {/* Item Fake 3 */}
                    <Box p={4} _hover={{ bg: gray50Bg }} cursor="pointer" borderBottom="1px solid" borderColor={gray50Bg}>
                      <Text fontWeight="bold" fontSize="sm" noOfLines={1}>Pedro Henrique</Text>
                      <Text fontSize="xs" color="gray.500" noOfLines={1}>Agendado para amanhã?</Text>
                    </Box>
                  </VStack>
                </Box>

                {/* LADO DIREITO: CHAT (MOCKUP) */}
                <Box flex="1" bg={gray100} position="relative" display="flex" flexDirection="column" h={{ base: "60%", md: "100%" }}>

                  {/* Header do Chat */}
                  <HStack p={4} bg={cardBg} borderBottom="1px solid" borderColor={gray50Bg} justify="space-between">
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
                  <Box p={4} bg={cardBg} borderTop="1px solid" borderColor={gray50Bg}>
                    <HStack>
                      <Input placeholder="Digite sua mensagem..." isDisabled />
                      <IconButton aria-label="Enviar" icon={<ChatIcon />} colorScheme="blue" isDisabled />
                    </HStack>
                  </Box>
                </Box>

              </Stack>
            </Card>
          </Box>
        )}

        {/* ABA 5: AGENDAMENTOS */}
        {activeTab === 5 && (
          <Box>
            <ScheduleTab />
          </Box>
        )}

      </Box>

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
              <Box w="100%" bg={gray50Bg} p={3} borderRadius="md" border="1px dashed" borderColor={gray200}>
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

              <FormControl>
                <FormLabel>Tags (Palavras-chave separadas por vírgula)</FormLabel>
                <Input
                  placeholder="ex: realismo, braço, promoção"
                  value={Array.isArray(newProduct.tags) ? newProduct.tags.join(', ') : newProduct.tags}
                  onChange={e => setNewProduct({ ...newProduct, tags: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Imagens do Produto</FormLabel>
                <HStack>
                  <Input type="file" multiple accept="image/*" onChange={handleImageUpload} p={1} isDisabled={isUploading} />
                  {isUploading && <Spinner size="sm" />}
                </HStack>
                {newProduct.imageUrls && newProduct.imageUrls.length > 0 && (
                  <HStack mt={2} spacing={2} overflowX="auto" py={2}>
                    {newProduct.imageUrls.map((url, i) => (
                      <Box key={i} w="60px" h="60px" borderRadius="md" overflow="hidden" border="1px solid gray" position="relative" flexShrink={0}>
                        <img src={url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <IconButton
                          icon={<DeleteIcon boxSize={3} />}
                          size="xs"
                          colorScheme="red"
                          position="absolute"
                          top={0}
                          right={0}
                          onClick={() => handleDeleteImage(i)}
                          aria-label="Remover imagem"
                          borderRadius="none"
                          borderBottomLeftRadius="md"
                        />
                      </Box>
                    ))}
                  </HStack>
                )}
              </FormControl>

            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={onProductModalClose}>Cancelar</Button><Button colorScheme="blue" onClick={handleAddProduct} isLoading={isUploading}>Salvar</Button></ModalFooter>
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

      {/* Modal Perfil (Minha Conta) */}
      <Modal isOpen={isProfileOpen} onClose={onProfileClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Minha Conta</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={6} py={4}>
              {/* Avatar Section */}
              <Box position="relative">
                <Avatar size="2xl" name={profileData.name} src={profileData.avatarUrl} />
                <IconButton
                  aria-label="Alterar foto"
                  icon={<EditIcon />}
                  size="sm"
                  colorScheme="brand"
                  rounded="full"
                  position="absolute"
                  bottom={0}
                  right={0}
                  boxShadow="md"
                  onClick={() => toast({ title: "Upload de imagem em breve!", status: "info" })}
                />
              </Box>

              {/* Form Fields */}
              <FormControl>
                <FormLabel>Nome Completo</FormLabel>
                <Input
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Email (Login)</FormLabel>
                <Input value={profileData.email} isDisabled bg="gray.100" />
              </FormControl>

              <FormControl>
                <FormLabel>Nome da Empresa</FormLabel>
                <Input
                  value={profileData.company}
                  onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onProfileClose}>Cancelar</Button>
            <Button colorScheme="brand" onClick={() => { onProfileClose(); toast({ title: "Perfil atualizado!", status: "success" }); }}>Salvar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default Dashboard;