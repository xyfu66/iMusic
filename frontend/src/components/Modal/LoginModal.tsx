import React, { useState } from 'react';
import { login } from '../../services/AuthService';
import Modal from './Modal';
import { useUserState } from '../../state/userState';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userState, setUserState] = useUserState();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await login(email, password);
      if (response.success) {
        const { userId, username, token, roles, permissions } = response.data;
        localStorage.setItem('token', token);
        setUserState({
          userId,
          username,
          token,
          roles,
          permissions,
          isLoggedIn: true,
        });
        onClose();
      } else {
        alert('Login failed');
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('Login failed. Please try again.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Login">
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-2 border rounded mb-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-2 border rounded mb-2"
        />
        <button type="submit" className="w-full bg-green-500 text-white px-4 py-2 rounded">
          Login
        </button>
      </form>
    </Modal>
  );
};

export default LoginModal;