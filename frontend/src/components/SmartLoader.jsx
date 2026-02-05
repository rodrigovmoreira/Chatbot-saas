import React, { useState, useEffect } from 'react';
import { Box, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

const messages = [
  "Iniciando protocolos de segurança...",
  "Aquecendo os motores...",
  "Buscando sessão criptografada...",
  "Sincronizando contatos...",
  "Quase lá..."
];

const SmartLoader = () => {
  const [index, setIndex] = useState(0);
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const spinnerColor = useColorModeValue('brand.500', 'brand.200');
  const spinnerTrack = useColorModeValue('gray.100', 'gray.700');

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <VStack spacing={6} py={10} justify="center" align="center">
      {/* Custom Spinner using framer-motion */}
      <Box
        as={motion.div}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        width="50px"
        height="50px"
        border="4px solid"
        borderColor={spinnerTrack}
        borderTopColor={spinnerColor}
        borderRadius="50%"
      />

      <Box h="30px" position="relative" width="100%" display="flex" justifyContent="center">
        <AnimatePresence mode='wait'>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            style={{ position: 'absolute' }}
          >
            <Text color={textColor} fontSize="md" fontWeight="medium" textAlign="center">
              {messages[index]}
            </Text>
          </motion.div>
        </AnimatePresence>
      </Box>
    </VStack>
  );
};

export default SmartLoader;
