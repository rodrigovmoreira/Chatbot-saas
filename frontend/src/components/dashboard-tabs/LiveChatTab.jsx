import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, Heading, Text, Button, VStack, HStack, Stack,
  useColorModeValue, Alert, Icon,
  Avatar, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalCloseButton, ModalBody, ModalFooter, useDisclosure, Code, IconButton, Tooltip, useToast
} from '@chakra-ui/react';
import { ChatIcon, WarningTwoIcon, LinkIcon, DeleteIcon } from '@chakra-ui/icons';
import { businessAPI } from '../../services/api';
import { useApp } from '../../context/AppContext';
import ConversationItem from './ConversationItem';
import MessageItem from './MessageItem';

const LiveChatTab = () => {
  const { state } = useApp();
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);

  // Modal de Embed
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');
  const gray100 = useColorModeValue("gray.100", "gray.900");

  const messagesEndRef = useRef(null);

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

  return (
    <Box>
      <HStack mb={4} justify="space-between">
        <Text fontSize="xs" color="gray.400">Debug ID: {state.businessConfig?._id || 'N/A'}</Text>
        <Button leftIcon={<LinkIcon />} size="sm" onClick={onOpen} colorScheme="brand">
          Instalar no Site
        </Button>
      </HStack>

      <Card h="75vh" overflow="hidden" border="1px solid" borderColor="gray.200">
        <Stack direction={{ base: 'column', md: 'row' }} h="100%" spacing={0} align="stretch">

          {/* LADO ESQUERDO: LISTA DE CONTATOS */}
          <Box
            w={{ base: "100%", md: "300px" }}
            h={{ base: "40%", md: "100%" }}
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
                <ConversationItem
                  key={contact._id}
                  contact={contact}
                  isSelected={selectedContact?._id === contact._id}
                  onClick={setSelectedContact}
                  cardBg={cardBg}
                  gray50Bg={gray50Bg}
                  formatTime={formatTime}
                />
              ))}
            </VStack>
          </Box>

          {/* LADO DIREITO: CHAT */}
          <Box flex="1" bg={gray100} position="relative" display="flex" flexDirection="column" h={{ base: "60%", md: "100%" }}>

            {selectedContact ? (
              <>
                {/* Header do Chat */}
                <HStack p={4} bg={cardBg} borderBottom="1px solid" borderColor={gray50Bg} justify="space-between">
                  <HStack>
                    <Avatar size="sm" name={selectedContact.name} src={selectedContact.avatarUrl} />
                    <Box>
                      <Text fontWeight="bold">{selectedContact.name || 'Visitante'}</Text>
                      <Text fontSize="xs" color="gray.500">
                         via {selectedContact.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'}
                      </Text>
                    </Box>
                  </HStack>

                  <Tooltip label="Limpar Histórico / Resetar IA">
                    <IconButton
                      icon={<DeleteIcon />}
                      size="sm"
                      colorScheme="red"
                      variant="ghost"
                      onClick={handleClearHistory}
                      aria-label="Limpar histórico"
                    />
                  </Tooltip>
                </HStack>

                {/* Área de Mensagens */}
                <Box flex="1" p={4} overflowY="auto" bgImage="linear-gradient(to bottom, #f0f2f5, #e1e5ea)">
                  <VStack spacing={3} align="stretch">
                    {messages.map((msg, index) => (
                      <MessageItem
                        key={index}
                        msg={msg}
                        selectedContactName={selectedContact.name}
                        formatTime={formatTime}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </VStack>
                </Box>

                {/* Input (Desativado por enquanto, pois é apenas visualização) */}
                <Box p={4} bg={cardBg} borderTop="1px solid" borderColor={gray50Bg}>
                   <Alert status="info" size="sm" borderRadius="md">
                      <Icon as={WarningTwoIcon} mr={2} />
                      Modo somente leitura. A intervenção humana será adicionada em breve.
                   </Alert>
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
