import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Box, Text, Flex, Badge, useColorModeValue } from '@chakra-ui/react';
import FunnelCard from './FunnelCard';

const FunnelColumn = ({ step, contacts, droppableId }) => {
  const bg = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const draggingBg = useColorModeValue('blue.50', 'whiteAlpha.100');

  // Calculate Total Value
  const totalValue = contacts.reduce((sum, c) => sum + (c.dealValue || 0), 0);
  const formattedTotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact'
  }).format(totalValue);

  return (
    <Box
      minW="300px"
      w="300px"
      h="full"
      bg={bg}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
      display="flex"
      flexDirection="column"
      mr={4}
    >
      {/* Header */}
      <Box p={4} borderBottom="1px solid" borderColor={borderColor}>
        <Flex justify="space-between" align="center" mb={1}>
          <Text fontWeight="bold" fontSize="md" color={step.color || 'gray.700'}>
            {step.label}
          </Text>
          <Badge colorScheme="gray" borderRadius="full">{contacts.length}</Badge>
        </Flex>
        <Text fontSize="xs" color="gray.500" fontWeight="bold">
          Total: {formattedTotal}
        </Text>
      </Box>

      {/* Droppable Area */}
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            flex="1"
            p={2}
            overflowY="auto"
            bg={snapshot.isDraggingOver ? draggingBg : 'transparent'}
            transition="background-color 0.2s"
          >
            {contacts.map((contact, index) => (
              <FunnelCard key={contact._id} contact={contact} index={index} />
            ))}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
    </Box>
  );
};

export default FunnelColumn;
