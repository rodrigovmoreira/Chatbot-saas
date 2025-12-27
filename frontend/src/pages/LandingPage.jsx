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
} from '@chakra-ui/react';
import { CheckIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';

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
            <Heading size="md" color={brandColor}>
              CalangoBot
            </Heading>
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
            <Button
              size="lg"
              colorScheme="brand"
              onClick={() => navigate('/login')}
              px={8}
            >
              Get Started Now
            </Button>
          </VStack>

          {/* Live Demo Visualization */}
          <Box flex={1} w="100%">
            <Card
              bg={useColorModeValue('#e5ddd5', '#202c33')} // WhatsApp BG color approximation
              borderRadius="xl"
              boxShadow="xl"
              maxW="400px"
              mx="auto"
              overflow="hidden"
            >
              <Box bg={useColorModeValue('#075e54', '#202c33')} p={3} color="white">
                <HStack>
                  <Box w={8} h={8} borderRadius="full" bg="gray.300" />
                  <Text fontWeight="bold">CalangoBot Store</Text>
                </HStack>
              </Box>
              <CardBody p={4} minH="300px" display="flex" flexDirection="column" gap={3}>
                {/* User Message */}
                <Flex justify="flex-end">
                  <Box
                    bg="#dcf8c6"
                    color="black"
                    p={2}
                    borderRadius="lg"
                    borderTopRightRadius="0"
                    maxW="80%"
                  >
                    <Text fontSize="sm">Do you have the green sneakers in size 42?</Text>
                  </Box>
                </Flex>

                {/* Bot Response - Image */}
                <Flex justify="flex-start">
                  <Box
                    bg="white"
                    color="black"
                    p={2}
                    borderRadius="lg"
                    borderTopLeftRadius="0"
                    maxW="80%"
                  >
                    <Box
                      h="150px"
                      w="100%"
                      bg="gray.200"
                      borderRadius="md"
                      mb={2}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="4xl">👟</Text>
                    </Box>
                    <Text fontSize="sm">Yes! We have the Emerald Runners in stock. Here is a photo.</Text>
                  </Box>
                </Flex>

                 {/* User Message */}
                 <Flex justify="flex-end">
                  <Box
                    bg="#dcf8c6"
                    color="black"
                    p={2}
                    borderRadius="lg"
                    borderTopRightRadius="0"
                    maxW="80%"
                  >
                    <Text fontSize="sm">Great! Can I schedule a pickup for tomorrow at 2PM?</Text>
                  </Box>
                </Flex>

                {/* Bot Response - Confirmation */}
                <Flex justify="flex-start">
                  <Box
                    bg="white"
                    color="black"
                    p={2}
                    borderRadius="lg"
                    borderTopLeftRadius="0"
                    maxW="80%"
                  >
                     <Text fontSize="sm">✅ Appointment confirmed for tomorrow at 2:00 PM. See you then!</Text>
                  </Box>
                </Flex>
              </CardBody>
            </Card>
          </Box>
        </Stack>
      </Container>

      {/* Features Grid */}
      <Box bg={useColorModeValue('white', 'gray.800')} py={20}>
        <Container maxW="container.xl">
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
            <FeatureCard
              icon="🤖"
              title="AI Brain"
              text="Understands context and images to answer customer queries instantly."
            />
            <FeatureCard
              icon="📅"
              title="Auto Scheduling"
              text="Integrated calendar management so you never miss an appointment."
            />
            <FeatureCard
              icon="📸"
              title="Visual Catalog"
              text="Sends product photos automatically when customers ask for them."
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Container maxW="container.xl" py={20}>
        <VStack spacing={4} mb={10}>
          <Heading textAlign="center">Simple Pricing</Heading>
          <Text color="gray.500" fontSize="lg">Choose the plan that fits your business</Text>
        </VStack>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
          <PricingCard
            title="Starter"
            price="Free"
            features={['Basic AI Responses', 'Manual Scheduling', '5 Products in Catalog']}
          />
          <PricingCard
            title="Pro"
            price="$29/mo"
            highlight
            features={['Advanced Context AI', 'Auto-Scheduling', '50 Products in Catalog', 'Priority Support']}
          />
          <PricingCard
            title="Business"
            price="$99/mo"
            features={['Custom AI Training', 'Unlimited Scheduling', 'Unlimited Catalog', 'API Access']}
          />
        </SimpleGrid>
      </Container>

      {/* Footer */}
      <Box bg={useColorModeValue('gray.100', 'gray.900')} py={10}>
        <Container maxW="container.xl">
          <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align="center">
            <Text>&copy; {new Date().getFullYear()} CalangoBot. All rights reserved.</Text>
            <Stack direction="row" spacing={6} mt={{ base: 4, md: 0 }}>
              <Button variant="link">Privacy</Button>
              <Button variant="link">Terms</Button>
              <Button variant="link">Contact</Button>
            </Stack>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
};

const FeatureCard = ({ icon, title, text }) => {
  return (
    <VStack
      bg={useColorModeValue('gray.50', 'gray.700')}
      p={8}
      borderRadius="xl"
      align="flex-start"
      spacing={4}
      boxShadow="md"
    >
      <Text fontSize="4xl">{icon}</Text>
      <Heading size="md">{title}</Heading>
      <Text color="gray.500">{text}</Text>
    </VStack>
  );
};

const PricingCard = ({ title, price, features, highlight }) => {
  const borderColor = highlight ? 'brand.500' : 'transparent';
  const borderWidth = highlight ? '2px' : '0';
  const scale = highlight ? '1.05' : '1';

  return (
    <Card
      borderWidth={borderWidth}
      borderColor={borderColor}
      transform={`scale(${scale})`}
      transition="transform 0.2s"
      boxShadow="lg"
    >
      <CardHeader>
        <Heading size="md">{title}</Heading>
        <Heading size="2xl" mt={4}>{price}</Heading>
      </CardHeader>
      <CardBody>
        <List spacing={3}>
          {features.map((feature, index) => (
            <ListItem key={index}>
              <ListIcon as={CheckIcon} color="green.500" />
              {feature}
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
