import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box, Grid, GridItem, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack, Stack,
  useToast, Icon, useColorModeValue, FormControl, FormLabel, Input, Textarea,
  Spinner, Divider
} from '@chakra-ui/react';
import {
  CheckCircleIcon, WarningTwoIcon, EditIcon
} from '@chakra-ui/icons';
import { useApp } from '../../context/AppContext';
import { businessAPI } from '../../services/api';

const ConnectionTab = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');

  // Local state for editing form
  const [editingHours, setEditingHours] = useState(false);
  const [configForm, setConfigForm] = useState({
    businessName: '',
    operatingHours: { opening: '09:00', closing: '18:00' },
    awayMessage: '',
    socialMedia: { instagram: '', website: '', portfolio: '' }
  });

  // Sync with global state
  useEffect(() => {
    if (state.businessConfig) {
      setConfigForm({
        businessName: state.businessConfig.businessName || '',
        operatingHours: state.businessConfig.operatingHours || { opening: '09:00', closing: '18:00' },
        awayMessage: state.businessConfig.awayMessage || '',
        socialMedia: state.businessConfig.socialMedia || { instagram: '', website: '', portfolio: '' }
      });
    }
  }, [state.businessConfig]);

  // Actions
  const handleStartWhatsApp = async () => {
    try {
      toast({ title: 'Iniciando servidor...', status: 'info', duration: 2000 });
      await businessAPI.startWhatsApp();
    } catch (error) {
      toast({ title: 'Erro ao iniciar', description: error.message, status: 'error' });
    }
  };

  const handleLogoutWhatsApp = async () => {
    if (!window.confirm("Tem certeza? O bot vai parar de responder.")) return;
    try {
      await businessAPI.logoutWhatsApp();
      toast({ title: 'Desconectado', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao desconectar', status: 'error' });
    }
  };

  const handleSaveConfig = async () => {
    try {
      const payload = { ...state.businessConfig, ...configForm };
      const response = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      setEditingHours(false);
      toast({ title: 'Configurações salvas!', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao salvar', status: 'error' });
    }
  };

  return (
    <Box>
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
        {/* Card WhatsApp */}
        <GridItem>
          <Card bg={cardBg} h="100%" boxShadow="md" borderTop="4px solid" borderTopColor={state.whatsappStatus.isConnected ? "green.400" : "red.400"}>
            <CardHeader><Heading size="md">Status do WhatsApp</Heading></CardHeader>
            <CardBody display="flex" flexDirection="column" alignItems="center" justifyContent="center">
              {state.whatsappStatus.isConnected ? (
                <VStack spacing={4}>
                  <Icon as={CheckCircleIcon} color="green.500" boxSize={16} />
                  <Box textAlign="center">
                    <Text fontWeight="bold" fontSize="lg" color="green.600">Sistema Online</Text>
                    <Text fontSize="sm" color="gray.500">O robô está respondendo seus clientes.</Text>
                  </Box>
                  <Button colorScheme="red" variant="outline" onClick={handleLogoutWhatsApp}>Desconectar Sessão</Button>
                </VStack>
              ) : (
                <VStack spacing={4} w="100%">
                  {state.whatsappStatus.qrCode ? (
                    <VStack>
                      <Box bg="white" p={4} borderRadius="lg"><QRCodeSVG value={state.whatsappStatus.qrCode} size={180} /></Box>
                      <Button colorScheme="red" variant="outline" size="sm" onClick={handleLogoutWhatsApp}>Cancelar / Desligar</Button>
                    </VStack>
                  ) : state.whatsappStatus.mode === 'Iniciando...' ? (
                    <VStack py={6}><Spinner size="xl" color="brand.500" thickness="4px" /><Text color="gray.500">Iniciando motor...</Text></VStack>
                  ) : (
                    <VStack py={4}>
                      <Icon as={WarningTwoIcon} color="orange.400" boxSize={12} />
                      <Text fontWeight="bold" color="gray.600">Sessão Desligada</Text>
                      <Button size="lg" colorScheme="green" onClick={handleStartWhatsApp} width="full">Ligar Robô</Button>
                    </VStack>
                  )}
                </VStack>
              )}
            </CardBody>
          </Card>
        </GridItem>
        {/* Card Configs */}
        <GridItem>
          <Card bg={cardBg} h="100%" boxShadow="md">
            <CardHeader>
              <HStack justify="space-between"><Heading size="md">Dados da Empresa</Heading><Button size="xs" onClick={() => setEditingHours(!editingHours)} leftIcon={<EditIcon />}>{editingHours ? 'Cancelar' : 'Editar'}</Button></HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">NOME FANTASIA</FormLabel>
                  <Input isDisabled={!editingHours} value={configForm.businessName} onChange={e => setConfigForm({ ...configForm, businessName: e.target.value })} />
                </FormControl>
                <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
                  <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">ABERTURA</FormLabel><Input type="time" isDisabled={!editingHours} value={configForm.operatingHours.opening} onChange={e => setConfigForm({ ...configForm, operatingHours: { ...configForm.operatingHours, opening: e.target.value } })} size={{ base: 'lg', md: 'md' }} /></FormControl>
                  <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">FECHAMENTO</FormLabel><Input type="time" isDisabled={!editingHours} value={configForm.operatingHours.closing} onChange={e => setConfigForm({ ...configForm, operatingHours: { ...configForm.operatingHours, closing: e.target.value } })} size={{ base: 'lg', md: 'md' }} /></FormControl>
                </Stack>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">MENSAGEM DE AUSÊNCIA</FormLabel>
                  <Textarea isDisabled={!editingHours} value={configForm.awayMessage} onChange={e => setConfigForm({ ...configForm, awayMessage: e.target.value })} rows={3} />
                </FormControl>

                <Divider />

                <Heading size="sm" pt={2} color="gray.600">Links & Redes Sociais</Heading>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">INSTAGRAM</FormLabel>
                  <Input isDisabled={!editingHours} placeholder="@seu_negocio" value={configForm.socialMedia.instagram} onChange={e => setConfigForm({ ...configForm, socialMedia: { ...configForm.socialMedia, instagram: e.target.value } })} size={{ base: 'lg', md: 'md' }} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">WEBSITE</FormLabel>
                  <Input isDisabled={!editingHours} placeholder="https://..." value={configForm.socialMedia.website} onChange={e => setConfigForm({ ...configForm, socialMedia: { ...configForm.socialMedia, website: e.target.value } })} size={{ base: 'lg', md: 'md' }} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">PORTFOLIO</FormLabel>
                  <Input isDisabled={!editingHours} placeholder="Link externo (Drive, Behance...)" value={configForm.socialMedia.portfolio} onChange={e => setConfigForm({ ...configForm, socialMedia: { ...configForm.socialMedia, portfolio: e.target.value } })} size={{ base: 'lg', md: 'md' }} />
                </FormControl>

                {editingHours && <Button colorScheme="brand" onClick={handleSaveConfig} width="full">Salvar Alterações</Button>}
              </VStack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Box>
  );
};

export default ConnectionTab;
