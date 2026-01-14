import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import App from './App';
import theme from './theme';

// Mock getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    value: () => ({
        getPropertyValue: (prop) => {
            return '';
        }
    })
});

// Mock matchMedia
window.matchMedia = window.matchMedia || function() {
    return {
        matches: false,
        addListener: function() {},
        removeListener: function() {}
    };
};

test('renders landing page by default', () => {
  render(
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  );

  const linkElement = screen.getByText(/Evolua seus atendimentos com Inteligência Artificial/i);
  expect(linkElement).toBeInTheDocument();
});
