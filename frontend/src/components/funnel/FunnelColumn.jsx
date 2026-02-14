import React, { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Box, Text, Flex, Badge, useColorModeValue, IconButton, HStack, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Textarea, Button, useDisclosure } from '@chakra-ui/react';
import { GiBrain } from "react-icons/gi";
import FunnelCard from './FunnelCard';

const FunnelColumn = ({ step, contacts, droppableId, onUpdateStep }) => {
  // --- HOOKS (Sempre no topo) ---
  const bg = useColorModeValue('gray.200', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [promptText, setPromptText] = useState(step.prompt || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSavePrompt = async () => {
      setIsSaving(true);
      if (onUpdateStep) {
          await onUpdateStep(step.tag, { prompt: promptText });
      }
      setIsSaving(false);
      onClose();
  };

  // CORREÇÃO: Definimos a cor do "arrastar" aqui fora, no nível raiz do componente
  const draggingBg = useColorModeValue('blue.50', 'whiteAlpha.100');

  // Lógica de Totais
  const totalValue = contacts.reduce((sum, c) => sum + (c.dealValue || 0), 0);
  const formattedTotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact'
  }).format(totalValue);

  return (
    <>
      <Box
        minW={{ base: '100%', md: '300px' }}
        w={{ base: '100%', md: '300px' }}
        h={{ base: 'auto', md: 'full' }}
        bg={bg}
        borderRadius="lg"
        border="1px solid"
        borderColor={borderColor}
        display="flex"
        flexDirection="column"
        mr={{ base: 0, md: 4 }}
        mb={{ base: 4, md: 0 }}
        flexShrink={0}
      >
        {/* Header */}
        <Box p={4} borderBottom="1px solid" borderColor={borderColor}>
          <Flex justify="space-between" align="center" mb={1}>
            <HStack>
                <Text fontWeight="bold" fontSize="md" color={step.color || 'gray.700'}>
                  {step.label}
                </Text>
                {/* BRAIN BUTTON */}
                <IconButton
                    size="lg"
                    icon={<GiBrain  />}
                    aria-label="Configurar IA da Etapa"
                    colorScheme={step.prompt ? "purple" : "gray"}
                    variant="ghost"
                    onClick={() => {
                        setPromptText(step.prompt || '');
                        onOpen();
                    }}
                />
            </HStack>
            <Badge colorScheme="gray" borderRadius="full">{contacts.length}</Badge>
          </Flex>
          <Text fontSize="xs" color="gray.500" fontWeight="bold">
            Total: {formattedTotal}
          </Text>
        </Box>

        {/* Droppable Area */}
        <Droppable droppableId={droppableId}>
          {(provided, snapshot) => (
            <Box
              ref={provided.innerRef}
              {...provided.droppableProps}
              flex="1"
              p={2}
              overflowY="auto"
              // CORREÇÃO: Usamos a variável 'draggingBg' aqui, sem chamar o Hook
              bg={snapshot.isDraggingOver ? draggingBg : 'transparent'}
              transition="background-color 0.2s"
            >
              {contacts.map((contact, index) => (
                <FunnelCard key={contact._id} contact={contact} index={index} />
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </Box>

      {/* PROMPT EDIT MODAL */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
            <ModalHeader>Cérebro da Etapa: {step.label}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
                <Text fontSize="sm" color="gray.500" mb={2}>
                    Como a IA deve se comportar com clientes nesta etapa?
                </Text>
                <Textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Ex: Nesta fase, o cliente já recebeu o preço. Foque em quebrar objeções e oferecer agendamento..."
                    rows={6}
                />
            </ModalBody>
            <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
                <Button colorScheme="purple" onClick={handleSavePrompt} isLoading={isSaving}>
                    Salvar Instrução
                </Button>
            </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default React.memo(FunnelColumn);
