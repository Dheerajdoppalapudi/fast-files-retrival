// src/controllers/authController.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { AppDataSource } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required',
      });
    }

    const userRepository = new UserRepository();
    const user = await userRepository.findByEmail(email);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    const isPasswordValid = await userRepository.verifyPassword(user, password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });

    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      tokens:{
        access:token
      },
      user: userRepository.toResponse(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body as RegisterRequest;

    if (!username || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, email, and password are required',
      });
    }

    const userRepository = new UserRepository();
    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'User already exists',
      });
    }

    const newUser = await userRepository.createWithHashedPassword({
      username,
      email,
      password,
      role: 'user',
    });

    const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '24h' });

    return res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      tokens:{
        access:token
      },
      user: userRepository.toResponse(newUser),
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
};