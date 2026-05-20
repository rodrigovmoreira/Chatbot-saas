import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChakraProvider } from '@chakra-ui/react';
import { AppProvider } from '../context/AppContext';
import Login from './Login';
import { authAPI } from '../services/api';

// Mock authAPI
jest.mock('../services/api', () => ({
  authAPI: {
    login: jest.fn(),
    register: jest.fn(),
  },
}));

// Mock window.location.href
const mockLocation = new URL('http://localhost');
delete window.location;
window.location = mockLocation;

const renderWithProviders = (component) => {
  return render(
    <ChakraProvider>
      <AppProvider>
        {component}
      </AppProvider>
    </ChakraProvider>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders login form correctly', () => {
    renderWithProviders(<Login />);
    
    // Check if essential fields are rendered (using getAll because of login and register tabs)
    expect(screen.getAllByPlaceholderText('seu@email.com')[0]).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Sua senha')[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
  });

  test('successful login updates localStorage and redirects', async () => {
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
    const mockToken = 'fake-token-123';
    
    authAPI.login.mockResolvedValueOnce({
      data: { token: mockToken, user: mockUser }
    });

    renderWithProviders(<Login />);

    // Fill out the form
    fireEvent.change(screen.getAllByPlaceholderText('seu@email.com')[0], { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getAllByPlaceholderText('Sua senha')[0], { target: { value: 'password123' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    // Wait for the async API call to complete
    await waitFor(() => {
      expect(authAPI.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    // Verify localStorage was updated
    expect(localStorage.getItem('token')).toBe(mockToken);
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(mockUser);

    // Verify redirection
    expect(window.location.pathname).toBe('/dashboard');
  });

  test('failed login displays error message', async () => {
    const errorMessage = 'Credenciais inválidas';
    authAPI.login.mockRejectedValueOnce({
      response: { data: { message: errorMessage } }
    });

    renderWithProviders(<Login />);

    // Fill out the form
    fireEvent.change(screen.getAllByPlaceholderText('seu@email.com')[0], { target: { value: 'wrong@example.com' } });
    fireEvent.change(screen.getAllByPlaceholderText('Sua senha')[0], { target: { value: 'wrongpass' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    // Wait for the async API call to complete and the error to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Ensure localStorage is still empty
    expect(localStorage.getItem('token')).toBeNull();
  });
});
