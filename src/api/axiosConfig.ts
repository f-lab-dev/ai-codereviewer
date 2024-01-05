import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

interface CreateInstanceParams {
    customKey: string;
}

console.log(process.env)

const HEADER_KEY = process.env.CUSTOM_HEADER_KEY;

if(!HEADER_KEY) {
    throw new Error('Required Key is missing')
}

export const createInstance = ({ customKey} :CreateInstanceParams)=> {
    return axios.create({
        baseURL: process.env.BASE_API_URL,
        headers: {
            [HEADER_KEY]: customKey
        }
    })
}
