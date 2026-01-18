import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Checkbox,
  VStack,
  HStack,
  Stack,
  Text,
  Box,
  IconButton,
  Badge,
  useToast
} from '@chakra-ui/react';
import { ChevronUpIcon, ChevronDownIcon, CheckIcon } from '@chakra-ui/icons';

const FunnelConfigModal = ({ isOpen, onClose, availableTags = [], initialSteps = [], onSave }) => {
  const [selectedSteps, setSelectedSteps] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  // Load initial steps when modal opens or initialSteps changes
  useEffect(() => {
    if (isOpen) {
      const formattedSteps = initialSteps
        .sort((a, b) => a.order - b.order)
        .map(s => ({
          tag: s.tag,
          label: s.label || s.tag,
          color: s.color || 'gray.500',
          order: s.order
        }));
      setSelectedSteps(formattedSteps);
    }
  }, [isOpen, initialSteps]);

  const handleToggleTag = (tag) => {
    const exists = selectedSteps.find(s => s.tag === tag);
    if (exists) {
      // Remove
      setSelectedSteps(prev => prev.filter(s => s.tag !== tag));
    } else {
      // Add
      setSelectedSteps(prev => [
        ...prev,
        {
          tag: tag,
          label: tag,
          color: 'blue.500', // Default color
          order: prev.length
        }
      ]);
    }
  };

  const moveStep = (index, direction) => {
    const newSteps = [...selectedSteps];
    if (direction === 'up' && index > 0) {
      [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]];
    } else if (direction === 'down' && index < newSteps.length - 1) {
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    }
    setSelectedSteps(newSteps);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Re-assign order based on index
      const payload = selectedSteps.map((step, index) => ({
        ...step,
        order: index
      }));
      await onSave(payload);
      toast({ title: 'Funil salvo com sucesso!', status: 'success' });
      onClose();
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao salvar funil', status: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Configurar Funil de Vendas (Kanban)</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack direction={{ base: 'column', md: 'row' }} align="start" spacing={8}>
            {/* Left Column: Available Tags */}
            <Box flex={1} borderRight={{ base: 'none', md: '1px' }} borderBottom={{ base: '1px', md: 'none' }} borderColor="gray.200" pr={{ base: 0, md: 4 }} pb={{ base: 4, md: 0 }} w="full">
              <Text fontWeight="bold" mb={4}>1. Selecione as Tags</Text>
              <Text fontSize="sm" color="gray.500" mb={4}>
                Escolha quais tags do sistema representarão colunas no seu funil.
              </Text>
              <VStack align="stretch" maxH="400px" overflowY="auto">
                {availableTags.length === 0 ? (
                  <Text fontStyle="italic">Nenhuma tag disponível.</Text>
                ) : (
                  availableTags.map(tag => (
                    <Checkbox
                      key={tag}
                      isChecked={!!selectedSteps.find(s => s.tag === tag)}
                      onChange={() => handleToggleTag(tag)}
                      colorScheme="brand"
                    >
                      {tag}
                    </Checkbox>
                  ))
                )}
              </VStack>
            </Box>

            {/* Right Column: Order */}
            <Box flex={1} w="full">
              <Text fontWeight="bold" mb={4}>2. Ordene as Colunas</Text>
              <Text fontSize="sm" color="gray.500" mb={4}>
                Defina a ordem da esquerda para a direita.
              </Text>
              <VStack align="stretch" spacing={2} maxH="400px" overflowY="auto">
                {selectedSteps.length === 0 ? (
                  <Text color="gray.400" fontSize="sm">Selecione tags ao lado para começar.</Text>
                ) : (
                  selectedSteps.map((step, index) => (
                    <HStack
                      key={step.tag}
                      p={2}
                      bg="gray.50"
                      borderRadius="md"
                      justify="space-between"
                      border="1px solid"
                      borderColor="gray.200"
                    >
                      <HStack>
                        <Badge colorScheme="blue" borderRadius="full" px={2}>{index + 1}</Badge>
                        <Text fontWeight="medium">{step.label}</Text>
                      </HStack>
                      <HStack>
                        <IconButton
                          size="sm"
                          icon={<ChevronUpIcon />}
                          isDisabled={index === 0}
                          onClick={() => moveStep(index, 'up')}
                          aria-label="Mover para cima"
                        />
                        <IconButton
                          size="sm"
                          icon={<ChevronDownIcon />}
                          isDisabled={index === selectedSteps.length - 1}
                          onClick={() => moveStep(index, 'down')}
                          aria-label="Mover para baixo"
                        />
                      </HStack>
                    </HStack>
                  ))
                )}
              </VStack>
            </Box>
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
          <Button colorScheme="brand" onClick={handleSave} isLoading={isSaving} leftIcon={<CheckIcon />}>
            Salvar Configuração
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default FunnelConfigModal;
