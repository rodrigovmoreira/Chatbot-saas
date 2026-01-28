import React, { useEffect, useState } from 'react';
import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Heading,
  Text,
  Flex,
  Icon,
  useColorModeValue,
  Spinner,
  Center
} from '@chakra-ui/react';
import { FaDollarSign, FaUserPlus, FaRegHandshake, FaChartLine } from 'react-icons/fa';
import { dashboardAPI } from '../../services/api';

const StatsCard = ({ title, stat, icon, color }) => {
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const bg = useColorModeValue('white', 'gray.700');
  const iconColor = useColorModeValue('gray.800', 'gray.200');

  return (
    <Stat
      px={{ base: 4, md: 6 }}
      py={'5'}
      shadow={'xl'}
      border={'1px solid'}
      borderColor={borderColor}
      rounded={'lg'}
      bg={bg}
    >
      <Flex justifyContent={'space-between'}>
        <Box pl={{ base: 2, md: 4 }}>
          <StatLabel fontWeight={'medium'} isTruncated>
            {title}
          </StatLabel>
          <StatNumber fontSize={'2xl'} fontWeight={'bold'}>
            {stat}
          </StatNumber>
        </Box>
        <Box
          my={'auto'}
          color={iconColor}
          alignContent={'center'}
        >
          <Icon as={icon} w={8} h={8} color={color} />
        </Box>
      </Flex>
    </Stat>
  );
};

const OverviewTab = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    pipelineValue: 0,
    openDeals: 0,
    newLeadsToday: 0,
    totalSales: 0
  });

  const placeholderBg = useColorModeValue('white', 'gray.700');

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await dashboardAPI.getSummary();
        setData(response.data);
      } catch (error) {
        console.error('Error fetching dashboard summary:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <Center h="50vh">
        <Spinner size="xl" color="brand.500" />
      </Center>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Box maxW="7xl" mx={'auto'} pt={5} px={0}>
      <Heading
        textAlign={'left'}
        fontSize={'3xl'}
        py={10}
        fontWeight={'bold'}
        mb={4}
      >
        Visão Geral
      </Heading>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={{ base: 6, lg: 8 }}>
        <StatsCard
          title={'Pipeline Total'}
          stat={formatCurrency(data.pipelineValue)}
          icon={FaDollarSign}
          color={'blue.400'}
        />
        <StatsCard
          title={'Negócios Abertos'}
          stat={data.openDeals}
          icon={FaRegHandshake}
          color={'orange.400'}
        />
        <StatsCard
          title={'Novos Leads (Hoje)'}
          stat={data.newLeadsToday}
          icon={FaUserPlus}
          color={'green.400'}
        />
        <StatsCard
          title={'Vendas Totais'}
          stat={formatCurrency(data.totalSales)}
          icon={FaChartLine}
          color={'purple.400'}
        />
      </SimpleGrid>

      {/* Placeholder Section */}
      <Box mt={10} p={6} bg={placeholderBg} rounded={'lg'} shadow={'md'}>
        <Heading size="md" mb={4}>Atividade Recente</Heading>
        <Text color="gray.500">Nenhuma atividade recente para exibir.</Text>
      </Box>
    </Box>
  );
};

export default OverviewTab;
