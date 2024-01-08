import { AxiosInstance, AxiosResponse } from "axios"

const END_POINT_URL = '/open-api/prompts/github-code-review'

interface Response {
    prompt: string;
    model: string;
}

export const getPrompt = async (apiClient: AxiosInstance): Promise<Response> => {
    try {
        const response = await apiClient.get<Promise<AxiosResponse<Response>>, Promise<AxiosResponse<Response>>>(END_POINT_URL);
        console.log(response)
        return response.data;
      }

      catch (error) {
        console.error(error);
        return Promise.reject(error)
      }
}
