import axios from 'axios';
import { url } from '../utils/Utils';

export interface AuthMeResponse {
  email: string;
  role: string;
}

export const fetchUserRole = async (accessToken: string): Promise<AuthMeResponse> => {
  const response = await axios.get(`${url()}/auth/login`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.data?.status !== 'Success') {
    throw new Error(response.data?.message || 'Failed to fetch role');
  }
  return response.data.data as AuthMeResponse;
};
