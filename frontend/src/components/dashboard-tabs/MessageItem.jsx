import React from 'react';
import { Box, HStack, Text, Avatar } from '@chakra-ui/react';

const MessageItem = React.memo(({ msg, selectedContactName, formatTime }) => {
  const isMe = msg.role === 'bot' || msg.role === 'system';

  return (
    <HStack justify={isMe ? 'flex-end' : 'flex-start'} align="flex-start">
      {!isMe && <Avatar size="xs" name={selectedContactName} mr={2} mt={1} />}
      <Box
        bg={isMe ? 'brand.100' : 'white'}
        color="black"
        px={4} py={2}
        borderRadius="lg"
        boxShadow="sm"
        maxW="70%"
        borderTopLeftRadius={!isMe ? 0 : 'lg'}
        borderTopRightRadius={isMe ? 0 : 'lg'}
      >
        <Text fontSize="sm" whiteSpace="pre-wrap">{msg.content}</Text>
        <Text fontSize="10px" color="gray.500" textAlign="right" mt={1}>
          {formatTime(msg.timestamp)}
        </Text>
      </Box>
    </HStack>
  );
});

export default MessageItem;
