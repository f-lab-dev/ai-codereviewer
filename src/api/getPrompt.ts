import { AxiosInstance, AxiosResponse } from "axios"

const END_POINT_URL = '/open-api/prompts/github-code-review'


interface ApiResponse {
  data?: Response;
  success: boolean;
  error: boolean;
}
interface Response {
    prompt: string;
    model: string;
}


export const getPrompt = async (apiClient: AxiosInstance): Promise<Response> => {
    try {
        const response = await apiClient.get<Promise<AxiosResponse<ApiResponse>>, Promise<AxiosResponse<ApiResponse>>>(END_POINT_URL);
        if(!response.data.data) throw new Error('data does not exist')

        const {data} = response.data
        return data;
      }

      catch (error) {
        return Promise.reject(error)
      }
}
