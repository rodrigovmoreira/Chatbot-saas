import React, { useState } from 'react';
import { Box, Button, Center, Heading, Text, VStack, useDisclosure, useToast } from '@chakra-ui/react';
import { SettingsIcon } from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { businessAPI } from '../services/api';
import FunnelConfigModal from '../components/funnel/FunnelConfigModal';

const SalesFunnel = () => {
  const { state, dispatch } = useApp();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const businessConfig = state.businessConfig || {};
  const funnelSteps = businessConfig.funnelSteps || [];
  const availableTags = businessConfig.availableTags || [];

  const handleSaveConfig = async (newSteps) => {
    try {
      const { data } = await businessAPI.updateConfig({
        funnelSteps: newSteps
      });

      // Update Context
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: data });

      // Toast is handled in Modal, but good to have safety
    } catch (error) {
      console.error('Error saving funnel config:', error);
      throw error; // Re-throw so Modal handles loading state
    }
  };

  if (funnelSteps.length === 0) {
    return (
      <Box p={8} bg="white" borderRadius="lg" boxShadow="sm" minH="500px">
        <Center h="100%" flexDirection="column">
          <Heading size="lg" mb={4} color="gray.600">Seu Funil de Vendas está vazio</Heading>
          <Text color="gray.500" mb={8} maxW="md" textAlign="center">
             Organize seus contatos em etapas (colunas) baseadas em Tags.
             Acompanhe o progresso de "Novo Lead" até "Venda Realizada".
          </Text>
          <Button
            leftIcon={<SettingsIcon />}
            colorScheme="brand"
            size="lg"
            onClick={onOpen}
          >
            Configurar meu Funil
          </Button>
        </Center>

        <FunnelConfigModal
          isOpen={isOpen}
          onClose={onClose}
          availableTags={availableTags}
          initialSteps={funnelSteps}
          onSave={handleSaveConfig}
        />
      </Box>
    );
  }

  return (
    <Box h="calc(100vh - 100px)">
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="center">
        <Heading size="md">Funil de Vendas</Heading>
        <Button size="sm" leftIcon={<SettingsIcon />} onClick={onOpen}>
          Configurar Etapas
        </Button>
      </Box>

      {/* Placeholder for Kanban Board (Step 3.2) */}
      <Box
        p={8}
        border="2px dashed"
        borderColor="gray.200"
        borderRadius="lg"
        bg="gray.50"
        textAlign="center"
        h="full"
      >
        <Text fontSize="xl" fontWeight="bold" color="gray.500" mt={10}>
          Kanban Board Configurado!
        </Text>
        <Text mt={4}>
          Etapas: {funnelSteps.map(s => s.label).join(' -> ')}
        </Text>
      </Box>

      <FunnelConfigModal
        isOpen={isOpen}
        onClose={onClose}
        availableTags={availableTags}
        initialSteps={funnelSteps}
        onSave={handleSaveConfig}
      />
    </Box>
  );
};

export default SalesFunnel;
