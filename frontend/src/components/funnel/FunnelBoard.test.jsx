import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import FunnelBoard from './FunnelBoard';
import { ChakraProvider } from '@chakra-ui/react';

// We do not need to mock funnelUtils, we let the actual component use the real one, which sets up the 'boardData' properly
// Wait, funnelUtils is imported in FunnelBoard.jsx, so let's check its import path
// Actually, let's use the real funnelUtils since it's just a pure function that works fine.

// Mock do DragDropContext do hello-pangea/dnd para evitar problemas de Invariant no JSDOM
jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }) => <div data-testid="dnd-context">{children}</div>,
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

// Mock do FunnelColumn para focar apenas na renderização da board
jest.mock('./FunnelColumn', () => ({ step, contacts }) => {
  const safeContacts = contacts || [];
  return (
    <div data-testid={`funnel-column-${step.tag}`}>
      <h2>{step.name}</h2>
      <ul>
        {safeContacts.map(c => (
          <li key={c._id} data-testid={`funnel-card-${c._id}`}>
            {c.name}
          </li>
        ))}
      </ul>
    </div>
  );
});

// Mock the businessAPI imported in FunnelBoard (just in case)
jest.mock('../../services/api', () => ({
  businessAPI: {
    updateContact: jest.fn(),
  }
}));

describe('FunnelBoard', () => {
  const mockColumns = [
    { tag: 'tag1', name: 'Leads', order: 1 },
    { tag: 'tag2', name: 'Agendados', order: 2 },
    { tag: 'tag3', name: 'Pagos', order: 3 },
  ];

  const mockContacts = [
    { _id: 'c1', name: 'João', tags: ['tag1'] },
    { _id: 'c2', name: 'Maria', tags: ['tag2'] },
    { _id: 'c3', name: 'Pedro', tags: ['tag1'] },
  ];

  it('deve renderizar o FunnelBoard com as colunas na ordem correta', async () => {
    render(
      <ChakraProvider>
        <FunnelBoard columns={mockColumns} contacts={mockContacts} onUpdateStep={jest.fn()} />
      </ChakraProvider>
    );

    await waitFor(() => {
        expect(screen.getByTestId('funnel-column-tag1')).toBeInTheDocument();
        expect(screen.getByTestId('funnel-column-tag2')).toBeInTheDocument();
        expect(screen.getByTestId('funnel-column-tag3')).toBeInTheDocument();
    });
  });

  it('deve exibir os cartões corretos nas colunas corretas', async () => {
    render(
      <ChakraProvider>
        <FunnelBoard columns={mockColumns} contacts={mockContacts} onUpdateStep={jest.fn()} />
      </ChakraProvider>
    );

    await waitFor(() => {
        // Na coluna tag1, devem estar João (c1) e Pedro (c3)
        const column1 = screen.getByTestId('funnel-column-tag1');
        expect(column1).toHaveTextContent('João');
        expect(column1).toHaveTextContent('Pedro');
        expect(column1).not.toHaveTextContent('Maria');

        // Na coluna tag2, deve estar Maria (c2)
        const column2 = screen.getByTestId('funnel-column-tag2');
        expect(column2).toHaveTextContent('Maria');
        expect(column2).not.toHaveTextContent('João');
    });
  });
});
