import React, { useState, useEffect, useRef } from 'react';
import {
  Input, List, ListItem, Text, Icon, HStack, Spinner, useToast, useColorModeValue,
  Popover, PopoverTrigger, PopoverContent, PopoverBody, Button, Circle
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { tagAPI } from '../../services/api';

const TagAutocomplete = ({ onSelect, existingTags = [], placeholder = "Adicionar Tag" }) => {
  const [tags, setTags] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();
  const inputRef = useRef(null);

  const hoverBg = useColorModeValue('gray.100', 'gray.700');

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const { data } = await tagAPI.getAll();
      setTags(data);
    } catch (error) {
      console.error("Error loading tags:", error);
    }
  };

  const handleCreateTag = async () => {
    if (!inputValue.trim()) return;
    setIsLoading(true);
    try {
      const { data } = await tagAPI.create({
        name: inputValue.trim(),
        color: getRandomColor()
      });

      setTags(prev => [...prev, data]); // Add to local list
      onSelect(data.name); // Notify parent
      setInputValue('');
      setIsOpen(false);
      toast({ title: "Tag criada!", status: "success", duration: 2000 });
    } catch (error) {
        if (error.response?.status === 409) {
            // Already exists, just select it
            const existing = error.response.data.tag;
            onSelect(existing.name);
            setInputValue('');
            setIsOpen(false);
        } else {
            toast({ title: "Erro ao criar tag", status: "error" });
        }
    } finally {
      setIsLoading(false);
    }
  };

  const getRandomColor = () => {
    const colors = ['#F56565', '#ED8936', '#ECC94B', '#48BB78', '#38B2AC', '#4299E1', '#667EEA', '#9F7AEA', '#ED64A6'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(inputValue.toLowerCase()) &&
    !existingTags.includes(t.name)
  );

  const showCreateOption = inputValue && !tags.some(t => t.name.toLowerCase() === inputValue.toLowerCase());

  return (
    <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialFocusRef={inputRef}
        placement="bottom-start"
        isLazy
    >
      <PopoverTrigger>
        <Button
            size="sm"
            leftIcon={<AddIcon />}
            variant="outline"
            colorScheme="gray"
            w="full"
            onClick={() => setIsOpen(true)}
        >
            {placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent w="250px" boxShadow="lg">
        <PopoverBody p={2}>
            <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Buscar ou criar..."
                size="sm"
                mb={2}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredTags.length > 0 && filteredTags[0].name.toLowerCase() === inputValue.toLowerCase()) {
                            onSelect(filteredTags[0].name);
                            setInputValue('');
                            setIsOpen(false);
                        } else if (showCreateOption) {
                            handleCreateTag();
                        }
                    }
                }}
            />

            <List spacing={1} maxH="200px" overflowY="auto">
                {filteredTags.map(tag => (
                    <ListItem
                        key={tag._id}
                        px={2} py={1.5}
                        borderRadius="md"
                        cursor="pointer"
                        _hover={{ bg: hoverBg }}
                        onClick={() => {
                            onSelect(tag.name);
                            setInputValue('');
                            setIsOpen(false);
                        }}
                        display="flex"
                        alignItems="center"
                    >
                        <Circle size="10px" bg={tag.color || 'gray.400'} mr={2} />
                        <Text fontSize="sm">{tag.name}</Text>
                    </ListItem>
                ))}

                {filteredTags.length === 0 && !showCreateOption && (
                    <Text fontSize="xs" color="gray.500" p={2} textAlign="center">
                        Nenhuma tag encontrada.
                    </Text>
                )}

                {showCreateOption && (
                    <ListItem
                        px={2} py={1.5}
                        borderRadius="md"
                        cursor="pointer"
                        _hover={{ bg: hoverBg }}
                        onClick={handleCreateTag}
                        color="blue.500"
                        fontWeight="medium"
                    >
                        <HStack>
                            <Icon as={AddIcon} w={3} h={3} />
                            <Text fontSize="sm">Criar "{inputValue}"</Text>
                            {isLoading && <Spinner size="xs" ml={2} />}
                        </HStack>
                    </ListItem>
                )}
            </List>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default TagAutocomplete;
