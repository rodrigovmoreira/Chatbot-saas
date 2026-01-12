import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, Heading, Text, Button, VStack, HStack, Stack,
  useColorModeValue, Alert, Icon,
  Avatar, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalCloseButton, ModalBody, ModalFooter, useDisclosure, Code, IconButton, Tooltip, useToast,
  Badge, Input, Switch, FormControl, FormLabel,
  Popover, PopoverTrigger, PopoverContent, PopoverBody, PopoverHeader, PopoverArrow, PopoverCloseButton,
  List, ListItem
} from '@chakra-ui/react';
import { ChatIcon, LinkIcon, DeleteIcon, ArrowBackIcon, AddIcon, SmallCloseIcon } from '@chakra-ui/icons';
import { FaWhatsapp, FaGlobe, FaRobot, FaUser } from 'react-icons/fa';
import { businessAPI } from '../../services/api'; // Ensure this service has updateContact method
import { useApp } from '../../context/AppContext';
import axios from 'axios'; // For direct call if needed, but better via service

const LiveChatTab = () => {
  const { state, dispatch } = useApp();
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);

  // Tag Input State
  const [newTag, setNewTag] = useState('');
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);

  // Mobile View State
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Modal de Embed
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');
  const gray100 = useColorModeValue("gray.100", "gray.900");

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

        return response.data;
    } catch (error) {
        console.error("Error updating contact:", error);
        toast({ title: "Erro ao atualizar contato.", status: "error", duration: 3000 });
        throw error;
    }
  };

  // Adiciona tag ao contato. Se a tag não existir em availableTags, pergunta se quer criar.
  // Como o usuário pediu para "LiveChat tbm deve aparecer uma lista para seleção das tags existentes ou criar uma nova tag que salva no banco",
  // Vamos implementar lógica para salvar no banco se não existir.
  const handleAddTag = async (tagToAdd = null) => {
    const tag = tagToAdd || newTag.trim();
    if (!tag) return;

    const currentTags = selectedContact.tags || [];
    if (currentTags.includes(tag)) {
        setNewTag('');
        setIsTagPopoverOpen(false);
        return;
    }

    // Verifica se tag existe em availableTags
    const availableTags = state.businessConfig?.availableTags || [];
    if (!availableTags.includes(tag)) {
       // Se não existe, adiciona ao BusinessConfig primeiro
       try {
           const newAvailableTags = [...availableTags, tag];
           // Atualiza config no backend
           await businessAPI.updateConfig({ availableTags: newAvailableTags });

           // Update global context immediately for UX
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
    setNewTag('');
    setIsTagPopoverOpen(false);
  };

  const handleRemoveTag = async (tagToRemove) => {
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

    const fetchMessages = async () => {
      try {
        const { data } = await businessAPI.getMessages(selectedContact._id);
        setMessages(data);
        scrollToBottom();
      } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
      }
    };

    fetchMessages();
    // Polling de mensagens a cada 5s
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedContact]);

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
      <Stack direction={{ base: 'column', md: 'row' }} mb={4} justify="space-between" spacing={2}>
        <Text fontSize="xs" color="gray.400">Debug ID: {state.businessConfig?._id || 'N/A'}</Text>
        <Button leftIcon={<LinkIcon />} size="sm" onClick={onOpen} colorScheme="brand">
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
                  <Text fontSize="xs" color="gray.500" noOfLines={1}>
                    {contact.phone || contact.sessionId}
                  </Text>
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

                          <Tooltip label="Limpar Histórico">
                            <Button
                              leftIcon={<DeleteIcon />}
                              size="sm"
                              colorScheme="red"
                              variant="ghost"
                              onClick={handleClearHistory}
                              w={{ base: 'full', sm: 'auto' }}
                            >
                              Limpar
                            </Button>
                          </Tooltip>
                      </Stack>
                    </Stack>

                    {/* Bottom Row: Tags */}
                    <HStack spacing={2} overflowX="auto" pb={1} alignItems="center">
                        <Text fontSize="xs" color="gray.500">Tags:</Text>
                        {selectedContact.tags && selectedContact.tags.map(tag => (
                            <Badge key={tag} colorScheme={getTagColor(tag)} borderRadius="full" px={2} cursor="default">
                                {tag}
                                <Icon as={SmallCloseIcon} ml={1} cursor="pointer" onClick={() => handleRemoveTag(tag)} />
                            </Badge>
                        ))}

                        <Popover
                            isOpen={isTagPopoverOpen}
                            onClose={() => setIsTagPopoverOpen(false)}
                            placement="bottom-start"
                        >
                            <PopoverTrigger>
                                <Button
                                    size="xs"
                                    leftIcon={<AddIcon />}
                                    onClick={() => setIsTagPopoverOpen(!isTagPopoverOpen)}
                                    colorScheme="gray"
                                    variant="outline"
                                >
                                    Tag
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent w="200px">
                                <PopoverHeader fontSize="sm" fontWeight="bold">Adicionar Tag</PopoverHeader>
                                <PopoverArrow />
                                <PopoverCloseButton />
                                <PopoverBody p={2}>
                                    <Input
                                        size="sm"
                                        placeholder="Busca ou Nova Tag"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        mb={2}
                                    />
                                    <List spacing={1} maxH="150px" overflowY="auto">
                                        {/* Filter available tags based on input and exclude already assigned tags */}
                                        {(state.businessConfig?.availableTags || [])
                                            .filter(t =>
                                                t.toLowerCase().includes(newTag.toLowerCase()) &&
                                                !selectedContact.tags?.includes(t)
                                            )
                                            .map(tag => (
                                                <ListItem
                                                    key={tag}
                                                    px={2} py={1}
                                                    _hover={{ bg: "gray.100", cursor: "pointer" }}
                                                    onClick={() => handleAddTag(tag)}
                                                    borderRadius="md"
                                                    fontSize="sm"
                                                >
                                                    {tag}
                                                </ListItem>
                                            ))
                                        }
                                        {/* Option to create new tag if it doesn't exist */}
                                        {newTag &&
                                         !(state.businessConfig?.availableTags || []).some(t => t.toLowerCase() === newTag.toLowerCase()) &&
                                         !selectedContact.tags?.includes(newTag) && (
                                            <ListItem
                                                px={2} py={1}
                                                color="brand.500"
                                                fontWeight="bold"
                                                cursor="pointer"
                                                _hover={{ bg: "brand.50" }}
                                                onClick={() => handleAddTag()}
                                                borderRadius="md"
                                                fontSize="sm"
                                            >
                                                + Criar "{newTag}"
                                            </ListItem>
                                        )}
                                    </List>
                                </PopoverBody>
                            </PopoverContent>
                        </Popover>

                    </HStack>
                </Box>

                {/* Área de Mensagens */}
                <Box flex="1" p={4} overflowY="auto" bgImage="linear-gradient(to bottom, #f0f2f5, #e1e5ea)">
                  <VStack spacing={3} align="stretch">
                    {messages.map((msg, index) => {
                       const isMe = msg.role === 'bot' || msg.role === 'system';

                       return (
                         <HStack key={index} justify={isMe ? 'flex-end' : 'flex-start'} align="flex-start">
                           {!isMe && <Avatar size="xs" name={selectedContact.name} mr={2} mt={1} />}
                           <Box
                             bg={isMe ? 'brand.100' : 'white'}
                             color="black"
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

                {/* Input Area (Visual Only for now) */}
                <Box p={4} bg={cardBg} borderTop="1px solid" borderColor={gray50Bg}>
                    {selectedContact.isHandover ? (
                       <Alert status="warning" size="sm" borderRadius="md">
                          <Icon as={FaUser} mr={2} />
                          Robô pausado. Responda pelo seu celular ou app do WhatsApp.
                       </Alert>
                    ) : (
                       <Alert status="info" size="sm" borderRadius="md">
                          <Icon as={FaRobot} mr={2} />
                          IA Ativa. Monitorando conversa...
                       </Alert>
                    )}
                </Box>
              </>
            ) : (
              <VStack justify="center" h="100%" spacing={4}>
                 <Icon as={ChatIcon} boxSize={12} color="gray.300" />
                 <Text color="gray.500">Selecione uma conversa para iniciar o atendimento.</Text>
              </VStack>
            )}

          </Box>

        </Stack>
      </Card>

      {/* Modal de Instalação */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
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
             <Button colorScheme="blue" onClick={() => { navigator.clipboard.writeText(getEmbedCode()); onClose(); }}>
                Copiar Código
             </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default LiveChatTab;
