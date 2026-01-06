import React from 'react';
import { Box, HStack, Text, Icon } from '@chakra-ui/react';
import { FaWhatsapp, FaGlobe } from 'react-icons/fa';

const ConversationItem = React.memo(({ contact, isSelected, onClick, cardBg, gray50Bg, formatTime }) => {
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
        <Text fontSize="xs" color="gray.500">{formatTime(contact.lastInteraction)}</Text>
      </HStack>
      <Text fontSize="xs" color="gray.500" noOfLines={1}>
        {contact.phone || contact.sessionId}
      </Text>
    </Box>
  );
});

export default ConversationItem;
