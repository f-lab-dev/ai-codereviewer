import { AxiosInstance } from "axios"

const END_POINT_URL = 'f-lab/prompts/github-code-review'

export const getPrompt = async (apiClient: AxiosInstance) => {
    try {
        const response = await apiClient.get(END_POINT_URL);
        console.log(response.data);
        return response.data;
      }
      catch (error) {
        console.error(error);
      }
}