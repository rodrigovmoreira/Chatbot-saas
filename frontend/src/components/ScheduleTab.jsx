import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  Box, Button, Modal, ModalOverlay, ModalContent, ModalHeader, 
  ModalFooter, ModalBody, ModalCloseButton, FormControl, FormLabel, 
  Input, Select, useDisclosure, useToast, VStack, HStack, Text, useColorModeValue
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { businessAPI } from '../services/api';
import { useApp } from '../context/AppContext';

// Configura o Moment para Português
moment.locale('pt-br');
const localizer = momentLocalizer(moment);

const ScheduleTab = () => {
  const { state } = useApp();
  const [events, setEvents] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const [view, setView] = useState('week');
  const [date, setDate] = useState(new Date());

  const [newEvent, setNewEvent] = useState({
    title: '',
    clientName: '',
    clientPhone: '',
    start: '',
    end: '',
    type: 'servico'
  });
  
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await businessAPI.getAppointments();
      const formattedEvents = res.data.map(evt => ({
        ...evt,
        start: new Date(evt.start),
        end: new Date(evt.end),
        title: `${evt.title} - ${evt.clientName}`
      }));
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Erro ao buscar agenda:", error);
    }
  };

  const formatForInput = (dateObj) => {
    return moment(dateObj).format('YYYY-MM-DDTHH:mm');
  };

  const isWithinOperatingHours = (start, end) => {
    if (!state.businessConfig?.operatingHours) return true;

    const { opening, closing } = state.businessConfig.operatingHours;
    
    const openHour = parseInt(opening.split(':')[0]);
    const closeHour = parseInt(closing.split(':')[0]);
    const openMin = parseInt(opening.split(':')[1] || 0);
    const closeMin = parseInt(closing.split(':')[1] || 0);

    const startH = new Date(start).getHours();
    const startM = new Date(start).getMinutes();
    const endH = new Date(end).getHours();
    const endM = new Date(end).getMinutes();

    if (startH < openHour || (startH === openHour && startM < openMin)) return false;
    if (endH > closeHour || (endH === closeHour && endM > closeMin)) return false;
    
    return true;
  };

  const handleSelectSlot = ({ start, end }) => {
    setSelectedEvent(null);
    setNewEvent({
      ...newEvent,
      start: start,
      end: end,
      title: '',
      clientName: '',
      clientPhone: ''
    });
    onOpen();
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setNewEvent({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end)
    });
    onOpen();
  };

  const handleSave = async () => {
    if (!newEvent.title || !newEvent.clientName || !newEvent.clientPhone) {
      toast({ title: 'Preencha título, nome e telefone.', status: 'warning' });
      return;
    }

    if (!isWithinOperatingHours(newEvent.start, newEvent.end)) {
      const { opening, closing } = state.businessConfig?.operatingHours || { opening: '?', closing: '?' };
      toast({ 
        title: 'Fora do horário de funcionamento!', 
        description: `A empresa funciona das ${opening} às ${closing}.`, 
        status: 'error',
        duration: 5000
      });
      return;
    }

    try {
      if (selectedEvent) {
        await businessAPI.deleteAppointment(selectedEvent._id);
      }
      
      await businessAPI.createAppointment(newEvent);
      toast({ title: selectedEvent ? 'Agendamento atualizado!' : 'Agendamento criado!', status: 'success' });
      
      await fetchAppointments();
      onClose();
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.response?.data?.message || 'Conflito de horário.', status: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!window.confirm(`Cancelar agendamento de ${selectedEvent.clientName}?`)) return;

    try {
      await businessAPI.deleteAppointment(selectedEvent._id);
      toast({ title: 'Agendamento cancelado.', status: 'success' });
      await fetchAppointments();
      onClose();
    } catch (error) {
      toast({ title: 'Erro ao cancelar.', status: 'error' });
    }
  };

  const eventStyleGetter = (event) => {
    let backgroundColor = '#3182ce'; 
    if (event.type === 'orcamento') backgroundColor = '#d69e2e';
    if (event.type === 'servico') backgroundColor = '#38a169';
    return { style: { backgroundColor } };
  };

  const bg = useColorModeValue('white', 'gray.800');

  // Custom Styles for Dark Mode Support in React Big Calendar
  const calendarSx = {
    '.rbc-calendar': {
      color: useColorModeValue('gray.800', 'gray.200'),
    },
    '.rbc-off-range-bg': {
      bg: useColorModeValue('gray.100', 'gray.700'),
    },
    '.rbc-today': {
      bg: useColorModeValue('blue.50', 'whiteAlpha.100'),
    },
    '.rbc-header': {
      borderColor: useColorModeValue('gray.200', 'gray.600'),
    },
    '.rbc-time-view': {
      borderColor: useColorModeValue('gray.200', 'gray.600'),
    },
    '.rbc-time-content': {
      borderTopColor: useColorModeValue('gray.200', 'gray.600'),
    },
    '.rbc-timeslot-group': {
      borderBottomColor: useColorModeValue('gray.200', 'gray.600'),
    },
    '.rbc-day-slot': {
      borderLeftColor: useColorModeValue('gray.200', 'gray.600'),
    },
    '.rbc-time-header-content': {
      borderLeftColor: useColorModeValue('gray.200', 'gray.600'),
    },
    '.rbc-time-gutter': {
      borderRightColor: useColorModeValue('gray.200', 'gray.600'),
    },
    '.rbc-day-bg': {
      borderColor: useColorModeValue('gray.200', 'gray.600'),
    },
    '.rbc-toolbar button': {
      color: useColorModeValue('gray.600', 'gray.200'),
      borderColor: useColorModeValue('gray.300', 'gray.600'),
      _hover: {
        bg: useColorModeValue('gray.100', 'gray.700'),
      },
      _active: {
        bg: useColorModeValue('gray.200', 'gray.600'),
      }
    },
    '.rbc-toolbar button.rbc-active': {
      bg: useColorModeValue('brand.500', 'brand.200'),
      color: useColorModeValue('white', 'gray.900'),
      borderColor: useColorModeValue('brand.500', 'brand.200'),
    }
  };

  return (
    <Box h="75vh" bg={bg} p={4} borderRadius="md" boxShadow="sm" sx={calendarSx}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        selectable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}

        messages={{
          next: "Próximo", previous: "Anterior", today: "Hoje",
          month: "Mês", week: "Semana", day: "Dia", agenda: "Lista",
          date: "Data", time: "Hora", event: "Evento", noEventsInRange: "Sem agendamentos."
        }}
      />

      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedEvent ? 'Editar Agendamento' : 'Novo Agendamento'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Título / Serviço</FormLabel>
                <Input 
                  placeholder="Digite aqui o título ou serviço" 
                  value={newEvent.title} 
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                />
              </FormControl>
              
              <HStack w="100%">
                <FormControl isRequired>
                  <FormLabel>Nome Cliente</FormLabel>
                  <Input 
                    placeholder="João Silva" 
                    value={newEvent.clientName} 
                    onChange={(e) => setNewEvent({...newEvent, clientName: e.target.value})}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Telefone</FormLabel>
                  <Input 
                    placeholder="11999999999" 
                    value={newEvent.clientPhone} 
                    onChange={(e) => setNewEvent({...newEvent, clientPhone: e.target.value})}
                  />
                </FormControl>
              </HStack>

              <HStack w="100%">
                <FormControl isRequired>
                  <FormLabel>Início</FormLabel>
                  <Input 
                    type="datetime-local"
                    value={formatForInput(newEvent.start)}
                    onChange={(e) => setNewEvent({...newEvent, start: new Date(e.target.value)})}
                  />
                </FormControl>
                <FormControl isRequired>
                   <FormLabel>Fim</FormLabel>
                   <Input 
                    type="datetime-local"
                    value={formatForInput(newEvent.end)}
                    onChange={(e) => setNewEvent({...newEvent, end: new Date(e.target.value)})}
                  />
                </FormControl>
              </HStack>

              {/* CORREÇÃO AQUI: Substituído FormHelperText por Text */}
              {state.businessConfig?.operatingHours && (
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Horário de funcionamento: {state.businessConfig.operatingHours.opening} às {state.businessConfig.operatingHours.closing}
                </Text>
              )}

              <FormControl>
                <FormLabel>Tipo</FormLabel>
                <Select 
                  value={newEvent.type} 
                  onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
                >
                  <option value="servico">Prestação de Serviço</option>
                  <option value="orcamento">Orçamento / Avaliação</option>
                  <option value="retorno">Retorno</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter justifyContent="space-between">
            {selectedEvent ? (
              <Button colorScheme="red" leftIcon={<DeleteIcon />} onClick={handleDelete}>
                Cancelar
              </Button>
            ) : (
              <Box></Box>
            )}
            
            <HStack>
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
              <Button colorScheme="blue" onClick={handleSave}>Salvar</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ScheduleTab;