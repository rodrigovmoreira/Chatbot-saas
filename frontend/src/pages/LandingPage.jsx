import React from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  useColorModeValue,
  VStack,
  HStack,
  List,
  ListItem,
  ListIcon,
  Card,
  CardBody,
  CardHeader,
  Avatar,
  Icon,
} from '@chakra-ui/react';
import { CheckIcon, StarIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import { FaWhatsapp, FaRobot, FaCalendarCheck, FaImages } from 'react-icons/fa';

const LandingPage = () => {
  const navigate = useNavigate();
  const bg = useColorModeValue('gray.50', 'gray.900');
  const brandColor = 'brand.600';

  return (
    <Box bg={bg} minH="100vh">
      {/* Navbar */}
      <Box
        as="nav"
        position="fixed"
        w="100%"
        zIndex={10}
        bg={useColorModeValue('white', 'gray.800')}
        boxShadow="sm"
        py={4}
      >
        <Container maxW="container.xl">
          <Flex justify="space-between" align="center">
            <HStack>
                {/* Logo Placeholder */}
                <Icon as={FaRobot} w={6} h={6} color={brandColor} />
                <Heading size="md" color={brandColor}>
                CalangoBot
                </Heading>
            </HStack>
            
            <HStack spacing={4}>
              <Button variant="ghost" onClick={() => navigate('/login')}>
                Login
              </Button>
              <Button
                colorScheme="brand"
                variant="solid"
                onClick={() => navigate('/login')}
              >
                Start Free Trial
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Hero Section */}
      <Container maxW="container.xl" pt={32} pb={20}>
        <Stack
          direction={{ base: 'column', md: 'row' }}
          spacing={10}
          align="center"
        >
          <VStack align="flex-start" spacing={6} flex={1}>
            <Heading
              as="h1"
              size="2xl"
              lineHeight="shorter"
              bgGradient="linear(to-r, brand.600, brand.400)"
              bgClip="text"
            >
              Automate your WhatsApp Service with AI
            </Heading>
            <Text fontSize="xl" color="gray.500">
              Scheduling, Visual Catalog, and Smart Answers 24/7 for your business.
            </Text>
            <Stack direction={{ base: 'column', sm: 'row' }} spacing={4} w="100%">
                <Button
                size="lg"
                colorScheme="brand"
                leftIcon={<FaWhatsapp />}
                onClick={() => navigate('/login')}
                px={8}
                >
                Get Started Now
                </Button>
            </Stack>
          </VStack>

          {/* Live Demo Visualization (Chat Simulator) */}
          <Box flex={1} w="100%" id="demo">
            <Card
              bg={useColorModeValue('#e5ddd5', '#202c33')} 
              borderRadius="xl"
              boxShadow="2xl"
              maxW="400px"
              mx="auto"
              overflow="hidden"
              border="8px solid"
              borderColor="gray.800"
            >
              <Box bg={useColorModeValue('#075e54', '#202c33')} p={3} color="white">
                <HStack>
                  <Avatar size="sm" src="https://bit.ly/broken-link" bg="gray.300" icon={<FaRobot />} />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="bold" fontSize="sm">CalangoBot Store</Text>
                    <Text fontSize="xs">Online now</Text>
                  </VStack>
                </HStack>
              </Box>
              <CardBody p={4} minH="350px" display="flex" flexDirection="column" gap={3}>
                
                <ChatMessage isUser>Do you have this sneaker in size 42?</ChatMessage>
                
                <ChatMessage>
                    <VStack align="start" spacing={2}>
                        <Box h="120px" w="100%" bg="gray.200" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
                            <Icon as={FaImages} boxSize={8} color="gray.400" />
                        </Box>
                        <Text>Yes! We have the <b>Emerald Runner</b> in stock. Check out the photo above 👆</Text>
                    </VStack>
                </ChatMessage>

                <ChatMessage isUser>Great! Can I schedule to try it tomorrow at 2 PM?</ChatMessage>

                <ChatMessage>
                    ✅ <b>Appointment confirmed!</b><br/>
                    I'll see you tomorrow at 14:00. I've reserved the model for you.
                </ChatMessage>

              </CardBody>
            </Card>
          </Box>
        </Stack>
      </Container>

      {/* Features Grid */}
      <Box py={20}>
        <Container maxW="container.xl">
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
            <FeatureCard
              icon={FaRobot}
              title="AI Brain"
              text="Understands context and images."
            />
            <FeatureCard
              icon={FaCalendarCheck}
              title="Auto Scheduling"
              text="Integrated calendar management."
            />
            <FeatureCard
              icon={FaImages}
              title="Visual Catalog"
              text="Sends product photos automatically."
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box bg={useColorModeValue('white', 'gray.800')} py={20}>
        <Container maxW="container.xl">
            <VStack spacing={4} mb={10}>
            <Heading textAlign="center">Simple Pricing</Heading>
            </VStack>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
            <PricingCard
                title="Starter"
                price="Free"
                features={['Basic AI Responses', 'Manual Scheduling', '5 Products in Catalog']}
            />
            <PricingCard
                title="Pro"
                price="$19/mo"
                highlight
                features={['Contextual AI', 'Auto Scheduling', '50 Products in Catalog', 'Priority Support']}
            />
            <PricingCard
                title="Business"
                price="$49/mo"
                features={['Custom AI Training', 'Unlimited Scheduling', 'Unlimited Catalog', 'API Integration']}
            />
            </SimpleGrid>
        </Container>
      </Box>

      {/* Footer */}
      <Box bg={useColorModeValue('gray.900', 'black')} color="white" py={12}>
        <Container maxW="container.xl">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
            <VStack align="start">
                <HStack>
                    <Icon as={FaRobot} color={brandColor} />
                    <Heading size="md">CalangoBot</Heading>
                </HStack>
                <Text color="gray.400" fontSize="sm">
                    Automate your WhatsApp Service with AI.
                </Text>
            </VStack>
            
            <VStack align="end">
                <Text color="gray.500" fontSize="sm">
                  &copy; {new Date().getFullYear()} CalangoBot. All rights reserved.
                </Text>
            </VStack>
          </SimpleGrid>
        </Container>
      </Box>
    </Box>
  );
};

// --- Helper Components ---

const ChatMessage = ({ isUser, children }) => (
    <Flex justify={isUser ? "flex-end" : "flex-start"}>
        <Box
        bg={isUser ? "#dcf8c6" : "white"}
        color="black"
        p={2}
        px={3}
        borderRadius="lg"
        borderTopRightRadius={isUser ? "0" : "lg"}
        borderTopLeftRadius={isUser ? "lg" : "0"}
        maxW="85%"
        boxShadow="sm"
        >
        <Text fontSize="sm">{children}</Text>
        </Box>
    </Flex>
);

const FeatureCard = ({ icon, title, text }) => {
  return (
    <VStack
      bg={useColorModeValue('gray.50', 'gray.700')}
      p={8}
      borderRadius="xl"
      align="flex-start"
      spacing={4}
      boxShadow="md"
      _hover={{ transform: 'translateY(-5px)', transition: '0.3s' }}
    >
      <Icon as={icon} w={10} h={10} color="brand.500" />
      <Heading size="md">{title}</Heading>
      <Text color="gray.500">{text}</Text>
    </VStack>
  );
};

const PricingCard = ({ title, price, features, highlight }) => {
  const borderColor = highlight ? 'brand.500' : 'transparent';
  const borderWidth = highlight ? '2px' : '1px';
  const scale = highlight ? '1.05' : '1';
  const shadow = highlight ? 'xl' : 'md';

  return (
    <Card
      borderWidth={borderWidth}
      borderColor={borderColor}
      transform={`scale(${scale})`}
      transition="transform 0.2s"
      boxShadow={shadow}
      position="relative"
    >
      {highlight && (
          <Box position="absolute" top="-12px" left="50%" transform="translateX(-50%)" bg="brand.500" color="white" px={3} py={1} borderRadius="full" fontSize="xs" fontWeight="bold">
              BEST VALUE
          </Box>
      )}
      <CardHeader textAlign="center">
        <Heading size="md">{title}</Heading>
        <Heading size="2xl" mt={4}>{price}</Heading>
      </CardHeader>
      <CardBody>
        <List spacing={3}>
          {features.map((feature, index) => (
            <ListItem key={index} display="flex" alignItems="center">
              <ListIcon as={CheckIcon} color="green.500" />
              <Text fontSize="sm">{feature}</Text>
            </ListItem>
          ))}
        </List>
        <Button
          mt={8}
          w="100%"
          colorScheme="brand"
          variant={highlight ? 'solid' : 'outline'}
        >
          Choose {title}
        </Button>
      </CardBody>
    </Card>
  );
};

export default LandingPage;
