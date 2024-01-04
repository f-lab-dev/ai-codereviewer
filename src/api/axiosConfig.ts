import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

interface Headers {
    [key: string]: string;
}

interface CreateInstanceParams {
    endpoint: string;
    headers: Headers;
}


export const createInstance = ({endpoint, headers} :CreateInstanceParams)=> {
    return axios.create({
        baseURL: `${process.env.BASE_API_URL}/${endpoint}`,
        headers: {
            ...headers
        }
    })
}