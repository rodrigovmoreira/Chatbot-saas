import React from 'react';
import {
  Flex,
  Box,
  Text,
  Icon,
  IconButton,
  HStack,
  useColorModeValue,
  Drawer,
  DrawerOverlay,
  DrawerContent,
} from '@chakra-ui/react';
import {
  SettingsIcon,
  StarIcon,
  EditIcon,
  AttachmentIcon,
  ChatIcon,
  TimeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HamburgerIcon,
} from '@chakra-ui/icons';
import ColorModeToggle from './ColorModeToggle';

import { FaBullhorn, FaFilter, FaHome } from 'react-icons/fa';

const LinkItems = [
  { name: 'Visão Geral', icon: FaHome, index: 0 },
  { name: 'Conexão & Negócio', icon: SettingsIcon, index: 1 },
  { name: 'Inteligência & Nicho', icon: StarIcon, index: 2 },
  { name: 'Respostas Rápidas', icon: EditIcon, index: 3 },
  { name: 'Catálogo', icon: AttachmentIcon, index: 4 },
  { name: 'Campanhas', icon: FaBullhorn, index: 5, color: 'orange.500' },
  { name: 'Chat Ao vivo', icon: ChatIcon, index: 6, color: 'purple.500' },
  { name: 'Agendamentos', icon: TimeIcon, index: 7, color: 'blue.500' },
  { name: 'Funil de Vendas', icon: FaFilter, index: 8, color: 'teal.500' },
];

const NavItem = ({ icon, children, isActive, color, isCollapsed, ...rest }) => {
  const hoverBg = useColorModeValue('brand.500', 'brand.200');
  const activeBg = useColorModeValue('brand.100', 'gray.700');
  const activeColor = useColorModeValue('brand.600', 'brand.200');

  return (
    <Flex
      align="center"
      p={{ base: 4, md: 3 }} // Adjusted padding for better touch/desktop balance
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
          fontSize="18" // Slightly larger icon
          _groupHover={{
            color: 'white',
          }}
          as={icon}
          color={isActive ? activeColor : (color || 'inherit')}
        />
      )}
      {!isCollapsed && (
         <Text fontSize="sm" fontWeight={isActive ? 'bold' : 'normal'}>{children}</Text>
      )}
    </Flex>
  );
};

export const SidebarContent = ({ onClose, activeTab, setActiveTab, isCollapsed = false, toggleCollapse, pos = 'fixed', ...rest }) => {
  const bg = useColorModeValue('white', 'gray.900');
  const borderRightColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Flex
      direction="column"
      transition="width 0.2s"
      bg={bg}
      borderRight="1px"
      borderRightColor={borderRightColor}
      w={{ base: 'full', lg: isCollapsed ? 20 : 64 }} // Increased expanded width slightly (60->64)
      pos={pos}
      h="full"
      zIndex={pos === 'fixed' ? 100 : 'auto'}
      {...rest}
    >
      <Flex h="20" alignItems="center" mx={isCollapsed ? 0 : 8} justifyContent={isCollapsed ? 'center' : 'space-between'}>
        {!isCollapsed && (
          <Text fontSize="xl" fontFamily="monospace" fontWeight="bold">
            Painel
          </Text>
        )}
        <Box display={{ base: 'flex', lg: 'none' }} onClick={onClose} cursor="pointer">
          <Icon as={ChevronLeftIcon} boxSize={6} />
        </Box>
      </Flex>

      <Box flex="1" overflowY="auto" css={{
        '&::-webkit-scrollbar': { width: '4px' },
        '&::-webkit-scrollbar-track': { width: '6px' },
        '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '24px' },
      }}>
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
        gap={isCollapsed ? 4 : 0}
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

export const MobileNav = ({ onOpen, title, children, ...rest }) => {
  const bg = useColorModeValue('white', 'gray.800');
  const borderBottomColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Flex
      display={{ base: 'flex', lg: 'none' }}
      px={{ base: 4, md: 6 }}
      height="20"
      alignItems="center"
      bg={bg}
      borderBottomWidth="1px"
      borderBottomColor={borderBottomColor}
      justifyContent="space-between"
      pos="fixed"
      top="0"
      left="0"
      right="0"
      zIndex="999"
      boxShadow="sm"
      transition="all 0.3s"
      {...rest}
    >
      <HStack spacing={3}>
        <IconButton
          onClick={onOpen}
          variant="ghost"
          size="lg"
          aria-label="open menu"
          icon={<HamburgerIcon boxSize={6} />}
        />

        <Text
          fontSize="lg"
          fontWeight="bold"
        >
          {title}
        </Text>
      </HStack>

      <HStack spacing={{ base: '0', md: '6' }}>
        {children}
      </HStack>
    </Flex>
  );
};

// Unified Sidebar Component handling both Desktop and Mobile logic
export const Sidebar = ({ isOpen, onClose, activeTab, setActiveTab, isCollapsed, toggleCollapse }) => {
  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <SidebarContent
        display={{ base: 'none', lg: 'flex' }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        toggleCollapse={toggleCollapse}
      />

      {/* Mobile Sidebar (Drawer) */}
      <Drawer
        autoFocus={false}
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="xs" // roughly 320px
      >
        <DrawerOverlay />
        <DrawerContent>
          <SidebarContent
            onClose={onClose}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pos="relative"
            w="full"
          />
        </DrawerContent>
      </Drawer>
    </>
  );
};

export { LinkItems };
