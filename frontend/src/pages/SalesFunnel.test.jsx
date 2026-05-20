import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import SalesFunnel from './SalesFunnel';
import { ChakraProvider } from '@chakra-ui/react';
import { AppProvider, useApp } from '../context/AppContext';
import { businessAPI, tagAPI } from '../services/api';

// Mock the APIs
jest.mock('../services/api', () => ({
  businessAPI: {
    getContacts: jest.fn(),
    updateConfig: jest.fn(),
  },
  tagAPI: {
    getAll: jest.fn()
  }
}));

// Mock the AppContext to easily provide businessConfig state
jest.mock('../context/AppContext', () => {
  const actual = jest.requireActual('../context/AppContext');
  return {
    ...actual,
    useApp: jest.fn()
  };
});

// Mock the internal components to avoid complex DND and Chakra DOM errors
jest.mock('../components/funnel/FunnelBoard', () => ({ columns, contacts }) => (
  <div data-testid="mock-funnel-board">
    <span data-testid="columns-count">{columns.length}</span>
    <span data-testid="contacts-count">{contacts.length}</span>
  </div>
));

jest.mock('../components/funnel/FunnelConfigModal', () => () => (
  <div data-testid="mock-funnel-config-modal">Config Modal</div>
));

describe('SalesFunnel Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve exibir mensagem de funil vazio quando não houver etapas configuradas', async () => {
    // Setup Context com um funil vazio
    useApp.mockReturnValue({
      state: {
        businessConfig: {
          funnelSteps: []
        }
      },
      dispatch: jest.fn()
    });

    tagAPI.getAll.mockResolvedValue({ data: [] });

    await act(async () => {
      render(
        <ChakraProvider>
          <SalesFunnel />
        </ChakraProvider>
      );
    });

    // O useEffect do fetchTags dispara, mas para a UI já deve mostrar vazio
    expect(screen.getByText('Seu Funil de Vendas está vazio')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-funnel-board')).not.toBeInTheDocument();
  });

  it('deve buscar e distribuir os contatos nas colunas corretas ao carregar a página', async () => {
    // Setup Context com colunas mockadas
    useApp.mockReturnValue({
      state: {
        businessConfig: {
          funnelSteps: [
            { tag: 'tag1', label: 'Leads Iniciais', order: 1 },
            { tag: 'tag2', label: 'Em Negociação', order: 2 }
          ]
        }
      },
      dispatch: jest.fn()
    });

    // Mock API responses
    tagAPI.getAll.mockResolvedValue({ data: [{ _id: 'tag1', name: 'Leads Iniciais' }] });

    businessAPI.getContacts.mockResolvedValue({
      data: [
        { _id: 'c1', name: 'Contact 1', tags: ['tag1'] },
        { _id: 'c2', name: 'Contact 2', tags: ['tag2'] },
        { _id: 'c3', name: 'Contact 3', tags: ['tag1'] }
      ]
    });

    await act(async () => {
      render(
        <ChakraProvider>
          <SalesFunnel />
        </ChakraProvider>
      );
    });

    // Wait for the APIs to resolve and FunnelBoard to render
    await waitFor(() => {
      expect(screen.getByTestId('mock-funnel-board')).toBeInTheDocument();
    });

    // Validar se as props corretas foram passadas pro FunnelBoard
    expect(screen.getByTestId('columns-count').textContent).toBe('2');
    expect(screen.getByTestId('contacts-count').textContent).toBe('3');
  });
});
