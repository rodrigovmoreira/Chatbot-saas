import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Card, CardBody, Heading, Text, VStack, HStack, Badge,
  Table, Thead, Tbody, Tr, Th, Td, IconButton, useDisclosure,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  FormControl, FormLabel, Input, Select, Textarea, useToast, NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper, Checkbox, SimpleGrid
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon, TimeIcon } from '@chakra-ui/icons';
import { useApp } from '../../context/AppContext';
// Using direct axios for this specific module as it is not fully integrated into standard services yet,
// but auth headers are handled carefully.
import axios from 'axios';
import { Menu, MenuButton, MenuList, MenuItem, Checkbox as ChakraCheckbox } from '@chakra-ui/react';
import { ChevronDownIcon, SmallCloseIcon } from '@chakra-ui/icons';

const CampaignTab = () => {
  const { state } = useApp(); // Access global state for availableTags
  const [campaigns, setCampaigns] = useState([]);
  const [currentCampaign, setCurrentCampaign] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const DAYS_OF_WEEK = [
      { label: 'Dom', value: 0 },
      { label: 'Seg', value: 1 },
      { label: 'Ter', value: 2 },
      { label: 'Qua', value: 3 },
      { label: 'Qui', value: 4 },
      { label: 'Sex', value: 5 },
      { label: 'Sab', value: 6 }
  ];

  const loadCampaigns = useCallback(async () => {
      try {
          const token = localStorage.getItem('token');
          const { data } = await axios.get(`${API_URL}/api/campaigns`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          setCampaigns(data);
      } catch (error) {
          toast({ title: 'Erro ao carregar campanhas', status: 'error' });
      }
  }, [API_URL, toast]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
          ...currentCampaign,
          // Ensure targetTags is array (it should already be array with new UI, but keeping safeguard)
          targetTags: Array.isArray(currentCampaign.targetTags)
            ? currentCampaign.targetTags
            : (typeof currentCampaign.targetTags === 'string'
                ? currentCampaign.targetTags.split(',').map(t => t.trim()).filter(Boolean)
                : [])
      };

      if (currentCampaign._id) {
        await axios.put(`${API_URL}/api/campaigns/${currentCampaign._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast({ title: 'Campanha atualizada!', status: 'success' });
      } else {
        await axios.post(`${API_URL}/api/campaigns`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast({ title: 'Campanha criada!', status: 'success' });
      }
      onClose();
      loadCampaigns();
    } catch (error) {
      toast({ title: 'Erro ao salvar', status: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir campanha?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadCampaigns();
      toast({ title: 'Removido', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao excluir', status: 'error' });
    }
  };

  const toggleDay = (dayValue) => {
      const currentDays = currentCampaign?.schedule?.days || [];
      const newDays = currentDays.includes(dayValue)
          ? currentDays.filter(d => d !== dayValue)
          : [...currentDays, dayValue];

      setCurrentCampaign({
          ...currentCampaign,
          schedule: { ...currentCampaign.schedule, days: newDays }
      });
  };

  const openModal = (campaign = null) => {
    if (campaign) {
      setCurrentCampaign({
          ...campaign,
          // Ensure targetTags is an array for the state
          targetTags: Array.isArray(campaign.targetTags) ? campaign.targetTags : []
      });
    } else {
      setCurrentCampaign({
        name: '',
        type: 'broadcast',
        targetTags: [], // Initialize as empty array
        message: '',
        isActive: true,
        schedule: { frequency: 'once', time: '09:00', days: [] },
        delayRange: { min: 5, max: 15 }
      });
    }
    onOpen();
  };

  const toggleTag = (tag) => {
      const currentTags = Array.isArray(currentCampaign.targetTags) ? currentCampaign.targetTags : [];
      const newTags = currentTags.includes(tag)
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag];

      setCurrentCampaign({ ...currentCampaign, targetTags: newTags });
  };

  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <Heading size="md">Automação & Funis</Heading>
        <Button leftIcon={<AddIcon />} colorScheme="brand" onClick={() => openModal()}>
          Nova Campanha
        </Button>
      </HStack>

      {campaigns.length === 0 ? (
        <Card>
            <CardBody>
                <Text color="gray.500">Nenhuma campanha configurada.</Text>
            </CardBody>
        </Card>
      ) : (
        <Card overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Alvo (Tags)</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {campaigns.map((c) => (
                <Tr key={c._id}>
                  <Td fontWeight="bold">{c.name}</Td>
                  <Td>
                    <Badge colorScheme={c.type === 'recurring' ? 'purple' : 'blue'}>
                      {c.type === 'recurring' ? 'Recorrente' : 'Broadcast'}
                    </Badge>
                  </Td>
                  <Td>
                    {c.targetTags && c.targetTags.length > 0 ? (
                        c.targetTags.map(t => <Badge key={t} mr={1} variant="outline">{t}</Badge>)
                    ) : <Text fontSize="xs" color="gray.400">Todos</Text>}
                  </Td>
                  <Td>
                      <Badge colorScheme={c.isActive ? 'green' : 'gray'}>
                          {c.isActive ? 'Ativo' : 'Pausado'}
                      </Badge>
                  </Td>
                  <Td>
                    <IconButton icon={<EditIcon />} size="sm" mr={2} onClick={() => openModal(c)} />
                    <IconButton icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => handleDelete(c._id)} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      )}

      {/* Modal Create/Edit */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
            <form onSubmit={handleSave}>
              <ModalHeader>{currentCampaign?._id ? 'Editar Campanha' : 'Nova Campanha'}</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                        <FormLabel>Nome da Campanha</FormLabel>
                        <Input
                            value={currentCampaign?.name || ''}
                            onChange={e => setCurrentCampaign({...currentCampaign, name: e.target.value})}
                        />
                    </FormControl>

                    <HStack>
                        <FormControl>
                            <FormLabel>Tipo</FormLabel>
                            <Select
                                value={currentCampaign?.type}
                                onChange={e => setCurrentCampaign({...currentCampaign, type: e.target.value})}
                            >
                                <option value="broadcast">Broadcast (Disparo Único)</option>
                                <option value="recurring">Recorrente (Ex: Cobrança)</option>
                            </Select>
                        </FormControl>

                        <FormControl>
                            <FormLabel>Status</FormLabel>
                            <Select
                                value={currentCampaign?.isActive ? 'true' : 'false'}
                                onChange={e => setCurrentCampaign({...currentCampaign, isActive: e.target.value === 'true'})}
                            >
                                <option value="true">Ativo</option>
                                <option value="false">Pausado</option>
                            </Select>
                        </FormControl>
                    </HStack>

                    <FormControl>
                        <FormLabel>Tags Alvo</FormLabel>
                        <Menu closeOnSelect={false}>
                            <MenuButton as={Button} rightIcon={<ChevronDownIcon />} w="100%" textAlign="left" variant="outline" fontWeight="normal">
                                {currentCampaign?.targetTags?.length > 0
                                    ? `${currentCampaign.targetTags.length} tag(s) selecionada(s)`
                                    : "Selecione as Tags"}
                            </MenuButton>
                            <MenuList maxH="200px" overflowY="auto">
                                {state.businessConfig?.availableTags?.map((tag) => (
                                    <MenuItem key={tag} onClick={() => toggleTag(tag)}>
                                        <ChakraCheckbox
                                            isChecked={currentCampaign?.targetTags?.includes(tag)}
                                            pointerEvents="none" // Pass click through to MenuItem
                                            mr={2}
                                        />
                                        {tag}
                                    </MenuItem>
                                ))}
                                {(!state.businessConfig?.availableTags || state.businessConfig.availableTags.length === 0) && (
                                    <MenuItem isDisabled>Nenhuma tag disponível.</MenuItem>
                                )}
                            </MenuList>
                        </Menu>
                        {/* Selected Tags Display */}
                        <HStack mt={2} wrap="wrap" spacing={2}>
                            {currentCampaign?.targetTags?.map(tag => (
                                <Badge key={tag} colorScheme="brand" borderRadius="full" px={2} py={1} display="flex" alignItems="center">
                                    {tag}
                                    <SmallCloseIcon
                                        ml={1}
                                        cursor="pointer"
                                        onClick={() => toggleTag(tag)}
                                        _hover={{ color: 'red.500' }}
                                    />
                                </Badge>
                            ))}
                        </HStack>
                    </FormControl>

                    <FormControl isRequired>
                        <FormLabel>Mensagem</FormLabel>
                        <Textarea
                            rows={4}
                            value={currentCampaign?.message || ''}
                            onChange={e => setCurrentCampaign({...currentCampaign, message: e.target.value})}
                        />
                    </FormControl>

                    <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md">
                        <Heading size="sm" mb={3} display="flex" alignItems="center">
                            <TimeIcon mr={2} /> Agendamento
                        </Heading>
                        <HStack alignItems="flex-start">
                            <FormControl>
                                <FormLabel>Frequência</FormLabel>
                                <Select
                                    value={currentCampaign?.schedule?.frequency}
                                    onChange={e => setCurrentCampaign({
                                        ...currentCampaign,
                                        schedule: { ...currentCampaign.schedule, frequency: e.target.value }
                                    })}
                                >
                                    <option value="once">Uma vez</option>
                                    <option value="daily">Diário</option>
                                    <option value="weekly">Semanal</option>
                                    <option value="monthly">Mensal</option>
                                </Select>
                            </FormControl>

                            <FormControl>
                                <FormLabel>Horário</FormLabel>
                                <Input
                                    type="time"
                                    value={currentCampaign?.schedule?.time}
                                    onChange={e => setCurrentCampaign({
                                        ...currentCampaign,
                                        schedule: { ...currentCampaign.schedule, time: e.target.value }
                                    })}
                                />
                            </FormControl>
                        </HStack>

                        {/* Weekly Days Selector */}
                        {currentCampaign?.schedule?.frequency === 'weekly' && (
                            <FormControl mt={3}>
                                <FormLabel fontSize="sm">Dias da Semana</FormLabel>
                                <SimpleGrid columns={4} spacing={2}>
                                    {DAYS_OF_WEEK.map(day => (
                                        <Checkbox
                                            key={day.value}
                                            isChecked={currentCampaign?.schedule?.days?.includes(day.value)}
                                            onChange={() => toggleDay(day.value)}
                                        >
                                            {day.label}
                                        </Checkbox>
                                    ))}
                                </SimpleGrid>
                            </FormControl>
                        )}
                    </Box>

                    <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md">
                        <Heading size="sm" mb={3}>Humanização (Delay)</Heading>
                        <HStack>
                            <FormControl>
                                <FormLabel>Min (Segundos)</FormLabel>
                                <NumberInput
                                    min={0}
                                    value={currentCampaign?.delayRange?.min}
                                    onChange={(str, num) => setCurrentCampaign({
                                        ...currentCampaign,
                                        delayRange: { ...currentCampaign.delayRange, min: num }
                                    })}
                                >
                                    <NumberInputField />
                                    <NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                                </NumberInput>
                            </FormControl>
                            <FormControl>
                                <FormLabel>Max (Segundos)</FormLabel>
                                <NumberInput
                                    min={0}
                                    value={currentCampaign?.delayRange?.max}
                                    onChange={(str, num) => setCurrentCampaign({
                                        ...currentCampaign,
                                        delayRange: { ...currentCampaign.delayRange, max: num }
                                    })}
                                >
                                    <NumberInputField />
                                    <NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                                </NumberInput>
                            </FormControl>
                        </HStack>
                    </Box>

                </VStack>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
                <Button colorScheme="brand" type="submit">Salvar Campanha</Button>
              </ModalFooter>
            </form>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default CampaignTab;
