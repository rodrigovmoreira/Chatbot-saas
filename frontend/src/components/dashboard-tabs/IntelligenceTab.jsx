import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack, Stack,
  useToast, Icon, useColorModeValue, FormControl, FormLabel, Input, Textarea,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, Alert, AlertIcon, Select, Divider, IconButton, Tooltip, Checkbox
} from '@chakra-ui/react';
import {
  AddIcon, EditIcon, DeleteIcon, StarIcon, TimeIcon, DownloadIcon
} from '@chakra-ui/icons';
import { useApp } from '../../context/AppContext';
import { businessAPI } from '../../services/api';

const IntelligenceTab = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();

  // Colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const orangeBg = useColorModeValue('orange.50', 'orange.900');
  const orange800 = useColorModeValue("orange.800", "orange.200");
  const orange700 = useColorModeValue("orange.700", "orange.300");
  const purpleBg = useColorModeValue('purple.50', 'purple.900');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');
  const gray800 = useColorModeValue('gray.800', 'gray.200');

  // Modals
  const { isOpen: isFollowUpModalOpen, onOpen: onFollowUpOpen, onClose: onFollowUpClose } = useDisclosure();
  const { isOpen: isSavePromptOpen, onOpen: onSavePromptOpen, onClose: onSavePromptClose } = useDisclosure();

  // Local State
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customPrompts, setCustomPrompts] = useState([]);
  const [selectedCustomPrompt, setSelectedCustomPrompt] = useState('');
  const [newPromptName, setNewPromptName] = useState('');

  const [activePrompts, setActivePrompts] = useState({
    chatSystem: '',
    visionSystem: ''
  });

  const [followUpSteps, setFollowUpSteps] = useState([]);
  const [newFollowUp, setNewFollowUp] = useState({ delayMinutes: 60, message: '', useAI: false });
  const [editingFollowUpIndex, setEditingFollowUpIndex] = useState(null);

  // Sync Global State
  useEffect(() => {
    if (state.businessConfig) {
      if (state.businessConfig.prompts) {
        setActivePrompts({
          chatSystem: state.businessConfig.prompts.chatSystem || '',
          visionSystem: state.businessConfig.prompts.visionSystem || ''
        });
      }
      setFollowUpSteps(state.businessConfig.followUpSteps || []);
    }
  }, [state.businessConfig]);

  // Fetch Data
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const res = await businessAPI.getPresets();
        setPresets(res.data);
      } catch (error) {
        console.error("Erro presets:", error);
      }
    };
    const fetchCustomPrompts = async () => {
      try { const res = await businessAPI.getCustomPrompts(); setCustomPrompts(res.data); } catch (e) { }
    };
    fetchPresets();
    fetchCustomPrompts();
  }, []);

  const fetchCustomPrompts = async () => {
      try { const res = await businessAPI.getCustomPrompts(); setCustomPrompts(res.data); } catch (e) { }
  };

  // Handlers
  const handleLoadCustomPrompt = (promptId) => {
    const selected = customPrompts.find(p => p._id === promptId);
    if (selected) {
      setActivePrompts({
        chatSystem: selected.prompts.chatSystem,
        visionSystem: selected.prompts.visionSystem
      });
      setFollowUpSteps(selected.followUpSteps || []);
      setSelectedCustomPrompt(promptId);
      setSelectedPreset('');
      toast({ title: 'Modelo carregado! Clique em "Salvar Alterações" para ativar.', status: 'info' });
    }
  };

  const handleApplyPreset = async () => {
    if (!selectedPreset) return;
    if (!window.confirm("ATENÇÃO: Isso substituirá seus PROMPTS e seu FUNIL DE VENDAS pelo modelo padrão. Continuar?")) return;

    try {
      const response = await businessAPI.applyPreset(selectedPreset);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data.config });
      setActivePrompts({
        chatSystem: response.data.config.prompts.chatSystem,
        visionSystem: response.data.config.prompts.visionSystem
      });
      setFollowUpSteps(response.data.config.followUpSteps || []);
      toast({ title: 'Personalidade aplicada!', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao aplicar modelo', status: 'error' });
    }
  };

  const handleSavePrompts = async () => {
    try {
      const orderedSteps = followUpSteps.map((step, index) => ({
        ...step,
        stage: index + 1
      }));
      const payload = {
        ...state.businessConfig,
        prompts: activePrompts,
        followUpSteps: orderedSteps
      };
      const response = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      setFollowUpSteps(orderedSteps);
      toast({ title: 'Cérebro da IA atualizado!', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao salvar prompts', status: 'error' });
    }
  };

  const handleCreateCustomPrompt = async () => {
    if (!newPromptName) return;
    try {
      await businessAPI.saveCustomPrompt({
        name: newPromptName,
        prompts: activePrompts,
        followUpSteps: followUpSteps
      });
      toast({ title: 'Modelo salvo na sua biblioteca!', status: 'success' });
      fetchCustomPrompts();
      onSavePromptClose();
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.response?.data?.message, status: 'error' });
    }
  };

  const handleDeleteCustomPrompt = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Apagar este modelo salvo?")) return;
    try {
      await businessAPI.deleteCustomPrompt(id);
      fetchCustomPrompts();
      if (selectedCustomPrompt === id) setSelectedCustomPrompt('');
      toast({ title: 'Modelo removido', status: 'success' });
    } catch (e) { }
  };

  // Follow-up Handlers
  const handleEditFollowUp = (idx) => {
    setEditingFollowUpIndex(idx);
    setNewFollowUp(followUpSteps[idx]);
    onFollowUpOpen();
  };

  const handleSaveFollowUpStep = () => {
    if (!newFollowUp.message || !newFollowUp.delayMinutes) {
      toast({ title: 'Preencha tempo e mensagem', status: 'warning' });
      return;
    }
    const updated = [...followUpSteps];
    if (editingFollowUpIndex !== null) updated[editingFollowUpIndex] = newFollowUp;
    else updated.push(newFollowUp);

    setFollowUpSteps(updated);
    setEditingFollowUpIndex(null);
    setNewFollowUp({ delayMinutes: 60, message: '', useAI: false });
    onFollowUpClose();
  };

  const handleRemoveFollowUp = (idx) => setFollowUpSteps(followUpSteps.filter((_, i) => i !== idx));

  const handleSaveFollowUps = async () => {
    try {
      const orderedSteps = followUpSteps.map((step, index) => ({
        ...step,
        stage: index + 1
      }));
      const payload = { ...state.businessConfig, followUpSteps: orderedSteps };
      const res = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: res.data });
      setFollowUpSteps(orderedSteps);
      toast({ title: 'Recuperação de Inatividade salva!', status: 'success' });
    } catch (e) { toast({ title: 'Erro ao salvar configuração', status: 'error' }); }
  };

  return (
    <Box>
      <VStack spacing={6} align="stretch">

        {/* 1. SELEÇÃO DE PRESET DO SISTEMA */}
        <Card bg={cardBg} boxShadow="sm" borderLeft="4px solid" borderColor="blue.500">
          <CardBody>
            <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align="center" spacing={4}>
              <Box>
                <Heading size="sm" mb={1}>Modelos Padrão (Sistema)</Heading>
                <Text fontSize="sm" color="gray.600">Use um modelo pronto da plataforma.</Text>
              </Box>
              <Stack direction={{ base: 'column', md: 'row' }} spacing={4} w={{ base: 'full', md: 'auto' }}>
                <Select placeholder="Selecione..." bg={gray50Bg} onChange={(e) => setSelectedPreset(e.target.value)} value={selectedPreset} size={{ base: 'lg', md: 'md' }} w={{ base: 'full', md: '300px' }}>
                  {presets.map(p => (<option key={p.key} value={p.key}>{p.icon} {p.name}</option>))}
                </Select>
                <Button colorScheme="blue" onClick={handleApplyPreset} isDisabled={!selectedPreset} leftIcon={<StarIcon />} width={{ base: 'full', md: 'auto' }} size={{ base: 'lg', md: 'md' }}>Aplicar</Button>
              </Stack>
            </Stack>
          </CardBody>
        </Card>

        {/* 2. MEUS MODELOS SALVOS */}
        <Card bg={orangeBg} boxShadow="sm" borderLeft="4px solid" borderColor="orange.400">
          <CardBody>
            <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align="center" spacing={4}>
              <Box>
                <Heading size="sm" mb={1} color={orange800}>Meus Modelos Pessoais</Heading>
                <Text fontSize="sm" color={orange700}>Carregue suas edições salvas anteriormente.</Text>
              </Box>
              <Stack direction={{ base: 'column', md: 'row' }} spacing={4} w={{ base: 'full', md: 'auto' }}>
                <Select
                  placeholder="Carregar meus prompts..."
                  bg={cardBg}
                  onChange={(e) => handleLoadCustomPrompt(e.target.value)}
                  value={selectedCustomPrompt}
                  size={{ base: 'lg', md: 'md' }}
                  w={{ base: 'full', md: '300px' }}
                >
                  {customPrompts.map(p => (
                    <option key={p._id} value={p._id}>📄 {p.name}</option>
                  ))}
                </Select>
                {selectedCustomPrompt && (
                  <IconButton
                    icon={<DeleteIcon />}
                    colorScheme="red"
                    variant="ghost"
                    onClick={(e) => handleDeleteCustomPrompt(selectedCustomPrompt, e)}
                    aria-label="Deletar"
                  />
                )}
              </Stack>
            </Stack>
          </CardBody>
        </Card>

        <Divider />

        {/* 3. EDITORES DE TEXTO (CHAT E VISÃO) */}
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
          <Card bg={cardBg} boxShadow="sm">
            <CardHeader pb={0}><Heading size="sm">🧠 Personalidade (Chat)</Heading></CardHeader>
            <CardBody>
              <Textarea
                value={activePrompts.chatSystem}
                onChange={(e) => setActivePrompts({ ...activePrompts, chatSystem: e.target.value })}
                rows={10}
                bg={gray50Bg}
                fontSize="sm"
                placeholder="Instruções para o chat..."
              />
            </CardBody>
          </Card>
          <Card bg={cardBg} boxShadow="sm">
            <CardHeader pb={0}><Heading size="sm">👁️ Visão (Imagem)</Heading></CardHeader>
            <CardBody>
              <Textarea
                value={activePrompts.visionSystem}
                onChange={(e) => setActivePrompts({ ...activePrompts, visionSystem: e.target.value })}
                rows={10}
                bg={gray50Bg}
                fontSize="sm"
                placeholder="Instruções para análise de imagem..."
              />
            </CardBody>
          </Card>
        </Grid>

        <Stack direction={{ base: 'column', md: 'row' }} spacing={4} width="100%">
          <Button
            colorScheme="green"
            size="lg"
            onClick={handleSavePrompts}
            flex="2"
            boxShadow="md"
            width="100%"
            whiteSpace="normal"
            height="auto"
            py={4}
          >
            Salvar Alterações nos Prompts (Ativar)
          </Button>

          <Button
            colorScheme="orange"
            variant="outline"
            size="lg"
            onClick={() => { setNewPromptName(''); onSavePromptOpen(); }}
            flex="1"
            leftIcon={<DownloadIcon />}
            width="100%"
            whiteSpace="normal"
            height="auto"
            py={4}
          >
            Salvar como Meu Modelo
          </Button>
        </Stack>

        <Divider />

        {/* 4. RECUPERAÇÃO DE INATIVIDADE (Formerly Funnel) */}
        <Box>
          <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" mb={4}>
            <Box>
              <Heading size="md">Recuperação de Inatividade</Heading>
              <Text fontSize="sm" color="gray.500">Mensagens automáticas para recuperar clientes que pararam de responder.</Text>
            </Box>
            <Button leftIcon={<AddIcon />} colorScheme="purple" onClick={() => { setEditingFollowUpIndex(null); setNewFollowUp({ delayMinutes: 60, message: '', useAI: false }); onFollowUpOpen(); }}>
              Novo Passo
            </Button>
          </Stack>

          <VStack spacing={4} align="stretch">
            {followUpSteps.map((step, idx) => (
              <Card key={idx} variant="outline" borderColor="purple.200" bg={purpleBg}>
                <CardBody>
                  <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align="start">
                    <Stack direction={{ base: 'column', md: 'row' }} align="start" spacing={4}>
                      <VStack
                        bg="purple.500" color="white" borderRadius="full" boxSize="40px"
                        justify="center" align="center" fontWeight="bold" flexShrink={0}
                      >
                        <Text>{idx + 1}</Text>
                      </VStack>
                      <Box>
                        <HStack mb={1}>
                          <Icon as={TimeIcon} color="gray.500" />
                          <Text fontWeight="bold" fontSize="sm">
                            Após {step.delayMinutes >= 60 ? `${(step.delayMinutes / 60).toFixed(1)} horas` : `${step.delayMinutes} minutos`} de silêncio
                          </Text>
                          {step.useAI && <Icon as={StarIcon} color="orange.400" />}
                        </HStack>
                        <Text fontSize="md" color={gray800} fontStyle={step.useAI ? 'italic' : 'normal'}>
                           {step.useAI ? `[Diretriz IA]: ${step.message}` : `"${step.message}"`}
                        </Text>
                      </Box>
                    </Stack>
                    <HStack>
                      <Tooltip label="Editar passo">
                        <IconButton icon={<EditIcon />} aria-label="Editar passo" size="sm" variant="ghost" colorScheme="blue" onClick={() => handleEditFollowUp(idx)} />
                      </Tooltip>
                      <Tooltip label="Excluir passo">
                        <IconButton icon={<DeleteIcon />} aria-label="Excluir passo" size="sm" variant="ghost" colorScheme="red" onClick={() => handleRemoveFollowUp(idx)} />
                      </Tooltip>
                    </HStack>
                  </Stack>
                </CardBody>
              </Card>
            ))}
            {followUpSteps.length === 0 && (
              <Alert status="warning" borderRadius="md"><AlertIcon />Seu funil está vazio. O bot não cobrará clientes inativos.</Alert>
            )}
          </VStack>

          {followUpSteps.length > 0 && (
            <Box mt={4} textAlign="right">
              <Button colorScheme="purple" variant="outline" onClick={handleSaveFollowUps}>Salvar Recuperação</Button>
            </Box>
          )}
        </Box>

      </VStack>

      {/* Modal Follow-up */}
      <Modal isOpen={isFollowUpModalOpen} onClose={onFollowUpClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingFollowUpIndex !== null ? 'Editar Passo' : 'Novo Passo'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Tempo de Espera (em Minutos)</FormLabel>
                <HStack>
                  <Input type="number" value={newFollowUp.delayMinutes} onChange={e => setNewFollowUp({ ...newFollowUp, delayMinutes: parseInt(e.target.value) })} size={{ base: 'lg', md: 'md' }} />
                  <Text fontSize="sm" color="gray.500">minutos</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400">Ex: 60 = 1 hora; 1440 = 24 horas.</Text>
              </FormControl>

              <FormControl display='flex' alignItems='center'>
                  <Checkbox
                     isChecked={newFollowUp.useAI}
                     onChange={(e) => setNewFollowUp({...newFollowUp, useAI: e.target.checked})}
                     colorScheme="orange"
                     mr={2}
                  />
                  <FormLabel mb='0' fontSize="sm">
                    Usar IA para gerar mensagem?
                  </FormLabel>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>
                    {newFollowUp.useAI ? "Diretrizes para a IA" : "Mensagem Exata"}
                </FormLabel>
                <Textarea
                    placeholder={newFollowUp.useAI ? "Ex: Cobre a resposta de forma educada e sugira uma ligação." : "Ex: E aí, ainda tem interesse?"}
                    value={newFollowUp.message}
                    onChange={e => setNewFollowUp({ ...newFollowUp, message: e.target.value })}
                    rows={4}
                    size={{ base: 'lg', md: 'md' }}
                />
                {newFollowUp.useAI && <Text fontSize="xs" color="orange.500">A IA gerará a mensagem real com base na conversa anterior e nesta diretriz.</Text>}
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onFollowUpClose}>Cancelar</Button>
            <Button colorScheme="purple" onClick={handleSaveFollowUpStep}>Salvar Passo</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Salvar Custom Prompt */}
      <Modal isOpen={isSavePromptOpen} onClose={onSavePromptClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Salvar como Meu Modelo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text fontSize="sm" color="gray.600">Dê um nome para salvar a configuração atual de prompts na sua biblioteca pessoal.</Text>
              <FormControl isRequired>
                <FormLabel>Nome do Modelo</FormLabel>
                <Input placeholder="Ex: Tatuador Agressivo v2" value={newPromptName} onChange={e => setNewPromptName(e.target.value)} size={{ base: 'lg', md: 'md' }} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onSavePromptClose}>Cancelar</Button>
            <Button colorScheme="orange" onClick={handleCreateCustomPrompt}>Salvar na Biblioteca</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default IntelligenceTab;
