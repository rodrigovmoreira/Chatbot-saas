import React from 'react';
import {
  Box, Card, Heading, Text, Button, VStack, HStack, Stack,
  useColorModeValue, Alert, Icon, Input, IconButton, Badge
} from '@chakra-ui/react';
import { ChatIcon, WarningTwoIcon } from '@chakra-ui/icons';

const LiveChatTab = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');
  const gray100 = useColorModeValue("gray.100", "gray.900");

  return (
    <Box>
      <Card h="75vh" overflow="hidden" border="1px solid" borderColor="gray.200">
        <Stack direction={{ base: 'column', md: 'row' }} h="100%" spacing={0} align="stretch">

          {/* LADO ESQUERDO: LISTA DE CONTATOS (MOCKUP) */}
          <Box
            w={{ base: "100%", md: "300px" }}
            h={{ base: "40%", md: "100%" }}
            borderRight="1px solid"
            borderColor={gray50Bg}
            bg={gray50Bg}
            overflowY="auto"
          >
            <Box p={4} borderBottom="1px solid" borderColor={gray50Bg} bg={cardBg}>
              <Heading size="sm" color="gray.600">Conversas</Heading>
            </Box>
            <VStack spacing={0} align="stretch" overflowY="auto">
              {/* Item Fake 1 */}
              <Box p={4} bg={cardBg} borderBottom="1px solid" borderColor={gray50Bg} cursor="pointer" borderLeft="4px solid" borderLeftColor="green.400">
                <Text fontWeight="bold" fontSize="sm" noOfLines={1}>João Silva</Text>
                <Text fontSize="xs" color="gray.500" noOfLines={1}>Olá, qual o preço do corte?</Text>
                <Badge colorScheme="green" fontSize="0.6em" mt={1}>Online</Badge>
              </Box>
              {/* Item Fake 2 */}
              <Box p={4} _hover={{ bg: gray50Bg }} cursor="pointer" borderBottom="1px solid" borderColor={gray50Bg}>
                <Text fontWeight="bold" fontSize="sm" noOfLines={1}>Maria Souza</Text>
                <Text fontSize="xs" color="gray.500" noOfLines={1}>Obrigado pelo atendimento!</Text>
              </Box>
              {/* Item Fake 3 */}
              <Box p={4} _hover={{ bg: gray50Bg }} cursor="pointer" borderBottom="1px solid" borderColor={gray50Bg}>
                <Text fontWeight="bold" fontSize="sm" noOfLines={1}>Pedro Henrique</Text>
                <Text fontSize="xs" color="gray.500" noOfLines={1}>Agendado para amanhã?</Text>
              </Box>
            </VStack>
          </Box>

          {/* LADO DIREITO: CHAT (MOCKUP) */}
          <Box flex="1" bg={gray100} position="relative" display="flex" flexDirection="column" h={{ base: "60%", md: "100%" }}>

            {/* Header do Chat */}
            <HStack p={4} bg={cardBg} borderBottom="1px solid" borderColor={gray50Bg} justify="space-between">
              <HStack>
                <Box bg="gray.300" borderRadius="full" w="40px" h="40px" />
                <Box>
                  <Text fontWeight="bold">João Silva</Text>
                  <Text fontSize="xs" color="green.500">● Respondendo agora</Text>
                </Box>
              </HStack>
              <Button size="sm" colorScheme="orange" variant="outline">Pausar Robô</Button>
            </HStack>

            {/* Área de Mensagens (Vazia/Ilustrativa) */}
            <Box flex="1" p={6} overflowY="auto">
              <VStack spacing={4}>
                <Alert status="info" borderRadius="md">
                  <Icon as={WarningTwoIcon} mr={2} />
                  Módulo de Chat ao Vivo em desenvolvimento.
                </Alert>
                <Text color="gray.400" fontSize="sm" mt={10}>
                  Selecione uma conversa para visualizar o histórico aqui.
                </Text>
              </VStack>
            </Box>

            {/* Input de Envio */}
            <Box p={4} bg={cardBg} borderTop="1px solid" borderColor={gray50Bg}>
              <HStack>
                <Input placeholder="Digite sua mensagem..." isDisabled size={{ base: 'lg', md: 'md' }} />
                <IconButton aria-label="Enviar" icon={<ChatIcon />} colorScheme="blue" isDisabled size={{ base: 'lg', md: 'md' }} />
              </HStack>
            </Box>
          </Box>

        </Stack>
      </Card>
    </Box>
  );
};

export default LiveChatTab;
