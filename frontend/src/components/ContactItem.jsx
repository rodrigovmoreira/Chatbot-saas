import React, { memo } from 'react';
import { Box, HStack, Icon, Text, Badge, useColorModeValue } from '@chakra-ui/react';
import { FaWhatsapp, FaGlobe } from 'react-icons/fa';

const getTagColor = (tag) => {
  const colors = ['purple', 'green', 'blue', 'orange', 'red', 'teal'];
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ContactItem = ({ contact, isSelected, onClick }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');

  return (
    <Box
      p={4}
      bg={isSelected ? 'brand.50' : cardBg}
      borderBottom="1px solid"
      borderColor={gray50Bg}
      cursor="pointer"
      borderLeft={isSelected ? "4px solid" : "4px solid transparent"}
      borderLeftColor="brand.500"
      _hover={{ bg: 'gray.100' }}
      onClick={() => onClick(contact)}
    >
      <HStack justify="space-between" mb={1}>
        <HStack>
           {contact.channel === 'whatsapp'
             ? <Icon as={FaWhatsapp} color="green.500" />
             : <Icon as={FaGlobe} color="blue.500" />
           }
           <Text fontWeight="bold" fontSize="sm" noOfLines={1}>{contact.name || contact.phone}</Text>
        </HStack>
        {contact.lastInteraction && (
            <Text fontSize="xs" color="gray.500">{formatTime(contact.lastInteraction)}</Text>
        )}
      </HStack>
      {contact.tags && contact.tags.length > 0 && (
          <HStack mt={1} spacing={1}>
              {contact.tags.slice(0, 2).map(tag => (
                  <Badge key={tag} fontSize="xx-small" colorScheme={getTagColor(tag)}>{tag}</Badge>
              ))}
              {contact.tags.length > 2 && <Text fontSize="xx-small">+{contact.tags.length - 2}</Text>}
          </HStack>
      )}
    </Box>
  );
};

export default memo(ContactItem);
