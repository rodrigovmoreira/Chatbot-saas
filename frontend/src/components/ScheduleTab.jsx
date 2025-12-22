import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  Box, Button, Modal, ModalOverlay, ModalContent, ModalHeader, 
  ModalFooter, ModalBody, ModalCloseButton, FormControl, FormLabel, 
  Input, Select, useDisclosure, useToast, VStack, HStack, Text, IconButton
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { businessAPI } from '../services/api';

// Configura o Moment para Português
moment.locale('pt-br');
const localizer = momentLocalizer(moment);

const ScheduleTab = () => {
  const [events, setEvents] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Estado do Formulário
  const [newEvent, setNewEvent] = useState({
    title: '',
    clientName: '',
    clientPhone: '',
    start: '',
    end: '',
    type: 'servico'
  });
  
  // Estado para visualização de evento clicado
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await businessAPI.getAppointments();
      // Converte strings de data para Objetos Date (exigência do BigCalendar)
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

  // Ao selecionar um horário vazio no calendário
  const handleSelectSlot = ({ start, end }) => {
    setSelectedEvent(null); // Limpa seleção anterior
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

  // Ao clicar em um evento existente
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
    // Validação simples
    if (!newEvent.title || !newEvent.clientName || !newEvent.clientPhone) {
      toast({ title: 'Preencha todos os campos obrigatórios.', status: 'warning' });
      return;
    }

    try {
      if (selectedEvent) {
        // Lógica de Edição (Se precisar no futuro)
        toast({ title: 'Edição ainda não implementada, delete e crie novamente.', status: 'info' });
      } else {
        // Criação
        await businessAPI.createAppointment(newEvent);
        toast({ title: 'Agendamento criado!', status: 'success' });
      }
      await fetchAppointments();
      onClose();
    } catch (error) {
      toast({ title: 'Erro ao salvar (possível conflito de horário).', description: error.response?.data?.message, status: 'error' });
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

  // Cores por tipo de evento
  const eventStyleGetter = (event) => {
    let backgroundColor = '#3182ce'; // Azul padrão
    if (event.type === 'orcamento') backgroundColor = '#d69e2e'; // Amarelo
    if (event.type === 'servico') backgroundColor = '#38a169'; // Verde
    return { style: { backgroundColor } };
  };

  return (
    <Box h="75vh" bg="white" p={4} borderRadius="md" boxShadow="sm">
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
        messages={{
          next: "Próximo", previous: "Anterior", today: "Hoje",
          month: "Mês", week: "Semana", day: "Dia", agenda: "Lista",
          date: "Data", time: "Hora", event: "Evento", noEventsInRange: "Sem agendamentos neste período."
        }}
        defaultView="week" // Começa vendo a semana
      />

      {/* MODAL DE CRIAÇÃO / DETALHES */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedEvent ? 'Detalhes do Agendamento' : 'Novo Agendamento'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Título / Serviço</FormLabel>
                <Input 
                  placeholder="Ex: Corte de Cabelo" 
                  value={newEvent.title} 
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  isDisabled={!!selectedEvent} // Desabilita edição se for visualização
                />
              </FormControl>
              
              <HStack w="100%">
                <FormControl isRequired>
                  <FormLabel>Nome Cliente</FormLabel>
                  <Input 
                    placeholder="João Silva" 
                    value={newEvent.clientName} 
                    onChange={(e) => setNewEvent({...newEvent, clientName: e.target.value})}
                    isDisabled={!!selectedEvent}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Telefone (Zap)</FormLabel>
                  <Input 
                    placeholder="5511999999999" 
                    value={newEvent.clientPhone} 
                    onChange={(e) => setNewEvent({...newEvent, clientPhone: e.target.value})}
                    isDisabled={!!selectedEvent}
                  />
                </FormControl>
              </HStack>

              <HStack w="100%">
                <FormControl>
                  <FormLabel>Início</FormLabel>
                  <Text fontSize="sm" fontWeight="bold">
                    {moment(newEvent.start).format('DD/MM/YYYY HH:mm')}
                  </Text>
                </FormControl>
                <FormControl>
                   <FormLabel>Fim</FormLabel>
                   <Text fontSize="sm" fontWeight="bold">
                    {moment(newEvent.end).format('HH:mm')}
                   </Text>
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel>Tipo</FormLabel>
                <Select 
                  value={newEvent.type} 
                  onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
                  isDisabled={!!selectedEvent}
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
                Cancelar Agendamento
              </Button>
            ) : (
              <Box></Box> // Espaçador
            )}
            
            <HStack>
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
              {!selectedEvent && (
                <Button colorScheme="blue" onClick={handleSave}>Agendar</Button>
              )}
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ScheduleTab;