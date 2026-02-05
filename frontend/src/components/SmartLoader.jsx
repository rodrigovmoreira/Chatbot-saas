import React, { useState, useEffect } from 'react';
import { Box, Text, VStack, CircularProgress, useColorModeValue } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

const messages = [
  "Iniciando protocolos de segurança...",
  "Aquecendo os motores...",
  "Buscando sessão criptografada...",
  "Sincronizando contatos...",
  "Arrumando tudo na velocidade da luz...",
  "Passeando pelo ciberespaço...",
  "Olhando para o horizonte digital...",
  "Preparando um café virtual...",
  "Seguindo o fluxo do cabo de rede...",
  "Quase lá..."
];

const SmartLoader = () => {
  const [index, setIndex] = useState(0);
  
  // Cores dinâmicas para Dark/Light Mode
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const spinnerColor = useColorModeValue('green.400', 'green.300'); // Ajuste para sua cor de marca (brand)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 2500); // Troca de frase a cada 2.5s
    return () => clearInterval(interval);
  }, []);

  return (
    <VStack spacing={6} py={10} justify="center" align="center" w="100%">
      
      {/* 1. CORREÇÃO DO SPINNER: Usando nativo com isIndeterminate */}
      <CircularProgress 
        isIndeterminate 
        color={spinnerColor} 
        size="60px" 
        thickness="4px" 
        trackColor={useColorModeValue('gray.100', 'gray.700')}
        capIsRound
      />

      {/* 2. CORREÇÃO DE LAYOUT: Container com largura mínima para não quebrar linha */}
      <Box 
        h="30px" 
        position="relative" 
        display="flex" 
        justifyContent="center"
        width={{ base: "100%", md: "auto" }} // Responsivo
        minW={{ base: "auto", md: "400px" }} // Garante espaço no Desktop
        px={4}
      >
        <AnimatePresence mode='wait'>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ position: 'absolute', width: '100%' }}
          >
            <Text 
              color={textColor} 
              fontSize="md" 
              fontWeight="medium" 
              textAlign="center"
              noOfLines={1} // Tenta forçar uma linha (reticências se estourar muito)
              whiteSpace="nowrap" // Evita quebra de linha se possível
            >
              {messages[index]}
            </Text>
          </motion.div>
        </AnimatePresence>
      </Box>
    </VStack>
  );
};

export default SmartLoader;