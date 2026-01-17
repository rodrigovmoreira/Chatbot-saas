import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, Heading, Text, Button, VStack, HStack, Stack,
  useColorModeValue, Alert, Icon,
  Avatar, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalCloseButton, ModalBody, ModalFooter, useDisclosure, Code, IconButton, Tooltip, useToast,
  Badge, Switch, FormControl, FormLabel,
  Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerBody,
  useBreakpointValue, Input
} from '@chakra-ui/react';
import { ChatIcon, LinkIcon, DeleteIcon, ArrowBackIcon, InfoIcon } from '@chakra-ui/icons';
import { FaWhatsapp, FaGlobe, FaRobot, FaUser } from 'react-icons/fa';
import { IoMdSend } from 'react-icons/io';
import { businessAPI } from '../../services/api'; // Ensure this service has updateContact method
import { useApp } from '../../context/AppContext';
import CrmSidebar from '../crm/CrmSidebar';
import axios from 'axios'; // For direct call if needed, but better via service

const LiveChatTab = () => {
  const { state, dispatch } = useApp();
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasScrolled, setHasScrolled] = useState(false);

  // CRM UI State
  const [showDesktopCrm, setShowDesktopCrm] = useState(true);
  const { isOpen: isCrmOpen, onOpen: onCrmOpen, onClose: onCrmClose } = useDisclosure();

  // Mobile View State
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Message Input State
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef(null);

  // Modal de Embed
  const { isOpen: isEmbedOpen, onOpen: onEmbedOpen, onClose: onEmbedClose } = useDisclosure();
  const toast = useToast();

  const isLargeScreen = useBreakpointValue({ base: false, lg: true });

  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');
  const gray100 = useColorModeValue("gray.100", "gray.900");
  const inputBg = useColorModeValue('white', '#0D1117');
  const chatBg = useColorModeValue('linear-gradient(to bottom, #f0f2f5, #e1e5ea)', '#0D1117');

  const myMsgBg = useColorModeValue('brand.100', 'brand.600');
  const otherMsgBg = useColorModeValue('white', '#21262D');
  const myMsgColor = useColorModeValue('black', 'white');
  const otherMsgColor = useColorModeValue('black', '#C9D1D9');

  const messagesEndRef = useRef(null);

  // === Handlers for Tags & Handover ===

  const updateContact = async (updates) => {
    if (!selectedContact) return;
    try {
        const token = localStorage.getItem('token');
        const response = await axios.put(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/contacts/${selectedContact._id}`, updates, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Update local state immediately
        setSelectedContact(prev => ({ ...prev, ...response.data }));

        // Update list
        setConversations(prev => prev.map(c => c._id === selectedContact._id ? { ...c, ...response.data } : c));

        // Show success toast for CRM updates (if it's not just a tag/handover update)
        if (updates.dealValue !== undefined || updates.funnelStage || updates.notes) {
             toast({ title: "CRM atualizado.", status: "success", duration: 2000 });
        }

        return response.data;
    } catch (error) {
        console.error("Error updating contact:", error);
        toast({ title: "Erro ao atualizar contato.", status: "error", duration: 3000 });
        throw error;
    }
  };

  const handleAddTag = async (tag) => {
    if (!tag || !selectedContact) return;

    const currentTags = selectedContact.tags || [];
    if (currentTags.includes(tag)) return;

    // Verifica se tag existe em availableTags e adiciona globalmente se não existir
    const availableTags = state.businessConfig?.availableTags || [];
    if (!availableTags.includes(tag)) {
       try {
           const newAvailableTags = [...availableTags, tag];
           await businessAPI.updateConfig({ availableTags: newAvailableTags });
           dispatch({
             type: 'SET_BUSINESS_CONFIG',
             payload: { ...state.businessConfig, availableTags: newAvailableTags }
           });
       } catch (error) {
           console.error("Erro ao criar nova tag global:", error);
           toast({ title: "Erro ao salvar nova tag no sistema.", status: "error" });
           return;
       }
    }

    const updatedTags = [...currentTags, tag];
    await updateContact({ tags: updatedTags });
  };

  const handleRemoveTag = async (tagToRemove) => {
      if (!selectedContact) return;
      const currentTags = selectedContact.tags || [];
      const updatedTags = currentTags.filter(t => t !== tagToRemove);
      await updateContact({ tags: updatedTags });
  };

  const toggleHandover = async () => {
      const newValue = !selectedContact.isHandover;
      await updateContact({ isHandover: newValue });
      toast({
          title: newValue ? "Robô Pausado (Modo Humano)" : "Robô Ativado",
          status: newValue ? "warning" : "success",
          duration: 2000
      });
  };

  const handleClearHistory = async () => {
    if (!selectedContact) return;

    if (!window.confirm("Tem certeza que deseja limpar o histórico desta conversa? A memória da IA será apagada.")) return;

    try {
      await businessAPI.clearHistory(selectedContact._id);
      setMessages([]);
      toast({
        title: "Histórico limpo.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Erro ao limpar histórico:", error);
      toast({
        title: "Erro ao limpar histórico.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 1. Carregar Conversas
  const loadConversations = async () => {
    try {
      const { data } = await businessAPI.getConversations();
      setConversations(data);
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
    }
  };

  useEffect(() => {
    loadConversations();
    // Polling de contatos a cada 10s
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  // 2. Carregar Mensagens ao selecionar
  useEffect(() => {
    if (!selectedContact) return;

    // Reset scroll flag when contact changes
    setHasScrolled(false);

    const fetchMessages = async () => {
      try {
        const { data } = await businessAPI.getMessages(selectedContact._id);
        setMessages(data);
        // Removed scrollToBottom() from here to prevent auto-scrolling on poll
      } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
      }
    };

    fetchMessages();
    // Polling de mensagens a cada 5s
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedContact]);

  // Effect to scroll once per contact load
  useEffect(() => {
    if (!hasScrolled && messages.length > 0) {
        scrollToBottom();
        setHasScrolled(true);
    }
  }, [messages, hasScrolled]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    setShowMobileChat(true); // Switch to chat view on mobile
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
    setSelectedContact(null);
  };

  const handleCrmToggle = () => {
      if (isLargeScreen) {
          setShowDesktopCrm(!showDesktopCrm);
      } else {
          onCrmOpen();
      }
  };

  const handleSendMessage = async () => {
      if (!inputMessage.trim() || !selectedContact) return;
      setIsSending(true);
      try {
          await businessAPI.sendMessage(selectedContact._id, inputMessage);
          // Add to local list immediately for better UX
          setMessages(prev => [...prev, {
              role: 'agent',
              content: inputMessage,
              timestamp: new Date().toISOString()
          }]);
          setInputMessage('');
          setHasScrolled(false); // Trigger scroll to bottom

          // Restore focus to input
          setTimeout(() => {
              inputRef.current?.focus();
          }, 50);

      } catch (error) {
          console.error("Error sending message:", error);
          toast({ title: "Erro ao enviar mensagem.", status: "error" });
      } finally {
          setIsSending(false);
      }
  };

  // Helper de Formatação
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getEmbedCode = () => {
    const businessId = state.businessConfig?._id;

    if (!businessId) {
      return "<!-- Carregando ID do Negócio... -->";
    }

    const origin = window.location.origin;
    return `<iframe
  src="${origin}/chat/${businessId}"
  width="350"
  height="600"
  style="border:none; position:fixed; bottom:20px; right:20px; z-index:9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 12px;">
</iframe>`;
  };

  // Cores de Badge
  const getTagColor = (tag) => {
      const colors = ['purple', 'green', 'blue', 'orange', 'red', 'teal'];
      const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return colors[hash % colors.length];
  };

  return (
    <Box>
      <Stack direction={{ base: 'column', md: 'row' }} mb={4} justify="flex-end" spacing={2}>
        <Button leftIcon={<LinkIcon />} size="sm" onClick={onEmbedOpen} colorScheme="brand">
          Instalar no Site
        </Button>
      </Stack>

      <Card h={{ base: "calc(100dvh - 150px)", md: "75vh" }} overflow="hidden" border="1px solid" borderColor="gray.200">
        <Stack direction={{ base: 'column', md: 'row' }} h="100%" spacing={0} align="stretch">

          {/* LADO ESQUERDO: LISTA DE CONTATOS */}
          <Box
            w={{ base: "100%", md: "300px" }}
            display={{ base: showMobileChat ? 'none' : 'block', md: 'block' }}
            h="100%"
            borderRight="1px solid"
            borderColor={gray50Bg}
            bg={gray50Bg}
            overflowY="auto"
          >
            <Box p={4} borderBottom="1px solid" borderColor={gray50Bg} bg={cardBg}>
              <Heading size="sm" color="gray.600">Conversas</Heading>
            </Box>
            <VStack spacing={0} align="stretch">
              {conversations.length === 0 && (
                 <Text p={4} fontSize="sm" color="gray.500">Nenhuma conversa ainda.</Text>
              )}
              {conversations.map((contact) => (
                <Box
                  key={contact._id}
                  p={4}
                  bg={selectedContact?._id === contact._id ? 'brand.50' : cardBg}
                  borderBottom="1px solid"
                  borderColor={gray50Bg}
                  cursor="pointer"
                  borderLeft={selectedContact?._id === contact._id ? "4px solid" : "4px solid transparent"}
                  borderLeftColor="brand.500"
                  _hover={{ bg: 'gray.100' }}
                  onClick={() => handleContactSelect(contact)}
                >
                  <HStack justify="space-between" mb={1}>
                    <HStack>
                       {contact.channel === 'whatsapp'
                         ? <Icon as={FaWhatsapp} color="green.500" />
                         : <Icon as={FaGlobe} color="blue.500" />
                       }
                       <Text fontWeight="bold" fontSize="sm" noOfLines={1}>{contact.name || contact.phone}</Text>
                    </HStack>
                    <Text fontSize="xs" color="gray.500">{formatTime(contact.lastInteraction)}</Text>
                  </HStack>
                  {/* Tags Preview */}
                  {contact.tags && contact.tags.length > 0 && (
                      <HStack mt={1} spacing={1}>
                          {contact.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} fontSize="xx-small" colorScheme={getTagColor(tag)}>{tag}</Badge>
                          ))}
                          {contact.tags.length > 2 && <Text fontSize="xx-small">+{contact.tags.length - 2}</Text>}
                      </HStack>
                  )}
                </Box>
              ))}
            </VStack>
          </Box>

          {/* LADO DIREITO: CHAT */}
          <Box
            flex="1"
            bg={gray100}
            position="relative"
            display={{ base: showMobileChat ? 'flex' : 'none', md: 'flex' }}
            flexDirection="column"
            h="100%"
            border={selectedContact?.isHandover ? "4px solid orange" : "none"} // Visual Cue for Handover
          >

            {selectedContact ? (
              <>
                {/* Header do Chat */}
                <Box p={3} bg={cardBg} borderBottom="1px solid" borderColor={gray50Bg}>
                    {/* Top Row: User Info & Actions */}
                    <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" mb={2} spacing={2}>
                      <HStack>
                        <IconButton
                          display={{ base: 'flex', md: 'none' }}
                          icon={<ArrowBackIcon />}
                          onClick={handleBackToList}
                          variant="ghost"
                          aria-label="Voltar"
                          mr={2}
                        />
                        <Avatar size="sm" name={selectedContact.name} src={selectedContact.avatarUrl} />
                        <Box>
                          <Text fontWeight="bold">{selectedContact.name || 'Visitante'}</Text>
                          <Text fontSize="xs" color="gray.500">
                             {selectedContact.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'}
                          </Text>
                        </Box>
                      </HStack>

                      <Stack direction={{ base: 'column', sm: 'row' }} alignItems={{ base: 'stretch', sm: 'center' }} justify={{ base: 'space-between', md: 'flex-end' }} w={{ base: 'full', md: 'auto' }} spacing={2}>
                          {/* Handover Toggle */}
                           <FormControl display='flex' alignItems='center' justifyContent={{ base: 'space-between', sm: 'flex-start' }} w={{ base: 'full', sm: 'auto' }}>
                              <FormLabel htmlFor='handover-switch' mb='0' fontSize="xs" color={selectedContact.isHandover ? "orange.500" : "gray.500"} mr={2}>
                                {selectedContact.isHandover ? "Pausado (Humano)" : "Robô Ativo"}
                              </FormLabel>
                              <Switch
                                id='handover-switch'
                                isChecked={selectedContact.isHandover}
                                onChange={toggleHandover}
                                colorScheme="orange"
                                size="sm"
                              />
                            </FormControl>

                            <HStack>
                              <Tooltip label="Informações do Cliente (CRM)">
                                <IconButton
                                    icon={<InfoIcon />}
                                    onClick={handleCrmToggle}
                                    variant={showDesktopCrm && isLargeScreen ? "solid" : "ghost"}
                                    colorScheme={showDesktopCrm && isLargeScreen ? "brand" : "gray"}
                                    aria-label="CRM"
                                    size="sm"
                                />
                              </Tooltip>

                              <Tooltip label="Limpar Histórico">
                                <Button
                                  leftIcon={<DeleteIcon />}
                                  size="sm"
                                  colorScheme="red"
                                  variant="ghost"
                                  onClick={handleClearHistory}
                                >
                                  Limpar
                                </Button>
                              </Tooltip>
                            </HStack>
                      </Stack>
                    </Stack>
                </Box>

                {/* Área de Mensagens */}
                <Box flex="1" p={4} overflowY="auto" bg={chatBg}>
                  <VStack spacing={3} align="stretch">
                    {messages.map((msg, index) => {
                       const isMe = msg.role === 'bot' || msg.role === 'system' || msg.role === 'agent';

                       return (
                         <HStack key={index} justify={isMe ? 'flex-end' : 'flex-start'} align="flex-start">
                           {!isMe && <Avatar size="xs" name={selectedContact.name} mr={2} mt={1} />}
                           <Box
                             bg={isMe ? myMsgBg : otherMsgBg}
                             color={isMe ? myMsgColor : otherMsgColor}
                             px={4} py={2}
                             borderRadius="lg"
                             boxShadow="sm"
                             maxW="70%"
                             borderTopLeftRadius={!isMe ? 0 : 'lg'}
                             borderTopRightRadius={isMe ? 0 : 'lg'}
                           >
                             <Text fontSize="sm" whiteSpace="pre-wrap">{msg.content}</Text>
                             <Text fontSize="10px" color="gray.500" textAlign="right" mt={1}>
                               {formatTime(msg.timestamp)}
                             </Text>
                           </Box>
                         </HStack>
                       );
                    })}
                    <div ref={messagesEndRef} />
                  </VStack>
                </Box>

                {/* Input Area */}
                <Box p={4} bg={cardBg} borderTop="1px solid" borderColor={gray50Bg}>
                    {/* Status Banners */}
                    {selectedContact.isHandover ? (
                       <Alert status="success" variant="subtle" size="sm" borderRadius="md" mb={3} bg="green.100" color="green.800">
                          <Icon as={FaUser} mr={2} />
                          🤖 Robô Pausado. Você está no controle da conversa.
                       </Alert>
                    ) : (
                       <Alert status="info" variant="subtle" size="sm" borderRadius="md" mb={3}>
                          <Icon as={FaRobot} mr={2} />
                          IA Ativa. Monitorando conversa...
                       </Alert>
                    )}

                    {/* Actual Input Field */}
                    <HStack>
                        <Input
                            ref={inputRef}
                            placeholder="Digite sua resposta..."
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            isDisabled={isSending}
                            bg={inputBg}
                            size={{ base: 'lg', md: 'md' }}
                            autoFocus
                        />
                        <IconButton
                            icon={<Icon as={IoMdSend} />}
                            colorScheme="brand"
                            onClick={handleSendMessage}
                            isLoading={isSending}
                            aria-label="Enviar"
                            size={{ base: 'lg', md: 'md' }}
                        />
                    </HStack>
                </Box>
              </>
            ) : (
              <VStack justify="center" h="100%" spacing={4}>
                 <Icon as={ChatIcon} boxSize={12} color="gray.300" />
                 <Text color="gray.500">Selecione uma conversa para iniciar o atendimento.</Text>
              </VStack>
            )}

          </Box>

          {/* LADO DIREITO: CRM SIDEBAR (DESKTOP) */}
          {selectedContact && showDesktopCrm && (
              <Box
                  display={{ base: 'none', lg: 'block' }}
                  h="100%"
              >
                  <CrmSidebar
                      contact={selectedContact}
                      onUpdate={updateContact}
                      availableTags={state.businessConfig?.availableTags || []}
                      onAddTag={handleAddTag}
                      onRemoveTag={handleRemoveTag}
                      onClose={() => setShowDesktopCrm(false)}
                  />
              </Box>
          )}

        </Stack>
      </Card>

      {/* Modal de Instalação */}
      <Modal isOpen={isEmbedOpen} onClose={onEmbedClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Instalar Widget no Site</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>Copie o código abaixo e cole no HTML do seu site (antes de fechar a tag `&lt;/body&gt;`):</Text>
            <Box bg="gray.900" p={4} borderRadius="md" color="green.300" overflowX="auto">
               <Code display="block" whiteSpace="pre" bg="transparent" color="inherit">
                  {getEmbedCode()}
               </Code>
            </Box>
          </ModalBody>
          <ModalFooter>
             <Button colorScheme="blue" onClick={() => { navigator.clipboard.writeText(getEmbedCode()); onEmbedClose(); }}>
                Copiar Código
             </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Drawer: CRM (MOBILE) */}
      <Drawer isOpen={isCrmOpen} placement="right" onClose={onCrmClose} size="sm">
        <DrawerOverlay />
        <DrawerContent>
            <DrawerCloseButton />
            <DrawerBody p={0}>
                 {selectedContact && (
                    <CrmSidebar
                        contact={selectedContact}
                        onUpdate={(data) => { updateContact(data); }}
                        availableTags={state.businessConfig?.availableTags || []}
                        onAddTag={handleAddTag}
                        onRemoveTag={handleRemoveTag}
                        onClose={onCrmClose}
                    />
                )}
            </DrawerBody>
        </DrawerContent>
      </Drawer>

    </Box>
  );
};

export default LiveChatTab;
