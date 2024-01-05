import { AxiosInstance } from "axios"

const END_POINT_URL = 'f-lab/prompts/github-code-review'

interface Response {
    prompt: string;
    model: string;
}

export const getPrompt = async (apiClient: AxiosInstance): Promise<Response> => {
    try {
        const response = await apiClient.get<Promise<Response>, Promise<Response>>(END_POINT_URL);
        return response;
      }
      
      catch (error) {
        console.error(error);
        return Promise.reject(error)
      }
}