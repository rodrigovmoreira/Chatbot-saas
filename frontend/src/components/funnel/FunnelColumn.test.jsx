import React from 'react';
import { render, screen } from '@testing-library/react';
import FunnelColumn from './FunnelColumn';
import { ChakraProvider } from '@chakra-ui/react';

// Mock do @hello-pangea/dnd
jest.mock('@hello-pangea/dnd', () => ({
  Droppable: ({ children }) => children({
    innerRef: jest.fn(),
    droppableProps: {},
    placeholder: null
  }, {}),
  Draggable: ({ children }) => children({
    innerRef: jest.fn(),
    draggableProps: {},
    dragHandleProps: {}
  }, { isDragging: false })
}));

// Mock do FunnelCard
jest.mock('./FunnelCard', () => ({ contact }) => (
  <div data-testid={`funnel-card-${contact._id}`}>
    {contact.name}
  </div>
));

describe('FunnelColumn', () => {
  const mockStep = {
    tag: 'tag1',
    label: 'Leads Iniciais',
    prompt: 'Algum prompt aqui'
  };

  const mockContacts = [
    { _id: '1', name: 'Ana Silva' },
    { _id: '2', name: 'Rui Costa' }
  ];

  it('deve renderizar o título da coluna corretamente', () => {
    render(
      <ChakraProvider>
        <FunnelColumn droppableId="tag1" step={mockStep} contacts={[]} onUpdateStep={jest.fn()} />
      </ChakraProvider>
    );

    expect(screen.getByText('Leads Iniciais')).toBeInTheDocument();
  });

  it('deve renderizar os FunnelCards corretos para os contatos fornecidos', () => {
    render(
      <ChakraProvider>
        <FunnelColumn droppableId="tag1" step={mockStep} contacts={mockContacts} onUpdateStep={jest.fn()} />
      </ChakraProvider>
    );

    expect(screen.getByTestId('funnel-card-1')).toHaveTextContent('Ana Silva');
    expect(screen.getByTestId('funnel-card-2')).toHaveTextContent('Rui Costa');
  });

  it('deve mostrar a contagem de contatos ao lado do título', () => {
    render(
      <ChakraProvider>
        <FunnelColumn droppableId="tag1" step={mockStep} contacts={mockContacts} onUpdateStep={jest.fn()} />
      </ChakraProvider>
    );

    // A contagem está no Badge, que tem o número direto
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
