import axios from 'axios'
import { API_BASE_URL } from '../config'

const API_URL = `${API_BASE_URL}/api/auth`

export const register = async (firstName, lastName, email, password) => {
  const response = await axios.post(`${API_URL}/register`, {
    firstName,
    lastName,
    email,
    password
  })
  return response.data
}

export const login = async (email, password) => {
  const response = await axios.post(`${API_URL}/login`, {
    email,
    password
  })

  if (response.data.token) {
    localStorage.setItem('token', response.data.token)
  }

  return response.data
}

export const logout = () => {
  localStorage.removeItem('token')
}

export const getToken = () => {
  return localStorage.getItem('token')
}

export const isLoggedIn = () => {
  return !!localStorage.getItem('token')
}
