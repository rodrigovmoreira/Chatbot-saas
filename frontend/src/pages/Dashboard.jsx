import React, { useEffect, useState } from 'react';
import {
  Box, Flex, Heading, Text, Button, VStack, HStack,
  useToast, useColorModeValue, FormControl, FormLabel, Input,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, Drawer, DrawerOverlay, DrawerContent,
  Menu, MenuButton, MenuList, MenuItem, Avatar, IconButton
} from '@chakra-ui/react';
import {
  EditIcon, WarningTwoIcon, ChevronDownIcon, HamburgerIcon,
} from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { authAPI, businessAPI } from '../services/api';
import ScheduleTab from '../components/ScheduleTab';

// Imported Components
import { SidebarContent, LinkItems } from '../components/Sidebar';
import ConnectionTab from '../components/dashboard-tabs/ConnectionTab';
import IntelligenceTab from '../components/dashboard-tabs/IntelligenceTab';
import QuickRepliesTab from '../components/dashboard-tabs/QuickRepliesTab';
import CatalogTab from '../components/dashboard-tabs/CatalogTab';
import LiveChatTab from '../components/dashboard-tabs/LiveChatTab';

const Dashboard = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const fileInputRef = React.useRef();

  // Colors
  const mainBg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');

  // Global Modals
  const { isOpen: isProfileOpen, onOpen: onProfileOpen, onClose: onProfileClose } = useDisclosure();
  const { isOpen: isSidebarOpen, onOpen: onSidebarOpen, onClose: onSidebarClose } = useDisclosure();

  // Navigation State
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Profile Data
  const [profileData, setProfileData] = useState({ name: '', email: '', company: '', avatarUrl: '' });

  // Sync Profile
  useEffect(() => {
    if (state.user) {
      setProfileData({
        name: state.user.name || '',
        email: state.user.email || '',
        company: state.businessConfig?.businessName || state.user.company || 'Minha Empresa',
        avatarUrl: state.user.avatarUrl || ''
      });
    }
  }, [state.user, state.businessConfig]);

  const handleLogoutSystem = async () => {
    const confirm = window.confirm("Ao sair, o Robô do WhatsApp será desligado para economizar recursos. Deseja continuar?");
    if (confirm) {
      try {
        await authAPI.logout();
        toast({ title: 'Sessão encerrada', status: 'info' });
      } catch (error) {
        console.error("Erro ao notificar logout:", error);
      } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'avatar'); // <--- AVISO: É um avatar, não produto!

    try {
      const response = await businessAPI.uploadImage(formData);
      setProfileData(prev => ({ ...prev, avatarUrl: response.data.imageUrl }));
      toast({ title: 'Avatar enviado!', status: 'success' });
    } catch (error) {
      console.error('Erro ao enviar avatar:', error);
      toast({ title: 'Erro ao enviar imagem', status: 'error' });
    }
  };

  const handleSaveProfile = async () => {
    try {
      const { data } = await authAPI.updateUser({
        name: profileData.name,
        avatarUrl: profileData.avatarUrl
      });

      dispatch({ type: 'SET_USER', payload: data.user });
      localStorage.setItem('user', JSON.stringify(data.user));
      toast({ title: "Perfil atualizado!", status: "success" });
      onProfileClose();
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast({ title: 'Erro ao atualizar perfil', status: 'error' });
    }
  };

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
        size="xs"
      >
        <DrawerOverlay />
        <DrawerContent>
          <SidebarContent
            onClose={onSidebarClose}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pos="relative"
            w="full"
          />
        </DrawerContent>
      </Drawer>

      {/* CONTEÚDO PRINCIPAL (Área à direita) */}
      <Box
        ml={{ base: 0, lg: isCollapsed ? 20 : 60 }}
        p={{ base: 4, md: 6 }}
        pt={{ base: 4, lg: 6 }}
        transition="margin-left 0.2s"
      >

        {/* Navbar Mobile Customizada (Com Avatar e Menu) */}
        <Flex
          display={{ base: 'flex', lg: 'none' }} // Só aparece no Mobile
          alignItems="center"
          justifyContent="space-between"
          bg={useColorModeValue('white', 'gray.800')}
          p={4}
          mb={4}
          borderRadius="lg"
          boxShadow="sm"
        >
          {/* Lado Esquerdo: Menu Hamburger + Título */}
          <HStack spacing={3}>
            <IconButton
              onClick={onSidebarOpen}
              variant="ghost"
              aria-label="Abrir menu"
              icon={<HamburgerIcon />}
            />
            <Text fontSize="lg" fontWeight="bold" color={useColorModeValue('gray.700', 'white')}>
              {LinkItems[activeTab]?.name || 'Painel'}
            </Text>
          </HStack>

          {/* Lado Direito: Foto do Usuário (Avatar) */}
          <Menu>
            <MenuButton
              as={Button}
              rounded={'full'}
              variant={'link'}
              cursor={'pointer'}
              minW={0}
            >
              <Avatar
                size={'sm'}
                name={profileData.name}
                src={profileData.avatarUrl}
              />
            </MenuButton>
            <MenuList>
              <MenuItem icon={<EditIcon />} onClick={onProfileOpen}>Meu Perfil</MenuItem>
              <MenuItem icon={<WarningTwoIcon />} onClick={handleLogoutSystem}>Sair</MenuItem>
            </MenuList>
          </Menu>
        </Flex>

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

        {activeTab === 0 && <ConnectionTab />}
        {activeTab === 1 && <IntelligenceTab />}
        {activeTab === 2 && <QuickRepliesTab />}
        {activeTab === 3 && <CatalogTab />}
        {activeTab === 4 && <LiveChatTab />}
        {activeTab === 5 && <ScheduleTab />}

      </Box>

      {/* Modal Perfil (Minha Conta) - Mantido Globalmente */}
      <Modal isOpen={isProfileOpen} onClose={onProfileClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Minha Conta</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={6} py={4}>
              <Box position="relative">
                <Avatar size="2xl" name={profileData.name} src={profileData.avatarUrl} />
                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
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
                  onClick={() => fileInputRef.current.click()}
                />
              </Box>

              <FormControl>
                <FormLabel>Nome Completo</FormLabel>
                <Input
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  size={{ base: 'lg', md: 'md' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Email (Login)</FormLabel>
                <Input value={profileData.email} isDisabled bg="gray.100" size={{ base: 'lg', md: 'md' }} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onProfileClose}>Cancelar</Button>
            <Button colorScheme="brand" onClick={handleSaveProfile}>Salvar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default Dashboard;
