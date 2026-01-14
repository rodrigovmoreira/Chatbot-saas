import React from 'react';
import {
  Flex,
  Box,
  Text,
  Icon,
  IconButton,
  HStack,
  useColorModeValue,
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

import { FaBullhorn, FaFilter } from 'react-icons/fa';

const LinkItems = [
  { name: 'Conexão & Geral', icon: SettingsIcon, index: 0 },
  { name: 'Inteligência & Nicho', icon: StarIcon, index: 1 },
  { name: 'Respostas Rápidas', icon: EditIcon, index: 2 },
  { name: 'Catálogo', icon: AttachmentIcon, index: 3 },
  { name: 'Campanhas', icon: FaBullhorn, index: 4, color: 'orange.500' }, // Reordered/Added
  { name: 'Live Chat', icon: ChatIcon, index: 5, color: 'purple.500' },
  { name: 'Agendamentos', icon: TimeIcon, index: 6, color: 'blue.500' },
  { name: 'Funil de Vendas', icon: FaFilter, index: 7, color: 'teal.500' },
];

const NavItem = ({ icon, children, isActive, color, isCollapsed, ...rest }) => {
  const hoverBg = useColorModeValue('brand.500', 'brand.200');
  const activeBg = useColorModeValue('brand.100', 'gray.700');
  const activeColor = useColorModeValue('brand.600', 'brand.200');

  return (
    <Flex
      align="center"
      p={{ base: 5, md: 4 }}
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

export const SidebarContent = ({ onClose, activeTab, setActiveTab, isCollapsed = false, toggleCollapse, pos = 'fixed', ...rest }) => {
  const bg = useColorModeValue('white', 'gray.900');
  const borderRightColor = useColorModeValue('gray.200', 'gray.700');

  // Mobile Responsiveness: Sidebar renders as full width inside Drawer on mobile
  return (
    <Flex
      direction="column"
      transition="width 0.2s"
      bg={bg}
      borderRight="1px"
      borderRightColor={borderRightColor}
      w={{ base: 'full', lg: isCollapsed ? 20 : 60 }}
      pos={pos}
      h="full"
      zIndex={pos === 'fixed' ? 100 : 'auto'} // Ensure fixed sidebar stays on top
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
      zIndex="999" // High z-index for mobile nav
      boxShadow="sm"
      transition="all 0.3s" // Smooth transition for appearance
      {...rest}
    >
      <HStack spacing={3}>
        <IconButton
          display={{ base: 'flex', lg: 'none' }}
          onClick={onOpen}
          variant="ghost"
          size="lg" // Increased size for better touch target
          aria-label="open menu"
          icon={<HamburgerIcon />}
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

// Export LinkItems to get the title in Dashboard
export { LinkItems };
