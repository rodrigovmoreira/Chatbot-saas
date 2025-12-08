import React, { useEffect, useState } from 'react';
import {
  Box, Container, Grid, GridItem, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack,
  Stat, StatLabel, StatNumber, StatHelpText, useToast, Badge, Icon, useColorModeValue,
  FormControl, FormLabel, Input, Select, Textarea, Checkbox, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalFooter, ModalBody, ModalCloseButton, useDisclosure, Divider, Code, Alert, AlertIcon
} from '@chakra-ui/react';
import { CheckCircleIcon, AddIcon, EditIcon, DeleteIcon, SettingsIcon, InfoIcon } from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { businessAPI } from '../services/api';

const Dashboard = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  
  // Modais
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isProductModalOpen, onOpen: onProductModalOpen, onClose: onProductModalClose } = useDisclosure({
    onClose: () => setEditingProductIndex(null)
  });

  // Estados de Edição (UI)
  const [editingConfig, setEditingConfig] = useState(false);
  const [editingHours, setEditingHours] = useState(false);
  
  // Formulário de Configuração Geral
  const [configForm, setConfigForm] = useState({
    businessName: '',
    businessType: '',
    welcomeMessage: '',
    operatingHours: { opening: '00:01', closing: '23:59' },
    awayMessage: ''
  });

  // Listas (Sincronizadas com o Contexto)
  const [menuOptions, setMenuOptions] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Itens Temporários (Novos/Edição)
  const [newMenuOption, setNewMenuOption] = useState({ keyword: '', description: '', response: '', requiresHuman: false });
  const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '' });
  const [editingProductIndex, setEditingProductIndex] = useState(null);

  // Sincronizar estado global com formulário local
  useEffect(() => {
    if (state.businessConfig) {
      setConfigForm({
        businessName: state.businessConfig.businessName || '',
        businessType: state.businessConfig.businessType || 'outros',
        welcomeMessage: state.businessConfig.welcomeMessage || '',
        operatingHours: state.businessConfig.operatingHours || { opening: '00:01', closing: '23:59' },
        awayMessage: state.businessConfig.awayMessage || ''
      });
      setMenuOptions(state.businessConfig.menuOptions || []);
      setProducts(state.businessConfig.products || []);
    }
  }, [state.businessConfig]);

  // --- Ações de API ---

  const handleLogout = async () => {
    try { await businessAPI.logout(); } catch (e) { console.error(e); }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleSaveConfig = async () => {
    try {
      // Salva tudo de uma vez (Config + Listas atuais)
      const payload = { ...configForm, menuOptions, products };
      const response = await businessAPI.updateConfig(payload);
      
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      setEditingConfig(false);
      setEditingHours(false);
      
      toast({ title: 'Configurações salvas!', status: 'success', duration: 3000 });
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.message, status: 'error', duration: 3000 });
    }
  };

  const handleSaveMenu = async () => {
    try {
      const payload = { ...state.businessConfig, ...configForm, menuOptions };
      const response = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      toast({ title: 'Menu atualizado!', status: 'success', duration: 3000 });
    } catch (error) {
      toast({ title: 'Erro ao salvar menu', status: 'error', duration: 3000 });
    }
  };

  const handleSaveProducts = async () => {
    try {
      const payload = { ...state.businessConfig, ...configForm, products };
      const response = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      toast({ title: 'Catálogo atualizado!', status: 'success', duration: 3000 });
    } catch (error) {
      toast({ title: 'Erro ao salvar produtos', status: 'error', duration: 3000 });
    }
  };

  // --- Manipuladores de Lista ---

  const handleAddMenuOption = () => {
    if (!newMenuOption.keyword || !newMenuOption.response) {
        toast({ title: 'Preencha palavra-chave e resposta', status: 'warning' });
        return;
    }
    setMenuOptions([...menuOptions, newMenuOption]);
    setNewMenuOption({ keyword: '', description: '', response: '', requiresHuman: false });
    onClose();
  };

  const handleRemoveMenuOption = (idx) => {
    setMenuOptions(menuOptions.filter((_, i) => i !== idx));
  };

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.price) {
        toast({ title: 'Preencha nome e preço', status: 'warning' });
        return;
    }
    if (editingProductIndex !== null) {
      const updated = [...products];
      updated[editingProductIndex] = newProduct;
      setProducts(updated);
      setEditingProductIndex(null);
    } else {
      setProducts([...products, newProduct]);
    }
    setNewProduct({ name: '', price: '', description: '' });
    onProductModalClose();
  };

  const handleRemoveProduct = (idx) => {
    setProducts(products.filter((_, i) => i !== idx));
  };

  // --- Renderização ---

  return (
    <Box minH="100vh" bg="gray.50" p={4}>
      <Container maxW="1400px">
        {/* Header */}
        <Card bg={cardBg} mb={6} boxShadow="sm" borderTop="4px solid" borderColor="brand.500">
          <CardBody>
            <HStack justify="space-between" align="center">
              <VStack align="start" spacing={1}>
                <Heading size="lg">Painel de Controle</Heading>
                <Text color="gray.600">Gerenciando: <Text as="span" fontWeight="bold" color="brand.600">{state.businessConfig?.businessName || 'Carregando...'}</Text></Text>
              </VStack>
              <Button colorScheme="red" variant="outline" size="sm" onClick={handleLogout}>Sair</Button>
            </HStack>
          </CardBody>
        </Card>

        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6} mb={6}>
          
          {/* Card 1: Status do Sistema (Twilio) */}
          <GridItem colSpan={1}>
            <Card bg={cardBg} height="100%" boxShadow="sm">
              <CardHeader pb={2}>
                <HStack>
                  <Icon as={CheckCircleIcon} color="green.500" boxSize={5} />
                  <Heading size="md">Sistema Conectado</Heading>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack align="start" spacing={4}>
                  <Alert status="success" variant="subtle" borderRadius="md" py={2}>
                    <AlertIcon />
                    <Text fontSize="sm">Servidor Webhook ativo e aguardando mensagens.</Text>
                  </Alert>
                  
                  <Box bg="blue.50" p={4} borderRadius="md" width="100%" borderLeft="4px solid" borderColor="blue.400">
                    <Heading size="sm" mb={2} color="blue.700">Modo Sandbox (Teste):</Heading>
                    <Text fontSize="sm" mb={2}>Envie uma mensagem no WhatsApp para o número da Sandbox do Twilio com o código de união:</Text>
                    <Code p={2} borderRadius="md" colorScheme="blue" children="join word-steel" w="100%" textAlign="center" mb={2} />
                    <Text fontSize="xs" color="gray.500">
                      * Consulte o código exato ("join ...") no seu Console do Twilio em Messaging {'>'} Try it out.
                    </Text>
                  </Box>
                  
                  <HStack spacing={4} pt={2}>
                     <Badge colorScheme="purple">Twilio API</Badge>
                     <Badge colorScheme="orange">DeepSeek AI</Badge>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </GridItem>

          {/* Card 2: Horários e Configuração Básica */}
          <GridItem colSpan={1}>
            <Card bg={cardBg} height="100%" boxShadow="sm">
              <CardHeader pb={2}>
                <HStack justify="space-between">
                    <Heading size="md">Configurações Gerais</Heading>
                    {!editingHours && <Button size="sm" leftIcon={<EditIcon />} onClick={() => setEditingHours(true)}>Editar</Button>}
                </HStack>
              </CardHeader>
              <CardBody>
                {editingHours ? (
                  <VStack spacing={3}>
                     <FormControl>
                        <FormLabel fontSize="sm">Nome da Empresa</FormLabel>
                        <Input size="sm" value={configForm.businessName} onChange={e => setConfigForm({...configForm, businessName: e.target.value})} />
                     </FormControl>
                    <HStack width="100%">
                      <FormControl>
                        <FormLabel fontSize="sm">Abre</FormLabel>
                        <Input size="sm" type="time" value={configForm.operatingHours.opening} onChange={e => setConfigForm({...configForm, operatingHours: {...configForm.operatingHours, opening: e.target.value}})} />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="sm">Fecha</FormLabel>
                        <Input size="sm" type="time" value={configForm.operatingHours.closing} onChange={e => setConfigForm({...configForm, operatingHours: {...configForm.operatingHours, closing: e.target.value}})} />
                      </FormControl>
                    </HStack>
                    <FormControl>
                        <FormLabel fontSize="sm">Msg. Ausência</FormLabel>
                        <Textarea size="sm" value={configForm.awayMessage} onChange={e => setConfigForm({...configForm, awayMessage: e.target.value})} rows={2} />
                    </FormControl>
                    <HStack width="100%" justify="flex-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingHours(false)}>Cancelar</Button>
                        <Button size="sm" colorScheme="brand" onClick={handleSaveConfig}>Salvar</Button>
                    </HStack>
                  </VStack>
                ) : (
                  <VStack align="start" spacing={3}>
                    <Text fontSize="sm">🕒 <b>Horário:</b> {configForm.operatingHours.opening} às {configForm.operatingHours.closing}</Text>
                    <Text fontSize="sm">🌙 <b>Ausência:</b> "{configForm.awayMessage}"</Text>
                    <Divider />
                    <Text fontSize="sm">🏢 <b>Empresa:</b> {configForm.businessName}</Text>
                    <Text fontSize="sm">👋 <b>Boas-vindas:</b> "{configForm.welcomeMessage}"</Text>
                  </VStack>
                )}
              </CardBody>
            </Card>
          </GridItem>

          {/* Card 3: Menu de Opções (Chatbot) */}
          <GridItem colSpan={{ base: 1, lg: 2 }}>
            <Card bg={cardBg} boxShadow="sm">
              <CardHeader pb={2}>
                <HStack justify="space-between">
                    <Heading size="md">Menu de Respostas Rápidas</Heading>
                    <Button size="sm" leftIcon={<AddIcon />} colorScheme="brand" onClick={onOpen}>Adicionar Opção</Button>
                </HStack>
              </CardHeader>
              <CardBody>
                <Text fontSize="sm" color="gray.500" mb={4}>
                    Se o cliente digitar estas palavras-chave, o bot responderá imediatamente (sem gastar IA).
                </Text>
                
                <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }} gap={4}>
                    {menuOptions.map((opt, idx) => (
                      <Card key={idx} variant="outline" size="sm" borderColor="gray.200">
                        <CardBody p={3}>
                          <HStack justify="space-between" mb={2}>
                            <Badge colorScheme="purple" fontSize="0.8em">{idx + 1}. {opt.keyword}</Badge>
                            <Icon as={DeleteIcon} color="red.300" cursor="pointer" onClick={() => handleRemoveMenuOption(idx)} boxSize={3} />
                          </HStack>
                          <Text fontWeight="bold" fontSize="xs" color="gray.700" mb={1}>{opt.description}</Text>
                          <Text fontSize="xs" color="gray.500" noOfLines={2}>{opt.response}</Text>
                          {opt.requiresHuman && <Badge mt={2} colorScheme="orange" fontSize="0.6em">Humano</Badge>}
                        </CardBody>
                      </Card>
                    ))}
                </Grid>
                
                {menuOptions.length > 0 && (
                    <Box mt={4} textAlign="right">
                         <Button size="sm" colorScheme="green" variant="ghost" onClick={handleSaveMenu}>Salvar Alterações do Menu</Button>
                    </Box>
                )}
              </CardBody>
            </Card>
          </GridItem>

          {/* Card 4: Catálogo de Produtos */}
          <GridItem colSpan={{ base: 1, lg: 2 }}>
            <Card bg={cardBg} boxShadow="sm">
                <CardHeader pb={2}>
                    <HStack justify="space-between">
                        <Heading size="md">Catálogo de Produtos & Serviços</Heading>
                        <Button size="sm" leftIcon={<AddIcon />} variant="outline" onClick={() => { setEditingProductIndex(null); setNewProduct({name:'', price:'', description:''}); onProductModalOpen(); }}>Novo Produto</Button>
                    </HStack>
                </CardHeader>
                <CardBody>
                    <Text fontSize="sm" color="gray.500" mb={4}>
                        A Inteligência Artificial consultará esta lista para responder perguntas sobre preços.
                    </Text>
                    <VStack align="stretch" spacing={2}>
                        {products.length === 0 && <Text fontStyle="italic" color="gray.400" fontSize="sm">Nenhum produto cadastrado.</Text>}
                        
                        {products.map((prod, idx) => (
                            <HStack key={idx} p={3} borderWidth="1px" borderRadius="md" justify="space-between" bg="white">
                                <VStack align="start" spacing={0}>
                                    <HStack>
                                        <Text fontWeight="bold" fontSize="sm">{prod.name}</Text>
                                        <Badge colorScheme="green" fontSize="0.8em">R$ {prod.price}</Badge>
                                    </HStack>
                                    <Text fontSize="xs" color="gray.600">{prod.description}</Text>
                                </VStack>
                                <HStack>
                                    <Button size="xs" variant="ghost" onClick={() => { setNewProduct(prod); setEditingProductIndex(idx); onProductModalOpen(); }}><EditIcon /></Button>
                                    <Button size="xs" colorScheme="red" variant="ghost" onClick={() => handleRemoveProduct(idx)}><DeleteIcon /></Button>
                                </HStack>
                            </HStack>
                        ))}
                        
                        {products.length > 0 && (
                            <Box mt={2} textAlign="right">
                                <Button size="sm" colorScheme="green" variant="ghost" onClick={handleSaveProducts}>Salvar Alterações do Catálogo</Button>
                            </Box>
                        )}
                    </VStack>
                </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </Container>

      {/* --- MODAIS --- */}

      {/* Modal Menu */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nova Opção de Menu</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3}>
              <FormControl isRequired>
                  <FormLabel>Palavra-chave</FormLabel>
                  <Input placeholder="Ex: pix" value={newMenuOption.keyword} onChange={e => setNewMenuOption({...newMenuOption, keyword: e.target.value})} />
              </FormControl>
              <FormControl isRequired>
                  <FormLabel>Descrição no Menu</FormLabel>
                  <Input placeholder="Ex: Chave Pix para pagamento" value={newMenuOption.description} onChange={e => setNewMenuOption({...newMenuOption, description: e.target.value})} />
              </FormControl>
              <FormControl isRequired>
                  <FormLabel>Resposta do Robô</FormLabel>
                  <Textarea placeholder="O texto que será enviado ao cliente..." value={newMenuOption.response} onChange={e => setNewMenuOption({...newMenuOption, response: e.target.value})} />
              </FormControl>
              <Checkbox isChecked={newMenuOption.requiresHuman} onChange={e => setNewMenuOption({...newMenuOption, requiresHuman: e.target.checked})}>Encaminhar para Humano</Checkbox>
            </VStack>
          </ModalBody>
          <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
              <Button colorScheme="brand" onClick={handleAddMenuOption}>Adicionar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Produto */}
      <Modal isOpen={isProductModalOpen} onClose={onProductModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingProductIndex !== null ? 'Editar' : 'Novo'} Produto</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3}>
              <FormControl isRequired>
                  <FormLabel>Nome</FormLabel>
                  <Input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </FormControl>
              <FormControl isRequired>
                  <FormLabel>Preço (R$)</FormLabel>
                  <Input type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
              </FormControl>
              <FormControl>
                  <FormLabel>Detalhes</FormLabel>
                  <Textarea placeholder="Ingredientes, tamanho..." value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onProductModalClose}>Cancelar</Button>
              <Button colorScheme="brand" onClick={handleAddProduct}>Salvar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Dashboard;