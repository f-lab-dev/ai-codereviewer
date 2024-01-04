import axios from "axios";
import dotenv from "dotenv";

interface CreateInstanceParams {
    endpoint: string;
    headers: Record<string, string>;
}


export const createInstance = ({endpoint, headers} :CreateInstanceParams)=> {
    return axios.create({
        baseURL: `${process.env.BASE_API_URL}/${endpoint}`,
        headers: {
            ...headers
        }
    })
}