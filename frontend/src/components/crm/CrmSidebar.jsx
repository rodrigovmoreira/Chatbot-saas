import React, { useState, useEffect } from 'react';
import {
  Box, VStack, Text, FormControl, FormLabel, Select, Textarea,
  Button, Badge, Icon, IconButton,
  NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper,
  InputGroup, InputLeftAddon,
  Popover, PopoverTrigger, PopoverContent, PopoverBody, PopoverHeader, PopoverArrow, PopoverCloseButton,
  List, ListItem, useColorModeValue, Flex, Input
} from '@chakra-ui/react';
import { SmallCloseIcon, AddIcon, CloseIcon } from '@chakra-ui/icons';

const CrmSidebar = ({ contact, onUpdate, availableTags, onAddTag, onRemoveTag, onClose }) => {
  // dealValue stores the raw string/number representation.
  // We initialize with string '0.00' to match input behavior or number 0.
  const [dealValue, setDealValue] = useState('0.00');
  const [funnelStage, setFunnelStage] = useState('new');
  const [notes, setNotes] = useState('');

  // Tag local state
  const [newTag, setNewTag] = useState('');
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);

  // Sync state with contact
  useEffect(() => {
    if (contact) {
      // Ensure we have a valid number or string
      const val = contact.dealValue !== undefined ? contact.dealValue : 0;
      setDealValue(val.toString());
      setFunnelStage(contact.funnelStage || 'new');
      setNotes(contact.notes || '');
    }
  }, [contact]);

  const handleSave = () => {
    // Parse the current string state to a float for the API
    const numericValue = parseFloat(dealValue);
    onUpdate({
      dealValue: isNaN(numericValue) ? 0 : numericValue,
      funnelStage,
      notes
    });
  };

  const funnelOptions = [
    { value: 'new', label: 'Novos' },
    { value: 'negotiation', label: 'Em Negociação' },
    { value: 'scheduled', label: 'Agendado' },
    { value: 'closed_won', label: 'Venda Realizada' },
    { value: 'closed_lost', label: 'Perdido' }
  ];

  const getTagColor = (tag) => {
      const colors = ['purple', 'green', 'blue', 'orange', 'red', 'teal'];
      const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return colors[hash % colors.length];
  };

  const handleLocalAddTag = (tag) => {
      onAddTag(tag);
      setNewTag('');
      setIsTagPopoverOpen(false);
  }

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  if (!contact) return null;

  return (
    <Box
        w={{ base: "100%", md: "300px" }}
        h="100%"
        borderLeft={{ base: 'none', md: '1px solid' }}
        borderColor={borderColor}
        bg={bg}
        p={4}
        overflowY="auto"
        position="relative"
    >
      {/* Mobile Close Button */}
      <IconButton
        display={{ base: 'flex', md: 'none' }}
        icon={<CloseIcon />}
        size="sm"
        position="absolute"
        top={2}
        right={2}
        onClick={onClose}
        aria-label="Fechar CRM"
        variant="ghost"
      />

      <VStack spacing={5} align="stretch">
        <Text fontWeight="bold" fontSize="lg" mb={2}>CRM</Text>

        {/* Deal Value */}
        <FormControl>
          <FormLabel fontSize="sm" color="gray.500">Valor da Oportunidade</FormLabel>
          <InputGroup size="sm">
            <InputLeftAddon children="R$" />
            <NumberInput
              value={dealValue}
              onChange={(valString) => setDealValue(valString)}
              min={0}
              precision={2}
              step={10}
              w="full"
            >
              <NumberInputField borderTopLeftRadius={0} borderBottomLeftRadius={0} />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </InputGroup>
        </FormControl>

        {/* Funnel Stage */}
        <FormControl>
          <FormLabel fontSize="sm" color="gray.500">Estágio do Funil</FormLabel>
          <Select
            value={funnelStage}
            onChange={(e) => setFunnelStage(e.target.value)}
          >
            {funnelOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </FormControl>

        {/* Tags */}
        <FormControl>
            <FormLabel fontSize="sm" color="gray.500">Tags</FormLabel>
            <Flex wrap="wrap" gap={2} mb={2}>
                {contact.tags && contact.tags.map(tag => (
                    <Badge key={tag} colorScheme={getTagColor(tag)} borderRadius="full" px={2} py={1} display="flex" alignItems="center">
                        {tag}
                        <Icon as={SmallCloseIcon} ml={1} cursor="pointer" onClick={() => onRemoveTag(tag)} />
                    </Badge>
                ))}
            </Flex>

            <Popover
                isOpen={isTagPopoverOpen}
                onClose={() => setIsTagPopoverOpen(false)}
                placement="bottom-start"
            >
                <PopoverTrigger>
                    <Button
                        size="sm"
                        leftIcon={<AddIcon />}
                        onClick={() => setIsTagPopoverOpen(!isTagPopoverOpen)}
                        w="full"
                        variant="outline"
                        colorScheme="gray"
                    >
                        Adicionar Tag
                    </Button>
                </PopoverTrigger>
                <PopoverContent w="250px">
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
                            {(availableTags || [])
                                .filter(t =>
                                    t.toLowerCase().includes(newTag.toLowerCase()) &&
                                    !contact.tags?.includes(t)
                                )
                                .map(tag => (
                                    <ListItem
                                        key={tag}
                                        px={2} py={1}
                                        _hover={{ bg: "gray.100", cursor: "pointer" }}
                                        onClick={() => handleLocalAddTag(tag)}
                                        borderRadius="md"
                                        fontSize="sm"
                                    >
                                        {tag}
                                    </ListItem>
                                ))
                            }
                            {newTag &&
                             !(availableTags || []).some(t => t.toLowerCase() === newTag.toLowerCase()) &&
                             !contact.tags?.includes(newTag) && (
                                <ListItem
                                    px={2} py={1}
                                    color="brand.500"
                                    fontWeight="bold"
                                    cursor="pointer"
                                    _hover={{ bg: "brand.50" }}
                                    onClick={() => handleLocalAddTag(newTag)}
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
        </FormControl>

        {/* Notes */}
        <FormControl flex="1">
          <FormLabel fontSize="sm" color="gray.500">Anotações Internas</FormLabel>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Comentários sobre o cliente..."
            size="sm"
            minH="150px"
            resize="vertical"
          />
        </FormControl>

        {/* Action */}
        <Button colorScheme="brand" onClick={handleSave} w="full">
          Salvar Dados
        </Button>

      </VStack>
    </Box>
  );
};

export default CrmSidebar;
